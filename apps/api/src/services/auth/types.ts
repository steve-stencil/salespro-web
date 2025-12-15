import type { SessionSource, User } from '../../entities';

/**
 * Login request parameters
 */
export interface LoginParams {
  email: string;
  password: string;
  source: SessionSource;
  rememberMe?: boolean | undefined;
  ipAddress: string;
  userAgent: string;
  deviceId?: string | undefined;
  /** Session ID from express-session (req.sessionID) */
  sessionId: string;
}

/**
 * Login result returned from authentication
 */
export interface LoginResult {
  success: boolean;
  user?: User;
  requiresMfa?: boolean;
  error?: string;
  errorCode?: LoginErrorCode;
}

/**
 * Login error codes for specific error handling
 */
export enum LoginErrorCode {
  INVALID_CREDENTIALS = 'invalid_credentials',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_INACTIVE = 'account_inactive',
  EMAIL_NOT_VERIFIED = 'email_not_verified',
  PASSWORD_EXPIRED = 'password_expired',
  MFA_REQUIRED = 'mfa_required',
}

/**
 * Password reset request result
 */
export interface PasswordResetRequestResult {
  success: boolean;
  /** Token is only returned in development for testing */
  token?: string;
}

/**
 * Password reset result
 */
export interface PasswordResetResult {
  success: boolean;
  error?: string;
}
