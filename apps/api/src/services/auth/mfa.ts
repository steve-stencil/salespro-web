import crypto from 'crypto';

import {
  User,
  Session,
  MfaRecoveryCode,
  LoginEventType,
  SessionSource,
} from '../../entities';
import {
  hashPassword,
  verifyPassword,
  generateBackupCode,
} from '../../lib/crypto';
import { emailService, isEmailServiceConfigured } from '../../lib/email';

import { logLoginEvent } from './events';

import type { EntityManager } from '@mikro-orm/core';

/**
 * MFA configuration constants
 */
export const MFA_CONFIG = {
  /** Length of MFA verification code */
  CODE_LENGTH: 6,
  /** Code expiration in minutes */
  CODE_EXPIRY_MINUTES: 5,
  /** Number of recovery codes to generate */
  RECOVERY_CODE_COUNT: 10,
  /** Max verification attempts before code invalidation */
  MAX_ATTEMPTS: 5,
} as const;

/**
 * MFA error codes for specific error handling
 */
export enum MfaErrorCode {
  CODE_EXPIRED = 'mfa_code_expired',
  CODE_INVALID = 'mfa_code_invalid',
  MFA_NOT_ENABLED = 'mfa_not_enabled',
  MFA_ALREADY_ENABLED = 'mfa_already_enabled',
  USER_NOT_FOUND = 'user_not_found',
  SESSION_NOT_FOUND = 'session_not_found',
  EMAIL_NOT_CONFIGURED = 'email_not_configured',
  RECOVERY_CODE_INVALID = 'recovery_code_invalid',
  NO_PENDING_MFA = 'no_pending_mfa',
}

/**
 * Result from MFA code generation/send
 */
export type MfaSendCodeResult = {
  success: boolean;
  error?: string;
  errorCode?: MfaErrorCode;
  /** Code expiry time in minutes */
  expiresIn?: number;
  /** MFA code (only returned in development mode) */
  code?: string;
};

/**
 * Result from MFA verification
 */
export type MfaVerifyResult = {
  success: boolean;
  user?: User;
  error?: string;
  errorCode?: MfaErrorCode;
};

/**
 * Result from enabling MFA
 */
export type MfaEnableResult = {
  success: boolean;
  recoveryCodes?: string[];
  error?: string;
  errorCode?: MfaErrorCode;
};

/**
 * Result from disabling MFA
 */
export type MfaDisableResult = {
  success: boolean;
  error?: string;
  errorCode?: MfaErrorCode;
};

/**
 * Store for pending MFA codes (in production, use Redis)
 * Key: pendingMfaUserId, Value: { code, expiresAt, attempts }
 */
const pendingMfaCodes = new Map<
  string,
  { code: string; expiresAt: Date; attempts: number }
>();

/**
 * Generate a random numeric code of specified length
 */
function generateNumericCode(length: number): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, digits.length);
    code += digits[randomIndex];
  }
  return code;
}

/**
 * Clean up expired pending MFA codes
 */
function cleanupExpiredCodes(): void {
  const now = new Date();
  for (const [userId, data] of pendingMfaCodes.entries()) {
    if (data.expiresAt < now) {
      pendingMfaCodes.delete(userId);
    }
  }
}

/**
 * Send MFA verification code to user's email
 * @param em - Entity manager
 * @param userId - User ID to send code to (from pendingMfaUserId)
 */
