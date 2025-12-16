import { Store } from 'express-session';

import { Session } from '../../entities';

import type { EntityManager } from '@mikro-orm/core';
import type { SessionData } from 'express-session';

/**
 * UUID v4 validation regex
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID v4
 */
function isValidUuid(sid: string): boolean {
  return UUID_REGEX.test(sid);
}

/**
 * Configuration options for the MikroORM session store
 */
export interface MikroOrmStoreOptions {
  /** Entity manager instance */
  em: EntityManager;
  /** Enable lazy cleanup of expired sessions on get (default: true) */
  lazyCleanup?: boolean;
  /** Cleanup expired sessions on initialization (default: true) */
  cleanupOnInit?: boolean;
  /** Interval for batch cleanup in milliseconds (default: 15 minutes, 0 to disable) */
  cleanupInterval?: number;
}

/**
 * Custom express-session store using MikroORM and PostgreSQL.
 * Implements lazy cleanup for expired sessions since PostgreSQL
 * doesn't have TTL indexes like MongoDB.
 *
 * Note: This store manages the low-level session data storage.
 * User and company associations are managed at a higher level
 * (in AuthService) after the session is created.
 */
export class MikroOrmStore extends Store {
  private readonly em: EntityManager;
  private readonly lazyCleanup: boolean;
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(options: MikroOrmStoreOptions) {
    super();
    this.em = options.em;
    this.lazyCleanup = options.lazyCleanup ?? true;

    // Run initial cleanup if enabled
    if (options.cleanupOnInit ?? true) {
      void this.cleanupExpiredSessions();
    }

    // Setup periodic cleanup if interval is set
    const interval = options.cleanupInterval ?? 15 * 60 * 1000; // 15 minutes
    if (interval > 0) {
      this.cleanupIntervalId = setInterval(() => {
        void this.cleanupExpiredSessions();
      }, interval);
    }
  }

  /**
   * Get a session by session ID
   */
  get = (
    sid: string,
    callback: (err: unknown, session?: SessionData | null) => void,
  ): void => {
    void this.getAsync(sid)
      .then(session => callback(null, session))
      .catch((err: unknown) => callback(err));
  };

  /**
   * Async implementation of get
   */
  private async getAsync(sid: string): Promise<SessionData | null> {
    // Skip invalid UUIDs - treat as session not found
    // This handles old non-UUID session IDs gracefully
    if (!isValidUuid(sid)) {
      return null;
    }

    const em = this.em.fork();

    try {
      const session = await em.findOne(Session, { sid });

      if (!session) {
        return null;
      }

      // Lazy cleanup: delete if expired
      const now = new Date();
      if (session.expiresAt < now || session.absoluteExpiresAt < now) {
        if (this.lazyCleanup) {
          await em.removeAndFlush(session);
        }
        return null;
      }

      // Update last activity
      session.lastActivityAt = now;
      await em.flush();

      return session.data as unknown as SessionData;
    } catch {
      // Handle any database errors (e.g., invalid UUID format)
      // Treat as session not found
      return null;
    }
  }

  /**
   * Set/update a session
   */
  set = (
    sid: string,
    session: SessionData,
    callback?: (err?: unknown) => void,
  ): void => {
    void this.setAsync(sid, session)
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  };

