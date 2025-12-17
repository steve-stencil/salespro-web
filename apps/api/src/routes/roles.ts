import { Router } from 'express';
import { z } from 'zod';

import { Role, RoleType, User, Company, UserRole } from '../entities';
import { getORM } from '../lib/db';
import {
  PERMISSIONS,
  getAllPermissions,
  getPermissionsByCategory,
  PERMISSION_META,
  isValidPermission,
} from '../lib/permissions';
import { requireAuth, requirePermission } from '../middleware';
import { PermissionService } from '../services/PermissionService';

import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * Request type with authenticated user
 */
type AuthenticatedRequest = Request & {
  user?: User & { company?: Company };
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that all permission strings are valid.
 * Returns invalid permissions if any are found.
 */
function validatePermissions(permissions: string[]): string[] {
  const allValidPermissions = getAllPermissions();
  const invalid: string[] = [];

  for (const permission of permissions) {
    // Allow wildcards
    if (permission === '*') continue;
    if (permission.endsWith(':*')) {
      const resource = permission.slice(0, -2);
      const hasResourcePermissions = allValidPermissions.some(p =>
        p.startsWith(resource + ':'),
      );
      if (!hasResourcePermissions) {
        invalid.push(permission);
      }
      continue;
    }
    // Check exact permission
    if (!isValidPermission(permission)) {
      invalid.push(permission);
    }
  }

  return invalid;
}

/**
 * Role name format validation regex.
 * Must start with a letter and contain only letters, numbers, hyphens, and underscores.
 */
const ROLE_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

// ============================================================================
// Validation Schemas
// ============================================================================

const createRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .regex(
      ROLE_NAME_REGEX,
      'Name must start with a letter and contain only letters, numbers, hyphens, and underscores',
    ),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(255, 'Display name must be 255 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission is required'),
  isDefault: z.boolean().optional(),
});

const updateRoleSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(255, 'Display name must be 255 characters or less')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission is required')
    .optional(),
  isDefault: z.boolean().optional(),
});

const assignRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  roleId: z.string().uuid('Invalid role ID format'),
});

const revokeRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  roleId: z.string().uuid('Invalid role ID format'),
});

const cloneRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .regex(
      ROLE_NAME_REGEX,
      'Name must start with a letter and contain only letters, numbers, hyphens, and underscores',
    ),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(255, 'Display name must be 255 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
});

// ============================================================================
// Permission Info Routes (Public for authenticated users)
// ============================================================================

/**
 * GET /roles/permissions
 * Get all available permissions with metadata
 */
router.get('/permissions', requireAuth(), (_req: Request, res: Response) => {
  const permissions = getAllPermissions();
  const byCategory = getPermissionsByCategory();

  res.status(200).json({
    permissions: permissions.map(p => ({
      name: p,
      ...PERMISSION_META[p],
    })),
    byCategory,
  });
});

// ============================================================================
// Role Management Routes (Require role:read permission)
// ============================================================================

/**
 * GET /roles
 * Get all roles available to the company with user counts
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      const roles = await permissionService.getAvailableRoles(user.company.id);

      // Get user counts for each role
      const roleCounts = await Promise.all(
        roles.map(async r => {
          const count = await em.count(UserRole, {
            role: r.id,
            company: user.company!.id,
          });
          return { roleId: r.id, count };
        }),
      );

      const countMap = new Map(roleCounts.map(rc => [rc.roleId, rc.count]));

      res.status(200).json({
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          displayName: r.displayName,
          description: r.description,
          type: r.type,
          permissions: r.permissions,
          isDefault: r.isDefault,
          isSystemRole: r.isSystemRole,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          userCount: countMap.get(r.id) ?? 0,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Get roles error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /roles/me
 * Get current user's roles and permissions
 * NOTE: This route MUST be defined BEFORE /:id routes to avoid "me" being parsed as an ID
 */
