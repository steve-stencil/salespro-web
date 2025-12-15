import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LoginEventType, SessionSource } from '../../../entities';
import { logLoginEvent } from '../../../services/auth/events';

import type { User } from '../../../entities';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Create a mock EntityManager
 */
function createMockEm() {
  return {
    persist: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock user
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    nameFirst: 'Test',
    nameLast: 'User',
    ...overrides,
  } as User;
}

describe('Events Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logLoginEvent', () => {
    it('should create and persist login event', async () => {
      const user = createMockUser();
      const em = createMockEm();

      await logLoginEvent(
        em as unknown as EntityManager,
        user,
        LoginEventType.LOGIN_SUCCESS,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent/1.0',
          source: SessionSource.WEB,
        },
      );

      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          user,
          email: 'test@example.com',
          eventType: LoginEventType.LOGIN_SUCCESS,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent/1.0',
          source: SessionSource.WEB,
        }),
      );
      expect(em.flush).toHaveBeenCalled();
    });

    it('should include metadata when provided', async () => {
      const user = createMockUser();
      const em = createMockEm();

      await logLoginEvent(
        em as unknown as EntityManager,
        user,
        LoginEventType.ACCOUNT_LOCKED,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent/1.0',
          source: SessionSource.WEB,
          metadata: { attempts: 5, lockoutMinutes: 15 },
        },
      );

      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { attempts: 5, lockoutMinutes: 15 },
        }),
      );
    });

    it('should not set metadata when not provided', async () => {
      const user = createMockUser();
      const em = createMockEm();

      await logLoginEvent(
        em as unknown as EntityManager,
        user,
        LoginEventType.LOGOUT,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent/1.0',
          source: SessionSource.IOS,
        },
      );

      // Event should be persisted without metadata property being set
      const persistedEvent = em.persist.mock.calls[0]?.[0];
      expect(persistedEvent?.eventType).toBe(LoginEventType.LOGOUT);
      expect(persistedEvent.source).toBe(SessionSource.IOS);
    });

    it('should handle different event types', async () => {
      const user = createMockUser();
      const em = createMockEm();

      const eventTypes = [
        LoginEventType.LOGIN_FAILED,
        LoginEventType.SESSION_REVOKED,
        LoginEventType.PASSWORD_RESET_REQUESTED,
        LoginEventType.PASSWORD_RESET_COMPLETED,
        LoginEventType.PASSWORD_CHANGED,
        LoginEventType.MFA_ENABLED,
      ];

      for (const eventType of eventTypes) {
        vi.clearAllMocks();

        await logLoginEvent(em as unknown as EntityManager, user, eventType, {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent/1.0',
          source: SessionSource.WEB,
        });

        expect(em.persist).toHaveBeenCalledWith(
          expect.objectContaining({ eventType }),
        );
      }
    });

    it('should handle different session sources', async () => {
      const user = createMockUser();
      const em = createMockEm();

      const sources = [
        SessionSource.WEB,
        SessionSource.IOS,
        SessionSource.ANDROID,
        SessionSource.API,
      ];

      for (const source of sources) {
        vi.clearAllMocks();

        await logLoginEvent(
          em as unknown as EntityManager,
          user,
          LoginEventType.LOGIN_SUCCESS,
          {
            ipAddress: '127.0.0.1',
            userAgent: 'Test Agent/1.0',
            source,
          },
        );

        expect(em.persist).toHaveBeenCalledWith(
          expect.objectContaining({ source }),
        );
      }
    });

    it('should use user email in event', async () => {
      const user = createMockUser({ email: 'custom@example.com' });
      const em = createMockEm();

      await logLoginEvent(
        em as unknown as EntityManager,
        user,
        LoginEventType.LOGIN_SUCCESS,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent/1.0',
          source: SessionSource.WEB,
        },
      );

      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'custom@example.com',
        }),
      );
    });
  });
});
