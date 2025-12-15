import {
  login as performLogin,
  logout as performLogout,
  logoutAllSessions as performLogoutAll,
  getUserSessions as fetchUserSessions,
  revokeSession as performRevokeSession,
  requestPasswordReset as performRequestReset,
  resetPassword as performResetPassword,
  changePassword as performChangePassword,
  sendMfaCode as performSendMfaCode,
  verifyMfaCode as performVerifyMfaCode,
  verifyMfaRecoveryCode as performVerifyMfaRecoveryCode,
  enableMfa as performEnableMfa,
  disableMfa as performDisableMfa,
  getRecoveryCodeCount as fetchRecoveryCodeCount,
  regenerateRecoveryCodes as performRegenerateRecoveryCodes,
} from './auth';

import type { Session } from '../entities';
import type {
  LoginParams,
  LoginResult,
  PasswordResetRequestResult,
  PasswordResetResult,
  MfaSendCodeResult,
  MfaVerifyResult,
  MfaEnableResult,
  MfaDisableResult,
} from './auth';
import type { EntityManager } from '@mikro-orm/core';

// Re-export types for external use
export { LoginErrorCode, MfaErrorCode } from './auth';
export type {
  LoginParams,
  LoginResult,
  PasswordResetRequestResult,
  PasswordResetResult,
  MfaSendCodeResult,
  MfaVerifyResult,
  MfaEnableResult,
  MfaDisableResult,
} from './auth';

/**
 * Authentication service facade.
 * Provides a unified interface to authentication operations.
 */
export class AuthService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Authenticate a user and create a session
   */
  async login(params: LoginParams): Promise<LoginResult> {
    return performLogin(this.em.fork(), params);
  }

  /**
   * Logout - destroy a specific session
   */
  async logout(
    sessionId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<boolean> {
    return performLogout(this.em.fork(), sessionId, ipAddress, userAgent);
  }

  /**
   * Logout all sessions for a user except the current one
   */
  async logoutAllSessions(
    userId: string,
    currentSessionId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<number> {
    return performLogoutAll(
      this.em.fork(),
      userId,
      currentSessionId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Request a password reset
   */
  async requestPasswordReset(
    email: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<PasswordResetRequestResult> {
    return performRequestReset(this.em.fork(), email, ipAddress, userAgent);
  }

  /**
   * Reset password using a token
   */
  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<PasswordResetResult> {
    return performResetPassword(
      this.em.fork(),
      token,
      newPassword,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<PasswordResetResult> {
    return performChangePassword(
      this.em.fork(),
      userId,
      currentPassword,
      newPassword,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Get a user's active sessions
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    return fetchUserSessions(this.em.fork(), userId);
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<boolean> {
    return performRevokeSession(
      this.em.fork(),
      userId,
      sessionId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Send MFA verification code to user's email
   */
  async sendMfaCode(userId: string): Promise<MfaSendCodeResult> {
    return performSendMfaCode(this.em.fork(), userId);
  }

  /**
   * Verify MFA code and complete login
   */
  async verifyMfaCode(
    pendingMfaUserId: string,
    code: string,
    sessionId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<MfaVerifyResult> {
    return performVerifyMfaCode(
      this.em.fork(),
      pendingMfaUserId,
      code,
      sessionId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Verify MFA using a recovery code
   */
  async verifyMfaRecoveryCode(
    pendingMfaUserId: string,
    recoveryCode: string,
    sessionId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<MfaVerifyResult> {
    return performVerifyMfaRecoveryCode(
      this.em.fork(),
      pendingMfaUserId,
      recoveryCode,
      sessionId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Enable MFA for a user
   */
  async enableMfa(
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<MfaEnableResult> {
    return performEnableMfa(this.em.fork(), userId, ipAddress, userAgent);
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<MfaDisableResult> {
    return performDisableMfa(this.em.fork(), userId, ipAddress, userAgent);
  }

  /**
   * Get remaining recovery codes count for a user
   */
  async getRecoveryCodeCount(userId: string): Promise<number> {
    return fetchRecoveryCodeCount(this.em.fork(), userId);
  }

  /**
   * Regenerate recovery codes for a user
   */
  async regenerateRecoveryCodes(
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<MfaEnableResult> {
    return performRegenerateRecoveryCodes(
      this.em.fork(),
      userId,
      ipAddress,
      userAgent,
    );
  }
}
