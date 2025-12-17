/**
 * Authentication types for the frontend application.
 * These types match the API specification in docs/FRONTEND_AUTH_API.md
 */

/** Session source platforms */
export type SessionSource = 'web' | 'ios' | 'android' | 'api';

/** Login request payload */
export type LoginRequest = {
  email: string;
  password: string;
  source?: SessionSource;
  rememberMe?: boolean;
};

/** Basic user info returned on login */
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
  requiresMfa?: boolean;
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

/** User type - company user vs internal platform user */
export type UserType = 'company' | 'internal';

/** Full user profile from /auth/me */
export type User = {
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
};

/**
 * Response from /auth/me endpoint.
 * Can be either full user data or a flag indicating MFA is required.
 */
export type GetCurrentUserResponse = User | { requiresMfa: true };

/** Validation error details from API */
export type ValidationErrorDetails = {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
};

/** API error response structure */
export type ApiErrorResponse = {
  error: string;
  errorCode?: string;
  details?: ValidationErrorDetails;
};

/** Logout response */
export type LogoutResponse = {
  message: string;
};

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

/** MFA verification request */
export type MfaVerifyRequest = {
  code: string;
};

/** MFA verification response */
export type MfaVerifyResponse = {
  message: string;
  user?: LoginUser;
};

/** Auth context state */
export type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requiresMfa: boolean;
};

/** Auth context actions */
export type AuthContextType = AuthState & {
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{ requiresMfa?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  clearMfaState: () => void;
};
