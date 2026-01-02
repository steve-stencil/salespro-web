/**
 * Permission checking hooks for UI access control.
 *
 * These hooks provide permission-based UI rendering capabilities.
 * Note: These are for UX only - backend ALWAYS enforces permissions.
 */
import { useMemo, useCallback } from 'react';

import { useMyRoles } from './useRoles';

// ============================================================================
// Permission Utility Functions
// ============================================================================

/**
 * Check if a permission string matches a pattern.
 * Supports wildcards:
 *   - '*' matches all permissions
 *   - 'resource:*' matches all actions for a resource
 *
 * @example
 *   matchPermission('customer:read', 'customer:read') // true
 *   matchPermission('customer:read', 'customer:*')    // true
 *   matchPermission('customer:read', '*')             // true
 *   matchPermission('customer:read', 'user:*')        // false
 */
export function matchPermission(permission: string, pattern: string): boolean {
  // Wildcard matches everything
  if (pattern === '*') {
    return true;
  }

  // Exact match
  if (pattern === permission) {
    return true;
  }

  // Resource wildcard (e.g., 'customer:*' matches 'customer:read')
  if (pattern.endsWith(':*')) {
    const resource = pattern.slice(0, -2);
    return permission.startsWith(resource + ':');
  }

  return false;
}

/**
 * Check if any pattern in an array matches the permission.
 *
 * @example
 *   hasPermission('customer:read', ['customer:read', 'user:read']) // true
 *   hasPermission('customer:read', ['customer:*'])                  // true
 *   hasPermission('customer:read', ['*'])                           // true
 *   hasPermission('customer:delete', ['customer:read'])             // false
 */
export function checkPermission(
  permission: string,
  userPermissions: string[],
): boolean {
  return userPermissions.some(pattern => matchPermission(permission, pattern));
}

/**
 * Check if user has all of the specified permissions.
 */
export function checkAllPermissions(
  permissions: string[],
  userPermissions: string[],
): boolean {
  return permissions.every(p => checkPermission(p, userPermissions));
}

/**
 * Check if user has any of the specified permissions.
 */
export function checkAnyPermission(
  permissions: string[],
  userPermissions: string[],
): boolean {
  return permissions.some(p => checkPermission(p, userPermissions));
}

// ============================================================================
// Permission Hook Result Types
// ============================================================================

export type UseUserPermissionsResult = {
  /** Array of user's permission strings */
  permissions: string[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
  /** Check if user has all specified permissions */
  hasAllPermissions: (permissions: string[]) => boolean;
  /** Check if user has any of the specified permissions */
  hasAnyPermission: (permissions: string[]) => boolean;
};

export type UseHasPermissionResult = {
  /** Whether user has the permission */
  hasPermission: boolean;
  /** Loading state */
  isLoading: boolean;
};

// ============================================================================
// Permission Hooks
// ============================================================================

/**
 * Hook to get the current user's permissions with utility methods.
 *
 * @example
 * const { permissions, hasPermission, isLoading } = useUserPermissions();
 *
 * if (hasPermission('role:create')) {
 *   // Show create button
 * }
 */
export function useUserPermissions(): UseUserPermissionsResult {
  const { data, isLoading, error } = useMyRoles();

  const permissions = useMemo(() => data?.permissions ?? [], [data]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      return checkPermission(permission, permissions);
    },
    [permissions],
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      return checkAllPermissions(perms, permissions);
    },
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      return checkAnyPermission(perms, permissions);
    },
    [permissions],
  );

  return {
    permissions,
    isLoading,
    error: error instanceof Error ? error.message : null,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
  };
}

/**
 * Hook to check if the current user has a specific permission.
 * Returns loading state while permissions are being fetched.
 *
 * @param permission - The permission to check (e.g., 'role:read')
 *
 * @example
 * const { hasPermission, isLoading } = useHasPermission('role:create');
 *
 * if (isLoading) return <Spinner />;
 * if (!hasPermission) return null;
 * return <CreateButton />;
 */
export function useHasPermission(permission: string): UseHasPermissionResult {
  const { permissions, isLoading } = useUserPermissions();

  const hasPermission = useMemo(
    () => checkPermission(permission, permissions),
    [permission, permissions],
  );

  return { hasPermission, isLoading };
}

/**
 * Hook to check if user has all of the specified permissions.
 *
 * @example
 * const { hasPermission, isLoading } = useHasAllPermissions(['role:read', 'role:update']);
 */
export function useHasAllPermissions(
  permissions: string[],
): UseHasPermissionResult {
  const { permissions: userPermissions, isLoading } = useUserPermissions();

  const hasPermission = useMemo(
    () => checkAllPermissions(permissions, userPermissions),
    [permissions, userPermissions],
  );

  return { hasPermission, isLoading };
}

/**
 * Hook to check if user has any of the specified permissions.
 *
 * @example
 * const { hasPermission, isLoading } = useHasAnyPermission(['role:create', 'role:update']);
 */
export function useHasAnyPermission(
  permissions: string[],
): UseHasPermissionResult {
  const { permissions: userPermissions, isLoading } = useUserPermissions();

  const hasPermission = useMemo(
    () => checkAnyPermission(permissions, userPermissions),
    [permissions, userPermissions],
  );

  return { hasPermission, isLoading };
}

// ============================================================================
// Permission Constants (matching backend)
// ============================================================================

/**
 * Permission constants for type-safe usage.
 * These match the backend PERMISSIONS constant.
 */
export const PERMISSIONS = {
  // App Access
  APP_DASHBOARD: 'app:dashboard',
  APP_SALESPRO: 'app:salespro',

  // Customers
  CUSTOMER_READ: 'customer:read',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_DELETE: 'customer:delete',

  // Users
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_ACTIVATE: 'user:activate',

  // Offices
  OFFICE_READ: 'office:read',
  OFFICE_CREATE: 'office:create',
  OFFICE_UPDATE: 'office:update',
  OFFICE_DELETE: 'office:delete',

  // Roles
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',

  // Reports
  REPORT_READ: 'report:read',
  REPORT_EXPORT: 'report:export',

  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',

  // Company
  COMPANY_READ: 'company:read',
  COMPANY_UPDATE: 'company:update',

  // Data Migration
  DATA_MIGRATION: 'data:migration',

  // Price Guide
  PRICE_GUIDE_READ: 'price_guide:read',
  PRICE_GUIDE_CREATE: 'price_guide:create',
  PRICE_GUIDE_UPDATE: 'price_guide:update',
  PRICE_GUIDE_DELETE: 'price_guide:delete',

  // Platform (internal users only)
  PLATFORM_ADMIN: 'platform:admin',
  PLATFORM_VIEW_COMPANIES: 'platform:view_companies',
  PLATFORM_CREATE_COMPANY: 'platform:create_company',
  PLATFORM_UPDATE_COMPANY: 'platform:update_company',
  PLATFORM_SWITCH_COMPANY: 'platform:switch_company',
  PLATFORM_VIEW_AUDIT_LOGS: 'platform:view_audit_logs',
  PLATFORM_MANAGE_INTERNAL_USERS: 'platform:manage_internal_users',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
