/**
 * Permission constants and utilities for the RBAC system.
 *
 * Permissions follow the format: resource:action
 * Examples: 'customer:read', 'user:create', 'office:delete'
 */

/**
 * All available permissions in the system.
 * These are defined in code as they map to actual API capabilities.
 */
export const PERMISSIONS = {
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

  // Company (admin-level)
  COMPANY_READ: 'company:read',
  COMPANY_UPDATE: 'company:update',

  // Files
  FILE_READ: 'file:read',
  FILE_CREATE: 'file:create',
  FILE_UPDATE: 'file:update',
  FILE_DELETE: 'file:delete',

  // Data Migration
  DATA_MIGRATION: 'data:migration',

  // Price Guide
  /** Export and import price guide pricing data via spreadsheet */
  PRICE_GUIDE_IMPORT_EXPORT: 'price_guide:import_export',

  // ==================================
  // Platform Permissions (Internal Users Only)
  // ==================================

  // Platform administration
  PLATFORM_ADMIN: 'platform:admin',
  PLATFORM_VIEW_COMPANIES: 'platform:view_companies',
  PLATFORM_CREATE_COMPANY: 'platform:create_company',
  PLATFORM_UPDATE_COMPANY: 'platform:update_company',
  PLATFORM_SWITCH_COMPANY: 'platform:switch_company',
  PLATFORM_VIEW_AUDIT_LOGS: 'platform:view_audit_logs',
  PLATFORM_MANAGE_INTERNAL_USERS: 'platform:manage_internal_users',
} as const;

/**
 * Permission type derived from the PERMISSIONS constant.
 * Use this for type-safe permission handling.
 */
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Metadata for each permission, used for UI rendering.
 */
export type PermissionMeta = {
  label: string;
  category: string;
  description: string;
};

/**
 * Permission metadata for UI rendering and documentation.
 * Each permission has a human-readable label, category, and description.
 */
export const PERMISSION_META: Record<Permission, PermissionMeta> = {
  // Customers
  'customer:read': {
    label: 'View Customers',
    category: 'Customers',
    description: 'View customer list and details',
  },
  'customer:create': {
    label: 'Create Customers',
    category: 'Customers',
    description: 'Add new customers to the system',
  },
  'customer:update': {
    label: 'Edit Customers',
    category: 'Customers',
    description: 'Modify existing customer information',
  },
  'customer:delete': {
    label: 'Delete Customers',
    category: 'Customers',
    description: 'Remove customers from the system',
  },

  // Users
  'user:read': {
    label: 'View Users',
    category: 'Users',
    description: 'View user list and profiles',
  },
  'user:create': {
    label: 'Create Users',
    category: 'Users',
    description: 'Add new users to the company',
  },
  'user:update': {
    label: 'Edit Users',
    category: 'Users',
    description: 'Modify user profiles and settings',
  },
  'user:delete': {
    label: 'Delete Users',
    category: 'Users',
    description:
      'Soft delete users from the company (preserves data for audit)',
  },
  'user:activate': {
    label: 'Activate/Deactivate Users',
    category: 'Users',
    description: 'Enable or disable user accounts',
  },

  // Offices
  'office:read': {
    label: 'View Offices',
    category: 'Offices',
    description: 'View office list and details',
  },
  'office:create': {
    label: 'Create Offices',
    category: 'Offices',
    description: 'Add new offices to the company',
  },
  'office:update': {
    label: 'Edit Offices',
    category: 'Offices',
    description: 'Modify office settings and information',
  },
  'office:delete': {
    label: 'Delete Offices',
    category: 'Offices',
    description: 'Remove offices from the company',
  },

  // Roles
  'role:read': {
    label: 'View Roles',
    category: 'Roles & Permissions',
    description: 'View available roles and their permissions',
  },
  'role:create': {
    label: 'Create Roles',
    category: 'Roles & Permissions',
    description: 'Create custom roles for the company',
  },
  'role:update': {
    label: 'Edit Roles',
    category: 'Roles & Permissions',
    description: 'Modify role permissions and settings',
  },
  'role:delete': {
    label: 'Delete Roles',
    category: 'Roles & Permissions',
    description: 'Remove custom roles from the company',
  },
  'role:assign': {
    label: 'Assign Roles',
    category: 'Roles & Permissions',
    description: 'Assign or revoke user roles',
  },

  // Reports
  'report:read': {
    label: 'View Reports',
    category: 'Reports',
    description: 'Access reports and analytics dashboards',
  },
  'report:export': {
    label: 'Export Reports',
    category: 'Reports',
    description: 'Export reports to CSV, PDF, or other formats',
  },

  // Settings
  'settings:read': {
    label: 'View Settings',
    category: 'Settings',
    description: 'View company and application settings',
  },
  'settings:update': {
    label: 'Manage Settings',
    category: 'Settings',
    description: 'Modify company and application settings',
  },

  // Company
  'company:read': {
    label: 'View Company Info',
    category: 'Company',
    description: 'View company profile and subscription details',
  },
  'company:update': {
    label: 'Manage Company',
    category: 'Company',
    description: 'Update company profile and subscription settings',
  },

  // Files
  'file:read': {
    label: 'View Files',
    category: 'Files',
    description: 'View and download files',
  },
  'file:create': {
    label: 'Upload Files',
    category: 'Files',
    description: 'Upload new files to the system',
  },
  'file:update': {
    label: 'Edit Files',
    category: 'Files',
    description: 'Update file metadata and visibility',
  },
  'file:delete': {
    label: 'Delete Files',
    category: 'Files',
    description: 'Delete files from the system',
  },

  // Data Migration
  'data:migration': {
    label: 'Data Migration',
    category: 'Data Migration',
    description: 'Import data from legacy systems (Parse)',
  },

  // Price Guide
  'price_guide:import_export': {
    label: 'Price Guide Import/Export',
    category: 'Price Guide',
    description: 'Export and import price guide pricing data via spreadsheet',
  },

  // Platform (Internal Users Only)
  'platform:admin': {
    label: 'Platform Admin',
    category: 'Platform',
    description: 'Full platform administration access (internal users only)',
  },
  'platform:view_companies': {
    label: 'View All Companies',
    category: 'Platform',
    description: 'View list of all companies in the platform',
  },
  'platform:create_company': {
    label: 'Create Companies',
    category: 'Platform',
    description: 'Create new companies in the platform',
  },
  'platform:update_company': {
    label: 'Update Companies',
    category: 'Platform',
    description: 'Update company settings and details',
  },
  'platform:switch_company': {
    label: 'Switch Company',
    category: 'Platform',
    description: 'Switch active company context (internal users only)',
  },
  'platform:view_audit_logs': {
    label: 'View Audit Logs',
    category: 'Platform',
    description: 'Access platform-wide audit and activity logs',
  },
  'platform:manage_internal_users': {
    label: 'Manage Internal Users',
    category: 'Platform',
    description: 'Create, edit, and manage internal platform users',
  },
};

