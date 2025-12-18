/**
 * Authentication types shared between API and web applications.
 * These types define the contract for authentication-related API endpoints.
 */

// ============================================================================
// Session Types
// ============================================================================

/** Session source platforms */
export type SessionSource = 'web' | 'ios' | 'android' | 'api';

/** User type - company user vs internal platform user */
export type UserType = 'company' | 'internal';

// ============================================================================
// Login Types
// ============================================================================

/** Login request payload */
export type LoginRequest = {
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
  /** Client platform identifier */
  source?: SessionSource;
  /** Extend session to 30 days */
  rememberMe?: boolean;
};

/** Basic user info returned on successful login */
export type LoginUser = {
  id: string;
  email: string;
  nameFirst: string;
  nameLast: string;
};

/** Login response from API */
export type LoginResponse = {
  message: string;
  user?: LoginUser;
  /** True if MFA verification is required before login completes */
  requiresMfa?: boolean;
  /** True if user has access to multiple companies and can switch between them */
  canSwitchCompanies?: boolean;
  error?: string;
  errorCode?: LoginErrorCode;
};

/** Login error codes for programmatic handling */
export type LoginErrorCode =
  | 'invalid_credentials'
  | 'account_locked'
  | 'account_inactive'
  | 'email_not_verified'
  | 'password_expired'
  | 'mfa_required';

// ============================================================================
// Current User Types
// ============================================================================

/** Full user profile from /auth/me endpoint */
export type CurrentUser = {
  id: string;
  email: string;
  nameFirst: string;
  nameLast: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  userType: UserType;
  company: {
    id: string;
    name: string;
  };
  /** True if user has access to multiple companies and can switch between them */
  canSwitchCompanies?: boolean;
};

/**
 * Response from /auth/me endpoint.
 * Can be either full user data or a flag indicating MFA is required.
 */
export type GetCurrentUserResponse = CurrentUser | { requiresMfa: true };

// ============================================================================
// Logout Types
// ============================================================================

/** Logout response */
export type LogoutResponse = {
  message: string;
};

// ============================================================================
// Password Reset Types
// ============================================================================

/** Forgot password request */
export type ForgotPasswordRequest = {
  email: string;
};

/** Forgot password response */
export type ForgotPasswordResponse = {
  message: string;
};

/** Reset password request */
export type ResetPasswordRequest = {
  token: string;
  password: string;
};

/** Reset password response */
export type ResetPasswordResponse = {
  message: string;
};

// ============================================================================
// MFA Types
// ============================================================================

/** MFA verification request */
export type MfaVerifyRequest = {
  /** 6-digit MFA code */
  code: string;
  /** Whether to trust this device for future logins (skip MFA for 30 days) */
  trustDevice?: boolean;
};

/** MFA verification response */
export type MfaVerifyResponse = {
  message: string;
  user?: LoginUser;
};

/** MFA resend code response */
export type MfaResendResponse = {
  message: string;
  /** Expiration time in minutes */
  expiresIn: number;
};

// ============================================================================
// Validation Types
// ============================================================================

/** Validation error details from API */
export type ValidationErrorDetails = {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
};

/** Standard API error response structure */
export type ApiErrorResponse = {
  error: string;
  errorCode?: string;
  details?: ValidationErrorDetails;
};
