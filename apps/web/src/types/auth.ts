/**
 * Authentication types for the frontend application.
 * Re-exports shared types and adds web-specific types like AuthState.
 */

// Re-export shared auth types
export type {
  SessionSource,
  UserType,
  LoginRequest,
  LoginUser,
  LoginResponse,
  LoginErrorCode,
  CurrentUser,
  GetCurrentUserResponse,
  LogoutResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
  MfaResendResponse,
  ValidationErrorDetails,
  ApiErrorResponse,
} from '@shared/core';

import type { CurrentUser } from '@shared/core';

// ============================================================================
// Web-Specific Types (React Context)
// ============================================================================

/**
 * Re-export CurrentUser as User for backwards compatibility.
 * The web app previously used "User" as the type name.
 */
export type User = CurrentUser;

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
  verifyMfa: (code: string, trustDevice?: boolean) => Promise<void>;
  clearMfaState: () => void;
};
