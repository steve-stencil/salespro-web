import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LoginEventType, MfaRecoveryCode } from '../../../entities';
import { verifyPassword } from '../../../lib/crypto';
import { emailService, isEmailServiceConfigured } from '../../../lib/email';
import { logLoginEvent } from '../../../services/auth/events';
import {
  sendMfaCode,
  verifyMfaCode,
  verifyMfaRecoveryCode,
  enableMfa,
  disableMfa,
  getRecoveryCodeCount,
  regenerateRecoveryCodes,
  hasPendingMfa,
  clearPendingMfa,
  MfaErrorCode,
  MFA_CONFIG,
} from '../../../services/auth/mfa';

import type {
  User,
  MfaRecoveryCode as MfaRecoveryCodeType,
  Session,
} from '../../../entities';
import type { EntityManager } from '@mikro-orm/core';

// Mock dependencies
vi.mock('../../../lib/crypto', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue('hashed-code'),
  generateBackupCode: vi.fn().mockReturnValue('ABCD-1234-EFGH'),
}));

vi.mock('../../../lib/email', () => ({
  emailService: {
    sendMfaCodeEmail: vi.fn().mockResolvedValue(undefined),
  },
  isEmailServiceConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock('../../../services/auth/events', () => ({
  logLoginEvent: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Create a mock EntityManager with common operations
 */
function createMockEm(): {
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
  };
}

/**
 * Create a mock user
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    isActive: true,
    mfaEnabled: false,
    mfaSecret: undefined,
    mfaEnabledAt: undefined,
    nameFirst: 'Test',
    nameLast: 'User',
    company: {
      id: 'company-123',
      name: 'Test Company',
    },
    ...overrides,
  } as User;
}

/**
 * Create a mock session
 */
function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    sid: 'session-123',
    data: {},
    mfaVerified: false,
    user: undefined,
    ...overrides,
  } as Session;
}

describe('MFA Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations to defaults
    vi.mocked(isEmailServiceConfigured).mockReturnValue(true);
    vi.mocked(emailService.sendMfaCodeEmail).mockResolvedValue(undefined);
    vi.mocked(verifyPassword).mockResolvedValue(false);
    // Clear any pending MFA codes
    clearPendingMfa('user-123');
    // Ensure real timers
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('sendMfaCode', () => {
    it('should return error when email service is not configured', async () => {
      vi.mocked(isEmailServiceConfigured).mockReturnValue(false);

      const em = createMockEm();
      const result = await sendMfaCode(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service is not configured');
      expect(result.errorCode).toBe(MfaErrorCode.EMAIL_NOT_CONFIGURED);
    });

    it('should return error when user is not found', async () => {
      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);

      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const result = await sendMfaCode(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(result.errorCode).toBe(MfaErrorCode.USER_NOT_FOUND);
    });

    it('should send MFA code successfully', async () => {
      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);

      const user = createMockUser();
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      const result = await sendMfaCode(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result.success).toBe(true);
      expect(result.expiresIn).toBe(MFA_CONFIG.CODE_EXPIRY_MINUTES);
      expect(emailService.sendMfaCodeEmail).toHaveBeenCalledWith(
        user.email,
        expect.any(String),
        MFA_CONFIG.CODE_EXPIRY_MINUTES,
      );
    });

    it('should return code in development mode', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);

      const user = createMockUser();
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      const result = await sendMfaCode(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.code).toHaveLength(MFA_CONFIG.CODE_LENGTH);

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should handle email service failure', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);
      vi.mocked(emailService.sendMfaCodeEmail).mockRejectedValue(
        new Error('Email failed'),
      );

      const user = createMockUser();
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      const result = await sendMfaCode(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to send MFA code');

      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('verifyMfaCode', () => {
    it('should return error when no pending MFA code exists', async () => {
      const em = createMockEm();

      const result = await verifyMfaCode(
        em as unknown as EntityManager,
        'user-123',
        '123456',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No pending MFA verification');
      expect(result.errorCode).toBe(MfaErrorCode.NO_PENDING_MFA);
    });

    it('should return error for expired code', async () => {
      // Set up fake timers BEFORE sending code so expiresAt is in fake time
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));

      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);

      const user = createMockUser();
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      // Send code - expiresAt will be set to 12:05
      await sendMfaCode(em as unknown as EntityManager, 'user-123');

      // Advance time past expiration (6 minutes)
      vi.advanceTimersByTime((MFA_CONFIG.CODE_EXPIRY_MINUTES + 1) * 60 * 1000);

      const result = await verifyMfaCode(
        em as unknown as EntityManager,
        'user-123',
        '123456',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('MFA code has expired');
      expect(result.errorCode).toBe(MfaErrorCode.CODE_EXPIRED);

      vi.useRealTimers();
    });

    it('should return error for invalid code', async () => {
      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);

      const user = createMockUser();
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      // Send code
      await sendMfaCode(em as unknown as EntityManager, 'user-123');

      // Try to verify with wrong code
      const result = await verifyMfaCode(
        em as unknown as EntityManager,
        'user-123',
        '000000',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid MFA code');
      expect(result.errorCode).toBe(MfaErrorCode.CODE_INVALID);
    });

    it('should return error after too many attempts', async () => {
      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);

      const user = createMockUser();
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      // Send code
      await sendMfaCode(em as unknown as EntityManager, 'user-123');

      // Try invalid codes multiple times
      for (let i = 0; i <= MFA_CONFIG.MAX_ATTEMPTS; i++) {
        await verifyMfaCode(
          em as unknown as EntityManager,
          'user-123',
          '000000',
          'session-123',
          '127.0.0.1',
          'Test Agent',
        );
      }

      // Next attempt should fail with too many attempts
      const result = await verifyMfaCode(
        em as unknown as EntityManager,
        'user-123',
        '000000',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      // Code should be invalidated after max attempts
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(MfaErrorCode.NO_PENDING_MFA);
    });

    it('should verify valid code successfully', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);

      const user = createMockUser();
      const session = createMockSession();
      const em = createMockEm();

      // First call for sending returns user
      // Second call in verify returns user with populate
      // Third call in verify returns session
      em.findOne
        .mockResolvedValueOnce(user) // sendMfaCode
        .mockResolvedValueOnce(user) // verifyMfaCode - find user
        .mockResolvedValueOnce(session); // verifyMfaCode - find session

      // Send code and get it
      const sendResult = await sendMfaCode(
        em as unknown as EntityManager,
        'user-123',
      );
      const code = sendResult.code;

      expect(code).toBeDefined();

      // Verify the code
      const result = await verifyMfaCode(
        em as unknown as EntityManager,
        'user-123',
        code!,
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(true);
      expect(result.user).toBe(user);
      expect(session.mfaVerified).toBe(true);
      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.LOGIN_SUCCESS,
        expect.objectContaining({
          metadata: { mfaVerified: true },
        }),
      );

      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('verifyMfaRecoveryCode', () => {
    it('should return error when user is not found', async () => {
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const result = await verifyMfaRecoveryCode(
        em as unknown as EntityManager,
        'user-123',
        'ABCD-1234',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(result.errorCode).toBe(MfaErrorCode.USER_NOT_FOUND);
    });

    it('should return error for invalid recovery code', async () => {
      const user = createMockUser({ mfaEnabled: true });
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      em.find.mockResolvedValue([]);

      const result = await verifyMfaRecoveryCode(
        em as unknown as EntityManager,
        'user-123',
        'INVALID-CODE',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid recovery code');
      expect(result.errorCode).toBe(MfaErrorCode.RECOVERY_CODE_INVALID);
    });

    it('should verify valid recovery code and mark as used', async () => {
      const user = createMockUser({ mfaEnabled: true });
      const recoveryCode = {
        id: 'code-1',
        codeHash: 'hashed-code',
        usedAt: null,
      } as MfaRecoveryCodeType;

      const session = createMockSession();

      const em = createMockEm();
      // First findOne call returns user, second returns session
      em.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(session);
      em.find.mockResolvedValue([recoveryCode]);

      // Mock verifyPassword to match the recovery code
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await verifyMfaRecoveryCode(
        em as unknown as EntityManager,
        'user-123',
        'ABCD-1234',
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(true);
      expect(result.user).toBe(user);
      expect(recoveryCode.usedAt).toBeDefined();
      expect(session.mfaVerified).toBe(true);
      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.MFA_BACKUP_CODE_USED,
        expect.objectContaining({
          metadata: { recoveryCodeId: 'code-1' },
        }),
      );
    });
  });

  describe('enableMfa', () => {
    it('should return error when user is not found', async () => {
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const result = await enableMfa(
        em as unknown as EntityManager,
        'user-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(result.errorCode).toBe(MfaErrorCode.USER_NOT_FOUND);
    });

    it('should return error when MFA is already enabled', async () => {
      const user = createMockUser({ mfaEnabled: true });
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      const result = await enableMfa(
        em as unknown as EntityManager,
        'user-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('MFA is already enabled');
      expect(result.errorCode).toBe(MfaErrorCode.MFA_ALREADY_ENABLED);
    });

    it('should enable MFA and generate recovery codes', async () => {
      const user = createMockUser({ mfaEnabled: false });
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      const result = await enableMfa(
        em as unknown as EntityManager,
        'user-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(true);
      expect(result.recoveryCodes).toBeDefined();
      expect(result.recoveryCodes).toHaveLength(MFA_CONFIG.RECOVERY_CODE_COUNT);
      expect(user.mfaEnabled).toBe(true);
      expect(user.mfaEnabledAt).toBeDefined();
      expect(em.persist).toHaveBeenCalledTimes(MFA_CONFIG.RECOVERY_CODE_COUNT);
      expect(em.flush).toHaveBeenCalled();
      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.MFA_ENABLED,
        expect.any(Object),
      );
    });
  });

  describe('disableMfa', () => {
    it('should return error when user is not found', async () => {
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const result = await disableMfa(
        em as unknown as EntityManager,
        'user-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(result.errorCode).toBe(MfaErrorCode.USER_NOT_FOUND);
    });

    it('should return error when MFA is not enabled', async () => {
      const user = createMockUser({ mfaEnabled: false });
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      const result = await disableMfa(
        em as unknown as EntityManager,
        'user-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('MFA is not enabled');
      expect(result.errorCode).toBe(MfaErrorCode.MFA_NOT_ENABLED);
    });

    it('should disable MFA and remove recovery codes', async () => {
      const user = createMockUser({
        mfaEnabled: true,
        mfaSecret: 'secret',
        mfaEnabledAt: new Date(),
      });
      const recoveryCodes = [
        { id: 'code-1' } as MfaRecoveryCodeType,
        { id: 'code-2' } as MfaRecoveryCodeType,
      ];

      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      em.find.mockResolvedValue(recoveryCodes);

      const result = await disableMfa(
        em as unknown as EntityManager,
        'user-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(true);
      expect(user.mfaEnabled).toBe(false);
      expect(user.mfaSecret).toBeUndefined();
      expect(user.mfaEnabledAt).toBeUndefined();
      expect(em.remove).toHaveBeenCalledTimes(recoveryCodes.length);
      expect(em.flush).toHaveBeenCalled();
      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.MFA_DISABLED,
        expect.any(Object),
      );
    });
  });

  describe('getRecoveryCodeCount', () => {
    it('should return count of unused recovery codes', async () => {
      const em = createMockEm();
      em.count.mockResolvedValue(7);

      const count = await getRecoveryCodeCount(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(count).toBe(7);
      expect(em.count).toHaveBeenCalledWith(MfaRecoveryCode, {
        user: { id: 'user-123' },
        usedAt: null,
      });
    });
  });

  describe('regenerateRecoveryCodes', () => {
    it('should return error when user is not found', async () => {
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const result = await regenerateRecoveryCodes(
        em as unknown as EntityManager,
        'user-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(result.errorCode).toBe(MfaErrorCode.USER_NOT_FOUND);
    });

    it('should return error when MFA is not enabled', async () => {
      const user = createMockUser({ mfaEnabled: false });
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      const result = await regenerateRecoveryCodes(
        em as unknown as EntityManager,
        'user-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('MFA is not enabled');
      expect(result.errorCode).toBe(MfaErrorCode.MFA_NOT_ENABLED);
    });

    it('should replace old recovery codes with new ones', async () => {
      const user = createMockUser({ mfaEnabled: true });
      const oldCodes = [
        { id: 'old-1' } as MfaRecoveryCodeType,
        { id: 'old-2' } as MfaRecoveryCodeType,
      ];

      const em = createMockEm();
      em.findOne.mockResolvedValue(user);
      em.find.mockResolvedValue(oldCodes);

      const result = await regenerateRecoveryCodes(
        em as unknown as EntityManager,
        'user-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(true);
      expect(result.recoveryCodes).toBeDefined();
      expect(result.recoveryCodes).toHaveLength(MFA_CONFIG.RECOVERY_CODE_COUNT);
      expect(em.remove).toHaveBeenCalledTimes(oldCodes.length);
      expect(em.persist).toHaveBeenCalledTimes(MFA_CONFIG.RECOVERY_CODE_COUNT);
      expect(em.flush).toHaveBeenCalled();
      expect(logLoginEvent).toHaveBeenCalledWith(
        em,
        user,
        LoginEventType.MFA_ENABLED,
        expect.objectContaining({
          metadata: { action: 'recovery_codes_regenerated' },
        }),
      );
    });
  });

  describe('hasPendingMfa', () => {
    it('should return false when no pending MFA exists', () => {
      const result = hasPendingMfa('user-123');
      expect(result).toBe(false);
    });

    it('should return true when pending MFA exists', async () => {
      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);

      const user = createMockUser();
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      // Send code to create pending MFA
      await sendMfaCode(em as unknown as EntityManager, 'user-123');

      const result = hasPendingMfa('user-123');
      expect(result).toBe(true);
    });

    it('should return false when pending MFA has expired', async () => {
      // Set up fake timers BEFORE sending code
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));

      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);

      const user = createMockUser();
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      // Send code
      await sendMfaCode(em as unknown as EntityManager, 'user-123');

      // Advance time past expiration
      vi.advanceTimersByTime((MFA_CONFIG.CODE_EXPIRY_MINUTES + 1) * 60 * 1000);

      const result = hasPendingMfa('user-123');
      expect(result).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('clearPendingMfa', () => {
    it('should clear pending MFA for user', async () => {
      vi.mocked(isEmailServiceConfigured).mockReturnValue(true);

      const user = createMockUser();
      const em = createMockEm();
      em.findOne.mockResolvedValue(user);

      // Send code
      await sendMfaCode(em as unknown as EntityManager, 'user-123');
      expect(hasPendingMfa('user-123')).toBe(true);

      // Clear pending MFA
      clearPendingMfa('user-123');
      expect(hasPendingMfa('user-123')).toBe(false);
    });
  });
});
