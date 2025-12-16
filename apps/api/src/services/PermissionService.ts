import { UserRole, Role, User } from '../entities';
import { UserType, RoleType, CompanyAccessLevel } from '../entities/types';
import {
  hasPermission as checkPermission,
  getReadOnlyPermissions,
  getPlatformPermissions,
  isPlatformPermission,
} from '../lib/permissions';

import type { EntityManager } from '@mikro-orm/core';

/**
 * Cache entry for user permissions.
 * Stores the merged permissions from all roles and an expiration timestamp.
 */
type CacheEntry = {
  permissions: Set<string>;
  expiresAt: number;
};

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Result type for role assignment operations
 */
export type RoleAssignmentResult = {
  success: boolean;
  userRole?: UserRole;
  error?: string;
};

/**
 * Permission Service for the RBAC system.
 *
 * Provides methods to:
 * - Check if a user has a specific permission
 * - Get all permissions for a user in a company
 * - Assign/revoke roles from users
 * - Get user's roles
 *
 * Includes in-memory caching to avoid database queries on every request.
 * Cache is invalidated when roles are assigned or revoked.
 */
export class PermissionService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly em: EntityManager) {}

  /**
   * Generate cache key for a user-company pair
   */
  private getCacheKey(userId: string, companyId: string): string {
    return `${userId}:${companyId}`;
  }

  /**
   * Get all permissions for a user in a company.
   * Results are cached for performance.
   *
   * @param userId - The user's ID
   * @param companyId - The company context
   * @returns Array of permission strings (may include wildcards)
   */
  async getUserPermissions(
    userId: string,
    companyId: string,
  ): Promise<string[]> {
    const cacheKey = this.getCacheKey(userId, companyId);
    const cached = this.cache.get(cacheKey);

    // Return cached result if still valid
    if (cached && cached.expiresAt > Date.now()) {
      return Array.from(cached.permissions);
    }

    // Fetch all roles for this user in this company
    const userRoles = await this.em.find(
      UserRole,
      {
        user: userId,
        company: companyId,
      },
      { populate: ['role'] },
    );

    // Merge permissions from all roles (union)
    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      for (const perm of userRole.role.permissions) {
        permissions.add(perm);
      }
    }

    // Cache the result
    this.cache.set(cacheKey, {
      permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return Array.from(permissions);
  }

  /**
   * Check if a user has a specific permission.
   * Supports wildcard matching (*, resource:*).
   *
   * @param userId - The user's ID
   * @param permission - The permission to check (e.g., 'customer:read')
   * @param companyId - The company context
   * @returns True if the user has the permission (directly or via wildcard)
   */
  async hasPermission(
    userId: string,
    permission: string,
    companyId: string,
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId, companyId);
    return checkPermission(permission, userPermissions);
  }

  /**
   * Check if a user has ALL of the specified permissions.
   *
   * @param userId - The user's ID
   * @param permissions - Array of permissions to check
   * @param companyId - The company context
   * @returns True if the user has all permissions
   */
  async hasAllPermissions(
    userId: string,
    permissions: string[],
    companyId: string,
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId, companyId);
    return permissions.every(perm => checkPermission(perm, userPermissions));
  }

  /**
   * Check if a user has ANY of the specified permissions.
   *
   * @param userId - The user's ID
   * @param permissions - Array of permissions to check
   * @param companyId - The company context
   * @returns True if the user has at least one permission
   */
  async hasAnyPermission(
    userId: string,
    permissions: string[],
    companyId: string,
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId, companyId);
    return permissions.some(perm => checkPermission(perm, userPermissions));
  }

  /**
   * Invalidate cached permissions for a user.
   * Call this after role changes (assign/revoke).
   *
   * @param userId - The user's ID
   * @param companyId - The company context
   */
  invalidateCache(userId: string, companyId: string): void {
    const cacheKey = this.getCacheKey(userId, companyId);
    this.cache.delete(cacheKey);
  }

  /**
   * Invalidate all cached permissions.
   * Useful after bulk role changes or system updates.
   */
  invalidateAllCache(): void {
    this.cache.clear();
  }

  /**
   * Assign a role to a user within a company.
   *
   * @param userId - The user's ID
   * @param roleId - The role's ID
   * @param companyId - The company context
   * @param assignedById - ID of the user making the assignment (optional)
   * @returns Result object with success status and created UserRole
   */
  async assignRole(
    userId: string,
    roleId: string,
    companyId: string,
    assignedById?: string,
  ): Promise<RoleAssignmentResult> {
    // Check if already assigned
    const existing = await this.em.findOne(UserRole, {
      user: userId,
      role: roleId,
      company: companyId,
    });

    if (existing) {
      return {
        success: false,
        error: 'Role is already assigned to this user',
      };
    }

    // Create the assignment
    const userRole = this.em.create(UserRole, {
      user: userId,
      role: roleId,
      company: companyId,
      assignedAt: new Date(),
      ...(assignedById ? { assignedBy: assignedById } : {}),
    });

    await this.em.persistAndFlush(userRole);

    // Invalidate cache for this user
    this.invalidateCache(userId, companyId);

    return { success: true, userRole };
  }

  /**
   * Revoke a role from a user.
   *
   * @param userId - The user's ID
   * @param roleId - The role's ID
   * @param companyId - The company context
   * @returns True if the role was revoked, false if not found
   */
  async revokeRole(
    userId: string,
    roleId: string,
    companyId: string,
  ): Promise<boolean> {
    const userRole = await this.em.findOne(UserRole, {
      user: userId,
      role: roleId,
      company: companyId,
    });

    if (!userRole) {
      return false;
    }

    await this.em.removeAndFlush(userRole);

    // Invalidate cache for this user
    this.invalidateCache(userId, companyId);

    return true;
  }

  /**
   * Revoke all roles from a user in a company.
   *
   * @param userId - The user's ID
   * @param companyId - The company context
   * @returns Number of roles revoked
   */
  async revokeAllRoles(userId: string, companyId: string): Promise<number> {
    const userRoles = await this.em.find(UserRole, {
      user: userId,
      company: companyId,
    });

    if (userRoles.length === 0) {
      return 0;
    }

    await this.em.removeAndFlush(userRoles);

    // Invalidate cache for this user
    this.invalidateCache(userId, companyId);

    return userRoles.length;
  }

  /**
   * Get all roles assigned to a user in a company.
   *
   * @param userId - The user's ID
   * @param companyId - The company context
   * @returns Array of Role entities
   */
  async getUserRoles(userId: string, companyId: string): Promise<Role[]> {
    const userRoles = await this.em.find(
      UserRole,
      {
        user: userId,
        company: companyId,
      },
      { populate: ['role'] },
    );

    return userRoles.map(ur => ur.role);
  }

  /**
   * Get all users who have a specific role in a company.
   *
   * @param roleId - The role's ID
   * @param companyId - The company context
   * @returns Array of UserRole entities with populated user
   */
  async getUsersWithRole(
    roleId: string,
    companyId: string,
  ): Promise<UserRole[]> {
    return this.em.find(
      UserRole,
      {
        role: roleId,
        company: companyId,
      },
      { populate: ['user'] },
    );
  }

  /**
   * Get all available roles for a company.
   * Includes system roles (no company) and company-specific roles.
   *
   * @param companyId - The company context
   * @returns Array of Role entities
   */
  async getAvailableRoles(companyId: string): Promise<Role[]> {
    return this.em.find(Role, {
      $or: [{ company: null }, { company: companyId }],
    });
  }

  /**
   * Get a role by name and company context.
   *
   * @param name - The role name
   * @param companyId - The company context (null for system roles)
   * @returns The Role entity or null
   */
  async getRoleByName(name: string, companyId?: string): Promise<Role | null> {
    // First try to find a company-specific role
    if (companyId) {
      const companyRole = await this.em.findOne(Role, {
        name,
        company: companyId,
      });
      if (companyRole) {
        return companyRole;
      }
    }

    // Fall back to system role
    return this.em.findOne(Role, {
      name,
      company: null,
    });
  }

  /**
   * Assign default roles to a new user.
   * Finds all roles marked as isDefault for the company and assigns them.
   *
   * @param userId - The new user's ID
   * @param companyId - The company context
   * @returns Array of assigned UserRole entities
   */
  async assignDefaultRoles(
    userId: string,
    companyId: string,
  ): Promise<UserRole[]> {
    // Find all default roles (system + company-specific)
    const defaultRoles = await this.em.find(Role, {
      isDefault: true,
      $or: [{ company: null }, { company: companyId }],
    });

    const assignments: UserRole[] = [];

    for (const role of defaultRoles) {
      const userRole = this.em.create(UserRole, {
        user: userId,
        role: role.id,
        company: companyId,
        assignedAt: new Date(),
      });
      this.em.persist(userRole);
      assignments.push(userRole);
    }

    if (assignments.length > 0) {
      await this.em.flush();
      this.invalidateCache(userId, companyId);
    }

    return assignments;
  }

  // ==================================
  // Internal User Methods
  // ==================================

  /**
   * Check if a user is an internal platform user.
   *
   * @param userId - The user's ID
   * @returns True if the user is an internal user
   */
  async isInternalUser(userId: string): Promise<boolean> {
    const user = await this.em.findOne(User, userId);
    return user?.userType === UserType.INTERNAL;
  }

  /**
   * Get the platform role for an internal user.
   * Internal users should have exactly one platform role.
   *
   * @param userId - The internal user's ID
   * @returns The platform Role or null
   */
  async getInternalUserPlatformRole(userId: string): Promise<Role | null> {
    const userRole = await this.em.findOne(
      UserRole,
      {
        user: userId,
        role: { type: RoleType.PLATFORM },
      },
      { populate: ['role'] },
    );

    return userRole?.role ?? null;
  }

  /**
   * Get platform-level permissions for an internal user.
   * These are permissions like platform:view_companies, platform:switch_company.
   *
   * @param userId - The internal user's ID
   * @returns Array of platform permission strings
   */
  async getInternalUserPlatformPermissions(userId: string): Promise<string[]> {
    const platformRole = await this.getInternalUserPlatformRole(userId);
    if (!platformRole) {
      return [];
    }

    // Filter to only platform permissions
    return platformRole.permissions.filter(p => isPlatformPermission(p));
  }

  /**
   * Get permissions for an internal user within a specific company context.
   * The permissions depend on the platform role's companyAccessLevel:
   * - FULL: Returns ['*'] (superUser access)
   * - READ_ONLY: Returns all :read permissions
   * - CUSTOM: Returns the non-platform permissions defined in the role
   *
   * @param userId - The internal user's ID
   * @param companyId - The company context to access
   * @returns Array of permission strings for the company context
   */
  async getInternalUserCompanyPermissions(
    userId: string,
    _companyId: string,
  ): Promise<string[]> {
    const user = await this.em.findOne(User, userId);
    if (!user || user.userType !== UserType.INTERNAL) {
      return [];
    }

    const platformRole = await this.getInternalUserPlatformRole(userId);
    if (!platformRole) {
      return [];
    }

    switch (platformRole.companyAccessLevel) {
      case CompanyAccessLevel.FULL:
        // SuperUser access - can do everything
        return ['*'];

      case CompanyAccessLevel.READ_ONLY:
        // Read-only access - all :read permissions
        return getReadOnlyPermissions();

      case CompanyAccessLevel.CUSTOM:
        // Custom permissions defined in the role (excluding platform: permissions)
        return platformRole.permissions.filter(p => !isPlatformPermission(p));

      default:
        return [];
    }
  }

  /**
   * Check if an internal user has a specific platform permission.
   *
   * @param userId - The internal user's ID
   * @param permission - The platform permission to check
   * @returns True if the user has the permission
   */
  async hasInternalUserPlatformPermission(
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const platformPermissions =
      await this.getInternalUserPlatformPermissions(userId);
    return checkPermission(permission, platformPermissions);
  }

  /**
   * Check if an internal user has a specific permission within a company context.
   *
   * @param userId - The internal user's ID
   * @param permission - The permission to check
   * @param companyId - The company context
   * @returns True if the user has the permission
   */
  async hasInternalUserCompanyPermission(
    userId: string,
    permission: string,
    companyId: string,
  ): Promise<boolean> {
    const companyPermissions = await this.getInternalUserCompanyPermissions(
      userId,
      companyId,
    );
    return checkPermission(permission, companyPermissions);
  }

  /**
   * Universal permission check that works for both company and internal users.
   * For internal users, checks the platform role's companyAccessLevel.
   * For company users, checks their assigned company/system roles.
   *
   * @param userId - The user's ID
   * @param permission - The permission to check
   * @param companyId - The company context
   * @returns True if the user has the permission
   */
  async checkPermission(
    userId: string,
    permission: string,
    companyId: string,
  ): Promise<boolean> {
    const isInternal = await this.isInternalUser(userId);

    if (isInternal) {
      // For platform permissions, check platform role
      if (isPlatformPermission(permission)) {
        return this.hasInternalUserPlatformPermission(userId, permission);
      }
      // For company permissions, check based on companyAccessLevel
      return this.hasInternalUserCompanyPermission(
        userId,
        permission,
        companyId,
      );
    }

    // Regular company user - use existing permission check
    return this.hasPermission(userId, permission, companyId);
  }

  /**
   * Assign a platform role to an internal user.
   * Internal users don't belong to a company, so the UserRole has no company.
   *
   * @param userId - The internal user's ID
   * @param roleId - The platform role's ID
   * @param assignedById - ID of the user making the assignment
   * @returns Result object with success status
   */
  async assignPlatformRole(
    userId: string,
    roleId: string,
    assignedById?: string,
  ): Promise<RoleAssignmentResult> {
    // Verify user is internal
    const user = await this.em.findOne(User, userId);
    if (!user || user.userType !== UserType.INTERNAL) {
      return {
        success: false,
        error: 'User is not an internal user',
      };
    }

    // Verify role is a platform role
    const role = await this.em.findOne(Role, roleId);
    if (!role || role.type !== RoleType.PLATFORM) {
      return {
        success: false,
        error: 'Role is not a platform role',
      };
    }

    // Check if already assigned
    const existing = await this.em.findOne(UserRole, {
      user: userId,
      role: roleId,
    });

    if (existing) {
      return {
        success: false,
        error: 'Role is already assigned to this user',
      };
    }

    // Remove any existing platform role (internal users should have one platform role)
    const existingPlatformRole = await this.em.findOne(UserRole, {
      user: userId,
      role: { type: RoleType.PLATFORM },
    });
    if (existingPlatformRole) {
      await this.em.removeAndFlush(existingPlatformRole);
    }

    // Create the assignment (no company for internal users)
    const userRole = this.em.create(UserRole, {
      user: userId,
      role: roleId,
      assignedAt: new Date(),
      ...(assignedById ? { assignedBy: assignedById } : {}),
    });

    await this.em.persistAndFlush(userRole);

    return { success: true, userRole };
  }

  /**
   * Get all platform roles.
   *
   * @returns Array of platform Role entities
   */
  async getPlatformRoles(): Promise<Role[]> {
    return this.em.find(Role, { type: RoleType.PLATFORM });
  }

  /**
   * Get all available platform permissions.
   * Returns the statically defined platform permissions.
   *
   * @returns Array of platform permission strings
   */
  getAvailablePlatformPermissions(): string[] {
    return getPlatformPermissions();
  }
}
