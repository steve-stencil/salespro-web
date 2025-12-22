/**
 * App context for managing active application state in the unified shell.
 *
 * Tracks which application (web dashboard or mobile contracts) is currently active
 * and provides methods for switching between apps.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { useLocation } from 'react-router-dom';

import type { ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Available applications in the shell.
 */
export type AppId = 'web' | 'mobile';

/**
 * App metadata for UI display.
 */
export type AppInfo = {
  id: AppId;
  name: string;
  description: string;
  icon: string;
  rootPath: string;
};

/**
 * App context state and actions.
 */
export type AppContextType = {
  /** Currently active app */
  activeApp: AppId;
  /** Set the active app */
  setActiveApp: (app: AppId) => void;
  /** Get info for a specific app */
  getAppInfo: (appId: AppId) => AppInfo;
  /** All available app info */
  apps: AppInfo[];
};

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'salespro:lastActiveApp';

/**
 * Application definitions with metadata.
 */
export const APP_INFO: Record<AppId, AppInfo> = {
  web: {
    id: 'web',
    name: 'Dashboard',
    description: 'Admin dashboard for managing users, roles, and settings',
    icon: 'Dashboard',
    rootPath: '/dashboard',
  },
  mobile: {
    id: 'mobile',
    name: 'SalesPro',
    description: 'Mobile contract creation and management',
    icon: 'PhoneIphone',
    rootPath: '/mobile/contracts',
  },
};

/**
 * Route prefixes that determine which app context we're in.
 */
const ROUTE_TO_APP: Array<{ prefix: string; app: AppId }> = [
  { prefix: '/mobile', app: 'mobile' },
  // Default to web for all other routes
];

// ============================================================================
// Context
// ============================================================================

const AppContext = createContext<AppContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

type AppProviderProps = {
  children: ReactNode;
};

/**
 * Determines which app is active based on the current route.
 */
function getAppFromPath(pathname: string): AppId {
  for (const { prefix, app } of ROUTE_TO_APP) {
    if (pathname.startsWith(prefix)) {
      return app;
    }
  }
  return 'web';
}

/**
 * App context provider.
 * Automatically detects the active app based on the current route
 * and persists the last active app to localStorage.
 */
export function AppProvider({
  children,
}: AppProviderProps): React.ReactElement {
  const location = useLocation();

  // Initialize from current route or localStorage
  const [activeApp, setActiveAppState] = useState<AppId>(() => {
    const fromRoute = getAppFromPath(location.pathname);
    // If we're on a specific app route, use that
    if (location.pathname !== '/') {
      return fromRoute;
    }
    // Otherwise try to restore from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'web' || stored === 'mobile') {
      return stored;
    }
    return 'web';
  });

  // Update active app when route changes
  useEffect(() => {
    const appFromRoute = getAppFromPath(location.pathname);
    if (appFromRoute !== activeApp) {
      setActiveAppState(appFromRoute);
    }
  }, [location.pathname, activeApp]);

  // Persist to localStorage when app changes
  const setActiveApp = useCallback((app: AppId): void => {
    setActiveAppState(app);
    localStorage.setItem(STORAGE_KEY, app);
  }, []);

  const getAppInfo = useCallback((appId: AppId): AppInfo => {
    return APP_INFO[appId];
  }, []);

  const apps = useMemo(() => Object.values(APP_INFO), []);

  const contextValue = useMemo<AppContextType>(
    () => ({
      activeApp,
      setActiveApp,
      getAppInfo,
      apps,
    }),
    [activeApp, setActiveApp, getAppInfo, apps],
  );

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the app context.
 *
 * @example
 * const { activeApp, setActiveApp } = useAppContext();
 *
 * @throws Error if used outside of AppProvider
 */
export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
