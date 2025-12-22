/**
 * Unit tests for AppSwitcher component.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AppSwitcher } from '../../components/AppSwitcher';
import { AppProvider } from '../../context/AppContext';
import { rolesApi } from '../../services/roles';

import type { ReactNode } from 'react';

// Mock the roles API
vi.mock('../../services/roles', () => ({
  rolesApi: {
    getMyRoles: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

function renderWithProviders(
  ui: React.ReactElement,
  initialRoute = '/dashboard',
): ReturnType<typeof render> {
  const queryClient = createQueryClient();

  function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <MemoryRouter initialEntries={[initialRoute]}>
        <QueryClientProvider client={queryClient}>
          <AppProvider>{children}</AppProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Wrapper });
}

// ============================================================================
// Tests
// ============================================================================

describe('AppSwitcher', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('visibility', () => {
    it('should not render when user has only one app permission', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web'],
      });

      renderWithProviders(<AppSwitcher />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('app-switcher-button'),
        ).not.toBeInTheDocument();
      });
    });

    it('should not render when user has no app permissions', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['user:read'],
      });

      renderWithProviders(<AppSwitcher />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('app-switcher-button'),
        ).not.toBeInTheDocument();
      });
    });

    it('should render when user has multiple app permissions', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web', 'app:mobile'],
      });

      renderWithProviders(<AppSwitcher />);

      await waitFor(() => {
        expect(screen.getByTestId('app-switcher-button')).toBeInTheDocument();
      });
    });
  });

  describe('popover', () => {
    it('should open popover when button is clicked', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web', 'app:mobile'],
      });

      renderWithProviders(<AppSwitcher />);

      await waitFor(() => {
        expect(screen.getByTestId('app-switcher-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('app-switcher-button'));

      expect(screen.getByText('Switch to')).toBeInTheDocument();
    });

    it('should show available apps in popover', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web', 'app:mobile'],
      });

      renderWithProviders(<AppSwitcher />);

      await waitFor(() => {
        expect(screen.getByTestId('app-switcher-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('app-switcher-button'));

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Contracts')).toBeInTheDocument();
    });

    it('should close popover when app is selected', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web', 'app:mobile'],
      });

      renderWithProviders(<AppSwitcher />);

      await waitFor(() => {
        expect(screen.getByTestId('app-switcher-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('app-switcher-button'));
      fireEvent.click(screen.getByText('Contracts'));

      await waitFor(() => {
        expect(screen.queryByText('Switch to')).not.toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('should navigate to mobile app when Contracts is clicked', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web', 'app:mobile'],
      });

      renderWithProviders(<AppSwitcher />);

      await waitFor(() => {
        expect(screen.getByTestId('app-switcher-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('app-switcher-button'));
      fireEvent.click(screen.getByText('Contracts'));

      expect(mockNavigate).toHaveBeenCalledWith('/mobile/contracts');
    });

    it('should navigate to web app when Dashboard is clicked', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web', 'app:mobile'],
      });

      renderWithProviders(<AppSwitcher />, '/mobile/contracts');

      await waitFor(() => {
        expect(screen.getByTestId('app-switcher-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('app-switcher-button'));
      fireEvent.click(screen.getByText('Dashboard'));

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('active app indicator', () => {
    it('should highlight current app in the popover', async () => {
      mockGetMyRoles.mockResolvedValue({
        roles: [],
        permissions: ['app:web', 'app:mobile'],
      });

      renderWithProviders(<AppSwitcher />, '/dashboard');

      await waitFor(() => {
        expect(screen.getByTestId('app-switcher-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('app-switcher-button'));

      // The Dashboard card should have aria-current="true"
      const dashboardCard = screen.getByRole('button', {
        name: 'Switch to Dashboard',
      });
      expect(dashboardCard).toHaveAttribute('aria-current', 'true');
    });
  });
});
