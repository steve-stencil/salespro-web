import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuthContext } from '../../context/AuthContext';
import { LoginPage } from '../../pages/LoginPage';

import type { AuthContextType } from '../../types/auth';

// Mock the API client to avoid actual network requests
vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    apiError: { details?: unknown };
    constructor(message: string, apiError: { details?: unknown } = {}) {
      super(message);
      this.apiError = apiError;
    }
  },
}));

// Test wrapper with all required providers
function createTestWrapper(authValue: AuthContextType) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={['/login']}>{children}</MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  };
}

// Default mock auth context values
function createMockAuthContext(
  overrides?: Partial<AuthContextType>,
): AuthContextType {
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    requiresMfa: false,
    login: vi.fn().mockResolvedValue({}),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    verifyMfa: vi.fn().mockResolvedValue(undefined),
    clearMfaState: vi.fn(),
    ...overrides,
  };
}

describe('App Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Page', () => {
    it('should render the login page with form elements', async () => {
      const mockAuth = createMockAuthContext();
      const Wrapper = createTestWrapper(mockAuth);

      render(
        <Wrapper>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Wrapper>,
      );

      // Wait for the page to render
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Check for form elements
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /sign in/i }),
      ).toBeInTheDocument();
    });

    it('should display validation errors for empty form submission', async () => {
      const user = userEvent.setup();
      const mockAuth = createMockAuthContext();
      const Wrapper = createTestWrapper(mockAuth);

      render(
        <Wrapper>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Click sign in without filling form
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Validation errors should appear
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      const mockAuth = createMockAuthContext();
      const Wrapper = createTestWrapper(mockAuth);

      render(
        <Wrapper>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Enter invalid email
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');

      // Enter valid password - use the specific input field
      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'password123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Email validation error should appear
      await waitFor(() => {
        expect(
          screen.getByText('Please enter a valid email address'),
        ).toBeInTheDocument();
      });
    });

    it('should call login function with form data', async () => {
      const user = userEvent.setup();
      const loginMock = vi.fn().mockResolvedValue({});
      const mockAuth = createMockAuthContext({ login: loginMock });
      const Wrapper = createTestWrapper(mockAuth);

      render(
        <Wrapper>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Fill in form - use specific labels
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Login should be called with correct values
      await waitFor(() => {
        expect(loginMock).toHaveBeenCalledWith(
          'test@example.com',
          'password123',
          false,
        );
      });
    });

    it('should show loading state during login', async () => {
      const user = userEvent.setup();
      // Create a login function that doesn't resolve immediately
      const loginMock = vi.fn().mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve({}), 100);
          }),
      );
      const mockAuth = createMockAuthContext({ login: loginMock });
      const Wrapper = createTestWrapper(mockAuth);

      render(
        <Wrapper>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Fill in form - use specific labels
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Should show signing in state
      await waitFor(() => {
        expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      });
    });

    it('should have forgot password link', async () => {
      const mockAuth = createMockAuthContext();
      const Wrapper = createTestWrapper(mockAuth);

      render(
        <Wrapper>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Check for forgot password link
      const forgotPasswordLink = screen.getByRole('link', {
        name: /forgot password/i,
      });
      expect(forgotPasswordLink).toBeInTheDocument();
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
    });

    it('should toggle password visibility', async () => {
      const user = userEvent.setup();
      const mockAuth = createMockAuthContext();
      const Wrapper = createTestWrapper(mockAuth);

      render(
        <Wrapper>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Use specific label to get the password input field
      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Click toggle button
      const toggleButton = screen.getByRole('button', {
        name: /show password/i,
      });
      await user.click(toggleButton);

      // Password should now be visible
      expect(passwordInput).toHaveAttribute('type', 'text');

      // Click again to hide
      const hideButton = screen.getByRole('button', { name: /hide password/i });
      await user.click(hideButton);

      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });
});
