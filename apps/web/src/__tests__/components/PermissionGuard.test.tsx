/**
 * Tests for PermissionGuard components.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  PermissionGuard,
  RequireAllPermissions,
  RequireAnyPermission,
  RequirePermission,
  ForbiddenPage,
  PermissionDeniedAlert,
} from '../../components/PermissionGuard';
import { rolesApi } from '../../services/roles';

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

type WrapperProps = {
  children: ReactNode;
  initialRoute?: string;
};

function createTestWrapper(initialRoute = '/test') {
  const queryClient = createQueryClient();
  return function TestWrapper({ children }: WrapperProps): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/test" element={children} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/forbidden" element={<ForbiddenPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// ForbiddenPage Tests
// ============================================================================

describe('ForbiddenPage', () => {
  it('should render 403 error page', () => {
    const Wrapper = createTestWrapper('/forbidden');
    render(<ForbiddenPage />, { wrapper: Wrapper });

    expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();
  });

  it('should show navigation buttons', () => {
    const Wrapper = createTestWrapper('/forbidden');
    render(<ForbiddenPage />, { wrapper: Wrapper });

    expect(
      screen.getByRole('button', { name: /go to dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /go back/i }),
    ).toBeInTheDocument();
  });
});

// ============================================================================
// PermissionGuard Tests
// ============================================================================

describe('PermissionGuard', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockGetMyRoles.mockImplementation(() => new Promise(() => {}));

    const Wrapper = createTestWrapper();
    render(
      <PermissionGuard permission="role:read">
        <div>Protected Content</div>
      </PermissionGuard>,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('permission-loading')).toBeInTheDocument();
  });

  it('should render children when user has permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:read'],
    });

    const Wrapper = createTestWrapper();
    render(
      <PermissionGuard permission="role:read">
        <div>Protected Content</div>
      </PermissionGuard>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('should show forbidden page when user lacks permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['user:read'],
    });

    const Wrapper = createTestWrapper();
    render(
      <PermissionGuard permission="role:read">
        <div>Protected Content</div>
      </PermissionGuard>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
    });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render custom fallback when provided', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: [],
    });

    const Wrapper = createTestWrapper();
    render(
      <PermissionGuard
        permission="role:read"
        fallback={<div>Custom Fallback</div>}
      >
        <div>Protected Content</div>
      </PermissionGuard>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
    });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect when redirectTo is provided', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: [],
    });

    const Wrapper = createTestWrapper();
    render(
      <PermissionGuard permission="role:read" redirectTo="/dashboard">
        <div>Protected Content</div>
      </PermissionGuard>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('should match wildcard permissions', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:*'],
    });

    const Wrapper = createTestWrapper();
    render(
      <PermissionGuard permission="role:read">
        <div>Protected Content</div>
      </PermissionGuard>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// RequireAllPermissions Tests
// ============================================================================

describe('RequireAllPermissions', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when user has all permissions', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:read', 'role:update'],
    });

    const Wrapper = createTestWrapper();
    render(
      <RequireAllPermissions permissions={['role:read', 'role:update']}>
        <div>Protected Content</div>
      </RequireAllPermissions>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('should not render when user is missing a permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:read'],
    });

    const Wrapper = createTestWrapper();
    const { container } = render(
      <RequireAllPermissions permissions={['role:read', 'role:update']}>
        <div>Protected Content</div>
      </RequireAllPermissions>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="permission-loading"]'),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render fallback when provided and user lacks permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:read'],
    });

    const Wrapper = createTestWrapper();
    render(
      <RequireAllPermissions
        permissions={['role:read', 'role:update']}
        fallback={<div>No Access</div>}
      >
        <div>Protected Content</div>
      </RequireAllPermissions>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('No Access')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// RequireAnyPermission Tests
// ============================================================================

describe('RequireAnyPermission', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when user has at least one permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:update'],
    });

    const Wrapper = createTestWrapper();
    render(
      <RequireAnyPermission permissions={['role:create', 'role:update']}>
        <div>Protected Content</div>
      </RequireAnyPermission>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('should not render when user has none of the permissions', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['user:read'],
    });

    const Wrapper = createTestWrapper();
    const { container } = render(
      <RequireAnyPermission permissions={['role:create', 'role:update']}>
        <div>Protected Content</div>
      </RequireAnyPermission>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="permission-loading"]'),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

// ============================================================================
// RequirePermission Tests
// ============================================================================

describe('RequirePermission', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when user has permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:create'],
    });

    const Wrapper = createTestWrapper();
    render(
      <RequirePermission permission="role:create">
        <button>Create Role</button>
      </RequirePermission>,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create role/i }),
      ).toBeInTheDocument();
    });
  });

  it('should not render children when user lacks permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:read'],
    });

    const Wrapper = createTestWrapper();
    render(
      <RequirePermission permission="role:create">
        <button>Create Role</button>
      </RequirePermission>,
      { wrapper: Wrapper },
    );

    // Wait for query to settle
    await waitFor(() => {
      expect(mockGetMyRoles).toHaveBeenCalled();
    });

    expect(
      screen.queryByRole('button', { name: /create role/i }),
    ).not.toBeInTheDocument();
  });

  it('should not show loading state (instant hide/show)', () => {
    mockGetMyRoles.mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(
            () =>
              resolve({
                roles: [],
                permissions: ['role:create'],
              }),
            50,
          );
        }),
    );

    const Wrapper = createTestWrapper();
    const { container } = render(
      <RequirePermission permission="role:create">
        <button>Create Role</button>
      </RequirePermission>,
      { wrapper: Wrapper },
    );

    // Should not show loading spinner
    expect(
      container.querySelector('[data-testid="permission-loading"]'),
    ).not.toBeInTheDocument();
  });
});

// ============================================================================
// PermissionDeniedAlert Tests
// ============================================================================

describe('PermissionDeniedAlert', () => {
  it('should display permission and action', () => {
    const Wrapper = createTestWrapper();
    render(
      <PermissionDeniedAlert
        permission="role:create"
        action="create new roles"
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('permission-denied-alert')).toBeInTheDocument();
    expect(screen.getByText(/role:create/)).toBeInTheDocument();
    expect(screen.getByText(/create new roles/)).toBeInTheDocument();
  });

  it('should use default action text', () => {
    const Wrapper = createTestWrapper();
    render(<PermissionDeniedAlert permission="role:delete" />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText(/perform this action/)).toBeInTheDocument();
  });
});
