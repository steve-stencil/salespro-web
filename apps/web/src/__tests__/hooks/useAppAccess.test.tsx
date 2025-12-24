/**
 * Unit tests for useAppAccess hook.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AppProvider } from '../../context/AppContext';
import { useAppAccess } from '../../hooks/useAppAccess';
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

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AppProvider>{children}</AppProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useAppAccess', () => {
  const mockGetMyRoles = vi.mocked(rolesApi.getMyRoles);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should return loading state initially', () => {
    mockGetMyRoles.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useAppAccess(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasWebAccess).toBe(false);
    expect(result.current.hasMobileAccess).toBe(false);
  });

  it('should return web access when user has app:web permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['app:web', 'user:read'],
    });

    const { result } = renderHook(() => useAppAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasWebAccess).toBe(true);
    expect(result.current.hasMobileAccess).toBe(false);
    expect(result.current.defaultApp).toBe('web');
  });

  it('should return mobile access when user has app:mobile permission', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['app:mobile'],
    });

    const { result } = renderHook(() => useAppAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasWebAccess).toBe(false);
    expect(result.current.hasMobileAccess).toBe(true);
    expect(result.current.defaultApp).toBe('mobile');
  });

  it('should return both accesses when user has both permissions', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['app:web', 'app:mobile'],
    });

    const { result } = renderHook(() => useAppAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasWebAccess).toBe(true);
    expect(result.current.hasMobileAccess).toBe(true);
    expect(result.current.hasMultipleApps).toBe(true);
    expect(result.current.defaultApp).toBe('web');
  });

  it('should return hasMultipleApps as true only when user has both', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['app:web'],
    });

    const { result } = renderHook(() => useAppAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMultipleApps).toBe(false);
  });

  it('should return availableApps list with accessible apps', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['app:web', 'app:mobile'],
    });

    const { result } = renderHook(() => useAppAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.availableApps).toHaveLength(2);
    expect(result.current.availableApps[0]?.id).toBe('web');
    expect(result.current.availableApps[1]?.id).toBe('mobile');
  });

  it('should return null defaultApp when user has no app permissions', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['user:read'],
    });

    const { result } = renderHook(() => useAppAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasWebAccess).toBe(false);
    expect(result.current.hasMobileAccess).toBe(false);
    expect(result.current.defaultApp).toBe(null);
    expect(result.current.availableApps).toHaveLength(0);
  });

  it('should provide hasAppAccess method that works correctly', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['app:web'],
    });

    const { result } = renderHook(() => useAppAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasAppAccess('web')).toBe(true);
    expect(result.current.hasAppAccess('mobile')).toBe(false);
  });

  it('should handle wildcard app permissions', async () => {
    mockGetMyRoles.mockResolvedValue({
      roles: [],
      permissions: ['app:*'],
    });

    const { result } = renderHook(() => useAppAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Wildcard should match both app permissions
    expect(result.current.hasWebAccess).toBe(true);
    expect(result.current.hasMobileAccess).toBe(true);
  });

  it('should handle error state', async () => {
    mockGetMyRoles.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAppAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.hasWebAccess).toBe(false);
    expect(result.current.hasMobileAccess).toBe(false);
  });
});
