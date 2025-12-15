import { User, Session, LoginEventType, SessionSource } from '../../entities';

import { logLoginEvent } from './events';

import type { EntityManager } from '@mikro-orm/core';

/**
 * Logout and destroy a specific session
 */
export async function logout(
  em: EntityManager,
  sessionId: string,
  ipAddress: string,
  userAgent: string,
): Promise<boolean> {
  const session = await em.findOne(
    Session,
    { sid: sessionId },
    { populate: ['user'] },
  );

  if (!session) {
    return false;
  }

  if (session.user) {
    await logLoginEvent(em, session.user, LoginEventType.LOGOUT, {
      ipAddress,
      userAgent,
      source: session.source ?? SessionSource.WEB,
    });
  }

  em.remove(session);
  await em.flush();

  return true;
}

/**
 * Logout all sessions for a user except the current one
 */
export async function logoutAllSessions(
  em: EntityManager,
  userId: string,
  currentSessionId?: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<number> {
  const user = await em.findOne(User, { id: userId });
  if (!user) return 0;

  const query = currentSessionId
    ? { user: userId, sid: { $ne: currentSessionId } }
    : { user: userId };

  const count = await em.nativeDelete(Session, query);

  if (ipAddress && userAgent) {
    await logLoginEvent(em, user, LoginEventType.SESSION_REVOKED, {
      ipAddress,
      userAgent,
      source: SessionSource.WEB,
      metadata: { reason: 'logout_all', count },
    });
    await em.flush();
  }

  return count;
}

/**
 * Get a user's active sessions
 */
export async function getUserSessions(
  em: EntityManager,
  userId: string,
): Promise<Session[]> {
  const now = new Date();

  return em.find(
    Session,
    {
      user: userId,
      expiresAt: { $gt: now },
      absoluteExpiresAt: { $gt: now },
    },
    { orderBy: { lastActivityAt: 'DESC' } },
  );
}

/**
 * Revoke a specific session
 */
export async function revokeSession(
  em: EntityManager,
  userId: string,
  sessionId: string,
  ipAddress: string,
  userAgent: string,
): Promise<boolean> {
  const session = await em.findOne(Session, {
    sid: sessionId,
    user: userId,
  });

  if (!session) {
    return false;
  }

  const user = await em.findOne(User, { id: userId });
  if (user) {
    await logLoginEvent(em, user, LoginEventType.SESSION_REVOKED, {
      ipAddress,
      userAgent,
      source: session.source ?? SessionSource.WEB,
      metadata: { revokedSessionId: sessionId },
    });
  }

  em.remove(session);
  await em.flush();

  return true;
}
