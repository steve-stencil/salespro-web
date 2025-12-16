/**
 * Unit tests for permission hooks and utility functions.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';

import {
  matchPermission,
  checkPermission,
  checkAllPermissions,
  checkAnyPermission,
  useUserPermissions,
  useHasPermission,
  useHasAllPermissions,
  useHasAnyPermission,
  PERMISSIONS,
} from '../../hooks/usePermissions';
import { rolesApi } from '../../services/roles';

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

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('matchPermission', () => {
  it('should return true for exact match', () => {
    expect(matchPermission('customer:read', 'customer:read')).toBe(true);
  });

  it('should return false for different permission', () => {
    expect(matchPermission('customer:read', 'customer:create')).toBe(false);
  });

  it('should match wildcard "*" to any permission', () => {
    expect(matchPermission('customer:read', '*')).toBe(true);
    expect(matchPermission('user:delete', '*')).toBe(true);
    expect(matchPermission('role:assign', '*')).toBe(true);
  });

  it('should match resource wildcard "resource:*" to same resource', () => {
    expect(matchPermission('customer:read', 'customer:*')).toBe(true);
    expect(matchPermission('customer:create', 'customer:*')).toBe(true);
    expect(matchPermission('customer:delete', 'customer:*')).toBe(true);
  });

  it('should not match resource wildcard to different resource', () => {
    expect(matchPermission('customer:read', 'user:*')).toBe(false);
    expect(matchPermission('role:assign', 'customer:*')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(matchPermission('', '')).toBe(true);
    expect(matchPermission('test', '*')).toBe(true);
    expect(matchPermission('test:action', 'test:*')).toBe(true);
  });
});

describe('checkPermission', () => {
  it('should return true if permission exists in array', () => {
    const permissions = ['customer:read', 'user:read'];
    expect(checkPermission('customer:read', permissions)).toBe(true);
  });

  it('should return false if permission does not exist', () => {
    const permissions = ['customer:read', 'user:read'];
    expect(checkPermission('customer:delete', permissions)).toBe(false);
  });

  it('should match using wildcards in user permissions', () => {
    const permissions = ['customer:*', 'user:read'];
    expect(checkPermission('customer:read', permissions)).toBe(true);
    expect(checkPermission('customer:delete', permissions)).toBe(true);
  });

  it('should match global wildcard', () => {
    const permissions = ['*'];
    expect(checkPermission('customer:read', permissions)).toBe(true);
    expect(checkPermission('anything:action', permissions)).toBe(true);
  });

  it('should return false for empty permissions array', () => {
    expect(checkPermission('customer:read', [])).toBe(false);
  });
});

describe('checkAllPermissions', () => {
  it('should return true if user has all permissions', () => {
    const userPermissions = ['customer:read', 'customer:create', 'user:read'];
    const required = ['customer:read', 'customer:create'];
    expect(checkAllPermissions(required, userPermissions)).toBe(true);
  });

  it('should return false if user is missing any permission', () => {
    const userPermissions = ['customer:read', 'user:read'];
    const required = ['customer:read', 'customer:create'];
    expect(checkAllPermissions(required, userPermissions)).toBe(false);
  });

  it('should work with wildcards', () => {
    const userPermissions = ['customer:*'];
    const required = ['customer:read', 'customer:create', 'customer:delete'];
    expect(checkAllPermissions(required, userPermissions)).toBe(true);
  });

  it('should return true for empty required array', () => {
    expect(checkAllPermissions([], ['customer:read'])).toBe(true);
  });
});

describe('checkAnyPermission', () => {
  it('should return true if user has at least one permission', () => {
    const userPermissions = ['customer:read'];
    const required = ['customer:read', 'customer:create'];
    expect(checkAnyPermission(required, userPermissions)).toBe(true);
  });

  it('should return false if user has none of the permissions', () => {
    const userPermissions = ['user:read'];
    const required = ['customer:read', 'customer:create'];
    expect(checkAnyPermission(required, userPermissions)).toBe(false);
  });

  it('should work with wildcards', () => {
    const userPermissions = ['*'];
    const required = ['customer:read', 'role:admin'];
    expect(checkAnyPermission(required, userPermissions)).toBe(true);
  });

  it('should return false for empty required array', () => {
    expect(checkAnyPermission([], ['customer:read'])).toBe(false);
  });
});

// ============================================================================
// Hook Tests
// ============================================================================

describe('useUserPermissions', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    mockGetMyRoles.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    const { result } = renderHook(() => useUserPermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.permissions).toEqual([]);
  });

  it('should return permissions after loading', async () => {
    const mockPermissions = ['customer:read', 'user:read', 'role:read'];
    mockGetMyRoles.mockResolvedValue({
      roles: [{ id: '1', name: 'admin', displayName: 'Admin' }],
      permissions: mockPermissions,
    });

    const { result } = renderHook(() => useUserPermissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.permissions).toEqual(mockPermissions);
  });

  it('should provide hasPermission method that works', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['customer:read', 'role:*'],
    });

    const { result } = renderHook(() => useUserPermissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission('customer:read')).toBe(true);
    expect(result.current.hasPermission('role:create')).toBe(true);
    expect(result.current.hasPermission('user:delete')).toBe(false);
  });

  it('should provide hasAllPermissions method that works', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['customer:read', 'customer:create'],
    });

    const { result } = renderHook(() => useUserPermissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(
      result.current.hasAllPermissions(['customer:read', 'customer:create']),
    ).toBe(true);
    expect(
      result.current.hasAllPermissions(['customer:read', 'customer:delete']),
    ).toBe(false);
  });

  it('should provide hasAnyPermission method that works', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['customer:read'],
    });

    const { result } = renderHook(() => useUserPermissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(
      result.current.hasAnyPermission(['customer:read', 'customer:delete']),
    ).toBe(true);
    expect(
      result.current.hasAnyPermission(['user:create', 'user:delete']),
    ).toBe(false);
  });

  it('should handle error state', async () => {
    mockGetMyRoles.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUserPermissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.permissions).toEqual([]);
  });
});

describe('useHasPermission', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true if user has the permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:read', 'role:create'],
    });

    const { result } = renderHook(() => useHasPermission('role:read'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(true);
  });

  it('should return false if user lacks the permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:read'],
    });

    const { result } = renderHook(() => useHasPermission('role:create'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(false);
  });

  it('should match wildcard permissions', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['*'],
    });

    const { result } = renderHook(() => useHasPermission('anything:here'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(true);
  });
});

describe('useHasAllPermissions', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true if user has all permissions', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:read', 'role:create', 'role:update'],
    });

    const { result } = renderHook(
      () => useHasAllPermissions(['role:read', 'role:create']),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(true);
  });

  it('should return false if user is missing any permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:read'],
    });

    const { result } = renderHook(
      () => useHasAllPermissions(['role:read', 'role:create']),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(false);
  });
});

describe('useHasAnyPermission', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true if user has at least one permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['role:read'],
    });

    const { result } = renderHook(
      () => useHasAnyPermission(['role:read', 'role:create']),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(true);
  });

  it('should return false if user has none of the permissions', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['user:read'],
    });

    const { result } = renderHook(
      () => useHasAnyPermission(['role:read', 'role:create']),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(false);
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('PERMISSIONS constant', () => {
  it('should have all expected role permissions', () => {
    expect(PERMISSIONS.ROLE_READ).toBe('role:read');
    expect(PERMISSIONS.ROLE_CREATE).toBe('role:create');
    expect(PERMISSIONS.ROLE_UPDATE).toBe('role:update');
    expect(PERMISSIONS.ROLE_DELETE).toBe('role:delete');
    expect(PERMISSIONS.ROLE_ASSIGN).toBe('role:assign');
  });

  it('should have all expected user permissions', () => {
    expect(PERMISSIONS.USER_READ).toBe('user:read');
    expect(PERMISSIONS.USER_CREATE).toBe('user:create');
    expect(PERMISSIONS.USER_UPDATE).toBe('user:update');
    expect(PERMISSIONS.USER_DELETE).toBe('user:delete');
    expect(PERMISSIONS.USER_ACTIVATE).toBe('user:activate');
  });

  it('should have all expected customer permissions', () => {
    expect(PERMISSIONS.CUSTOMER_READ).toBe('customer:read');
    expect(PERMISSIONS.CUSTOMER_CREATE).toBe('customer:create');
    expect(PERMISSIONS.CUSTOMER_UPDATE).toBe('customer:update');
    expect(PERMISSIONS.CUSTOMER_DELETE).toBe('customer:delete');
  });
});

