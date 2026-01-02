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

const mockManyCompaniesResponse: UserCompaniesResponse = {
  recent: [],
  pinned: [],
  results: [
    { id: 'company-1', name: 'Company A', isActive: true },
    { id: 'company-2', name: 'Company B', isActive: true },
    { id: 'company-3', name: 'Company C', isActive: true },
    { id: 'company-4', name: 'Company D', isActive: true },
    { id: 'company-5', name: 'Company E', isActive: true },
    { id: 'company-6', name: 'Company F', isActive: true },
  ],
  total: 6,
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

    it('should display Continue button', async () => {
      renderSelectCompanyPage();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /continue/i }),
        ).toBeInTheDocument();
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
    it('should pre-select the current company on page load', async () => {
      renderSelectCompanyPage();

      await waitFor(() => {
        // Continue button should be enabled since current company is pre-selected
        const continueButton = screen.getByRole('button', {
          name: /continue/i,
        });
        expect(continueButton).not.toBeDisabled();
      });
    });

    it('should select a company when clicked without switching immediately', async () => {
      renderSelectCompanyPage();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /company b/i }),
        ).toBeInTheDocument();
      });

      // Click on Company B
      const companyBButton = screen.getByRole('button', { name: /company b/i });
      fireEvent.click(companyBButton);

      // switchCompany should NOT have been called yet
      expect(companyApi.switchCompany).not.toHaveBeenCalled();

      // Continue button should still be enabled
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).not.toBeDisabled();
    });

    it('should switch company when Continue is clicked after selection', async () => {
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

      // Select Company B
      const companyBButton = screen.getByRole('button', { name: /company b/i });
      fireEvent.click(companyBButton);

      // Click Continue
      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(companyApi.switchCompany).toHaveBeenCalledWith('company-2');
      });

      await waitFor(() => {
        expect(mockRefreshUser).toHaveBeenCalled();
      });
    });

    it('should allow selecting the current company and continuing', async () => {
      const mockSwitchResponse: SwitchCompanyResponse = {
        message: 'Company switched successfully',
        activeCompany: { id: 'company-1', name: 'Company A' },
      };
      vi.mocked(companyApi.switchCompany).mockResolvedValue(mockSwitchResponse);

      renderSelectCompanyPage();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /company a/i }),
        ).toBeInTheDocument();
      });

      // Current company should be pre-selected, Continue should be enabled
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).not.toBeDisabled();

      // Click Continue with current company selected
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(companyApi.switchCompany).toHaveBeenCalledWith('company-1');
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

      // Select and confirm
      const companyBButton = screen.getByRole('button', { name: /company b/i });
      fireEvent.click(companyBButton);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to switch company/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('should hide search field when there are 5 or fewer companies', async () => {
      renderSelectCompanyPage();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /company a/i }),
        ).toBeInTheDocument();
      });

      // Search field should not be present
      expect(
        screen.queryByPlaceholderText(/search companies/i),
      ).not.toBeInTheDocument();
    });

    it('should show search field when there are more than 5 companies', async () => {
      vi.mocked(companyApi.getUserCompanies).mockResolvedValue(
        mockManyCompaniesResponse,
      );

      renderSelectCompanyPage();

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/search companies/i),
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

