/**
 * App types and registry for the multi-app architecture.
 *
 * Defines available applications in the platform and their configurations.
 * Each app has a unique ID, base path, and required permission.
 */

/**
 * Available application identifiers in the platform.
 */
export type AppId = 'dashboard' | 'salespro';

/**
 * Definition for an application in the platform.
 */
export type AppDefinition = {
  /** Unique identifier for the app */
  id: AppId;
  /** Display name of the app */
  name: string;
  /** Short description of the app's purpose */
  description: string;
  /** Material UI icon name to display */
  icon: string;
  /** Base URL path for the app (e.g., '/dashboard') */
  basePath: string;
  /** Permission string required to access this app */
  permission: string;
};

/**
 * Registry of all available applications.
 * Used by the app switcher and permission checks.
 */
export const APP_REGISTRY: Record<AppId, AppDefinition> = {
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Admin & management console',
    icon: 'dashboard',
    basePath: '/dashboard',
    permission: 'app:dashboard',
  },
  salespro: {
    id: 'salespro',
    name: 'SalesPro',
    description: 'Field sales application',
    icon: 'storefront',
    basePath: '/sales',
    permission: 'app:salespro',
  },
};

/**
 * Get all app definitions as an array.
 */
export function getAllApps(): AppDefinition[] {
  return Object.values(APP_REGISTRY);
}

/**
 * Get an app definition by its ID.
 */
export function getAppById(id: AppId): AppDefinition | undefined {
  return APP_REGISTRY[id];
}

/**
 * Check if a given string is a valid app ID.
 */
export function isValidAppId(id: string): id is AppId {
  return id in APP_REGISTRY;
}

/**
 * Get the app ID from a URL path.
 * Returns undefined if the path doesn't match any app.
 */
export function getAppIdFromPath(path: string): AppId | undefined {
  for (const app of Object.values(APP_REGISTRY)) {
    if (path.startsWith(app.basePath)) {
      return app.id;
    }
  }
  return undefined;
}

/**
 * App permission constants for easy reference.
 */
export const APP_PERMISSIONS = {
  DASHBOARD: 'app:dashboard',
  SALESPRO: 'app:salespro',
} as const;

export type AppPermission =
  (typeof APP_PERMISSIONS)[keyof typeof APP_PERMISSIONS];
