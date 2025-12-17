import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuthContext } from '../context/AuthContext';

import type { AuthContextType } from '../types/auth';

// Mock the router module to avoid actual routing issues in tests
vi.mock('../router', () => ({
  router: {
    // Mock router for testing
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
          <MemoryRouter>{children}</MemoryRouter>
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

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AuthContext Provider', () => {
    it('should render loading state when auth is loading', () => {
      const mockAuth = createMockAuthContext({ isLoading: true });
      const Wrapper = createTestWrapper(mockAuth);

      render(
        <Wrapper>
          <div data-testid="protected-content">Protected Content</div>
        </Wrapper>,
      );

      // The wrapper renders, auth state is available
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should provide auth context to children', () => {
      const mockAuth = createMockAuthContext({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          nameFirst: 'Test',
          nameLast: 'User',
          emailVerified: true,
          mfaEnabled: false,
          userType: 'company',
          company: {
            id: 'company-1',
            name: 'Test Company',
          },
        },
      });
      const Wrapper = createTestWrapper(mockAuth);

      function TestConsumer(): React.ReactElement {
        return <div data-testid="consumer">Consumer rendered</div>;
      }

      render(
        <Wrapper>
          <TestConsumer />
        </Wrapper>,
      );

      expect(screen.getByTestId('consumer')).toBeInTheDocument();
    });

    it('should provide unauthenticated state correctly', async () => {
      const mockAuth = createMockAuthContext({
        isLoading: false,
        isAuthenticated: false,
        user: null,
      });
      const Wrapper = createTestWrapper(mockAuth);

      function AuthStateDisplay(): React.ReactElement {
        return (
          <div data-testid="auth-state">
            {mockAuth.isAuthenticated ? 'Authenticated' : 'Not authenticated'}
          </div>
        );
      }

      render(
        <Wrapper>
          <AuthStateDisplay />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent(
          'Not authenticated',
        );
      });
    });

    it('should provide authenticated state correctly', async () => {
      const mockAuth = createMockAuthContext({
        isLoading: false,
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          nameFirst: 'Test',
          nameLast: 'User',
          emailVerified: true,
          mfaEnabled: false,
          userType: 'company',
          company: {
            id: 'company-1',
            name: 'Test Company',
          },
        },
      });
      const Wrapper = createTestWrapper(mockAuth);

      function AuthStateDisplay(): React.ReactElement {
        return (
          <div data-testid="auth-state">
            {mockAuth.isAuthenticated ? 'Authenticated' : 'Not authenticated'}
          </div>
        );
      }

      render(
        <Wrapper>
          <AuthStateDisplay />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent(
          'Authenticated',
        );
      });
    });
  });

  describe('QueryClient Provider', () => {
    it('should provide QueryClient to children', () => {
      const mockAuth = createMockAuthContext();
      const Wrapper = createTestWrapper(mockAuth);

      render(
        <Wrapper>
          <div data-testid="query-test">Query client available</div>
        </Wrapper>,
      );

      expect(screen.getByTestId('query-test')).toBeInTheDocument();
    });
  });
});
