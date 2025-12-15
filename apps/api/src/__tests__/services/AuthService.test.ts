import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SessionSource } from '../../entities';
import {
  login as performLogin,
  logout as performLogout,
  logoutAllSessions as performLogoutAll,
  getUserSessions as fetchUserSessions,
  revokeSession as performRevokeSession,
  requestPasswordReset as performRequestReset,
  resetPassword as performResetPassword,
  changePassword as performChangePassword,
  LoginErrorCode,
} from '../../services/auth';
import { AuthService } from '../../services/AuthService';

import type { Session, User } from '../../entities';
import type {
  LoginResult,
  PasswordResetRequestResult,
  PasswordResetResult,
} from '../../services/auth';
import type { EntityManager } from '@mikro-orm/core';

// Mock the auth module functions
vi.mock('../../services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  logoutAllSessions: vi.fn(),
  getUserSessions: vi.fn(),
  revokeSession: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  LoginErrorCode: {
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
    PASSWORD_EXPIRED: 'PASSWORD_EXPIRED',
    MFA_REQUIRED: 'MFA_REQUIRED',
  },
}));

/**
 * Create a mock EntityManager with fork method
 */
function createMockEm() {
  const em = {
    fork: vi.fn(),
  };
  em.fork.mockReturnValue(em);
  return em;
}