  /**
   * Async implementation of set
   */
  private async setAsync(sid: string, sessionData: SessionData): Promise<void> {
    // Skip invalid UUIDs - cannot store sessions with non-UUID IDs
    if (!isValidUuid(sid)) {
      console.error(
        `[MikroOrmStore] Attempted to set session with invalid UUID: ${sid}`,
      );
      return;
    }

    const em = this.em.fork();

    try {
      const session = await em.findOne(Session, { sid });

      if (session) {
        // Update existing session
        session.data = sessionData as unknown as Record<string, unknown>;
        if (sessionData.cookie.expires) {
          session.expiresAt = new Date(sessionData.cookie.expires);
        }
        session.lastActivityAt = new Date();
      } else {
        // For new sessions created via express-session,
        // we only store the basic session data.
        // User/company/source will be set by AuthService during login.
        const now = new Date();
        const slidingExpiry = sessionData.cookie.expires
          ? new Date(sessionData.cookie.expires)
          : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days default

        // Absolute expiry is 30 days from creation
        const absoluteExpiry = new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000,
        );

        const newSession = new Session();
        newSession.sid = sid;
        newSession.data = sessionData as unknown as Record<string, unknown>;
        newSession.expiresAt = slidingExpiry;
        newSession.absoluteExpiresAt = absoluteExpiry;
        newSession.createdAt = now;
        newSession.lastActivityAt = now;
        newSession.mfaVerified = false;

        em.persist(newSession);
      }

      await em.flush();
    } catch (err) {
      throw err;
    }
  }

  /**
   * Destroy a session
   */
  destroy = (sid: string, callback?: (err?: unknown) => void): void => {
    void this.destroyAsync(sid)
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  };

  /**
   * Async implementation of destroy
   */
  private async destroyAsync(sid: string): Promise<void> {
    // Skip invalid UUIDs
    if (!isValidUuid(sid)) {
      return;
    }

    const em = this.em.fork();
    await em.nativeDelete(Session, { sid });
  }

  /**
   * Touch a session to update expiration without changing data
   */
  override touch = (
    sid: string,
    session: SessionData,
    callback?: (err?: unknown) => void,
  ): void => {
    void this.touchAsync(sid, session)
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  };

  /**
   * Async implementation of touch
   */
  private async touchAsync(
    sid: string,
    sessionData: SessionData,
  ): Promise<void> {
    // Skip invalid UUIDs
    if (!isValidUuid(sid)) {
      return;
    }

    const em = this.em.fork();

    const session = await em.findOne(Session, { sid });
    if (!session) return;

    // Update sliding expiration (but not beyond absolute expiration)
    if (sessionData.cookie.expires) {
      const newExpiry = new Date(sessionData.cookie.expires);
      session.expiresAt =
        newExpiry < session.absoluteExpiresAt
          ? newExpiry
          : session.absoluteExpiresAt;
    }

    session.lastActivityAt = new Date();
    await em.flush();
  }

  /**
   * Get the count of all active sessions
   */
  override length = (
    callback: (err: unknown, length?: number) => void,
  ): void => {
    void this.lengthAsync()
      .then(length => callback(null, length))
      .catch((err: unknown) => callback(err));
  };

  /**
   * Async implementation of length
   */
  private async lengthAsync(): Promise<number> {
    const em = this.em.fork();
    return await em.count(Session, {
      expiresAt: { $gt: new Date() },
      absoluteExpiresAt: { $gt: new Date() },
    });
  }

  /**
   * Clear all sessions
   */
  override clear = (callback?: (err?: unknown) => void): void => {
    void this.clearAsync()
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  };

  /**
   * Async implementation of clear
   */
  private async clearAsync(): Promise<void> {
    const em = this.em.fork();
    await em.nativeDelete(Session, {});
  }

  /**
   * Get all sessions (optional, for debugging)
   */
  override all = (
    callback: (
      err: unknown,
      sessions?: { [sid: string]: SessionData } | null,
    ) => void,
  ): void => {
    void this.allAsync()
      .then(sessions => callback(null, sessions))
      .catch((err: unknown) => callback(err));
  };

  /**
   * Async implementation of all
   */
  private async allAsync(): Promise<{ [sid: string]: SessionData }> {
    const em = this.em.fork();
    const now = new Date();
    const sessions = await em.find(Session, {
      expiresAt: { $gt: now },
      absoluteExpiresAt: { $gt: now },
    });

    const result: { [sid: string]: SessionData } = {};
    for (const session of sessions) {
      result[session.sid] = session.data as unknown as SessionData;
    }
    return result;
  }

  /**
   * Cleanup expired sessions (batch operation)
   * @returns Number of sessions deleted
   */
  async cleanupExpiredSessions(): Promise<number> {
    const em = this.em.fork();
    const now = new Date();

    const result = await em.nativeDelete(Session, {
      $or: [{ expiresAt: { $lt: now } }, { absoluteExpiresAt: { $lt: now } }],
    });

    return result;
  }

  /**
   * Stop the cleanup interval (call on server shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }
}
