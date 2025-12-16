import { v4 as uuid } from 'uuid';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PermissionService } from '../../services/PermissionService';

import type { Role, UserRole } from '../../entities';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Create a mock Role entity
 */
function createMockRole(overrides: Partial<Role> = {}): Role {
  return {
    id: uuid(),
    name: 'testRole',
    displayName: 'Test Role',
    permissions: ['customer:read'],
    isDefault: false,
    isSystemRole: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Role;
}

/**
 * Create a mock UserRole entity
 */
function createMockUserRole(
  role: Role,
  overrides: Partial<UserRole> = {},
): UserRole {
  return {
    id: uuid(),
    user: { id: uuid() },
    role,
    company: { id: uuid() },
    assignedAt: new Date(),
    ...overrides,
  } as unknown as UserRole;
}

/**
 * Create a mock EntityManager
 */
function createMockEm() {
  const em = {
    fork: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    persist: vi.fn(),
    flush: vi.fn(),
    removeAndFlush: vi.fn(),
    persistAndFlush: vi.fn(),
    nativeDelete: vi.fn(),
  };
  em.fork.mockReturnValue(em);
  return em;
}

describe('PermissionService', () => {
  let permissionService: PermissionService;
  let mockEm: ReturnType<typeof createMockEm>;
  const testUserId = uuid();
  const testCompanyId = uuid();
  const testRoleId = uuid();

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm = createMockEm();
    permissionService = new PermissionService(
      mockEm as unknown as EntityManager,
    );
  });

  describe('getUserPermissions', () => {
    it('should return permissions from user roles', async () => {
      const role1 = createMockRole({
        permissions: ['customer:read', 'customer:create'],
      });
      const role2 = createMockRole({ permissions: ['user:read'] });
      const userRoles = [createMockUserRole(role1), createMockUserRole(role2)];

      mockEm.find.mockResolvedValue(userRoles);

      const permissions = await permissionService.getUserPermissions(
        testUserId,
        testCompanyId,
      );

      expect(permissions).toContain('customer:read');
      expect(permissions).toContain('customer:create');
      expect(permissions).toContain('user:read');
    });

    it('should return empty array when user has no roles', async () => {
      mockEm.find.mockResolvedValue([]);

      const permissions = await permissionService.getUserPermissions(
        testUserId,
        testCompanyId,
      );

      expect(permissions).toEqual([]);
    });

    it('should deduplicate permissions from multiple roles', async () => {
      const role1 = createMockRole({
        permissions: ['customer:read', 'customer:create'],
      });
      const role2 = createMockRole({
        permissions: ['customer:read', 'user:read'],
      });
      const userRoles = [createMockUserRole(role1), createMockUserRole(role2)];

      mockEm.find.mockResolvedValue(userRoles);

      const permissions = await permissionService.getUserPermissions(
        testUserId,
        testCompanyId,
      );

      // Should deduplicate customer:read
      const customerReadCount = permissions.filter(
        p => p === 'customer:read',
      ).length;
      expect(customerReadCount).toBe(1);
    });

    it('should cache permissions', async () => {
      const role = createMockRole({ permissions: ['customer:read'] });
      const userRoles = [createMockUserRole(role)];

      mockEm.find.mockResolvedValue(userRoles);

      // First call
      await permissionService.getUserPermissions(testUserId, testCompanyId);
      // Second call - should use cache
      await permissionService.getUserPermissions(testUserId, testCompanyId);

      // Database should only be called once
      expect(mockEm.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has exact permission', async () => {
      const role = createMockRole({ permissions: ['customer:read'] });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      const result = await permissionService.hasPermission(
        testUserId,
        'customer:read',
        testCompanyId,
      );

      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      const role = createMockRole({ permissions: ['customer:read'] });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      const result = await permissionService.hasPermission(
        testUserId,
        'customer:delete',
        testCompanyId,
      );

      expect(result).toBe(false);
    });

    it('should match via wildcard *', async () => {
      const role = createMockRole({ permissions: ['*'] });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      const result = await permissionService.hasPermission(
        testUserId,
        'anything:here',
        testCompanyId,
      );

      expect(result).toBe(true);
    });

    it('should match via resource wildcard', async () => {
      const role = createMockRole({ permissions: ['customer:*'] });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      expect(
        await permissionService.hasPermission(
          testUserId,
          'customer:read',
          testCompanyId,
        ),
      ).toBe(true);
      expect(
        await permissionService.hasPermission(
          testUserId,
          'customer:delete',
          testCompanyId,
        ),
      ).toBe(true);
      expect(
        await permissionService.hasPermission(
          testUserId,
          'user:read',
          testCompanyId,
        ),
      ).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when user has all required permissions', async () => {
      const role = createMockRole({
        permissions: ['customer:read', 'customer:create', 'customer:update'],
      });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      const result = await permissionService.hasAllPermissions(
        testUserId,
        ['customer:read', 'customer:create'],
        testCompanyId,
      );

      expect(result).toBe(true);
    });

    it('should return false when user lacks any required permission', async () => {
      const role = createMockRole({ permissions: ['customer:read'] });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      const result = await permissionService.hasAllPermissions(
        testUserId,
        ['customer:read', 'customer:delete'],
        testCompanyId,
      );

      expect(result).toBe(false);
    });

    it('should return true with empty requirements', async () => {
      mockEm.find.mockResolvedValue([]);

      const result = await permissionService.hasAllPermissions(
        testUserId,
        [],
        testCompanyId,
      );

      expect(result).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when user has at least one required permission', async () => {
      const role = createMockRole({ permissions: ['customer:read'] });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      const result = await permissionService.hasAnyPermission(
        testUserId,
        ['customer:read', 'customer:delete'],
        testCompanyId,
      );

      expect(result).toBe(true);
    });

    it('should return false when user has none of the required permissions', async () => {
      const role = createMockRole({ permissions: ['user:read'] });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      const result = await permissionService.hasAnyPermission(
        testUserId,
        ['customer:read', 'customer:delete'],
        testCompanyId,
      );

      expect(result).toBe(false);
    });

    it('should return false with empty requirements', async () => {
      const role = createMockRole({ permissions: ['customer:read'] });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      const result = await permissionService.hasAnyPermission(
        testUserId,
        [],
        testCompanyId,
      );

      expect(result).toBe(false);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate cache for specific user', async () => {
      const role = createMockRole({ permissions: ['customer:read'] });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      // First call to populate cache
      await permissionService.getUserPermissions(testUserId, testCompanyId);
      expect(mockEm.find).toHaveBeenCalledTimes(1);

      // Invalidate cache
      permissionService.invalidateCache(testUserId, testCompanyId);

      // Second call should hit database again
      await permissionService.getUserPermissions(testUserId, testCompanyId);
      expect(mockEm.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateAllCache', () => {
    it('should invalidate all cached permissions', async () => {
      const role = createMockRole({ permissions: ['customer:read'] });
      const userRoles = [createMockUserRole(role)];
      mockEm.find.mockResolvedValue(userRoles);

      const user2Id = uuid();
      const company2Id = uuid();

      // Populate cache for two different users
      await permissionService.getUserPermissions(testUserId, testCompanyId);
      await permissionService.getUserPermissions(user2Id, company2Id);
      expect(mockEm.find).toHaveBeenCalledTimes(2);

      // Invalidate all cache
      permissionService.invalidateAllCache();

      // Both should hit database again
      await permissionService.getUserPermissions(testUserId, testCompanyId);
      await permissionService.getUserPermissions(user2Id, company2Id);
      expect(mockEm.find).toHaveBeenCalledTimes(4);
    });
  });

  describe('assignRole', () => {
    it('should create a new user role assignment', async () => {
      mockEm.findOne.mockResolvedValue(null); // No existing assignment
      mockEm.create.mockReturnValue({ id: uuid() });

      const result = await permissionService.assignRole(
        testUserId,
        testRoleId,
        testCompanyId,
        'assignerUserId',
      );

      expect(result.success).toBe(true);
      expect(mockEm.persistAndFlush).toHaveBeenCalled();
    });

    it('should return error if role is already assigned', async () => {
      const existingUserRole = createMockUserRole(createMockRole());
      mockEm.findOne.mockResolvedValue(existingUserRole);

      const result = await permissionService.assignRole(
        testUserId,
        testRoleId,
        testCompanyId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Role is already assigned to this user');
    });

    it('should invalidate cache after assignment', async () => {
      mockEm.findOne.mockResolvedValue(null);
      mockEm.create.mockReturnValue({ id: uuid() });

      // Populate cache first
      const role = createMockRole({ permissions: ['customer:read'] });
      mockEm.find.mockResolvedValue([createMockUserRole(role)]);
      await permissionService.getUserPermissions(testUserId, testCompanyId);
      expect(mockEm.find).toHaveBeenCalledTimes(1);

      // Assign role
      await permissionService.assignRole(testUserId, testRoleId, testCompanyId);

      // Next getUserPermissions should hit database
      await permissionService.getUserPermissions(testUserId, testCompanyId);
      expect(mockEm.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('revokeRole', () => {
    it('should remove user role assignment', async () => {
      const existingUserRole = createMockUserRole(createMockRole());
      mockEm.findOne.mockResolvedValue(existingUserRole);

      const result = await permissionService.revokeRole(
        testUserId,
        testRoleId,
        testCompanyId,
      );

      expect(result).toBe(true);
      expect(mockEm.removeAndFlush).toHaveBeenCalledWith(existingUserRole);
    });

    it('should return false if role is not assigned', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await permissionService.revokeRole(
        testUserId,
        testRoleId,
        testCompanyId,
      );

      expect(result).toBe(false);
    });

    it('should invalidate cache after revocation', async () => {
      const existingUserRole = createMockUserRole(createMockRole());
      mockEm.findOne.mockResolvedValue(existingUserRole);

      // Populate cache first
      const role = createMockRole({ permissions: ['customer:read'] });
      mockEm.find.mockResolvedValue([createMockUserRole(role)]);
      await permissionService.getUserPermissions(testUserId, testCompanyId);
      expect(mockEm.find).toHaveBeenCalledTimes(1);

      // Revoke role
      await permissionService.revokeRole(testUserId, testRoleId, testCompanyId);

      // Next getUserPermissions should hit database
      await permissionService.getUserPermissions(testUserId, testCompanyId);
      expect(mockEm.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('revokeAllRoles', () => {
    it('should remove all user role assignments', async () => {
      const userRoles = [
        createMockUserRole(createMockRole()),
        createMockUserRole(createMockRole()),
      ];
      mockEm.find.mockResolvedValue(userRoles);

      const result = await permissionService.revokeAllRoles(
        testUserId,
        testCompanyId,
      );

      expect(result).toBe(2);
      expect(mockEm.removeAndFlush).toHaveBeenCalledWith(userRoles);
    });

    it('should return 0 if user has no roles', async () => {
      mockEm.find.mockResolvedValue([]);

      const result = await permissionService.revokeAllRoles(
        testUserId,
        testCompanyId,
      );

      expect(result).toBe(0);
      expect(mockEm.removeAndFlush).not.toHaveBeenCalled();
    });
  });

  describe('getUserRoles', () => {
    it('should return roles for user', async () => {
      const role1 = createMockRole({ name: 'admin' });
      const role2 = createMockRole({ name: 'user' });
      const userRoles = [createMockUserRole(role1), createMockUserRole(role2)];
      mockEm.find.mockResolvedValue(userRoles);

      const roles = await permissionService.getUserRoles(
        testUserId,
        testCompanyId,
      );

      expect(roles).toHaveLength(2);
      expect(roles[0].name).toBe('admin');
      expect(roles[1].name).toBe('user');
    });

    it('should return empty array if user has no roles', async () => {
      mockEm.find.mockResolvedValue([]);

      const roles = await permissionService.getUserRoles(
        testUserId,
        testCompanyId,
      );

      expect(roles).toEqual([]);
    });
  });

  describe('getAvailableRoles', () => {
    it('should return system and company roles', async () => {
      const roles = [
        createMockRole({ name: 'systemAdmin', company: undefined }),
        createMockRole({ name: 'companyRole' }),
      ];
      mockEm.find.mockResolvedValue(roles);

      const result = await permissionService.getAvailableRoles(testCompanyId);

      expect(result).toHaveLength(2);
      expect(mockEm.find).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $or: [{ company: null }, { company: testCompanyId }],
        }),
      );
    });
  });

  describe('getRoleByName', () => {
    it('should find company-specific role first', async () => {
      const companyRole = createMockRole({ name: 'admin' });
      mockEm.findOne.mockResolvedValueOnce(companyRole);

      const role = await permissionService.getRoleByName(
        'admin',
        testCompanyId,
      );

      expect(role).toBe(companyRole);
      expect(mockEm.findOne).toHaveBeenCalledTimes(1);
    });

    it('should fall back to system role if no company role', async () => {
      const systemRole = createMockRole({ name: 'admin' });
      mockEm.findOne.mockResolvedValueOnce(null); // No company role
      mockEm.findOne.mockResolvedValueOnce(systemRole); // System role

      const role = await permissionService.getRoleByName(
        'admin',
        testCompanyId,
      );

      expect(role).toBe(systemRole);
      expect(mockEm.findOne).toHaveBeenCalledTimes(2);
    });

    it('should search system roles only when no companyId', async () => {
      const systemRole = createMockRole({ name: 'admin' });
      mockEm.findOne.mockResolvedValue(systemRole);

      const role = await permissionService.getRoleByName('admin');

      expect(role).toBe(systemRole);
      expect(mockEm.findOne).toHaveBeenCalledWith(expect.anything(), {
        name: 'admin',
        company: null,
      });
    });
  });

  describe('assignDefaultRoles', () => {
    it('should assign all default roles to user', async () => {
      const defaultRoles = [
        createMockRole({ isDefault: true, name: 'viewer' }),
        createMockRole({ isDefault: true, name: 'basic' }),
      ];
      mockEm.find.mockResolvedValue(defaultRoles);
      mockEm.create.mockImplementation(() => ({}) as UserRole);

      const assignments = await permissionService.assignDefaultRoles(
        testUserId,
        testCompanyId,
      );

      expect(assignments).toHaveLength(2);
      expect(mockEm.persist).toHaveBeenCalledTimes(2);
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('should return empty array if no default roles', async () => {
      mockEm.find.mockResolvedValue([]);

      const assignments = await permissionService.assignDefaultRoles(
        testUserId,
        testCompanyId,
      );

      expect(assignments).toEqual([]);
      expect(mockEm.flush).not.toHaveBeenCalled();
    });
  });
});
