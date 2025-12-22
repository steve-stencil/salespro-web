/**
 * Hook for checking app-level access permissions.
 *
 * Determines which applications the current user can access
 * based on their app:web and app:mobile permissions.
 */
import { useMemo } from 'react';

import { APP_INFO } from '../context/AppContext';

import { useUserPermissions, PERMISSIONS } from './usePermissions';

import type { AppId, AppInfo } from '../context/AppContext';

// ============================================================================
// Types
// ============================================================================

/**
 * Result from the useAppAccess hook.
 */
export type UseAppAccessResult = {
  /** Whether user has access to the web dashboard */
  hasWebAccess: boolean;
  /** Whether user has access to mobile contracts */
  hasMobileAccess: boolean;
  /** List of apps the user can access */
  availableApps: AppInfo[];
  /** Whether user has access to multiple apps (shows switcher) */
  hasMultipleApps: boolean;
  /** Loading state while permissions are being fetched */
  isLoading: boolean;
  /** Error message if permissions fetch failed */
  error: string | null;
  /** Get the default app for the user (first available app) */
  defaultApp: AppId | null;
  /** Check if user has access to a specific app */
  hasAppAccess: (appId: AppId) => boolean;
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to check which apps the current user has access to.
 *
 * @example
 * const { hasWebAccess, hasMobileAccess, availableApps } = useAppAccess();
 *
 * if (!hasWebAccess && !hasMobileAccess) {
 *   return <NoAccessPage />;
 * }
 */
export function useAppAccess(): UseAppAccessResult {
  const { hasPermission, isLoading, error } = useUserPermissions();

  const hasWebAccess = useMemo(
    () => hasPermission(PERMISSIONS.APP_WEB),
    [hasPermission],
  );

  const hasMobileAccess = useMemo(
    () => hasPermission(PERMISSIONS.APP_MOBILE),
    [hasPermission],
  );

  const availableApps = useMemo(() => {
    const apps: AppInfo[] = [];
    if (hasWebAccess) {
      apps.push(APP_INFO.web);
    }
    if (hasMobileAccess) {
      apps.push(APP_INFO.mobile);
    }
    return apps;
  }, [hasWebAccess, hasMobileAccess]);

  const hasMultipleApps = availableApps.length > 1;

  const defaultApp = useMemo((): AppId | null => {
    if (hasWebAccess) return 'web';
    if (hasMobileAccess) return 'mobile';
    return null;
  }, [hasWebAccess, hasMobileAccess]);

  const hasAppAccess = useMemo(() => {
    return (appId: AppId): boolean => {
      switch (appId) {
        case 'web':
          return hasWebAccess;
        case 'mobile':
          return hasMobileAccess;
        default:
          return false;
      }
    };
  }, [hasWebAccess, hasMobileAccess]);

  return {
    hasWebAccess,
    hasMobileAccess,
    availableApps,
    hasMultipleApps,
    isLoading,
    error,
    defaultApp,
    hasAppAccess,
  };
}