export async function sendMfaCode(
  em: EntityManager,
  userId: string,
): Promise<MfaSendCodeResult> {
  // Check if email service is configured
  if (!isEmailServiceConfigured()) {
    return {
      success: false,
      error: 'Email service is not configured',
      errorCode: MfaErrorCode.EMAIL_NOT_CONFIGURED,
    };
  }

  // Find the user
  const user = await em.findOne(User, { id: userId });
  if (!user) {
    return {
      success: false,
      error: 'User not found',
      errorCode: MfaErrorCode.USER_NOT_FOUND,
    };
  }

  // Generate a new code
  const code = generateNumericCode(MFA_CONFIG.CODE_LENGTH);
  const expiresAt = new Date(
    Date.now() + MFA_CONFIG.CODE_EXPIRY_MINUTES * 60 * 1000,
  );

  // Store the code
  pendingMfaCodes.set(userId, { code, expiresAt, attempts: 0 });

  // Clean up any expired codes
  cleanupExpiredCodes();

  // Send the email
  try {
    await emailService.sendMfaCodeEmail(
      user.email,
      code,
      MFA_CONFIG.CODE_EXPIRY_MINUTES,
    );

    const result: MfaSendCodeResult = {
      success: true,
      expiresIn: MFA_CONFIG.CODE_EXPIRY_MINUTES,
    };

    // Return code in development mode for testing
    if (process.env['NODE_ENV'] === 'development') {
      result.code = code;
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // In development mode, return the code even if email fails
    // This allows testing MFA without a configured email service
    if (process.env['NODE_ENV'] === 'development') {
      console.warn('MFA email failed in development, code still available:', {
        error: message,
      });
      return {
        success: true,
        expiresIn: MFA_CONFIG.CODE_EXPIRY_MINUTES,
        code,
      };
    }

    // In production, remove the stored code if email fails
    pendingMfaCodes.delete(userId);

    return {
      success: false,
      error: `Failed to send MFA code: ${message}`,
      errorCode: MfaErrorCode.EMAIL_NOT_CONFIGURED,
    };
  }
}

/**
 * Verify MFA code and complete login
 * @param em - Entity manager
 * @param pendingMfaUserId - User ID from session.pendingMfaUserId
 * @param code - Code entered by user
 * @param sessionId - Session ID to update
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 */
export async function verifyMfaCode(
  em: EntityManager,
  pendingMfaUserId: string,
  code: string,
  sessionId: string,
  ipAddress: string,
  userAgent: string,
): Promise<MfaVerifyResult> {
  // Check for pending MFA
  const pendingCode = pendingMfaCodes.get(pendingMfaUserId);
  if (!pendingCode) {
    return {
      success: false,
      error: 'No pending MFA verification',
      errorCode: MfaErrorCode.NO_PENDING_MFA,
    };
  }

  // Check if code is expired
  if (pendingCode.expiresAt < new Date()) {
    pendingMfaCodes.delete(pendingMfaUserId);
    return {
      success: false,
      error: 'MFA code has expired',
      errorCode: MfaErrorCode.CODE_EXPIRED,
    };
  }

  // Increment attempts
  pendingCode.attempts += 1;

  // Check if too many attempts
  if (pendingCode.attempts > MFA_CONFIG.MAX_ATTEMPTS) {
    pendingMfaCodes.delete(pendingMfaUserId);
    return {
      success: false,
      error: 'Too many failed attempts',
      errorCode: MfaErrorCode.CODE_INVALID,
    };
  }

  // Verify the code (constant-time comparison)
  const codeBuffer = Buffer.from(code);
  const storedBuffer = Buffer.from(pendingCode.code);
  if (
    codeBuffer.length !== storedBuffer.length ||
    !crypto.timingSafeEqual(codeBuffer, storedBuffer)
  ) {
    return {
      success: false,
      error: 'Invalid MFA code',
      errorCode: MfaErrorCode.CODE_INVALID,
    };
  }

  // Code is valid - clear from pending
  pendingMfaCodes.delete(pendingMfaUserId);

  // Find user
  const user = await em.findOne(
    User,
    { id: pendingMfaUserId },
    { populate: ['company'] },
  );
  if (!user) {
    return {
      success: false,
      error: 'User not found',
      errorCode: MfaErrorCode.USER_NOT_FOUND,
    };
  }

  // Update session to mark MFA as verified
  const session = await em.findOne(Session, { sid: sessionId });
  if (session) {
    session.mfaVerified = true;
    session.user = user;
    await em.flush();
  }

  // Log successful MFA verification
  await logLoginEvent(em, user, LoginEventType.LOGIN_SUCCESS, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
    metadata: { mfaVerified: true },
  });

  return {
    success: true,
    user,
  };
}

