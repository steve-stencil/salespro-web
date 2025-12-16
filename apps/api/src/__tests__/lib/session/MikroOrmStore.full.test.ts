import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MikroOrmStore } from '../../../lib/session/MikroOrmStore';

import type { EntityManager } from '@mikro-orm/core';
import type { SessionData } from 'express-session';

// Test session ID must be a valid UUID (MikroOrmStore validates UUIDs)
const TEST_SESSION_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const NEW_SESSION_ID = 'a47ac10b-58cc-4372-a567-0e02b2c3d480';

// Helper to create session data
function createSessionData(overrides: Partial<SessionData> = {}): SessionData {
  return {
    cookie: {
      originalMaxAge: 86400000,
      expires: new Date(Date.now() + 86400000),
      httpOnly: true,
      path: '/',
    },
    ...overrides,
  } as SessionData;
}

// Helper to create mock session entity
function createMockSessionEntity(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    sid: TEST_SESSION_ID,
    data: {},
    expiresAt: new Date(now.getTime() + 86400000),
    absoluteExpiresAt: new Date(now.getTime() + 86400000 * 30),
    lastActivityAt: now,
    createdAt: now,
    mfaVerified: false,
    ...overrides,
  };
}

// Promisify callback-based store methods
/**
 * Convert error to Error instance for rejection
 */
function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : JSON.stringify(err));
}

function promisifyGet(
  store: MikroOrmStore,
  sid: string,
): Promise<SessionData | null | undefined> {
  return new Promise((resolve, reject) => {
    store.get(sid, (err, session) => {
      if (err) reject(toError(err));
      else resolve(session);
    });
  });
}

function promisifySet(
  store: MikroOrmStore,
  sid: string,
  session: SessionData,
): Promise<void> {
  return new Promise((resolve, reject) => {
    store.set(sid, session, err => {
      if (err) reject(toError(err));
      else resolve();
    });
  });
}

function promisifyDestroy(store: MikroOrmStore, sid: string): Promise<void> {
  return new Promise((resolve, reject) => {
    store.destroy(sid, err => {
      if (err) reject(toError(err));
      else resolve();
    });
  });
}

function promisifyTouch(
  store: MikroOrmStore,
  sid: string,
  session: SessionData,
): Promise<void> {
  return new Promise((resolve, reject) => {
    store.touch(sid, session, err => {
      if (err) reject(toError(err));
      else resolve();
    });
  });
}

function promisifyLength(store: MikroOrmStore): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    store.length((err, length) => {
      if (err) reject(toError(err));
      else resolve(length);
    });
  });
}

function promisifyClear(store: MikroOrmStore): Promise<void> {
  return new Promise((resolve, reject) => {
    store.clear(err => {
      if (err) reject(toError(err));
      else resolve();
    });
  });
}

function promisifyAll(
  store: MikroOrmStore,
): Promise<{ [sid: string]: SessionData } | null | undefined> {
  return new Promise((resolve, reject) => {
    store.all((err, sessions) => {
      if (err) reject(toError(err));
      else resolve(sessions);
    });
  });
}

