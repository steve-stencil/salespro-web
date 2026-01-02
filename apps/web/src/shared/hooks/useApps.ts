/**
 * Hook for getting user's accessible applications.
 *
 * Filters the app registry based on user permissions to determine
 * which apps the current user can access.
 */
import { APP_REGISTRY, getAllApps, getAppIdFromPath } from '@shared/core';
import { useMemo } from 'react';

import { useUserPermissions } from '../../hooks/usePermissions';

import type { AppDefinition, AppId } from '@shared/core';

export type UseAppsResult = {
  /** List of apps the user can access */
  apps: AppDefinition[];
  /** Whether the user has access to multiple apps */
  hasMultipleApps: boolean;
  /** Check if user has access to a specific app */
  hasAppAccess: (appId: AppId) => boolean;
  /** Get the first accessible app (for redirects) */
  firstAccessibleApp: AppDefinition | null;
  /** Loading state while permissions are being fetched */
  isLoading: boolean;
};

/**
 * Hook to get user's accessible applications.
 *
 * Filters all available apps based on user's permissions and returns
 * the list of apps they can access.
 *
 * @example
 * const { apps, hasMultipleApps, isLoading } = useApps();
 *
 * if (hasMultipleApps) {
 *   // Show app switcher
 * }
 */
export function useApps(): UseAppsResult {
  const { hasPermission, isLoading } = useUserPermissions();

  const accessibleApps = useMemo(() => {
    if (isLoading) {
      return [];
    }

    return getAllApps().filter(app => hasPermission(app.permission));
  }, [hasPermission, isLoading]);

  const hasAppAccess = useMemo(
    () => (appId: AppId) => {
      const app = APP_REGISTRY[appId];
      return hasPermission(app.permission);
    },
    [hasPermission],
  );

  return {
    apps: accessibleApps,
    hasMultipleApps: accessibleApps.length > 1,
    hasAppAccess,
    firstAccessibleApp: accessibleApps[0] ?? null,
    isLoading,
  };
}

/**
 * Hook to get the current app based on the URL path.
 *
 * @returns The current app ID or undefined if not in an app context
 */
export function useCurrentApp(): AppId | undefined {
  // This hook can be extended to use useLocation if needed
  // For now, it's a simple utility to determine app from path
  return getAppIdFromPath(window.location.pathname);
}

/**
 * Get the last used app from localStorage.
 */
export function getLastUsedApp(): AppId | null {
  const stored = localStorage.getItem('lastUsedApp');
  if (stored && (stored === 'dashboard' || stored === 'salespro')) {
    return stored as AppId;
  }
  return null;
}

/**
 * Save the last used app to localStorage.
 */
export function setLastUsedApp(appId: AppId): void {
  localStorage.setItem('lastUsedApp', appId);
}