describe('AuthService', () => {
  let authService: AuthService;
  let mockEm: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm = createMockEm();
    authService = new AuthService(mockEm as unknown as EntityManager);
  });

  describe('login', () => {
    it('should call performLogin with forked em and params', async () => {
      const mockResult = {
        success: true,
        user: {} as User,
      } as LoginResult;
      vi.mocked(performLogin).mockResolvedValue(mockResult);

      const params = {
        email: 'test@example.com',
        password: 'password123',
        source: SessionSource.WEB,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        sessionId: 'session-123',
      };

      const result = await authService.login(params);

      expect(mockEm.fork).toHaveBeenCalled();
      expect(performLogin).toHaveBeenCalledWith(mockEm, params);
      expect(result).toEqual(mockResult);
    });

    it('should return error result when login fails', async () => {
      const mockResult = {
        success: false,
        error: 'Invalid credentials',
        errorCode: LoginErrorCode.INVALID_CREDENTIALS,
      } as LoginResult;
      vi.mocked(performLogin).mockResolvedValue(mockResult);

      const params = {
        email: 'test@example.com',
        password: 'wrong-password',
        source: SessionSource.WEB,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        sessionId: 'session-123',
      };

      const result = await authService.login(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should call performLogout with forked em and params', async () => {
      vi.mocked(performLogout).mockResolvedValue(true);

      const result = await authService.logout(
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );

      expect(mockEm.fork).toHaveBeenCalled();
      expect(performLogout).toHaveBeenCalledWith(
        mockEm,
        'session-123',
        '127.0.0.1',
        'Test Agent',
      );
      expect(result).toBe(true);
    });

    it('should return false when session not found', async () => {
      vi.mocked(performLogout).mockResolvedValue(false);

      const result = await authService.logout(
        'non-existent',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result).toBe(false);
    });
  });

  describe('logoutAllSessions', () => {
    it('should call performLogoutAll with all params', async () => {
      vi.mocked(performLogoutAll).mockResolvedValue(5);

      const result = await authService.logoutAllSessions(
        'user-123',
        'current-session',
        '127.0.0.1',
        'Test Agent',
      );

      expect(mockEm.fork).toHaveBeenCalled();
      expect(performLogoutAll).toHaveBeenCalledWith(
        mockEm,
        'user-123',
        'current-session',
        '127.0.0.1',
        'Test Agent',
      );
      expect(result).toBe(5);
    });

    it('should work with optional params', async () => {
      vi.mocked(performLogoutAll).mockResolvedValue(3);

      const result = await authService.logoutAllSessions('user-123');

      expect(performLogoutAll).toHaveBeenCalledWith(
        mockEm,
        'user-123',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toBe(3);
    });
  });

  describe('requestPasswordReset', () => {
    it('should call performRequestReset with params', async () => {
      const mockResult: PasswordResetRequestResult = { success: true };
      vi.mocked(performRequestReset).mockResolvedValue(mockResult);

      const result = await authService.requestPasswordReset(
        'test@example.com',
        '127.0.0.1',
        'Test Agent',
      );

      expect(mockEm.fork).toHaveBeenCalled();
      expect(performRequestReset).toHaveBeenCalledWith(
        mockEm,
        'test@example.com',
        '127.0.0.1',
        'Test Agent',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('resetPassword', () => {
    it('should call performResetPassword with params', async () => {
      const mockResult: PasswordResetResult = { success: true };
      vi.mocked(performResetPassword).mockResolvedValue(mockResult);

      const result = await authService.resetPassword(
        'reset-token',
        'NewPassword123!',
        '127.0.0.1',
        'Test Agent',
      );

      expect(mockEm.fork).toHaveBeenCalled();
      expect(performResetPassword).toHaveBeenCalledWith(
        mockEm,
        'reset-token',
        'NewPassword123!',
        '127.0.0.1',
        'Test Agent',
      );
      expect(result).toEqual(mockResult);
    });

    it('should return error when reset fails', async () => {
      const mockResult: PasswordResetResult = {
        success: false,
        error: 'Invalid or expired token',
      };
      vi.mocked(performResetPassword).mockResolvedValue(mockResult);

      const result = await authService.resetPassword(
        'invalid-token',
        'NewPassword123!',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired token');
    });
  });

  describe('changePassword', () => {
    it('should call performChangePassword with params', async () => {
      const mockResult: PasswordResetResult = { success: true };
      vi.mocked(performChangePassword).mockResolvedValue(mockResult);

      const result = await authService.changePassword(
        'user-123',
        'OldPassword123!',
        'NewPassword456!',
        '127.0.0.1',
        'Test Agent',
      );

      expect(mockEm.fork).toHaveBeenCalled();
      expect(performChangePassword).toHaveBeenCalledWith(
        mockEm,
        'user-123',
        'OldPassword123!',
        'NewPassword456!',
        '127.0.0.1',
        'Test Agent',
      );
      expect(result).toEqual(mockResult);
    });

    it('should return error when current password is wrong', async () => {
      const mockResult: PasswordResetResult = {
        success: false,
        error: 'Current password is incorrect',
      };
      vi.mocked(performChangePassword).mockResolvedValue(mockResult);

      const result = await authService.changePassword(
        'user-123',
        'WrongPassword',
        'NewPassword456!',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).toBe(false);
    });
  });

  describe('getUserSessions', () => {
    it('should call fetchUserSessions and return sessions', async () => {
      const mockSessions = [
        { sid: 'session-1' },
        { sid: 'session-2' },
      ] as Session[];
      vi.mocked(fetchUserSessions).mockResolvedValue(mockSessions);

      const result = await authService.getUserSessions('user-123');

      expect(mockEm.fork).toHaveBeenCalled();
      expect(fetchUserSessions).toHaveBeenCalledWith(mockEm, 'user-123');
      expect(result).toEqual(mockSessions);
    });

    it('should return empty array when no sessions', async () => {
      vi.mocked(fetchUserSessions).mockResolvedValue([]);

      const result = await authService.getUserSessions('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('revokeSession', () => {
    it('should call performRevokeSession with params', async () => {
      vi.mocked(performRevokeSession).mockResolvedValue(true);

      const result = await authService.revokeSession(
        'user-123',
        'session-456',
        '127.0.0.1',
        'Test Agent',
      );

      expect(mockEm.fork).toHaveBeenCalled();
      expect(performRevokeSession).toHaveBeenCalledWith(
        mockEm,
        'user-123',
        'session-456',
        '127.0.0.1',
        'Test Agent',
      );
      expect(result).toBe(true);
    });

    it('should return false when session not found', async () => {
      vi.mocked(performRevokeSession).mockResolvedValue(false);

      const result = await authService.revokeSession(
        'user-123',
        'non-existent',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result).toBe(false);
    });
  });
});
