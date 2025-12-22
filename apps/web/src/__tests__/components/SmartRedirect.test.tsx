/**
 * Unit tests for SmartRedirect component.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SmartRedirect } from '../../components/SmartRedirect';
import { AuthContext } from '../../context/AuthContext';
import { rolesApi } from '../../services/roles';

import type { AuthContextType } from '../../types/auth';
import type { ReactNode } from 'react';

// Mock the roles API
vi.mock('../../services/roles', () => ({
  rolesApi: {
    getMyRoles: vi.fn(),
  },
}));

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

const mockAuthContext: AuthContextType = {
  user: {
    id: '1',
    email: 'test@example.com',
    nameFirst: 'Test',
    nameLast: 'User',
    type: 'regular',
    company: {
      id: '1',
      name: 'Test Company',
    },
    isActive: true,
    emailVerified: true,
    mfaEnabled: false,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  isLoading: false,
  isAuthenticated: true,
  requiresMfa: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  verifyMfa: vi.fn(),
  clearMfaState: vi.fn(),
};

function renderWithProviders(initialRoute = '/'): {
  container: HTMLElement;
  currentPath: () => string;
} {
  const queryClient = createQueryClient();
  let testLocation = initialRoute;

  function LocationDisplay(): React.ReactElement {
    const location = window.location;
    testLocation = location.pathname;
    return <div data-testid="location">{location.pathname}</div>;
  }

  function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <MemoryRouter initialEntries={[initialRoute]}>
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={mockAuthContext}>
            <Routes>
              <Route path="/" element={children} />
              <Route
                path="/dashboard"
                element={
                  <>
                    <div>Dashboard Page</div>
                    <LocationDisplay />
                  </>
                }
              />
              <Route
                path="/mobile/contracts"
                element={
                  <>
                    <div>Mobile Contracts Page</div>
                    <LocationDisplay />
                  </>
                }
              />
            </Routes>
          </AuthContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  const { container } = render(<SmartRedirect />, { wrapper: Wrapper });

  return {
    container,
    currentPath: () => testLocation,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SmartRedirect', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('loading state', () => {
    it('should show loading spinner while permissions are loading', () => {
      mockGetMyRoles.mockImplementation(() => new Promise(() => {}));

      renderWithProviders();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('no access', () => {
    it('should show no access page when user has no app permissions', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['user:read'],
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('No Access')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Application Access Required'),
      ).toBeInTheDocument();
    });
  });

  describe('redirect logic', () => {
    it('should redirect to dashboard when user has only web access', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web'],
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });
    });

    it('should redirect to mobile contracts when user has only mobile access', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:mobile'],
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Mobile Contracts Page')).toBeInTheDocument();
      });
    });

    it('should redirect to dashboard when user has both permissions', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web', 'app:mobile'],
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });
    });

    it('should redirect to last used app when stored in localStorage', async () => {
      localStorage.setItem('salespro:lastActiveApp', 'mobile');

      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web', 'app:mobile'],
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Mobile Contracts Page')).toBeInTheDocument();
      });
    });

    it('should fallback to web if localStorage app is not accessible', async () => {
      localStorage.setItem('salespro:lastActiveApp', 'mobile');

      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web'],
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });
    });
  });
});