/**
 * Verify MFA using a recovery code
 * @param em - Entity manager
 * @param pendingMfaUserId - User ID from session.pendingMfaUserId
 * @param recoveryCode - Recovery code entered by user
 * @param sessionId - Session ID to update
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 */
export async function verifyMfaRecoveryCode(
  em: EntityManager,
  pendingMfaUserId: string,
  recoveryCode: string,
  sessionId: string,
  ipAddress: string,
  userAgent: string,
): Promise<MfaVerifyResult> {
  // Find user
  const user = await em.findOne(
    User,
    { id: pendingMfaUserId },
    { populate: ['company'] },
  );
  if (!user) {
    return {
      success: false,
      error: 'User not found',
      errorCode: MfaErrorCode.USER_NOT_FOUND,
    };
  }

  // Find unused recovery codes for this user
  const recoveryCodes = await em.find(MfaRecoveryCode, {
    user: { id: user.id },
    usedAt: null,
  });

  // Normalize the input (uppercase, remove dashes)
  const normalizedInput = recoveryCode.toUpperCase().replace(/-/g, '');

  // Check each recovery code (they're hashed with argon2)
  let matchedCode: MfaRecoveryCode | null = null;

  for (const code of recoveryCodes) {
    const isMatch = await verifyPassword(normalizedInput, code.codeHash);
    if (isMatch) {
      matchedCode = code;
      break;
    }
  }

  if (!matchedCode) {
    return {
      success: false,
      error: 'Invalid recovery code',
      errorCode: MfaErrorCode.RECOVERY_CODE_INVALID,
    };
  }

  // Mark recovery code as used
  matchedCode.usedAt = new Date();

  // Clear pending MFA
  pendingMfaCodes.delete(pendingMfaUserId);

  // Update session to mark MFA as verified
  const session = await em.findOne(Session, { sid: sessionId });
  if (session) {
    session.mfaVerified = true;
    session.user = user;
  }

  await em.flush();

  // Log recovery code usage
  await logLoginEvent(em, user, LoginEventType.MFA_BACKUP_CODE_USED, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
    metadata: { recoveryCodeId: matchedCode.id },
  });

  return {
    success: true,
    user,
  };
}

/**
 * Enable MFA for a user
 * @param em - Entity manager
 * @param userId - User ID to enable MFA for
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 */
export async function enableMfa(
  em: EntityManager,
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<MfaEnableResult> {
  const user = await em.findOne(User, { id: userId });
  if (!user) {
    return {
      success: false,
      error: 'User not found',
      errorCode: MfaErrorCode.USER_NOT_FOUND,
    };
  }

  if (user.mfaEnabled) {
    return {
      success: false,
      error: 'MFA is already enabled',
      errorCode: MfaErrorCode.MFA_ALREADY_ENABLED,
    };
  }

  // Generate recovery codes using the existing utility
  const plainRecoveryCodes: string[] = [];
  for (let i = 0; i < MFA_CONFIG.RECOVERY_CODE_COUNT; i++) {
    plainRecoveryCodes.push(generateBackupCode());
  }

  // Hash and store recovery codes
  for (const plainCode of plainRecoveryCodes) {
    const normalizedCode = plainCode.replace(/-/g, '');
    const codeHash = await hashPassword(normalizedCode);

    const recoveryCode = new MfaRecoveryCode();
    recoveryCode.user = user;
    recoveryCode.codeHash = codeHash;
    em.persist(recoveryCode);
  }

  // Enable MFA on user
  user.mfaEnabled = true;
  user.mfaEnabledAt = new Date();

  await em.flush();

  // Log MFA enabled event
  await logLoginEvent(em, user, LoginEventType.MFA_ENABLED, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
  });

  return {
    success: true,
    recoveryCodes: plainRecoveryCodes,
  };
}

