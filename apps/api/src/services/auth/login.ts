import { SESSION_DURATIONS } from '../../config/session';
import {
  User,
  Session,
  LoginAttempt,
  LoginEventType,
  UserType,
} from '../../entities';
import { verifyPassword } from '../../lib/crypto';

import { LOCKOUT_CONFIG } from './config';
import { logLoginEvent } from './events';
import {
  verifyTrustedDevice,
  updateTrustedDeviceLastSeen,
} from './trusted-device';
import { LoginErrorCode } from './types';

import type { LoginParams, LoginResult } from './types';
import type { SessionSource } from '../../entities';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Authenticate a user and return login result
 */
export async function login(
  em: EntityManager,
  params: LoginParams,
): Promise<LoginResult> {
  const {
    email,
    password,
    source,
    ipAddress,
    userAgent,
    deviceId,
    sessionId,
    deviceTrustToken,
  } = params;

  const user = await em.findOne(
    User,
    { email: email.toLowerCase() },
    { populate: ['company'] },
  );

  const attempt = new LoginAttempt();
  attempt.email = email.toLowerCase();
  attempt.ipAddress = ipAddress;
  attempt.userAgent = userAgent;

  if (!user) {
    attempt.success = false;
    attempt.failureReason = 'invalid_credentials';
    em.persist(attempt);
    await em.flush();
    return {
      success: false,
      error: 'Invalid credentials',
      errorCode: LoginErrorCode.INVALID_CREDENTIALS,
    };
  }

  if (user.isLocked) {
    attempt.success = false;
    attempt.failureReason = 'account_locked';
    em.persist(attempt);
    await em.flush();

    await logLoginEvent(em, user, LoginEventType.LOGIN_FAILED, {
      ipAddress,
      userAgent,
      source,
      metadata: { reason: 'account_locked' },
    });

    return {
      success: false,
      error:
        'Account is temporarily locked. Please try again later or reset your password.',
      errorCode: LoginErrorCode.ACCOUNT_LOCKED,
    };
  }

  if (!user.isActive) {
    attempt.success = false;
    attempt.failureReason = 'inactive';
    em.persist(attempt);
    await em.flush();
    return {
      success: false,
      error: 'Account is deactivated',
      errorCode: LoginErrorCode.ACCOUNT_INACTIVE,
    };
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid) {
    attempt.success = false;
    attempt.failureReason = 'invalid_password';
    em.persist(attempt);
    await handleFailedLogin(em, user, ipAddress, userAgent, source);
    return {
      success: false,
      error: 'Invalid credentials',
      errorCode: LoginErrorCode.INVALID_CREDENTIALS,
    };
  }

  if (user.needsResetPassword) {
    attempt.success = false;
    attempt.failureReason = 'password_expired';
    em.persist(attempt);
    await em.flush();
    return {
      success: false,
      error: 'Password reset required',
      errorCode: LoginErrorCode.PASSWORD_EXPIRED,
    };
  }

  if (user.mfaEnabled || user.company?.mfaRequired) {
    // Check if device is trusted before requiring MFA
    if (deviceTrustToken) {
      const trustResult = await verifyTrustedDevice(
        em,
        user.id,
        deviceTrustToken,
      );

      if (trustResult.trusted && trustResult.device) {
        // Device is trusted - skip MFA and update last seen
        await updateTrustedDeviceLastSeen(em, trustResult.device, ipAddress);

        // Continue with successful login (skip MFA)
        await handleSuccessfulLogin(em, user, sessionId, {
          source,
          ipAddress,
          userAgent,
          deviceId,
          rememberMe: params.rememberMe,
        });

        attempt.success = true;
        em.persist(attempt);
        await em.flush();

        return { success: true, user };
      }
    }

    // Device not trusted or no token - require MFA
    attempt.success = true;
    em.persist(attempt);
    await em.flush();
    return { success: true, user, requiresMfa: true };
  }

  await handleSuccessfulLogin(em, user, sessionId, {
    source,
    ipAddress,
    userAgent,
    deviceId,
    rememberMe: params.rememberMe,
  });

  attempt.success = true;
  em.persist(attempt);
  await em.flush();

  return { success: true, user };
}

/**
 * Handle successful login - manage sessions and enforce limits
 * @param sessionId - Session ID from express-session (req.sessionID)
 */
