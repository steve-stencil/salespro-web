import crypto from 'crypto';

import { env } from './env';

import type { SessionOptions } from 'express-session';

/**
 * Session duration constants (in milliseconds)
 */
export const SESSION_DURATIONS = {
  /** Short session for non-remembered logins (2 hours) */
  SHORT: 2 * 60 * 60 * 1000,
  /** Default sliding expiration (7 days) */
  DEFAULT: 7 * 24 * 60 * 60 * 1000,
  /** Remember me session (30 days) */
  REMEMBER_ME: 30 * 24 * 60 * 60 * 1000,
  /** Absolute maximum session lifetime (30 days) */
  ABSOLUTE_MAX: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Session cleanup intervals (in milliseconds)
 */
export const CLEANUP_INTERVALS = {
  /** Interval for batch cleanup of expired sessions */
  SESSION_CLEANUP: 15 * 60 * 1000, // 15 minutes
} as const;

/**
 * Get base session options for express-session.
 * Store should be provided separately.
 */
export function getSessionOptions(): Omit<SessionOptions, 'store'> {
  const isProduction = env.NODE_ENV === 'production';

  return {
    name: 'sid',
    secret: env.SESSION_SECRET ?? 'dev-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on each request
    // Generate UUID session IDs (required for our PostgreSQL sid column)
    genid: () => crypto.randomUUID(),
    cookie: {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      maxAge: SESSION_DURATIONS.DEFAULT,
      path: '/',
    },
  };
}

/**
 * Cookie options for remember me tokens (separate from session)
 */
export function getRememberMeCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
} {
  const isProduction = env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: SESSION_DURATIONS.REMEMBER_ME,
    path: '/',
  };
}
