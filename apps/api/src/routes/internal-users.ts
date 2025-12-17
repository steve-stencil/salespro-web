import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';

import { User, Role, UserRole } from '../entities';
import { UserType, RoleType } from '../entities/types';
import { getORM } from '../lib/db';
import { PERMISSIONS } from '../lib/permissions';
import {
  requireAuth,
  requireInternalUser,
  requirePermission,
} from '../middleware';
import { PermissionService } from '../services/PermissionService';

import type { Request, Response } from 'express';

const router: Router = Router();

/** Password hash salt rounds */
const SALT_ROUNDS = 12;

// Validation schemas
const createInternalUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  nameFirst: z.string().optional(),
  nameLast: z.string().optional(),
  platformRoleId: z.string().uuid('Invalid role ID format'),
});

const updateInternalUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  nameFirst: z.string().optional(),
  nameLast: z.string().optional(),
  isActive: z.boolean().optional(),
  platformRoleId: z.string().uuid('Invalid role ID format').optional(),
});

/**
 * UUID v4 validation regex
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /internal-users
 * List all internal platform users.
 * Requires internal user with platform:manage_internal_users permission.
 */
router.get(
  '/',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orm = getORM();
      const em = orm.em.fork();

      const internalUsers = await em.find(
        User,
        { userType: UserType.INTERNAL },
        {
          orderBy: { email: 'asc' },
          fields: [
            'id',
            'email',
            'nameFirst',
            'nameLast',
            'isActive',
            'createdAt',
            'lastLoginDate',
          ],
        },
      );

      // Get platform roles for each user
      const usersWithRoles = await Promise.all(
        internalUsers.map(async user => {
          const userRole = await em.findOne(
            UserRole,
            {
              user: user.id,
              role: { type: RoleType.PLATFORM },
            },
            { populate: ['role'] },
          );

          return {
            id: user.id,
            email: user.email,
            nameFirst: user.nameFirst,
            nameLast: user.nameLast,
            isActive: user.isActive,
            createdAt: user.createdAt,
            lastLoginDate: user.lastLoginDate,
            platformRole: userRole?.role
              ? {
                  id: userRole.role.id,
                  name: userRole.role.name,
                  displayName: userRole.role.displayName,
                }
              : null,
          };
        }),
      );

      res.json({
        users: usersWithRoles,
        total: usersWithRoles.length,
      });
    } catch (err) {
      req.log.error({ err }, 'Error listing internal users');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /internal-users/roles
 * List all available platform roles.
 * Requires internal user with platform:manage_internal_users permission.
 */
router.get(
  '/roles',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      const platformRoles = await permissionService.getPlatformRoles();

      res.json({
        roles: platformRoles.map(role => ({
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          companyAccessLevel: role.companyAccessLevel,
          permissions: role.permissions,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Error listing platform roles');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /internal-users/:id
 * Get details of a specific internal user.
 * Requires internal user with platform:manage_internal_users permission.
 */
router.get(
  '/:id',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid user ID format' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, {
        id,
        userType: UserType.INTERNAL,
      });

      if (!user) {
        res.status(404).json({ error: 'Internal user not found' });
        return;
      }

      // Get platform role
      const userRole = await em.findOne(
        UserRole,
        {
          user: user.id,
          role: { type: RoleType.PLATFORM },
        },
        { populate: ['role'] },
      );

      res.json({
        id: user.id,
        email: user.email,
        nameFirst: user.nameFirst,
        nameLast: user.nameLast,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginDate: user.lastLoginDate,
        platformRole: userRole?.role
          ? {
              id: userRole.role.id,
              name: userRole.role.name,
              displayName: userRole.role.displayName,
              companyAccessLevel: userRole.role.companyAccessLevel,
              permissions: userRole.role.permissions,
            }
          : null,
      });
    } catch (err) {
      req.log.error({ err }, 'Error fetching internal user');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /internal-users
 * Create a new internal platform user.
 * Requires internal user with platform:manage_internal_users permission.
 */
router.post(
  '/',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parseResult = createInternalUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.issues,
        });
        return;
      }

      const { email, password, nameFirst, nameLast, platformRoleId } =
        parseResult.data;

      const orm = getORM();
      const em = orm.em.fork();

      // Check if email already exists
      const existingUser = await em.findOne(User, {
        email: email.toLowerCase(),
      });
      if (existingUser) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }

      // Verify platform role exists
      const role = await em.findOne(Role, {
        id: platformRoleId,
        type: RoleType.PLATFORM,
      });

      if (!role) {
        res.status(400).json({ error: 'Invalid platform role' });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const user = em.create(User, {
        email: email.toLowerCase(),
        passwordHash,
        nameFirst,
        nameLast,
        userType: UserType.INTERNAL,
        isActive: true,
        emailVerified: true, // Internal users don't need email verification
        mfaEnabled: false,
        needsResetPassword: false,
        maxSessions: 5,
        failedLoginAttempts: 0,
      });

      em.persist(user);

      // Assign platform role
      const userRole = em.create(UserRole, {
        user,
        role,
        assignedAt: new Date(),
      });

      em.persist(userRole);

      await em.flush();

      req.log.info(
        { userId: user.id, email: user.email },
        'Created internal user',
      );

      res.status(201).json({
        id: user.id,
        email: user.email,
        nameFirst: user.nameFirst,
        nameLast: user.nameLast,
        isActive: user.isActive,
        platformRole: {
          id: role.id,
          name: role.name,
          displayName: role.displayName,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Error creating internal user');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /internal-users/:id
 * Update an internal platform user.
 * Requires internal user with platform:manage_internal_users permission.
 */
router.patch(
  '/:id',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid user ID format' });
        return;
      }

      const parseResult = updateInternalUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.issues,
        });
        return;
      }

      const { email, nameFirst, nameLast, isActive, platformRoleId } =
        parseResult.data;

      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, {
        id,
        userType: UserType.INTERNAL,
      });

      if (!user) {
        res.status(404).json({ error: 'Internal user not found' });
        return;
      }

      // Check email uniqueness if changing
      if (email && email.toLowerCase() !== user.email) {
        const existingUser = await em.findOne(User, {
          email: email.toLowerCase(),
        });
        if (existingUser) {
          res.status(409).json({ error: 'Email already in use' });
          return;
        }
        user.email = email.toLowerCase();
      }

      // Update fields
      if (nameFirst !== undefined) user.nameFirst = nameFirst;
      if (nameLast !== undefined) user.nameLast = nameLast;
      if (isActive !== undefined) user.isActive = isActive;

      // Update platform role if provided
      if (platformRoleId) {
        const newRole = await em.findOne(Role, {
          id: platformRoleId,
          type: RoleType.PLATFORM,
        });

        if (!newRole) {
          res.status(400).json({ error: 'Invalid platform role' });
          return;
        }

        const permissionService = new PermissionService(em);
        await permissionService.assignPlatformRole(user.id, newRole.id);
      }

      await em.flush();

      // Get updated platform role
      const userRole = await em.findOne(
        UserRole,
        {
          user: user.id,
          role: { type: RoleType.PLATFORM },
        },
        { populate: ['role'] },
      );

      req.log.info({ userId: user.id }, 'Updated internal user');

      res.json({
        id: user.id,
        email: user.email,
        nameFirst: user.nameFirst,
        nameLast: user.nameLast,
        isActive: user.isActive,
        platformRole: userRole?.role
          ? {
              id: userRole.role.id,
              name: userRole.role.name,
              displayName: userRole.role.displayName,
            }
          : null,
      });
    } catch (err) {
      req.log.error({ err }, 'Error updating internal user');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /internal-users/:id
 * Delete an internal platform user.
 * Requires internal user with platform:manage_internal_users permission.
 */
router.delete(
  '/:id',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid user ID format' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, {
        id,
        userType: UserType.INTERNAL,
      });

      if (!user) {
        res.status(404).json({ error: 'Internal user not found' });
        return;
      }

      // Remove associated UserRole entries first
      const userRoles = await em.find(UserRole, { user: user.id });
      for (const ur of userRoles) {
        em.remove(ur);
      }

      em.remove(user);
      await em.flush();

      req.log.info({ userId: id }, 'Deleted internal user');

      res.status(204).send();
    } catch (err) {
      req.log.error({ err }, 'Error deleting internal user');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
