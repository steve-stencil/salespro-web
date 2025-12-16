/**
 * Authentication context for global auth state management.
 * Provides user state, login/logout actions, and MFA handling.
 */
import {
  createContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';

import { ApiClientError } from '../lib/api-client';
import { authApi } from '../services/auth';

import type { User, AuthContextType } from '../types/auth';
import type { ReactNode } from 'react';

export const AuthContext = createContext<AuthContextType | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

/**
 * Authentication provider component.
 * Wraps the app to provide auth state and actions.
 */
export function AuthProvider({
  children,
}: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresMfa, setRequiresMfa] = useState(false);

  /**
   * Check authentication status on mount.
   * Fetches current user from /auth/me endpoint.
   */
  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch {
      // Not authenticated or session expired
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  /**
   * Authenticates user with email and password.
   * Returns { requiresMfa: true } if MFA verification is needed.
   */
  const login = useCallback(
    async (
      email: string,
      password: string,
      rememberMe = false,
    ): Promise<{ requiresMfa?: boolean }> => {
      const response = await authApi.login(email, password, rememberMe);

      if (response.requiresMfa) {
        setRequiresMfa(true);
        return { requiresMfa: true };
      }

      // Login successful - fetch full user data
      await checkAuth();
      return {};
    },
    [checkAuth],
  );

  /**
   * Verifies MFA code after login.
   */
  const verifyMfa = useCallback(
    async (code: string): Promise<void> => {
      await authApi.verifyMfa(code);
      setRequiresMfa(false);
      // Fetch full user data after MFA verification
      await checkAuth();
    },
    [checkAuth],
  );

  /**
   * Clears MFA requirement state (e.g., when navigating away from MFA page).
   */
  const clearMfaState = useCallback((): void => {
    setRequiresMfa(false);
  }, []);

  /**
   * Logs out the current user and clears state.
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch (error) {
      // Log error but still clear local state
      if (error instanceof ApiClientError) {
        console.error('Logout error:', error.message);
      }
    } finally {
      setUser(null);
      setRequiresMfa(false);
    }
  }, []);

  /**
   * Refreshes current user data from the server.
   */
  const refreshUser = useCallback(async (): Promise<void> => {
    await checkAuth();
  }, [checkAuth]);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      requiresMfa,
      login,
      logout,
      refreshUser,
      verifyMfa,
      clearMfaState,
    }),
    [
      user,
      isLoading,
      requiresMfa,
      login,
      logout,
      refreshUser,
      verifyMfa,
      clearMfaState,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}
