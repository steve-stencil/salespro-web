import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the events module
vi.mock('../../../services/auth/events', () => ({
  logLoginEvent: vi.fn().mockResolvedValue(undefined),
}));

import { LoginEventType, SessionSource } from '../../../entities';
import { logLoginEvent } from '../../../services/auth/events';
import {
  logout,
  logoutAllSessions,
  getUserSessions,
  revokeSession,
} from '../../../services/auth/session';

import type { User, Session } from '../../../entities';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Create a mock EntityManager
 */
function createMockEm() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    remove: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    nativeDelete: vi.fn().mockResolvedValue(0),
  };
}

/**
 * Create a mock user
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    ...overrides,
  } as User;
}

/**
 * Create a mock session
 * Note: Using Record<string, unknown> to allow undefined values in tests
 */
function createMockSession(overrides: Record<string, unknown> = {}): Session {
  return {
    sid: 'session-123',
    user: createMockUser(),
    source: SessionSource.WEB,
    expiresAt: new Date(Date.now() + 86400000),
    absoluteExpiresAt: new Date(Date.now() + 86400000 * 30),
    lastActivityAt: new Date(),
    ...overrides,
  } as Session;
}

describe('Session Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logout', () => {
    it('should return false when session not found', async () => {
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const result = await logout(
        em as unknown as EntityManager,
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result).toBe(false);
      expect(em.remove).not.toHaveBeenCalled();
    });

    it('should remove session and log event when found with user', async () => {
      const user = createMockUser();
      const session = createMockSession({ user });

      const em = createMockEm();
      em.findOne.mockResolvedValue(session);

      const result = await logout(
        em as unknown as EntityManager,
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result).toBe(true);
      expect(em.remove).toHaveBeenCalledWith(session);
      expect(em.flush).toHaveBeenCalled();
      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.LOGOUT,
        expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          source: SessionSource.WEB,
        }),
      );
    });

    it('should remove session without logging when no user', async () => {
      const session = createMockSession({ user: undefined });

      const em = createMockEm();
      em.findOne.mockResolvedValue(session);

      const result = await logout(
        em as unknown as EntityManager,
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result).toBe(true);
      expect(em.remove).toHaveBeenCalledWith(session);
      expect(logLoginEvent).not.toHaveBeenCalled();
    });

    it('should use WEB source when session source is null', async () => {
      const user = createMockUser();
      const session = createMockSession({ user, source: undefined });

      const em = createMockEm();
      em.findOne.mockResolvedValue(session);

      await logout(
        em as unknown as EntityManager,
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.LOGOUT,
        expect.objectContaining({
          source: SessionSource.WEB,
        }),
      );
    });
  });

  describe('logoutAllSessions', () => {
    it('should return 0 when user not found', async () => {
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const result = await logoutAllSessions(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result).toBe(0);
    });

    it('should delete all sessions when no current session specified', async () => {
      const user = createMockUser();

      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      em.nativeDelete.mockResolvedValue(5);

      const result = await logoutAllSessions(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result).toBe(5);
      expect(em.nativeDelete).toHaveBeenCalledWith(expect.anything(), {
        user: 'user-123',
      });
    });

    it('should exclude current session when specified', async () => {
      const user = createMockUser();

      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      em.nativeDelete.mockResolvedValue(4);

      const result = await logoutAllSessions(
        em as unknown as EntityManager,
        'user-123',
        'current-session',
      );

      expect(result).toBe(4);
      expect(em.nativeDelete).toHaveBeenCalledWith(expect.anything(), {
        user: 'user-123',
        sid: { $ne: 'current-session' },
      });
    });

    it('should log event when ip and userAgent provided', async () => {
      const user = createMockUser();

      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      em.nativeDelete.mockResolvedValue(3);

      await logoutAllSessions(
        em as unknown as EntityManager,
        'user-123',
        'current-session',
        '127.0.0.1',
        'Test Agent',
      );

      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.SESSION_REVOKED,
        expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          metadata: { reason: 'logout_all', count: 3 },
        }),
      );
    });

    it('should not log event when ip not provided', async () => {
      const user = createMockUser();

      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      em.nativeDelete.mockResolvedValue(3);

      await logoutAllSessions(em as unknown as EntityManager, 'user-123');

      expect(logLoginEvent).not.toHaveBeenCalled();
    });
  });

  describe('getUserSessions', () => {
    it('should return active sessions for user', async () => {
      const sessions = [
        createMockSession({ sid: 'session-1' }),
        createMockSession({ sid: 'session-2' }),
      ];

      const em = createMockEm();
      em.find.mockResolvedValue(sessions);

      const result = await getUserSessions(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result).toEqual(sessions);
      expect(em.find).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          user: 'user-123',
          expiresAt: { $gt: expect.any(Date) },
          absoluteExpiresAt: { $gt: expect.any(Date) },
        }),
        expect.objectContaining({
          orderBy: { lastActivityAt: 'DESC' },
        }),
      );
    });

    it('should return empty array when no sessions', async () => {
      const em = createMockEm();
      em.find.mockResolvedValue([]);

      const result = await getUserSessions(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result).toEqual([]);
    });
  });

  describe('revokeSession', () => {
    it('should return false when session not found', async () => {
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const result = await revokeSession(
        em as unknown as EntityManager,
        'user-123',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result).toBe(false);
    });

    it('should remove session and log event', async () => {
      const user = createMockUser();
      const session = createMockSession();

      const em = createMockEm();
      em.findOne.mockImplementation((_entity, query) => {
        if (query?.sid) return Promise.resolve(session);
        if (query?.id) return Promise.resolve(user);
        return Promise.resolve(null);
      });

      const result = await revokeSession(
        em as unknown as EntityManager,
        'user-123',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result).toBe(true);
      expect(em.remove).toHaveBeenCalledWith(session);
      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.SESSION_REVOKED,
        expect.objectContaining({
          metadata: { revokedSessionId: 'session-123' },
        }),
      );
    });

    it('should remove session without logging when user not found', async () => {
      const session = createMockSession();

      const em = createMockEm();
      em.findOne.mockImplementation((_entity, query) => {
        if (query?.sid) return Promise.resolve(session);
        return Promise.resolve(null);
      });

      const result = await revokeSession(
        em as unknown as EntityManager,
        'user-123',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result).toBe(true);
      expect(em.remove).toHaveBeenCalledWith(session);
      expect(logLoginEvent).not.toHaveBeenCalled();
    });

    it('should use WEB source when session source is null', async () => {
      const user = createMockUser();
      const session = createMockSession({ source: undefined });

      const em = createMockEm();
      em.findOne.mockImplementation((_entity, query) => {
        if (query?.sid) return Promise.resolve(session);
        if (query?.id) return Promise.resolve(user);
        return Promise.resolve(null);
      });

      await revokeSession(
        em as unknown as EntityManager,
        'user-123',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.SESSION_REVOKED,
        expect.objectContaining({
          source: SessionSource.WEB,
        }),
      );
    });
  });
});
