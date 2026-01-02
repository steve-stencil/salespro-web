/**
 * App context for tracking the current application state.
 *
 * Provides the current app ID and setter for components that need
 * to know which app they're rendering within.
 */
import { getAppIdFromPath } from '@shared/core';
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { setLastUsedApp } from '../hooks/useApps';

import type { AppId } from '@shared/core';
import type { ReactNode } from 'react';

export type AppContextValue = {
  /** Current app ID (null if not in an app context) */
  currentApp: AppId | null;
  /** Set the current app */
  setCurrentApp: (app: AppId) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

type AppProviderProps = {
  children: ReactNode;
};

/**
 * Provider component for app context.
 * Automatically updates the current app based on URL path.
 */
export function AppProvider({
  children,
}: AppProviderProps): React.ReactElement {
  const location = useLocation();
  const [currentApp, setCurrentAppState] = useState<AppId | null>(null);

  // Update current app based on URL path
  useEffect(() => {
    const appFromPath = getAppIdFromPath(location.pathname);
    if (appFromPath && appFromPath !== currentApp) {
      setCurrentAppState(appFromPath);
      setLastUsedApp(appFromPath);
    }
  }, [location.pathname, currentApp]);

  /**
   * Manually set the current app.
   */
  function setCurrentApp(app: AppId): void {
    setCurrentAppState(app);
    setLastUsedApp(app);
  }

  const contextValue = useMemo<AppContextValue>(
    () => ({
      currentApp,
      setCurrentApp,
    }),
    [currentApp],
  );

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}

/**
 * Hook to access the app context.
 *
 * @throws Error if used outside of AppProvider
 *
 * @example
 * const { currentApp } = useAppContext();
 */
export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

/**
 * Hook to get just the current app ID.
 * Safe to use - returns null if outside AppProvider.
 */
export function useCurrentAppId(): AppId | null {
  const context = useContext(AppContext);
  return context?.currentApp ?? null;
}