router.get('/me', requireAuth(), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user?.company) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const orm = getORM();
    const em = orm.em.fork();
    const permissionService = new PermissionService(em);

    const roles = await permissionService.getUserRoles(
      user.id,
      user.company.id,
    );
    const permissions = await permissionService.getUserPermissions(
      user.id,
      user.company.id,
    );

    res.status(200).json({
      roles: roles.map(r => ({
        id: r.id,
        name: r.name,
        displayName: r.displayName,
        type: r.type,
      })),
      permissions,
    });
  } catch (err) {
    req.log.error({ err }, 'Get my roles error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /roles/:id
 * Get a specific role by ID with user count
 */
router.get(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Role ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const role = await em.findOne(Role, {
        id,
        $or: [{ company: null }, { company: user.company.id }],
      });

      if (!role) {
        res.status(404).json({ error: 'Role not found' });
        return;
      }

      // Get user count for this role
      const userCount = await em.count(UserRole, {
        role: role.id,
        company: user.company.id,
      });

      res.status(200).json({
        role: {
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          type: role.type,
          permissions: role.permissions,
          isDefault: role.isDefault,
          isSystemRole: role.isSystemRole,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
          userCount,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get role error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /roles/:id/users
 * Get users who have a specific role assigned
 */
router.get(
  '/:id/users',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Role ID is required' });
        return;
      }

      // Pagination params
      const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query['limit'] as string) || 25),
      );
      const offset = (page - 1) * limit;

      const orm = getORM();
      const em = orm.em.fork();

      // Verify role exists and is accessible
      const role = await em.findOne(Role, {
        id,
        $or: [{ company: null }, { company: user.company.id }],
      });

      if (!role) {
        res.status(404).json({ error: 'Role not found' });
        return;
      }

      // Get users with this role
      const [userRoles, total] = await em.findAndCount(
        UserRole,
        {
          role: role.id,
          company: user.company.id,
        },
        {
          populate: ['user'],
          limit,
          offset,
          orderBy: { assignedAt: 'DESC' },
        },
      );

      res.status(200).json({
        users: userRoles.map(ur => ({
          id: ur.user.id,
          email: ur.user.email,
          nameFirst: ur.user.nameFirst,
          nameLast: ur.user.nameLast,
          isActive: ur.user.isActive,
          assignedAt: ur.assignedAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get role users error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /roles
 * Create a new company role
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_CREATE),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = createRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const { name, displayName, description, permissions, isDefault } =
        parseResult.data;

      // Validate permission strings
      const invalidPermissions = validatePermissions(permissions);
      if (invalidPermissions.length > 0) {
        res.status(400).json({
          error: 'Invalid permissions',
          invalidPermissions,
          message: `The following permissions are not valid: ${invalidPermissions.join(', ')}`,
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      // Check if role name already exists for this company
      const existing = await em.findOne(Role, {
        name,
        company: user.company.id,
      });

      if (existing) {
        res.status(409).json({
          error: 'Role name already exists',
          message: `A role with the name "${name}" already exists in your company.`,
        });
        return;
      }

      // Also check if name conflicts with a system role
      const systemRole = await em.findOne(Role, {
        name,
        company: null,
        type: RoleType.SYSTEM,
      });

      if (systemRole) {
        res.status(409).json({
          error: 'Role name conflicts with system role',
          message: `The name "${name}" is reserved for a system role.`,
        });
        return;
      }

      // Create the role
      const role = new Role();
      role.name = name;
      role.displayName = displayName;
      if (description) role.description = description;
      role.permissions = permissions;
      role.isDefault = isDefault ?? false;
      role.type = RoleType.COMPANY;
      role.company = em.getReference(Company, user.company.id);

      await em.persistAndFlush(role);

      req.log.info(
        { roleId: role.id, roleName: role.name, userId: user.id },
        'Role created',
      );

      res.status(201).json({
        message: 'Role created successfully',
        role: {
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          type: role.type,
          permissions: role.permissions,
          isDefault: role.isDefault,
          createdAt: role.createdAt,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create role error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /roles/:id/clone
 * Clone an existing role (creates a new company role with same permissions)
 */
router.post(
  '/:id/clone',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_CREATE),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Role ID is required' });
        return;
      }

      const parseResult = cloneRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const { name, displayName, description } = parseResult.data;

      const orm = getORM();
      const em = orm.em.fork();

      // Find the source role
      const sourceRole = await em.findOne(Role, {
        id,
        $or: [{ company: null }, { company: user.company.id }],
      });

      if (!sourceRole) {
        res.status(404).json({ error: 'Source role not found' });
        return;
      }

      // Check if new role name already exists
      const existing = await em.findOne(Role, {
        name,
        company: user.company.id,
      });

      if (existing) {
        res.status(409).json({
          error: 'Role name already exists',
          message: `A role with the name "${name}" already exists in your company.`,
        });
        return;
      }

      // Create the cloned role
      const newRole = new Role();
      newRole.name = name;
      newRole.displayName = displayName;
      const finalDescription = description ?? sourceRole.description;
      if (finalDescription) {
        newRole.description = finalDescription;
      }
      newRole.permissions = [...sourceRole.permissions]; // Copy permissions
      newRole.isDefault = false; // Cloned roles are not default
      newRole.type = RoleType.COMPANY;
      newRole.company = em.getReference(Company, user.company.id);

      await em.persistAndFlush(newRole);

      req.log.info(
        {
          newRoleId: newRole.id,
          sourceRoleId: sourceRole.id,
          userId: user.id,
        },
        'Role cloned',
      );

      res.status(201).json({
        message: 'Role cloned successfully',
        role: {
          id: newRole.id,
          name: newRole.name,
          displayName: newRole.displayName,
          description: newRole.description,
          type: newRole.type,
          permissions: newRole.permissions,
          isDefault: newRole.isDefault,
          createdAt: newRole.createdAt,
        },
        clonedFrom: {
          id: sourceRole.id,
          name: sourceRole.name,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Clone role error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /roles/:id
 * Update a company role (cannot update system roles)
 */
router.patch(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Role ID is required' });
        return;
      }

      const parseResult = updateRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const displayName = parseResult.data['displayName'];
      const description = parseResult.data['description'];
      const permissions = parseResult.data['permissions'];
      const isDefault = parseResult.data['isDefault'];

      // Validate permissions if provided
      if (permissions) {
        const invalidPermissions = validatePermissions(permissions);
        if (invalidPermissions.length > 0) {
          res.status(400).json({
            error: 'Invalid permissions',
            invalidPermissions,
            message: `The following permissions are not valid: ${invalidPermissions.join(', ')}`,
          });
          return;
        }
      }

      const orm = getORM();
      const em = orm.em.fork();

      const role = await em.findOne(Role, {
        id,
        company: user.company.id,
      });

      if (!role) {
        res.status(404).json({ error: 'Role not found or cannot be modified' });
        return;
      }

      // Cannot modify system roles
      if ((role.type as RoleType) === RoleType.SYSTEM) {
        res.status(403).json({
          error: 'Cannot modify system roles',
          message: 'System roles are protected and cannot be modified.',
        });
        return;
      }

      // Track changes for logging
      const changes: Record<string, { from: unknown; to: unknown }> = {};

      if (displayName !== undefined && displayName !== role.displayName) {
        changes['displayName'] = { from: role.displayName, to: displayName };
        role.displayName = displayName;
      }
      if (description !== undefined && description !== role.description) {
        changes['description'] = { from: role.description, to: description };
        role.description = description;
      }
      if (permissions !== undefined) {
        changes['permissions'] = { from: role.permissions, to: permissions };
        role.permissions = permissions;
      }
      if (isDefault !== undefined && isDefault !== role.isDefault) {
        changes['isDefault'] = { from: role.isDefault, to: isDefault };
        role.isDefault = isDefault;
      }

      await em.flush();

      req.log.info(
        { roleId: role.id, changes, userId: user.id },
        'Role updated',
      );

      res.status(200).json({
        message: 'Role updated successfully',
        role: {
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          type: role.type,
          permissions: role.permissions,
          isDefault: role.isDefault,
          updatedAt: role.updatedAt,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update role error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /roles/:id
 * Delete a company role (cannot delete system roles)
 * Query params:
 *   - force: if true, delete even if users are assigned (they will lose the role)
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_DELETE),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Role ID is required' });
        return;
      }

      const force = req.query['force'] === 'true';

      const orm = getORM();
      const em = orm.em.fork();

      const role = await em.findOne(Role, {
        id,
        company: user.company.id,
      });

      if (!role) {
        res.status(404).json({ error: 'Role not found or cannot be deleted' });
        return;
      }

      // Cannot delete system roles
      if ((role.type as RoleType) === RoleType.SYSTEM) {
        res.status(403).json({
          error: 'Cannot delete system roles',
          message: 'System roles are protected and cannot be deleted.',
        });
        return;
      }

      // Check for assigned users
      const assignedCount = await em.count(UserRole, {
        role: role.id,
        company: user.company.id,
      });

      if (assignedCount > 0 && !force) {
        res.status(409).json({
          error: 'Role has assigned users',
          userCount: assignedCount,
          message: `This role is currently assigned to ${assignedCount} user${assignedCount === 1 ? '' : 's'}. Use ?force=true to delete anyway, or reassign users first.`,
        });
        return;
      }

      // If force delete, remove all assignments first
      if (assignedCount > 0 && force) {
        await em.nativeDelete(UserRole, {
          role: role.id,
          company: user.company.id,
        });
        req.log.info(
          {
            roleId: role.id,
            removedAssignments: assignedCount,
            userId: user.id,
          },
          'Force deleted role assignments',
        );
      }

      await em.removeAndFlush(role);

      req.log.info(
        {
          roleId: role.id,
          roleName: role.name,
          force,
          assignedCount,
          userId: user.id,
        },
        'Role deleted',
      );

      res.status(200).json({
        message: 'Role deleted successfully',
        removedAssignments: assignedCount,
      });
    } catch (err) {
      req.log.error({ err }, 'Delete role error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// Role Assignment Routes (Require role:assign permission)
// ============================================================================

/**
 * GET /roles/users/:userId
 * Get roles assigned to a specific user
 */
router.get(
  '/users/:userId',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { userId } = req.params;
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      const roles = await permissionService.getUserRoles(
        userId,
        user.company.id,
      );
      const permissions = await permissionService.getUserPermissions(
        userId,
        user.company.id,
      );

      res.status(200).json({
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          displayName: r.displayName,
          type: r.type,
          permissions: r.permissions,
        })),
        effectivePermissions: permissions,
      });
    } catch (err) {
      req.log.error({ err }, 'Get user roles error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /roles/assign
 * Assign a role to a user
 */
router.post(
  '/assign',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_ASSIGN),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = assignRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const { userId, roleId } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      // Verify the role is available to this company
      const role = await em.findOne(Role, {
        id: roleId,
        $or: [{ company: null }, { company: user.company.id }],
      });

      if (!role) {
        res.status(404).json({ error: 'Role not found' });
        return;
      }

      // Verify the target user belongs to the same company
      const targetUser = await em.findOne(User, {
        id: userId,
        company: user.company.id,
      });

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const result = await permissionService.assignRole(
        userId,
        roleId,
        user.company.id,
        user.id,
      );

      if (!result.success) {
        res.status(409).json({ error: result.error });
        return;
      }

      req.log.info(
        { targetUserId: userId, roleId, assignedBy: user.id },
        'Role assigned',
      );

      res.status(200).json({
        message: 'Role assigned successfully',
        assignment: {
          userId,
          roleId,
          roleName: role.name,
          roleDisplayName: role.displayName,
          assignedAt: result.userRole?.assignedAt,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Assign role error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /roles/revoke
 * Revoke a role from a user
 */
router.post(
  '/revoke',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_ASSIGN),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = revokeRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const { userId, roleId } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      const success = await permissionService.revokeRole(
        userId,
        roleId,
        user.company.id,
      );

      if (!success) {
        res.status(404).json({ error: 'Role assignment not found' });
        return;
      }

      req.log.info(
        { targetUserId: userId, roleId, revokedBy: user.id },
        'Role revoked',
      );

      res.status(200).json({ message: 'Role revoked successfully' });
    } catch (err) {
      req.log.error({ err }, 'Revoke role error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /roles/assign/bulk
 * Assign multiple roles to a user or a role to multiple users
 */
router.post(
  '/assign/bulk',
  requireAuth(),
  requirePermission(PERMISSIONS.ROLE_ASSIGN),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const bulkAssignSchema = z.object({
        assignments: z
          .array(assignRoleSchema)
          .min(1, 'At least one assignment is required'),
      });

      const parseResult = bulkAssignSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const { assignments } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      const results: Array<{
        userId: string;
        roleId: string;
        success: boolean;
        error?: string;
      }> = [];

      const companyId = user.company.id;

      for (const { userId, roleId } of assignments) {
        // Verify role and user
        const role = await em.findOne(Role, {
          id: roleId,
          $or: [{ company: null }, { company: companyId }],
        });

        if (!role) {
          results.push({
            userId,
            roleId,
            success: false,
            error: 'Role not found',
          });
          continue;
        }

        const targetUser = await em.findOne(User, {
          id: userId,
          company: companyId,
        });

        if (!targetUser) {
          results.push({
            userId,
            roleId,
            success: false,
            error: 'User not found',
          });
          continue;
        }

        const result = await permissionService.assignRole(
          userId,
          roleId,
          companyId,
          user.id,
        );

        if (result.error) {
          results.push({
            userId,
            roleId,
            success: result.success,
            error: result.error,
          });
        } else {
          results.push({
            userId,
            roleId,
            success: result.success,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      req.log.info(
        { successCount, failureCount, assignedBy: user.id },
        'Bulk role assignment completed',
      );

      res.status(200).json({
        message: `Bulk assignment completed: ${successCount} succeeded, ${failureCount} failed`,
        results,
      });
    } catch (err) {
      req.log.error({ err }, 'Bulk assign role error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
