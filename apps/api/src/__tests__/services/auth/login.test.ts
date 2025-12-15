import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LoginEventType, SessionSource } from '../../../entities';
import { verifyPassword } from '../../../lib/crypto';
import { LOCKOUT_CONFIG } from '../../../services/auth/config';
import { logLoginEvent } from '../../../services/auth/events';
import {
  login,
  handleSuccessfulLogin,
  handleFailedLogin,
} from '../../../services/auth/login';
import { LoginErrorCode } from '../../../services/auth/types';

import type { User, Company, Session } from '../../../entities';
import type { LoginParams } from '../../../services/auth/types';
import type { EntityManager } from '@mikro-orm/core';

// Mock the crypto module
vi.mock('../../../lib/crypto', () => ({
  verifyPassword: vi.fn(),
}));

// Mock the events module
vi.mock('../../../services/auth/events', () => ({
  logLoginEvent: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Create a mock EntityManager with common operations
 */
function createMockEm(): ReturnType<typeof vi.fn> & {
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  nativeDelete: ReturnType<typeof vi.fn>;
} {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    count: vi.fn(),
    persist: vi.fn(),
    remove: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    nativeDelete: vi.fn().mockResolvedValue(0),
  } as ReturnType<typeof vi.fn> & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    persist: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    flush: ReturnType<typeof vi.fn>;
    nativeDelete: ReturnType<typeof vi.fn>;
  };
}

/**
 * Create a mock company
 */
function createMockCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-123',
    name: 'Test Company',
    mfaRequired: false,
    maxSessionsPerUser: 5,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      historyCount: 3,
      maxAgeDays: 90,
    },
    ...overrides,
  } as Company;
}

/**
 * Create a mock user
 */
function createMockUser(overrides: Partial<User> = {}): User {
  const user = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    isActive: true,
    needsResetPassword: false,
    maxSessions: 2,
    failedLoginAttempts: 0,
    emailVerified: true,
    mfaEnabled: false,
    nameFirst: 'Test',
    nameLast: 'User',
    company: createMockCompany(),
    lockedUntil: undefined as Date | undefined,
    ...overrides,
  } as User;

  // Define isLocked as a getter on the object (configurable for test overrides)
  Object.defineProperty(user, 'isLocked', {
    get() {
      if (!user.lockedUntil) return false;
      return user.lockedUntil > new Date();
    },
    configurable: true,
  });

  return user;
}

/**
 * Create default login params
 */
function createLoginParams(overrides: Partial<LoginParams> = {}): LoginParams {
  return {
    email: 'test@example.com',
    password: 'TestPassword123!',
    source: SessionSource.WEB,
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent/1.0',
    sessionId: 'session-123',
    ...overrides,
  };
}