/**
 * Get all permissions grouped by category.
 * Useful for building permission selection UIs.
 */
export function getPermissionsByCategory(): Record<string, Permission[]> {
  const grouped: Record<string, Permission[]> = {};

  for (const [permission, meta] of Object.entries(PERMISSION_META)) {
    const { category } = meta;
    grouped[category] ??= [];
    grouped[category].push(permission as Permission);
  }

  return grouped;
}

/**
 * Get all available permission strings.
 * Useful for validation.
 */
export function getAllPermissions(): Permission[] {
  return Object.values(PERMISSIONS);
}

/**
 * Check if a permission string is valid.
 */
export function isValidPermission(
  permission: string,
): permission is Permission {
  return Object.values(PERMISSIONS).includes(permission as Permission);
}

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
 * Used to check a user's effective permissions against a required permission.
 *
 * @example
 *   hasPermission('customer:read', ['customer:read', 'user:read']) // true
 *   hasPermission('customer:read', ['customer:*'])                  // true
 *   hasPermission('customer:read', ['*'])                           // true
 *   hasPermission('customer:delete', ['customer:read'])             // false
 */
export function hasPermission(
  permission: string,
  userPermissions: string[],
): boolean {
  return userPermissions.some(pattern => matchPermission(permission, pattern));
}

/**
 * Expand wildcard permissions to their concrete permissions.
 * Useful for displaying effective permissions in UI.
 *
 * @example
 *   expandWildcard('customer:*') // ['customer:read', 'customer:create', ...]
 *   expandWildcard('*')          // [all permissions]
 */
export function expandWildcard(pattern: string): Permission[] {
  const allPermissions = getAllPermissions();

  if (pattern === '*') {
    return allPermissions;
  }

  if (pattern.endsWith(':*')) {
    const resource = pattern.slice(0, -2);
    return allPermissions.filter(p => p.startsWith(resource + ':'));
  }

  // If it's a concrete permission, return it if valid
  if (isValidPermission(pattern)) {
    return [pattern];
  }

  return [];
}

// ==================================
// Platform Permission Helpers
// ==================================

/**
 * Check if a permission is a platform-level permission.
 * Platform permissions are prefixed with 'platform:'.
 */
export function isPlatformPermission(permission: string): boolean {
  return permission.startsWith('platform:');
}

/**
 * Get all platform permissions.
 * These are only applicable to internal users.
 */
export function getPlatformPermissions(): Permission[] {
  return getAllPermissions().filter(p => isPlatformPermission(p));
}

/**
 * Get all company/resource permissions (non-platform).
 * These are the permissions that apply to actions within a company.
 */
export function getCompanyPermissions(): Permission[] {
  return getAllPermissions().filter(p => !isPlatformPermission(p));
}

/**
 * Get all read-only permissions (all :read actions).
 * Used for platform roles with READ_ONLY access level.
 */
export function getReadOnlyPermissions(): Permission[] {
  return getCompanyPermissions().filter(p => p.endsWith(':read'));
}
