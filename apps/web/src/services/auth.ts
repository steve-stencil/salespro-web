/**
 * Authentication API service.
 * Provides methods for login, logout, password reset, and MFA verification.
 */
import { apiClient } from '../lib/api-client';

import type {
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  User,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
} from '../types/auth';

/**
 * Authentication API methods.
 */
export const authApi = {
  /**
   * Authenticates a user and creates a session.
   * Session cookie is set automatically by the server.
   *
   * @param email - User's email address
   * @param password - User's password
   * @param rememberMe - Extend session to 30 days (default: false)
   * @returns Login response with user data or MFA requirement
   */
  login: async (
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<LoginResponse> => {
    const request: LoginRequest = {
      email,
      password,
      source: 'web',
      rememberMe,
    };
    return apiClient.post<LoginResponse>('/auth/login', request);
  },

  /**
   * Ends the current session and clears the session cookie.
   */
  logout: async (): Promise<LogoutResponse> => {
    return apiClient.post<LogoutResponse>('/auth/logout');
  },

  /**
   * Retrieves the currently authenticated user's profile.
   * Uses the session cookie for authentication.
   */
  getCurrentUser: async (): Promise<User> => {
    return apiClient.get<User>('/auth/me');
  },

  /**
   * Requests a password reset email.
   * Always returns success to prevent email enumeration attacks.
   *
   * @param email - Email address to send reset link to
   */
  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const request: ForgotPasswordRequest = { email };
    return apiClient.post<ForgotPasswordResponse>(
      '/auth/password/forgot',
      request,
    );
  },

  /**
   * Resets the user's password using a token from the email link.
   *
   * @param token - Reset token from email
   * @param password - New password (minimum 8 characters)
   */
  resetPassword: async (
    token: string,
    password: string,
  ): Promise<ResetPasswordResponse> => {
    const request: ResetPasswordRequest = { token, password };
    return apiClient.post<ResetPasswordResponse>(
      '/auth/password/reset',
      request,
    );
  },

  /**
   * Verifies MFA code after login when MFA is enabled.
   *
   * @param code - 6-digit MFA code
   */
  verifyMfa: async (code: string): Promise<MfaVerifyResponse> => {
    const request: MfaVerifyRequest = { code };
    return apiClient.post<MfaVerifyResponse>('/auth/mfa/verify', request);
  },
};