describe('Login Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should return invalid credentials when user not found', async () => {
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const params = createLoginParams();
      const result = await login(em as unknown as EntityManager, params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.errorCode).toBe(LoginErrorCode.INVALID_CREDENTIALS);
      expect(em.persist).toHaveBeenCalled();
      expect(em.flush).toHaveBeenCalled();
    });

    it('should return account locked when user is locked', async () => {
      const lockedUser = createMockUser({
        lockedUntil: new Date(Date.now() + 60000), // locked for 1 minute
      });
      // Override the isLocked getter to return true
      Object.defineProperty(lockedUser, 'isLocked', {
        get: () => true,
        configurable: true,
      });

      const em = createMockEm();
      em.findOne.mockResolvedValue(lockedUser);

      const params = createLoginParams();
      const result = await login(em as unknown as EntityManager, params);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(LoginErrorCode.ACCOUNT_LOCKED);
      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        lockedUser,
        LoginEventType.LOGIN_FAILED,
        expect.objectContaining({ metadata: { reason: 'account_locked' } }),
      );
    });

    it('should return account inactive when user is deactivated', async () => {
      const inactiveUser = createMockUser({ isActive: false });

      const em = createMockEm();
      em.findOne.mockResolvedValue(inactiveUser);

      const params = createLoginParams();
      const result = await login(em as unknown as EntityManager, params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is deactivated');
      expect(result.errorCode).toBe(LoginErrorCode.ACCOUNT_INACTIVE);
    });

    it('should return invalid credentials when password is wrong', async () => {
      const user = createMockUser();

      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      const params = createLoginParams();
      const result = await login(em as unknown as EntityManager, params);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(LoginErrorCode.INVALID_CREDENTIALS);
    });

    it('should return password expired when user needs to reset password', async () => {
      const user = createMockUser({ needsResetPassword: true });

      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const params = createLoginParams();
      const result = await login(em as unknown as EntityManager, params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Password reset required');
      expect(result.errorCode).toBe(LoginErrorCode.PASSWORD_EXPIRED);
    });

    it('should require MFA when user has MFA enabled', async () => {
      const user = createMockUser({ mfaEnabled: true });

      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const params = createLoginParams();
      const result = await login(em as unknown as EntityManager, params);

      expect(result.success).toBe(true);
      expect(result.user).toBe(user);
      expect(result.requiresMfa).toBe(true);
    });

    it('should require MFA when company requires MFA', async () => {
      const company = createMockCompany({ mfaRequired: true });
      const user = createMockUser({ mfaEnabled: false, company });

      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const params = createLoginParams();
      const result = await login(em as unknown as EntityManager, params);

      expect(result.success).toBe(true);
      expect(result.requiresMfa).toBe(true);
    });

    it('should successfully login user without MFA', async () => {
      const user = createMockUser();

      const em = createMockEm();
      // First call returns user, second call returns null (for session check)
      em.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      em.count.mockResolvedValue(0);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const params = createLoginParams();
      const result = await login(em as unknown as EntityManager, params);

      expect(result.success).toBe(true);
      expect(result.user).toBe(user);
      expect(result.requiresMfa).toBeUndefined();
    });

    it('should normalize email to lowercase', async () => {
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const params = createLoginParams({ email: 'TEST@EXAMPLE.COM' });
      await login(em as unknown as EntityManager, params);

      expect(em.findOne).toHaveBeenCalledWith(
        expect.anything(),
        { email: 'test@example.com' },
        expect.anything(),
      );
    });
  });

  describe('handleSuccessfulLogin', () => {
    it('should create new session when none exists', async () => {
      const user = createMockUser();

      const em = createMockEm();
      em.findOne.mockResolvedValue(null);
      em.count.mockResolvedValue(0);

      const session = await handleSuccessfulLogin(
        em as unknown as EntityManager,
        user,
        'session-123',
        {
          source: SessionSource.WEB,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      );

      expect(session.sid).toBe('session-123');
      expect(session.user).toBe(user);
      expect(em.persist).toHaveBeenCalled();
      expect(em.flush).toHaveBeenCalled();
    });

    it('should update existing session', async () => {
      const user = createMockUser();
      const existingSession = {
        sid: 'session-123',
        data: {},
        expiresAt: new Date(),
        absoluteExpiresAt: new Date(),
      } as Session;

      const em = createMockEm();
      em.findOne.mockResolvedValue(existingSession);
      em.count.mockResolvedValue(0);

      const session = await handleSuccessfulLogin(
        em as unknown as EntityManager,
        user,
        'session-123',
        {
          source: SessionSource.WEB,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      );

      expect(session.user).toBe(user);
      expect(session.source).toBe(SessionSource.WEB);
    });

    it('should remove oldest session when limit exceeded', async () => {
      const user = createMockUser({ maxSessions: 2 });
      const oldestSession = {
        sid: 'oldest-session',
        createdAt: new Date(Date.now() - 100000),
      } as Session;

      const em = createMockEm();
      // Order of findOne calls:
      // 1. Find oldest session to remove (returns oldestSession)
      // 2. Find existing session with sessionId (returns null)
      em.findOne
        .mockResolvedValueOnce(oldestSession)
        .mockResolvedValueOnce(null);
      em.count.mockResolvedValue(2); // At limit

      await handleSuccessfulLogin(
        em as unknown as EntityManager,
        user,
        'session-123',
        {
          source: SessionSource.WEB,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      );

      expect(em.remove).toHaveBeenCalledWith(oldestSession);
      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.SESSION_REVOKED,
        expect.objectContaining({
          metadata: expect.objectContaining({
            reason: 'session_limit_exceeded',
          }),
        }),
      );
    });

    it('should set longer expiration for remember me', async () => {
      const user = createMockUser();

      const em = createMockEm();
      em.findOne.mockResolvedValue(null);
      em.count.mockResolvedValue(0);

      const session = await handleSuccessfulLogin(
        em as unknown as EntityManager,
        user,
        'session-123',
        {
          source: SessionSource.WEB,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          rememberMe: true,
        },
      );

      // Remember me should have 30-day expiration
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const expectedExpiry = new Date(Date.now() + thirtyDays);
      expect(session.expiresAt.getTime()).toBeCloseTo(
        expectedExpiry.getTime(),
        -4,
      );
    });

    it('should set deviceId when provided', async () => {
      const user = createMockUser();

      const em = createMockEm();
      em.findOne.mockResolvedValue(null);
      em.count.mockResolvedValue(0);

      const session = await handleSuccessfulLogin(
        em as unknown as EntityManager,
        user,
        'session-123',
        {
          source: SessionSource.WEB,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          deviceId: 'device-abc',
        },
      );

      expect(session.deviceId).toBe('device-abc');
    });

    it('should reset failed login attempts on success', async () => {
      const user = createMockUser({ failedLoginAttempts: 3 });

      const em = createMockEm();
      em.findOne.mockResolvedValue(null);
      em.count.mockResolvedValue(0);

      await handleSuccessfulLogin(
        em as unknown as EntityManager,
        user,
        'session-123',
        {
          source: SessionSource.WEB,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      );

      expect(user.failedLoginAttempts).toBe(0);
    });

    it('should delete existing sessions for same source', async () => {
      const user = createMockUser();

      const em = createMockEm();
      em.findOne.mockResolvedValue(null);
      em.count.mockResolvedValue(0);

      await handleSuccessfulLogin(
        em as unknown as EntityManager,
        user,
        'session-123',
        {
          source: SessionSource.WEB,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      );

      expect(em.nativeDelete).toHaveBeenCalledWith(expect.anything(), {
        user: user.id,
        source: SessionSource.WEB,
      });
    });
  });

  describe('handleFailedLogin', () => {
    it('should increment failed login attempts', async () => {
      const user = createMockUser({ failedLoginAttempts: 0 });

      const em = createMockEm();

      await handleFailedLogin(
        em as unknown as EntityManager,
        user,
        '127.0.0.1',
        'Test Agent',
        SessionSource.WEB,
      );

      expect(user.failedLoginAttempts).toBe(1);
      expect(user.lastFailedLoginAt).toBeDefined();
    });

    it('should lock account after first lockout threshold', async () => {
      const user = createMockUser({
        failedLoginAttempts: LOCKOUT_CONFIG.FIRST_LOCKOUT_ATTEMPTS - 1,
      });

      const em = createMockEm();

      await handleFailedLogin(
        em as unknown as EntityManager,
        user,
        '127.0.0.1',
        'Test Agent',
        SessionSource.WEB,
      );

      expect(user.lockedUntil).toBeDefined();
      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.ACCOUNT_LOCKED,
        expect.objectContaining({
          metadata: expect.objectContaining({
            attempts: LOCKOUT_CONFIG.FIRST_LOCKOUT_ATTEMPTS,
            lockoutMinutes: LOCKOUT_CONFIG.FIRST_LOCKOUT_MINUTES,
          }),
        }),
      );
    });

    it('should apply second lockout duration after threshold', async () => {
      const user = createMockUser({
        failedLoginAttempts: LOCKOUT_CONFIG.SECOND_LOCKOUT_ATTEMPTS - 1,
      });

      const em = createMockEm();

      await handleFailedLogin(
        em as unknown as EntityManager,
        user,
        '127.0.0.1',
        'Test Agent',
        SessionSource.WEB,
      );

      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.ACCOUNT_LOCKED,
        expect.objectContaining({
          metadata: expect.objectContaining({
            lockoutMinutes: LOCKOUT_CONFIG.SECOND_LOCKOUT_MINUTES,
          }),
        }),
      );
    });

    it('should apply long lockout after threshold', async () => {
      const user = createMockUser({
        failedLoginAttempts: LOCKOUT_CONFIG.LONG_LOCKOUT_ATTEMPTS - 1,
      });

      const em = createMockEm();

      await handleFailedLogin(
        em as unknown as EntityManager,
        user,
        '127.0.0.1',
        'Test Agent',
        SessionSource.WEB,
      );

      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.ACCOUNT_LOCKED,
        expect.objectContaining({
          metadata: expect.objectContaining({
            lockoutMinutes: LOCKOUT_CONFIG.LONG_LOCKOUT_MINUTES,
          }),
        }),
      );
    });

    it('should not lock account below threshold', async () => {
      const user = createMockUser({ failedLoginAttempts: 1 });

      const em = createMockEm();

      await handleFailedLogin(
        em as unknown as EntityManager,
        user,
        '127.0.0.1',
        'Test Agent',
        SessionSource.WEB,
      );

      expect(user.lockedUntil).toBeUndefined();
    });

    it('should log failed login event', async () => {
      const user = createMockUser();

      const em = createMockEm();

      await handleFailedLogin(
        em as unknown as EntityManager,
        user,
        '127.0.0.1',
        'Test Agent',
        SessionSource.WEB,
      );

      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.LOGIN_FAILED,
        expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          source: SessionSource.WEB,
        }),
      );
    });
  });
});
