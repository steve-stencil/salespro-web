import { describe, it, expect } from 'vitest';

import {
  PERMISSIONS,
  getAllPermissions,
  getPermissionsByCategory,
  isValidPermission,
  matchPermission,
  hasPermission,
  expandWildcard,
  isPlatformPermission,
  getPlatformPermissions,
  getCompanyPermissions,
  getReadOnlyPermissions,
} from '../../lib/permissions';

describe('permissions', () => {
  describe('PERMISSIONS constant', () => {
    it('should define customer permissions', () => {
      expect(PERMISSIONS.CUSTOMER_READ).toBe('customer:read');
      expect(PERMISSIONS.CUSTOMER_CREATE).toBe('customer:create');
      expect(PERMISSIONS.CUSTOMER_UPDATE).toBe('customer:update');
      expect(PERMISSIONS.CUSTOMER_DELETE).toBe('customer:delete');
    });

    it('should define user permissions', () => {
      expect(PERMISSIONS.USER_READ).toBe('user:read');
      expect(PERMISSIONS.USER_CREATE).toBe('user:create');
      expect(PERMISSIONS.USER_UPDATE).toBe('user:update');
      expect(PERMISSIONS.USER_DELETE).toBe('user:delete');
      expect(PERMISSIONS.USER_ACTIVATE).toBe('user:activate');
    });

    it('should define role permissions', () => {
      expect(PERMISSIONS.ROLE_READ).toBe('role:read');
      expect(PERMISSIONS.ROLE_CREATE).toBe('role:create');
      expect(PERMISSIONS.ROLE_UPDATE).toBe('role:update');
      expect(PERMISSIONS.ROLE_DELETE).toBe('role:delete');
      expect(PERMISSIONS.ROLE_ASSIGN).toBe('role:assign');
    });

    it('should define office permissions', () => {
      expect(PERMISSIONS.OFFICE_READ).toBe('office:read');
      expect(PERMISSIONS.OFFICE_CREATE).toBe('office:create');
      expect(PERMISSIONS.OFFICE_UPDATE).toBe('office:update');
      expect(PERMISSIONS.OFFICE_DELETE).toBe('office:delete');
    });

    it('should follow resource:action naming convention', () => {
      const permissions = getAllPermissions();
      for (const perm of permissions) {
        // Resources and actions can use underscores for readability
        expect(perm).toMatch(/^[a-z_]+:[a-z_]+$/);
      }
    });

    it('should define platform permissions', () => {
      expect(PERMISSIONS.PLATFORM_ADMIN).toBe('platform:admin');
      expect(PERMISSIONS.PLATFORM_VIEW_COMPANIES).toBe(
        'platform:view_companies',
      );
      expect(PERMISSIONS.PLATFORM_SWITCH_COMPANY).toBe(
        'platform:switch_company',
      );
      expect(PERMISSIONS.PLATFORM_VIEW_AUDIT_LOGS).toBe(
        'platform:view_audit_logs',
      );
      expect(PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS).toBe(
        'platform:manage_internal_users',
      );
    });
  });

  describe('getAllPermissions', () => {
    it('should return all permissions as an array', () => {
      const permissions = getAllPermissions();
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    });

    it('should include all defined permissions', () => {
      const permissions = getAllPermissions();
      expect(permissions).toContain('customer:read');
      expect(permissions).toContain('user:create');
      expect(permissions).toContain('role:assign');
    });
  });

  describe('getPermissionsByCategory', () => {
    it('should group permissions by category', () => {
      const byCategory = getPermissionsByCategory();
      expect(typeof byCategory).toBe('object');
      expect(Object.keys(byCategory).length).toBeGreaterThan(0);
    });

    it('should have Customers category', () => {
      const byCategory = getPermissionsByCategory();
      expect(byCategory['Customers']).toBeDefined();
      expect(byCategory['Customers']).toContain('customer:read');
      expect(byCategory['Customers']).toContain('customer:create');
    });

    it('should have Users category', () => {
      const byCategory = getPermissionsByCategory();
      expect(byCategory['Users']).toBeDefined();
      expect(byCategory['Users']).toContain('user:read');
    });

    it('should have Roles & Permissions category', () => {
      const byCategory = getPermissionsByCategory();
      expect(byCategory['Roles & Permissions']).toBeDefined();
      expect(byCategory['Roles & Permissions']).toContain('role:read');
      expect(byCategory['Roles & Permissions']).toContain('role:assign');
    });
  });

  describe('isValidPermission', () => {
    it('should return true for valid permissions', () => {
      expect(isValidPermission('customer:read')).toBe(true);
      expect(isValidPermission('user:create')).toBe(true);
      expect(isValidPermission('role:assign')).toBe(true);
    });

    it('should return false for invalid permissions', () => {
      expect(isValidPermission('invalid:permission')).toBe(false);
      expect(isValidPermission('not-a-permission')).toBe(false);
      expect(isValidPermission('')).toBe(false);
      expect(isValidPermission('customer:unknown')).toBe(false);
    });

    it('should return false for wildcard patterns', () => {
      expect(isValidPermission('*')).toBe(false);
      expect(isValidPermission('customer:*')).toBe(false);
    });
  });

  describe('matchPermission', () => {
    describe('exact match', () => {
      it('should match identical permissions', () => {
        expect(matchPermission('customer:read', 'customer:read')).toBe(true);
        expect(matchPermission('user:create', 'user:create')).toBe(true);
      });

      it('should not match different permissions', () => {
        expect(matchPermission('customer:read', 'customer:create')).toBe(false);
        expect(matchPermission('customer:read', 'user:read')).toBe(false);
      });
    });

    describe('wildcard * (all permissions)', () => {
      it('should match any permission with *', () => {
        expect(matchPermission('customer:read', '*')).toBe(true);
        expect(matchPermission('user:delete', '*')).toBe(true);
        expect(matchPermission('role:assign', '*')).toBe(true);
      });
    });

    describe('resource wildcard (resource:*)', () => {
      it('should match all actions for a resource', () => {
        expect(matchPermission('customer:read', 'customer:*')).toBe(true);
        expect(matchPermission('customer:create', 'customer:*')).toBe(true);
        expect(matchPermission('customer:update', 'customer:*')).toBe(true);
        expect(matchPermission('customer:delete', 'customer:*')).toBe(true);
      });

      it('should not match different resources', () => {
        expect(matchPermission('user:read', 'customer:*')).toBe(false);
        expect(matchPermission('role:read', 'customer:*')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should not match partial resource names', () => {
        // 'custom' is not 'customer'
        expect(matchPermission('custom:read', 'customer:*')).toBe(false);
      });

      it('should handle empty patterns', () => {
        expect(matchPermission('customer:read', '')).toBe(false);
      });
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has exact permission', () => {
      const userPermissions = ['customer:read', 'customer:create'];
      expect(hasPermission('customer:read', userPermissions)).toBe(true);
      expect(hasPermission('customer:create', userPermissions)).toBe(true);
    });

    it('should return false when user lacks permission', () => {
      const userPermissions = ['customer:read'];
      expect(hasPermission('customer:delete', userPermissions)).toBe(false);
      expect(hasPermission('user:read', userPermissions)).toBe(false);
    });

    it('should match via wildcard *', () => {
      const userPermissions = ['*'];
      expect(hasPermission('customer:read', userPermissions)).toBe(true);
      expect(hasPermission('anything:whatever', userPermissions)).toBe(true);
    });

    it('should match via resource wildcard', () => {
      const userPermissions = ['customer:*', 'user:read'];
      expect(hasPermission('customer:read', userPermissions)).toBe(true);
      expect(hasPermission('customer:delete', userPermissions)).toBe(true);
      expect(hasPermission('user:read', userPermissions)).toBe(true);
      expect(hasPermission('user:delete', userPermissions)).toBe(false);
    });

    it('should return false for empty permission array', () => {
      expect(hasPermission('customer:read', [])).toBe(false);
    });

    it('should handle mixed permissions', () => {
      const userPermissions = ['customer:read', 'user:*', 'role:assign'];
      expect(hasPermission('customer:read', userPermissions)).toBe(true);
      expect(hasPermission('customer:create', userPermissions)).toBe(false);
      expect(hasPermission('user:read', userPermissions)).toBe(true);
      expect(hasPermission('user:delete', userPermissions)).toBe(true);
      expect(hasPermission('role:assign', userPermissions)).toBe(true);
      expect(hasPermission('role:delete', userPermissions)).toBe(false);
    });
  });

  describe('expandWildcard', () => {
    it('should expand * to all permissions', () => {
      const expanded = expandWildcard('*');
      const allPermissions = getAllPermissions();
      expect(expanded).toEqual(allPermissions);
    });

    it('should expand resource:* to all actions for that resource', () => {
      const expanded = expandWildcard('customer:*');
      expect(expanded).toContain('customer:read');
      expect(expanded).toContain('customer:create');
      expect(expanded).toContain('customer:update');
      expect(expanded).toContain('customer:delete');
      expect(expanded).not.toContain('user:read');
    });

    it('should expand user:* correctly', () => {
      const expanded = expandWildcard('user:*');
      expect(expanded).toContain('user:read');
      expect(expanded).toContain('user:create');
      expect(expanded).toContain('user:update');
      expect(expanded).toContain('user:delete');
      expect(expanded).toContain('user:activate');
    });

    it('should return single permission array for concrete permissions', () => {
      const expanded = expandWildcard('customer:read');
      expect(expanded).toEqual(['customer:read']);
    });

    it('should return empty array for invalid patterns', () => {
      const expanded = expandWildcard('invalid:pattern');
      expect(expanded).toEqual([]);
    });

    it('should return empty array for malformed wildcards', () => {
      const expanded = expandWildcard('invalid:*');
      expect(expanded).toEqual([]);
    });
  });

  describe('isPlatformPermission', () => {
    it('should return true for platform permissions', () => {
      expect(isPlatformPermission('platform:admin')).toBe(true);
      expect(isPlatformPermission('platform:view_companies')).toBe(true);
      expect(isPlatformPermission('platform:switch_company')).toBe(true);
    });

    it('should return false for non-platform permissions', () => {
      expect(isPlatformPermission('customer:read')).toBe(false);
      expect(isPlatformPermission('user:create')).toBe(false);
      expect(isPlatformPermission('role:assign')).toBe(false);
    });

    it('should return false for wildcards', () => {
      expect(isPlatformPermission('*')).toBe(false);
      expect(isPlatformPermission('customer:*')).toBe(false);
    });
  });

  describe('getPlatformPermissions', () => {
    it('should return only platform permissions', () => {
      const platformPerms = getPlatformPermissions();
      expect(platformPerms.length).toBeGreaterThan(0);
      expect(platformPerms.every(p => p.startsWith('platform:'))).toBe(true);
    });

    it('should include all defined platform permissions', () => {
      const platformPerms = getPlatformPermissions();
      expect(platformPerms).toContain('platform:admin');
      expect(platformPerms).toContain('platform:view_companies');
      expect(platformPerms).toContain('platform:switch_company');
      expect(platformPerms).toContain('platform:view_audit_logs');
      expect(platformPerms).toContain('platform:manage_internal_users');
    });

    it('should not include company permissions', () => {
      const platformPerms = getPlatformPermissions();
      expect(platformPerms).not.toContain('customer:read');
      expect(platformPerms).not.toContain('user:create');
    });
  });

  describe('getCompanyPermissions', () => {
    it('should return only non-platform permissions', () => {
      const companyPerms = getCompanyPermissions();
      expect(companyPerms.length).toBeGreaterThan(0);
      expect(companyPerms.every(p => !p.startsWith('platform:'))).toBe(true);
    });

    it('should include company resource permissions', () => {
      const companyPerms = getCompanyPermissions();
      expect(companyPerms).toContain('customer:read');
      expect(companyPerms).toContain('user:create');
      expect(companyPerms).toContain('role:assign');
    });

    it('should not include platform permissions', () => {
      const companyPerms = getCompanyPermissions();
      expect(companyPerms).not.toContain('platform:admin');
      expect(companyPerms).not.toContain('platform:view_companies');
    });
  });

  describe('getReadOnlyPermissions', () => {
    it('should return only :read permissions', () => {
      const readOnlyPerms = getReadOnlyPermissions();
      expect(readOnlyPerms.length).toBeGreaterThan(0);
      expect(readOnlyPerms.every(p => p.endsWith(':read'))).toBe(true);
    });

    it('should include read permissions for main resources', () => {
      const readOnlyPerms = getReadOnlyPermissions();
      expect(readOnlyPerms).toContain('customer:read');
      expect(readOnlyPerms).toContain('user:read');
      expect(readOnlyPerms).toContain('role:read');
      expect(readOnlyPerms).toContain('office:read');
    });

    it('should not include non-read permissions', () => {
      const readOnlyPerms = getReadOnlyPermissions();
      expect(readOnlyPerms).not.toContain('customer:create');
      expect(readOnlyPerms).not.toContain('user:delete');
      expect(readOnlyPerms).not.toContain('role:assign');
    });

    it('should not include platform permissions', () => {
      const readOnlyPerms = getReadOnlyPermissions();
      expect(readOnlyPerms.every(p => !p.startsWith('platform:'))).toBe(true);
    });
  });
});
