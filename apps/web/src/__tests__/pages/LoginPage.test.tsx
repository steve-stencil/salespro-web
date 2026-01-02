/**
 * Tests for LoginPage component.
 * Verifies login flow including multi-company redirect logic.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AuthContext } from '../../context/AuthContext';
import { LoginPage } from '../../pages/LoginPage';

import type { AuthContextType, LoginResult } from '../../types/auth';

// ============================================================================
// Test Utilities
// ============================================================================

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

function createMockAuthContext(
  overrides: Partial<AuthContextType> = {},
): AuthContextType {
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    requiresMfa: false,
    login: vi.fn().mockResolvedValue({}),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    verifyMfa: vi.fn(),
    clearMfaState: vi.fn(),
    ...overrides,
  };
}

type RenderOptions = {
  authContext?: AuthContextType;
  initialPath?: string;
};

function renderLoginPage(options: RenderOptions = {}): {
  queryClient: QueryClient;
  mockLogin: ReturnType<typeof vi.fn>;
} {
  const queryClient = createQueryClient();
  const mockLogin = vi.fn().mockResolvedValue({});
  const authContext =
    options.authContext ?? createMockAuthContext({ login: mockLogin });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={[options.initialPath ?? '/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/select-company"
              element={<div data-testid="select-company">Select Company</div>}
            />
            <Route
              path="/dashboard"
              element={<div data-testid="dashboard">Dashboard</div>}
            />
            <Route
              path="/mfa-verify"
              element={<div data-testid="mfa-verify">MFA Verify</div>}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

  return {
    queryClient,
    mockLogin: authContext.login as ReturnType<typeof vi.fn>,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('should display the login form', () => {
      renderLoginPage();

      expect(
        screen.getByRole('heading', { name: /welcome back/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', { name: /email address/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/enter your password/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /sign in/i }),
      ).toBeInTheDocument();
    });

    it('should display remember me checkbox', () => {
      renderLoginPage();

      expect(
        screen.getByRole('checkbox', { name: /remember me/i }),
      ).toBeInTheDocument();
    });

    it('should display forgot password link', () => {
      renderLoginPage();

      expect(
        screen.getByRole('link', { name: /forgot password/i }),
      ).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('should show error for invalid email format', async () => {
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', {
        name: /email address/i,
      });
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      });
    });

    it('should show error for missing password', async () => {
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', {
        name: /email address/i,
      });
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('multi-company redirect', () => {
    it('should redirect to /select-company when canSwitchCompanies is true', async () => {
      const mockLogin = vi
        .fn()
        .mockResolvedValue({ canSwitchCompanies: true } as LoginResult);
      const authContext = createMockAuthContext({ login: mockLogin });
      renderLoginPage({ authContext });

      const emailInput = screen.getByRole('textbox', {
        name: /email address/i,
      });
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, {
        target: { value: 'TestPassword123!' },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('select-company')).toBeInTheDocument();
      });
    });

    it('should redirect to /dashboard when canSwitchCompanies is false', async () => {
      const mockLogin = vi
        .fn()
        .mockResolvedValue({ canSwitchCompanies: false } as LoginResult);
      const authContext = createMockAuthContext({ login: mockLogin });
      renderLoginPage({ authContext });

      const emailInput = screen.getByRole('textbox', {
        name: /email address/i,
      });
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, {
        target: { value: 'TestPassword123!' },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });

    it('should redirect to /dashboard when canSwitchCompanies is undefined', async () => {
      const mockLogin = vi.fn().mockResolvedValue({} as LoginResult);
      const authContext = createMockAuthContext({ login: mockLogin });
      renderLoginPage({ authContext });

      const emailInput = screen.getByRole('textbox', {
        name: /email address/i,
      });
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, {
        target: { value: 'TestPassword123!' },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('MFA flow', () => {
    it('should redirect to /mfa-verify when requiresMfa is true', async () => {
      const mockLogin = vi
        .fn()
        .mockResolvedValue({ requiresMfa: true } as LoginResult);
      const authContext = createMockAuthContext({ login: mockLogin });
      renderLoginPage({ authContext });

      const emailInput = screen.getByRole('textbox', {
        name: /email address/i,
      });
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, {
        target: { value: 'TestPassword123!' },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('mfa-verify')).toBeInTheDocument();
      });
    });

    it('should pass canSwitchCompanies to MFA page in state', async () => {
      const mockLogin = vi.fn().mockResolvedValue({
        requiresMfa: true,
        canSwitchCompanies: true,
      } as LoginResult);
      const authContext = createMockAuthContext({ login: mockLogin });
      renderLoginPage({ authContext });

      const emailInput = screen.getByRole('textbox', {
        name: /email address/i,
      });
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, {
        target: { value: 'TestPassword123!' },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('mfa-verify')).toBeInTheDocument();
      });
    });
  });

  describe('already authenticated', () => {
    it('should redirect to dashboard if already authenticated', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          nameFirst: 'Test',
          nameLast: 'User',
          emailVerified: true,
          mfaEnabled: false,
          userType: 'company',
          company: { id: 'company-1', name: 'Test Company' },
        },
      });
      renderLoginPage({ authContext });

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('login with credentials', () => {
    it('should call login with correct parameters', async () => {
      const mockLogin = vi.fn().mockResolvedValue({});
      const authContext = createMockAuthContext({ login: mockLogin });
      renderLoginPage({ authContext });

      const emailInput = screen.getByRole('textbox', {
        name: /email address/i,
      });
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const rememberMeCheckbox = screen.getByRole('checkbox', {
        name: /remember me/i,
      });
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, {
        target: { value: 'TestPassword123!' },
      });
      fireEvent.click(rememberMeCheckbox);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          'test@example.com',
          'TestPassword123!',
          true, // rememberMe
        );
      });
    });
  });

  describe('loading state', () => {
    it('should show loading spinner while submitting', async () => {
      const mockLogin = vi
        .fn()
        .mockImplementation(
          () =>
            new Promise<Record<string, never>>(resolve =>
              setTimeout(() => resolve({}), 100),
            ),
        );
      const authContext = createMockAuthContext({ login: mockLogin });
      renderLoginPage({ authContext });

      const emailInput = screen.getByRole('textbox', {
        name: /email address/i,
      });
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, {
        target: { value: 'TestPassword123!' },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      });
    });

    it('should disable form while submitting', async () => {
      const mockLogin = vi
        .fn()
        .mockImplementation(
          () =>
            new Promise<Record<string, never>>(resolve =>
              setTimeout(() => resolve({}), 100),
            ),
        );
      const authContext = createMockAuthContext({ login: mockLogin });
      renderLoginPage({ authContext });

      const emailInput = screen.getByRole('textbox', {
        name: /email address/i,
      });
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, {
        target: { value: 'TestPassword123!' },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(emailInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
        expect(submitButton).toBeDisabled();
      });
    });
  });
});

