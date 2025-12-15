/**
 * Lockout configuration for failed login attempts
 */
export const LOCKOUT_CONFIG = {
  /** Attempts before first lockout */
  FIRST_LOCKOUT_ATTEMPTS: 5,
  /** Minutes for first lockout */
  FIRST_LOCKOUT_MINUTES: 15,
  /** Attempts before second lockout */
  SECOND_LOCKOUT_ATTEMPTS: 10,
  /** Minutes for second lockout */
  SECOND_LOCKOUT_MINUTES: 60,
  /** Attempts before long lockout */
  LONG_LOCKOUT_ATTEMPTS: 15,
  /** Minutes for long lockout (requires admin or password reset) */
  LONG_LOCKOUT_MINUTES: 24 * 60,
} as const;
