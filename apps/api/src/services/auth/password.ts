import {
  User,
  PasswordResetToken,
  PasswordHistory,
  LoginEventType,
  SessionSource,
  Session,
} from '../../entities';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
} from '../../lib/crypto';

import { logLoginEvent } from './events';

import type { PasswordResetRequestResult, PasswordResetResult } from './types';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Request a password reset and generate token
 */
export async function requestPasswordReset(
  em: EntityManager,
  email: string,
  ipAddress: string,
  userAgent: string,
): Promise<PasswordResetRequestResult> {
  const user = await em.findOne(User, { email: email.toLowerCase() });

  if (!user) {
    return { success: true };
  }

  await em.nativeDelete(PasswordResetToken, { user: user.id });

  const token = generateSecureToken(32);
  const resetToken = new PasswordResetToken();
  resetToken.tokenHash = hashToken(token);
  resetToken.user = user;
  resetToken.expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  em.persist(resetToken);

  await logLoginEvent(em, user, LoginEventType.PASSWORD_RESET_REQUESTED, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
  });

  await em.flush();

  if (process.env['NODE_ENV'] === 'development') {
    return { success: true, token };
  }
  return { success: true };
}

/**
 * Reset password using a token
 */
export async function resetPassword(
  em: EntityManager,
  token: string,
  newPassword: string,
  ipAddress: string,
  userAgent: string,
): Promise<PasswordResetResult> {
  const tokenHash = hashToken(token);
  const resetToken = await em.findOne(
    PasswordResetToken,
    { tokenHash, usedAt: null },
    { populate: ['user', 'user.company'] },
  );

  if (!resetToken || !resetToken.isValid) {
    return { success: false, error: 'Invalid or expired reset token' };
  }

  const user = resetToken.user;

  const validationError = await validatePassword(em, user, newPassword);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const passwordHash = await hashPassword(newPassword);

  const history = new PasswordHistory();
  history.user = user;
  history.passwordHash = user.passwordHash;
  em.persist(history);

  user.passwordHash = passwordHash;
  user.needsResetPassword = false;
  user.failedLoginAttempts = 0;
  delete user.lockedUntil;
  delete user.lastFailedLoginAt;
  user.forceLogoutAt = new Date();

  resetToken.usedAt = new Date();

  await em.nativeDelete(Session, { user: user.id });

  await logLoginEvent(em, user, LoginEventType.PASSWORD_RESET_COMPLETED, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
  });

  await em.flush();

  return { success: true };
}

/**
 * Change password for authenticated user
 */
export async function changePassword(
  em: EntityManager,
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress: string,
  userAgent: string,
): Promise<PasswordResetResult> {
  const user = await em.findOne(
    User,
    { id: userId },
    { populate: ['company'] },
  );

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const passwordValid = await verifyPassword(
    currentPassword,
    user.passwordHash,
  );
  if (!passwordValid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  const validationError = await validatePassword(em, user, newPassword);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const passwordHash = await hashPassword(newPassword);

  const history = new PasswordHistory();
  history.user = user;
  history.passwordHash = user.passwordHash;
  em.persist(history);

  user.passwordHash = passwordHash;

  await logLoginEvent(em, user, LoginEventType.PASSWORD_CHANGED, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
  });

  await em.flush();

  return { success: true };
}

/**
 * Validate password against company policy and history
 */
export async function validatePassword(
  em: EntityManager,
  user: User,
  password: string,
): Promise<string | null> {
  const policy = user.company.passwordPolicy;

  if (password.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters`;
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }

  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }

  if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain at least one special character';
  }

  if (policy.historyCount > 0) {
    const history = await em.find(
      PasswordHistory,
      { user: user.id },
      { orderBy: { createdAt: 'DESC' }, limit: policy.historyCount },
    );

    for (const h of history) {
      if (await verifyPassword(password, h.passwordHash)) {
        return `Cannot reuse any of your last ${policy.historyCount} passwords`;
      }
    }

    if (await verifyPassword(password, user.passwordHash)) {
      return 'Cannot reuse your current password';
    }
  }

  return null;
}