export async function handleSuccessfulLogin(
  em: EntityManager,
  user: User,
  sessionId: string,
  params: {
    source: SessionSource;
    ipAddress: string;
    userAgent: string;
    deviceId?: string | undefined;
    rememberMe?: boolean | undefined;
  },
): Promise<Session> {
  const { source, ipAddress, userAgent, deviceId, rememberMe } = params;

  await em.nativeDelete(Session, { user: user.id, source });

  const existingSessions = await em.count(Session, { user: user.id });
  const maxSessions = user.maxSessions;

  if (existingSessions >= maxSessions) {
    const oldestSession = await em.findOne(
      Session,
      { user: user.id },
      { orderBy: { createdAt: 'ASC' } },
    );

    if (oldestSession) {
      await logLoginEvent(em, user, LoginEventType.SESSION_REVOKED, {
        ipAddress,
        userAgent,
        source,
        metadata: {
          reason: 'session_limit_exceeded',
          revokedSessionId: oldestSession.sid,
        },
      });
      em.remove(oldestSession);
    }
  }

  const now = new Date();
  const slidingExpiry = rememberMe
    ? new Date(now.getTime() + SESSION_DURATIONS.REMEMBER_ME)
    : new Date(now.getTime() + SESSION_DURATIONS.DEFAULT);

  // Try to find existing session first (created by MikroOrmStore)
  // If not found, create a new one
  let session = await em.findOne(Session, { sid: sessionId });
  if (!session) {
    session = new Session();
    session.sid = sessionId;
    session.data = {};
    em.persist(session);
  }

  // Update session with user/company info
  session.user = user;
  session.company = user.company;
  session.source = source;
  session.expiresAt = slidingExpiry;
  session.absoluteExpiresAt = new Date(
    now.getTime() + SESSION_DURATIONS.ABSOLUTE_MAX,
  );
  session.ipAddress = ipAddress;
  session.userAgent = userAgent;
  if (deviceId) {
    session.deviceId = deviceId;
  }
  session.mfaVerified = !user.mfaEnabled;

  // For internal users, auto-set activeCompany to their home company on login
  // This provides a default company context so they can access company resources immediately
  const userType = user.userType as UserType;
  if (userType === UserType.INTERNAL && user.company) {
    session.activeCompany = user.company;
  }

  user.failedLoginAttempts = 0;
  delete user.lockedUntil;
  delete user.lastFailedLoginAt;
  user.lastLoginDate = now;

  await logLoginEvent(em, user, LoginEventType.LOGIN_SUCCESS, {
    ipAddress,
    userAgent,
    source,
  });

  await em.flush();
  return session;
}

/**
 * Handle failed login - track attempts and lock account if needed
 */
export async function handleFailedLogin(
  em: EntityManager,
  user: User,
  ipAddress: string,
  userAgent: string,
  source: SessionSource,
): Promise<void> {
  user.failedLoginAttempts += 1;
  user.lastFailedLoginAt = new Date();

  const attempts = user.failedLoginAttempts;
  let lockoutMinutes = 0;

  if (attempts >= LOCKOUT_CONFIG.LONG_LOCKOUT_ATTEMPTS) {
    lockoutMinutes = LOCKOUT_CONFIG.LONG_LOCKOUT_MINUTES;
  } else if (attempts >= LOCKOUT_CONFIG.SECOND_LOCKOUT_ATTEMPTS) {
    lockoutMinutes = LOCKOUT_CONFIG.SECOND_LOCKOUT_MINUTES;
  } else if (attempts >= LOCKOUT_CONFIG.FIRST_LOCKOUT_ATTEMPTS) {
    lockoutMinutes = LOCKOUT_CONFIG.FIRST_LOCKOUT_MINUTES;
  }

  if (lockoutMinutes > 0) {
    user.lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
    await logLoginEvent(em, user, LoginEventType.ACCOUNT_LOCKED, {
      ipAddress,
      userAgent,
      source,
      metadata: { attempts, lockoutMinutes },
    });
  }

  await logLoginEvent(em, user, LoginEventType.LOGIN_FAILED, {
    ipAddress,
    userAgent,
    source,
    metadata: { attempts },
  });

  await em.flush();
}