describe('MikroOrmStore (Full)', () => {
  let store: MikroOrmStore;
  let mockEm: {
    fork: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    persist: ReturnType<typeof vi.fn>;
    flush: ReturnType<typeof vi.fn>;
    removeAndFlush: ReturnType<typeof vi.fn>;
    nativeDelete: ReturnType<typeof vi.fn>;
  };
  let forkedEm: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    persist: ReturnType<typeof vi.fn>;
    flush: ReturnType<typeof vi.fn>;
    removeAndFlush: ReturnType<typeof vi.fn>;
    nativeDelete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();

    forkedEm = {
      findOne: vi.fn(),
      find: vi.fn(),
      count: vi.fn(),
      persist: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      removeAndFlush: vi.fn().mockResolvedValue(undefined),
      nativeDelete: vi.fn().mockResolvedValue(0),
    };

    mockEm = {
      ...forkedEm,
      fork: vi.fn().mockReturnValue(forkedEm),
    };

    store = new MikroOrmStore({
      em: mockEm as unknown as EntityManager,
      cleanupOnInit: false,
      cleanupInterval: 0, // Disable periodic cleanup for tests
    });
  });

  afterEach(() => {
    store.stopCleanup();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should run initial cleanup when cleanupOnInit is true', () => {
      const em = {
        fork: vi.fn().mockReturnValue({
          nativeDelete: vi.fn().mockResolvedValue(0),
        }),
      };

      new MikroOrmStore({
        em: em as unknown as EntityManager,
        cleanupOnInit: true,
        cleanupInterval: 0,
      });

      expect(em.fork).toHaveBeenCalled();
    });

    it('should setup periodic cleanup when interval is set', () => {
      const em = {
        fork: vi.fn().mockReturnValue({
          nativeDelete: vi.fn().mockResolvedValue(0),
        }),
      };

      const testStore = new MikroOrmStore({
        em: em as unknown as EntityManager,
        cleanupOnInit: false,
        cleanupInterval: 60000, // 1 minute
      });

      // Advance timers and check cleanup was called
      vi.advanceTimersByTime(60000);
      expect(em.fork).toHaveBeenCalled();

      testStore.stopCleanup();
    });

    it('should use default options when not specified', () => {
      const em = {
        fork: vi.fn().mockReturnValue({
          nativeDelete: vi.fn().mockResolvedValue(0),
        }),
      };

      const testStore = new MikroOrmStore({
        em: em as unknown as EntityManager,
      });

      // Should have started cleanup
      expect(em.fork).toHaveBeenCalled();

      testStore.stopCleanup();
    });
  });

  describe('get', () => {
    it('should return null when session not found', async () => {
      forkedEm.findOne.mockResolvedValue(null);

      const session = await promisifyGet(store, 'non-existent');

      expect(session).toBeNull();
    });

    it('should return session data when found and not expired', async () => {
      const sessionEntity = createMockSessionEntity({
        data: { userId: 'user-123' },
      });
      forkedEm.findOne.mockResolvedValue(sessionEntity);

      const session = await promisifyGet(store, TEST_SESSION_ID);

      expect(session).toEqual({ userId: 'user-123' });
    });

    it('should return null and delete when session is expired (sliding)', async () => {
      const sessionEntity = createMockSessionEntity({
        expiresAt: new Date(Date.now() - 1000), // Expired
      });
      forkedEm.findOne.mockResolvedValue(sessionEntity);

      const session = await promisifyGet(store, TEST_SESSION_ID);

      expect(session).toBeNull();
      expect(forkedEm.removeAndFlush).toHaveBeenCalledWith(sessionEntity);
    });

    it('should return null and delete when session is expired (absolute)', async () => {
      const sessionEntity = createMockSessionEntity({
        absoluteExpiresAt: new Date(Date.now() - 1000), // Expired
      });
      forkedEm.findOne.mockResolvedValue(sessionEntity);

      const session = await promisifyGet(store, TEST_SESSION_ID);

      expect(session).toBeNull();
    });

    it('should update lastActivityAt on access', async () => {
      const sessionEntity = createMockSessionEntity();
      const originalActivity = sessionEntity.lastActivityAt;
      forkedEm.findOne.mockResolvedValue(sessionEntity);

      // Advance time
      vi.advanceTimersByTime(1000);

      await promisifyGet(store, TEST_SESSION_ID);

      expect(sessionEntity.lastActivityAt.getTime()).toBeGreaterThan(
        originalActivity.getTime(),
      );
      expect(forkedEm.flush).toHaveBeenCalled();
    });

    it('should not delete expired session when lazyCleanup is false', async () => {
      const testStore = new MikroOrmStore({
        em: mockEm as unknown as EntityManager,
        cleanupOnInit: false,
        cleanupInterval: 0,
        lazyCleanup: false,
      });

      const sessionEntity = createMockSessionEntity({
        expiresAt: new Date(Date.now() - 1000),
      });
      forkedEm.findOne.mockResolvedValue(sessionEntity);

      const session = await promisifyGet(testStore, TEST_SESSION_ID);

      expect(session).toBeNull();
      expect(forkedEm.removeAndFlush).not.toHaveBeenCalled();
    });

    it('should return null on database error (graceful error handling)', async () => {
      const error = new Error('Database error');
      forkedEm.findOne.mockRejectedValue(error);

      // MikroOrmStore now catches errors and returns null instead of rejecting
      // This is intentional to handle invalid UUID session IDs gracefully
      const result = await promisifyGet(store, TEST_SESSION_ID);
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should create new session when not exists', async () => {
      forkedEm.findOne.mockResolvedValue(null);

      const sessionData = createSessionData();

      await promisifySet(store, NEW_SESSION_ID, sessionData);

      expect(forkedEm.persist).toHaveBeenCalled();
      expect(forkedEm.flush).toHaveBeenCalled();
    });

    it('should update existing session', async () => {
      const existingSession = createMockSessionEntity();
      forkedEm.findOne.mockResolvedValue(existingSession);

      const sessionData = createSessionData({
        userId: 'updated-user',
      } as SessionData);

      await promisifySet(store, TEST_SESSION_ID, sessionData);

      expect(existingSession.data).toEqual(sessionData);
      expect(forkedEm.flush).toHaveBeenCalled();
    });

    it('should update expiresAt from cookie', async () => {
      const existingSession = createMockSessionEntity();
      forkedEm.findOne.mockResolvedValue(existingSession);

      const newExpiry = new Date(Date.now() + 100000);
      const sessionData = createSessionData();
      sessionData.cookie.expires = newExpiry;

      await promisifySet(store, TEST_SESSION_ID, sessionData);

      expect(existingSession.expiresAt).toEqual(newExpiry);
    });

    it('should reject on error', async () => {
      const error = new Error('Database error');
      forkedEm.findOne.mockRejectedValue(error);

      await expect(
        promisifySet(store, TEST_SESSION_ID, createSessionData()),
      ).rejects.toThrow('Database error');
    });

    it('should use default expiry when cookie.expires not set', async () => {
      forkedEm.findOne.mockResolvedValue(null);

      const sessionData = createSessionData();
      delete (sessionData.cookie as { expires?: Date }).expires;

      await promisifySet(store, TEST_SESSION_ID, sessionData);

      expect(forkedEm.persist).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should delete session by sid', async () => {
      await promisifyDestroy(store, TEST_SESSION_ID);

      expect(forkedEm.nativeDelete).toHaveBeenCalledWith(expect.anything(), {
        sid: TEST_SESSION_ID,
      });
    });

    it('should reject on error', async () => {
      const error = new Error('Database error');
      forkedEm.nativeDelete.mockRejectedValue(error);

      await expect(promisifyDestroy(store, TEST_SESSION_ID)).rejects.toThrow(
        'Database error',
      );
    });

    it('should work without callback', () => {
      // Should not throw
      store.destroy(TEST_SESSION_ID);
      expect(forkedEm.nativeDelete).toHaveBeenCalled();
    });
  });

  describe('touch', () => {
    it('should update session expiration', async () => {
      const session = createMockSessionEntity();
      forkedEm.findOne.mockResolvedValue(session);

      const newExpiry = new Date(Date.now() + 200000);
      const sessionData = createSessionData();
      sessionData.cookie.expires = newExpiry;

      await promisifyTouch(store, TEST_SESSION_ID, sessionData);

      expect(session.expiresAt).toEqual(newExpiry);
      expect(forkedEm.flush).toHaveBeenCalled();
    });

    it('should not extend beyond absoluteExpiresAt', async () => {
      const absoluteExpiry = new Date(Date.now() + 50000);
      const session = createMockSessionEntity({
        absoluteExpiresAt: absoluteExpiry,
      });
      forkedEm.findOne.mockResolvedValue(session);

      const newExpiry = new Date(Date.now() + 200000); // Beyond absolute
      const sessionData = createSessionData();
      sessionData.cookie.expires = newExpiry;

      await promisifyTouch(store, TEST_SESSION_ID, sessionData);

      expect(session.expiresAt).toEqual(absoluteExpiry);
    });

    it('should do nothing when session not found', async () => {
      forkedEm.findOne.mockResolvedValue(null);

      await promisifyTouch(store, 'non-existent', createSessionData());

      expect(forkedEm.flush).not.toHaveBeenCalled();
    });

    it('should update lastActivityAt', async () => {
      const session = createMockSessionEntity();
      const originalActivity = session.lastActivityAt;
      forkedEm.findOne.mockResolvedValue(session);

      vi.advanceTimersByTime(1000);

      await promisifyTouch(store, TEST_SESSION_ID, createSessionData());

      expect(session.lastActivityAt.getTime()).toBeGreaterThan(
        originalActivity.getTime(),
      );
    });
  });

  describe('length', () => {
    it('should return count of active sessions', async () => {
      forkedEm.count.mockResolvedValue(42);

      const length = await promisifyLength(store);

      expect(length).toBe(42);
      expect(forkedEm.count).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          expiresAt: { $gt: expect.any(Date) },
          absoluteExpiresAt: { $gt: expect.any(Date) },
        }),
      );
    });

    it('should reject on error', async () => {
      const error = new Error('Database error');
      forkedEm.count.mockRejectedValue(error);

      await expect(promisifyLength(store)).rejects.toThrow('Database error');
    });
  });

  describe('clear', () => {
    it('should delete all sessions', async () => {
      await promisifyClear(store);

      expect(forkedEm.nativeDelete).toHaveBeenCalledWith(expect.anything(), {});
    });

    it('should reject on error', async () => {
      const error = new Error('Database error');
      forkedEm.nativeDelete.mockRejectedValue(error);

      await expect(promisifyClear(store)).rejects.toThrow('Database error');
    });

    it('should work without callback', () => {
      store.clear();
      expect(forkedEm.nativeDelete).toHaveBeenCalled();
    });
  });

  describe('all', () => {
    it('should return all active sessions', async () => {
      const sessions = [
        createMockSessionEntity({ sid: 'session-1', data: { userId: '1' } }),
        createMockSessionEntity({ sid: 'session-2', data: { userId: '2' } }),
      ];
      forkedEm.find.mockResolvedValue(sessions);

      const result = await promisifyAll(store);

      expect(result).toEqual({
        'session-1': { userId: '1' },
        'session-2': { userId: '2' },
      });
    });

    it('should return empty object when no sessions', async () => {
      forkedEm.find.mockResolvedValue([]);

      const result = await promisifyAll(store);

      expect(result).toEqual({});
    });

    it('should reject on error', async () => {
      const error = new Error('Database error');
      forkedEm.find.mockRejectedValue(error);

      await expect(promisifyAll(store)).rejects.toThrow('Database error');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      forkedEm.nativeDelete.mockResolvedValue(10);

      const result = await store.cleanupExpiredSessions();

      expect(result).toBe(10);
      expect(forkedEm.nativeDelete).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $or: [
            { expiresAt: { $lt: expect.any(Date) } },
            { absoluteExpiresAt: { $lt: expect.any(Date) } },
          ],
        }),
      );
    });
  });

  describe('stopCleanup', () => {
    it('should stop periodic cleanup', () => {
      const em = {
        fork: vi.fn().mockReturnValue({
          nativeDelete: vi.fn().mockResolvedValue(0),
        }),
      };

      const testStore = new MikroOrmStore({
        em: em as unknown as EntityManager,
        cleanupOnInit: false,
        cleanupInterval: 60000,
      });

      testStore.stopCleanup();

      // Clear previous calls
      em.fork.mockClear();

      // Advance timers - cleanup should not run
      vi.advanceTimersByTime(120000);

      // Should not have called fork for cleanup
      expect(em.fork).not.toHaveBeenCalled();
    });
  });
});
