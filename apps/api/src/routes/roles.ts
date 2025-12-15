import { Router } from 'express';
import { z } from 'zod';

import { Role, RoleType, User, Company } from '../entities';
import { getORM } from '../lib/db';
import {
  PERMISSIONS,
  getAllPermissions,
  getPermissionsByCategory,
  PERMISSION_META,
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
// Validation Schemas
// ============================================================================

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).min(1),
  isDefault: z.boolean().optional(),
});

const updateRoleSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).min(1).optional(),
  isDefault: z.boolean().optional(),
});

const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

const revokeRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
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
 * Get all roles available to the company
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
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Get roles error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /roles/:id
 * Get a specific role by ID
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
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get role error');
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
          details: parseResult.error.issues,
        });
        return;
      }

      const { name, displayName, description, permissions, isDefault } =
        parseResult.data;

      const orm = getORM();
      const em = orm.em.fork();

      // Check if role name already exists for this company
      const existing = await em.findOne(Role, {
        name,
        company: user.company.id,
      });

      if (existing) {
        res.status(409).json({ error: 'Role name already exists' });
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

      res.status(201).json({
        message: 'Role created',
        role: {
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          type: role.type,
          permissions: role.permissions,
          isDefault: role.isDefault,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create role error');
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
          details: parseResult.error.issues,
        });
        return;
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
      if (role.type === RoleType.SYSTEM) {
        res.status(403).json({ error: 'Cannot modify system roles' });
        return;
      }

      const { displayName, description, permissions, isDefault } =
        parseResult.data;

      if (displayName !== undefined) role.displayName = displayName;
      if (description !== undefined) role.description = description;
      if (permissions !== undefined) role.permissions = permissions;
      if (isDefault !== undefined) role.isDefault = isDefault;

      await em.flush();

      res.status(200).json({
        message: 'Role updated',
        role: {
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          type: role.type,
          permissions: role.permissions,
          isDefault: role.isDefault,
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
      if (role.type === RoleType.SYSTEM) {
        res.status(403).json({ error: 'Cannot delete system roles' });
        return;
      }

      await em.removeAndFlush(role);

      res.status(200).json({ message: 'Role deleted' });
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
 * GET /roles/me
 * Get current user's roles and permissions
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
          details: parseResult.error.issues,
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

      res.status(200).json({
        message: 'Role assigned',
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
          details: parseResult.error.issues,
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

      res.status(200).json({ message: 'Role revoked' });
    } catch (err) {
      req.log.error({ err }, 'Revoke role error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