/**
 * Disable MFA for a user
 * @param em - Entity manager
 * @param userId - User ID to disable MFA for
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 */
export async function disableMfa(
  em: EntityManager,
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<MfaDisableResult> {
  const user = await em.findOne(User, { id: userId });
  if (!user) {
    return {
      success: false,
      error: 'User not found',
      errorCode: MfaErrorCode.USER_NOT_FOUND,
    };
  }

  if (!user.mfaEnabled) {
    return {
      success: false,
      error: 'MFA is not enabled',
      errorCode: MfaErrorCode.MFA_NOT_ENABLED,
    };
  }

  // Remove all recovery codes
  const recoveryCodes = await em.find(MfaRecoveryCode, {
    user: { id: user.id },
  });
  for (const code of recoveryCodes) {
    em.remove(code);
  }

  // Disable MFA on user - use delete for optional properties with exactOptionalPropertyTypes
  user.mfaEnabled = false;
  delete user.mfaSecret;
  delete user.mfaEnabledAt;

  await em.flush();

  // Log MFA disabled event
  await logLoginEvent(em, user, LoginEventType.MFA_DISABLED, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
  });

  return {
    success: true,
  };
}

/**
 * Get remaining recovery codes count for a user
 * @param em - Entity manager
 * @param userId - User ID
 */
export async function getRecoveryCodeCount(
  em: EntityManager,
  userId: string,
): Promise<number> {
  return em.count(MfaRecoveryCode, {
    user: { id: userId },
    usedAt: null,
  });
}

/**
 * Regenerate recovery codes for a user (invalidates old codes)
 * @param em - Entity manager
 * @param userId - User ID
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 */
export async function regenerateRecoveryCodes(
  em: EntityManager,
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<MfaEnableResult> {
  const user = await em.findOne(User, { id: userId });
  if (!user) {
    return {
      success: false,
      error: 'User not found',
      errorCode: MfaErrorCode.USER_NOT_FOUND,
    };
  }

  if (!user.mfaEnabled) {
    return {
      success: false,
      error: 'MFA is not enabled',
      errorCode: MfaErrorCode.MFA_NOT_ENABLED,
    };
  }

  // Remove old recovery codes
  const oldCodes = await em.find(MfaRecoveryCode, { user: { id: user.id } });
  for (const code of oldCodes) {
    em.remove(code);
  }

  // Generate new recovery codes
  const plainRecoveryCodes: string[] = [];
  for (let i = 0; i < MFA_CONFIG.RECOVERY_CODE_COUNT; i++) {
    plainRecoveryCodes.push(generateBackupCode());
  }

  // Hash and store new recovery codes
  for (const plainCode of plainRecoveryCodes) {
    const normalizedCode = plainCode.replace(/-/g, '');
    const codeHash = await hashPassword(normalizedCode);

    const recoveryCode = new MfaRecoveryCode();
    recoveryCode.user = user;
    recoveryCode.codeHash = codeHash;
    em.persist(recoveryCode);
  }

  await em.flush();

  // Log recovery codes regenerated
  await logLoginEvent(em, user, LoginEventType.MFA_ENABLED, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
    metadata: { action: 'recovery_codes_regenerated' },
  });

  return {
    success: true,
    recoveryCodes: plainRecoveryCodes,
  };
}

/**
 * Check if user has pending MFA verification
 * @param userId - User ID to check
 */
export function hasPendingMfa(userId: string): boolean {
  const pending = pendingMfaCodes.get(userId);
  if (!pending) return false;
  return pending.expiresAt > new Date();
}

/**
 * Clear pending MFA for testing purposes
 */
export function clearPendingMfa(userId: string): void {
  pendingMfaCodes.delete(userId);
}
