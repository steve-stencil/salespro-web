/**
 * Platform Roles Management Routes
 *
 * CRUD operations for platform roles that control internal user permissions.
 * All routes require internal user with platform:admin permission.
 */
import { Router } from 'express';
import { z } from 'zod';

import { Role } from '../entities';
import { RoleType } from '../entities/types';
import { getORM } from '../lib/db';
import { PERMISSIONS, isPlatformPermission } from '../lib/permissions';
import {
  requireAuth,
  requireInternalUser,
  requirePermission,
} from '../middleware';
import { PermissionService } from '../services/PermissionService';

import type { Request, Response } from 'express';

const router: Router = Router();

/**
 * UUID v4 validation regex
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Validation schemas
const createPlatformRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be 50 characters or less')
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      'Name must start with a letter and contain only letters, numbers, underscores, and hyphens',
    ),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be 100 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  permissions: z
    .array(z.string())
    .min(1, 'At least one platform permission is required'),
  companyPermissions: z.array(z.string()).default([]),
});

const updatePlatformRoleSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be 100 characters or less')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  permissions: z
    .array(z.string())
    .min(1, 'At least one platform permission is required')
    .optional(),
  companyPermissions: z.array(z.string()).optional(),
});

/**
 * GET /platform/roles
 * List all platform roles with user counts.
 * Requires internal user with platform:admin permission.
 */
router.get(
  '/',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      const platformRoles = await permissionService.getPlatformRoles();

      // Get user count for each role
      const rolesWithCounts = await Promise.all(
        platformRoles.map(async role => {
          const userCount = await em.count('UserRole', { role: role.id });
          return {
            id: role.id,
            name: role.name,
            displayName: role.displayName,
            description: role.description,
            permissions: role.permissions,
            companyPermissions: role.companyPermissions,
            userCount,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
          };
        }),
      );

      res.json({ roles: rolesWithCounts });
    } catch (err) {
      req.log.error({ err }, 'Error listing platform roles');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /platform/roles/:id
 * Get a specific platform role.
 * Requires internal user with platform:admin permission.
 */
router.get(
  '/:id',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid role ID format' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const role = await em.findOne(Role, {
        id,
        type: RoleType.PLATFORM,
      });

      if (!role) {
        res.status(404).json({ error: 'Platform role not found' });
        return;
      }

      // Get user count
      const userCount = await em.count('UserRole', { role: role.id });

      res.json({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
        companyPermissions: role.companyPermissions,
        userCount,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      });
    } catch (err) {
      req.log.error({ err }, 'Error fetching platform role');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /platform/roles
 * Create a new platform role.
 * Requires internal user with platform:admin permission.
 */
router.post(
  '/',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parseResult = createPlatformRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.issues,
        });
        return;
      }

      const {
        name,
        displayName,
        description,
        permissions,
        companyPermissions,
      } = parseResult.data;

      const orm = getORM();
      const em = orm.em.fork();

      // Check if role name already exists
      const existingRole = await em.findOne(Role, {
        name,
        type: RoleType.PLATFORM,
      });

      if (existingRole) {
        res
          .status(409)
          .json({ error: 'A platform role with this name already exists' });
        return;
      }

      // Validate that permissions array contains at least one platform permission
      const hasPlatformPermission = permissions.some(p =>
        isPlatformPermission(p),
      );
      if (!hasPlatformPermission) {
        res.status(400).json({
          error: 'At least one platform permission (platform:*) is required',
        });
        return;
      }

      // Create the role
      const role = em.create(Role, {
        name,
        displayName,
        description,
        type: RoleType.PLATFORM,
        permissions,
        companyPermissions,
        isDefault: false,
      });

      await em.persistAndFlush(role);

      req.log.info(
        { roleId: role.id, roleName: role.name },
        'Created platform role',
      );

      res.status(201).json({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
        companyPermissions: role.companyPermissions,
        userCount: 0,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      });
    } catch (err) {
      req.log.error({ err }, 'Error creating platform role');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /platform/roles/:id
 * Update a platform role.
 * Requires internal user with platform:admin permission.
 */
router.patch(
  '/:id',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid role ID format' });
        return;
      }

      const parseResult = updatePlatformRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.issues,
        });
        return;
      }

      const { displayName, description, permissions, companyPermissions } =
        parseResult.data;

      const orm = getORM();
      const em = orm.em.fork();

      const role = await em.findOne(Role, {
        id,
        type: RoleType.PLATFORM,
      });

      if (!role) {
        res.status(404).json({ error: 'Platform role not found' });
        return;
      }

      // Update fields if provided
      if (displayName !== undefined) {
        role.displayName = displayName;
      }
      if (description !== undefined) {
        role.description = description ?? undefined;
      }
      if (permissions !== undefined) {
        // Validate that permissions array contains at least one platform permission
        const hasPlatformPermission = permissions.some(p =>
          isPlatformPermission(p),
        );
        if (!hasPlatformPermission) {
          res.status(400).json({
            error: 'At least one platform permission (platform:*) is required',
          });
          return;
        }
        role.permissions = permissions;
      }
      if (companyPermissions !== undefined) {
        role.companyPermissions = companyPermissions;
      }

      await em.flush();

      // Get user count
      const userCount = await em.count('UserRole', { role: role.id });

      req.log.info(
        { roleId: role.id, roleName: role.name },
        'Updated platform role',
      );

      res.json({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
        companyPermissions: role.companyPermissions,
        userCount,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      });
    } catch (err) {
      req.log.error({ err }, 'Error updating platform role');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /platform/roles/:id
 * Delete a platform role.
 * Requires internal user with platform:admin permission.
 * Cannot delete a role that has users assigned.
 */
router.delete(
  '/:id',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid role ID format' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const role = await em.findOne(Role, {
        id,
        type: RoleType.PLATFORM,
      });

      if (!role) {
        res.status(404).json({ error: 'Platform role not found' });
        return;
      }

      // Check if role has any users assigned
      const userCount = await em.count('UserRole', { role: role.id });
      if (userCount > 0) {
        res.status(400).json({
          error: `Cannot delete role: ${userCount} user(s) are assigned to this role. Reassign them first.`,
        });
        return;
      }

      const roleName = role.name;
      await em.removeAndFlush(role);

      req.log.info({ roleId: id, roleName }, 'Deleted platform role');

      res.status(204).send();
    } catch (err) {
      req.log.error({ err }, 'Error deleting platform role');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
