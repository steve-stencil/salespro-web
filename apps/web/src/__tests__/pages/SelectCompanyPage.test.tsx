/**
 * Tests for SelectCompanyPage component.
 * Verifies company selection functionality for multi-company users.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AuthContext } from '../../context/AuthContext';
import { SelectCompanyPage } from '../../pages/SelectCompanyPage';
import { companyApi } from '../../services/company';

import type { AuthContextType, User } from '../../types/auth';
import type {
  UserCompaniesResponse,
  SwitchCompanyResponse,
} from '../../types/company';

// Mock the company API
vi.mock('../../services/company', () => ({
  companyApi: {
    getUserCompanies: vi.fn(),
    switchCompany: vi.fn(),
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

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  nameFirst: 'Test',
  nameLast: 'User',
  emailVerified: true,
  mfaEnabled: false,
  userType: 'company',
  company: { id: 'company-1', name: 'Company A' },
  canSwitchCompanies: true,
};

const mockCompaniesResponse: UserCompaniesResponse = {
  recent: [
    { id: 'company-1', name: 'Company A', isActive: true },
    { id: 'company-2', name: 'Company B', isActive: true },
  ],
  pinned: [],
  results: [
    { id: 'company-1', name: 'Company A', isActive: true },
    { id: 'company-2', name: 'Company B', isActive: true },
  ],
  total: 2,
  hasMore: false,
};

function createMockAuthContext(
  overrides: Partial<AuthContextType> = {},
): AuthContextType {
  return {
    user: mockUser,
    isLoading: false,
    isAuthenticated: true,
    requiresMfa: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    verifyMfa: vi.fn(),
    clearMfaState: vi.fn(),
    ...overrides,
  };
}

type RenderOptions = {
  authContext?: AuthContextType;
  initialPath?: string;
};

function renderSelectCompanyPage(options: RenderOptions = {}): {
  queryClient: QueryClient;
} {
  const queryClient = createQueryClient();
  const authContext = options.authContext ?? createMockAuthContext();

  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authContext}>
        <MemoryRouter
          initialEntries={[options.initialPath ?? '/select-company']}
        >
          <Routes>
            <Route path="/select-company" element={<SelectCompanyPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

  return { queryClient };
}

// ============================================================================
// Tests
// ============================================================================

describe('SelectCompanyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(companyApi.getUserCompanies).mockResolvedValue(
      mockCompaniesResponse,
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('should display the page title and description', async () => {
      renderSelectCompanyPage();

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /select company/i }),
        ).toBeInTheDocument();
      });
      expect(screen.getByText(/choose which company/i)).toBeInTheDocument();
    });

    it('should display the logged in user email', async () => {
      renderSelectCompanyPage();

      await waitFor(() => {
        expect(
          screen.getByText(/logged in as test@example.com/i),
        ).toBeInTheDocument();
      });
    });

    it('should display available companies', async () => {
      renderSelectCompanyPage();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /company a/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /company b/i }),
        ).toBeInTheDocument();
      });
    });

    it('should mark current company as selected', async () => {
      renderSelectCompanyPage();

      await waitFor(() => {
        expect(screen.getByText(/currently selected/i)).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('should show loading spinner while auth is loading', () => {
      const authContext = createMockAuthContext({ isLoading: true });
      renderSelectCompanyPage({ authContext });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('company selection', () => {
    it('should call switchCompany when a company is clicked', async () => {
      const mockSwitchResponse: SwitchCompanyResponse = {
        message: 'Company switched successfully',
        activeCompany: { id: 'company-2', name: 'Company B' },
      };
      vi.mocked(companyApi.switchCompany).mockResolvedValue(mockSwitchResponse);

      const mockRefreshUser = vi.fn().mockResolvedValue(undefined);
      const authContext = createMockAuthContext({
        refreshUser: mockRefreshUser,
      });
      renderSelectCompanyPage({ authContext });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /company b/i }),
        ).toBeInTheDocument();
      });

      // Click on Company B (not the current company)
      const companyBButton = screen.getByRole('button', { name: /company b/i });
      fireEvent.click(companyBButton);

      await waitFor(() => {
        expect(companyApi.switchCompany).toHaveBeenCalledWith('company-2');
      });
    });

    it('should show error when company switch fails', async () => {
      vi.mocked(companyApi.switchCompany).mockRejectedValue(
        new Error('Switch failed'),
      );

      renderSelectCompanyPage();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /company b/i }),
        ).toBeInTheDocument();
      });

      const companyBButton = screen.getByRole('button', { name: /company b/i });
      fireEvent.click(companyBButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to switch company/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('redirects', () => {
    it('should redirect to login if not authenticated', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
      renderSelectCompanyPage({ authContext });

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });
    });

    it('should redirect to dashboard if user cannot switch companies', async () => {
      const authContext = createMockAuthContext({
        user: { ...mockUser, canSwitchCompanies: false },
      });
      renderSelectCompanyPage({ authContext });

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show message when no companies available', async () => {
      vi.mocked(companyApi.getUserCompanies).mockResolvedValue({
        recent: [],
        pinned: [],
        results: [],
        total: 0,
        hasMore: false,
      });

      renderSelectCompanyPage();

      await waitFor(() => {
        expect(screen.getByText(/no companies available/i)).toBeInTheDocument();
      });
    });
  });
});
