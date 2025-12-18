import type { SessionSource, User } from '../../entities';

/**
 * Login request parameters
 */
export type LoginParams = {
  email: string;
  password: string;
  source: SessionSource;
  rememberMe?: boolean | undefined;
  ipAddress: string;
  userAgent: string;
  deviceId?: string | undefined;
  /** Session ID from express-session (req.sessionID) */
  sessionId: string;
  /** Device trust token from cookie for MFA bypass */
  deviceTrustToken?: string | undefined;
};

/**
 * Active company info returned in login response
 */
export type ActiveCompanyInfo = {
  id: string;
  name: string;
};

/**
 * Login result returned from authentication
 */
export type LoginResult = {
  success: boolean;
  user?: User;
  requiresMfa?: boolean;
  error?: string;
  errorCode?: LoginErrorCode;
  /** Currently active company for the session */
  activeCompany?: ActiveCompanyInfo;
  /** Whether user can switch between multiple companies */
  canSwitchCompanies?: boolean;
};

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
  NO_ACTIVE_COMPANIES = 'no_active_companies',
}

/**
 * Password reset request result
 */
export type PasswordResetRequestResult = {
  success: boolean;
  /** Token is only returned in development for testing */
  token?: string;
};

/**
 * Password reset result
 */
export type PasswordResetResult = {
  success: boolean;
  error?: string;
};
