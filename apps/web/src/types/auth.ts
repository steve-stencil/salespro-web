/**
 * Authentication types for the frontend application.
 * These types match the API specification in docs/FRONTEND_AUTH_API.md
 */

/** Session source platforms */
export type SessionSource = 'web' | 'ios' | 'android' | 'api';

/** Login request payload */
export interface LoginRequest {
  email: string;
  password: string;
  source?: SessionSource;
  rememberMe?: boolean;
}

/** Basic user info returned on login */
export interface LoginUser {
  id: string;
  email: string;
  nameFirst: string;
  nameLast: string;
}

/** Login response from API */
export interface LoginResponse {
  message: string;
  user?: LoginUser;
  requiresMfa?: boolean;
  error?: string;
  errorCode?: LoginErrorCode;
}

/** Login error codes for programmatic handling */
export type LoginErrorCode =
  | 'invalid_credentials'
  | 'account_locked'
  | 'account_inactive'
  | 'email_not_verified'
  | 'password_expired'
  | 'mfa_required';

/** Full user profile from /auth/me */
export interface User {
  id: string;
  email: string;
  nameFirst: string;
  nameLast: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  company: {
    id: string;
    name: string;
  };
}

/** Validation error details from API */
export interface ValidationErrorDetails {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
}

/** API error response structure */
export interface ApiErrorResponse {
  error: string;
  errorCode?: string;
  details?: ValidationErrorDetails;
}

/** Logout response */
export interface LogoutResponse {
  message: string;
}

/** Forgot password request */
export interface ForgotPasswordRequest {
  email: string;
}

/** Forgot password response */
export interface ForgotPasswordResponse {
  message: string;
}

/** Reset password request */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

/** Reset password response */
export interface ResetPasswordResponse {
  message: string;
}

/** MFA verification request */
export interface MfaVerifyRequest {
  code: string;
}

/** MFA verification response */
export interface MfaVerifyResponse {
  message: string;
  user?: LoginUser;
}

/** Auth context state */
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requiresMfa: boolean;
}

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
