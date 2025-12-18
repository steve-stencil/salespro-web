import { Router } from 'express';
import { z } from 'zod';

import { User, Office, UserOffice } from '../entities';
import { getORM } from '../lib/db';
import { PERMISSIONS } from '../lib/permissions';
import { requireAuth, requirePermission } from '../middleware';
import { PermissionService } from '../services/PermissionService';

import type { AuthenticatedRequest } from '../middleware/requireAuth';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const updateUserSchema = z.object({
  nameFirst: z.string().min(1).max(100).optional(),
  nameLast: z.string().min(1).max(100).optional(),
});

const activateUserSchema = z.object({
  isActive: z.boolean(),
});

const addOfficeAccessSchema = z.object({
  officeId: z.string().uuid(),
});

const setCurrentOfficeSchema = z.object({
  officeId: z.string().uuid().nullable(),
});

// ============================================================================
// User List and Details Routes
// ============================================================================

/**
 * GET /users
 * List all users in the company with pagination and optional office filter
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_READ),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const {
        page = '1',
        limit = '20',
        officeId,
        search,
        isActive,
      } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10) || 20),
      );
      const offset = (pageNum - 1) * limitNum;

      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      // Build query filters - exclude soft-deleted users
      const where: Record<string, unknown> = {
        company: company.id,
        deletedAt: null,
      };

      // Filter by active status
      if (isActive !== undefined) {
        where['isActive'] = isActive === 'true';
      }

      // Filter by office (users who have access to this office)
      let userIdsWithOfficeAccess: string[] | null = null;
      if (officeId && typeof officeId === 'string') {
        const officeUsers = await em.find(UserOffice, { office: officeId });
        userIdsWithOfficeAccess = officeUsers.map(uo => uo.user.id);
        if (userIdsWithOfficeAccess.length === 0) {
          // No users have access to this office
          res.status(200).json({
            users: [],
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: 0,
              totalPages: 0,
            },
          });
          return;
        }
        where['id'] = { $in: userIdsWithOfficeAccess };
      }

      // Search by email or name
      if (search && typeof search === 'string') {
        const searchTerm = search.toLowerCase();
        where['$or'] = [
          { email: { $ilike: `%${searchTerm}%` } },
          { nameFirst: { $ilike: `%${searchTerm}%` } },
          { nameLast: { $ilike: `%${searchTerm}%` } },
        ];
      }

      // Get total count for pagination
      const total = await em.count(User, where);

      // Fetch users with pagination
      const users = await em.find(User, where, {
        limit: limitNum,
        offset,
        orderBy: { createdAt: 'DESC' },
        populate: ['currentOffice'],
      });

      // Fetch roles for each user
      const usersWithRoles = await Promise.all(
        users.map(async u => {
          const roles = await permissionService.getUserRoles(u.id, company.id);
          return {
            id: u.id,
            email: u.email,
            nameFirst: u.nameFirst,
            nameLast: u.nameLast,
            isActive: u.isActive,
            mfaEnabled: u.mfaEnabled,
            emailVerified: u.emailVerified,
            currentOffice: u.currentOffice
              ? { id: u.currentOffice.id, name: u.currentOffice.name }
              : null,
            roles: roles.map(r => ({
              id: r.id,
              name: r.name,
              displayName: r.displayName,
            })),
            lastLoginDate: u.lastLoginDate,
            createdAt: u.createdAt,
          };
        }),
      );

      res.status(200).json({
        users: usersWithRoles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      req.log.error({ err }, 'List users error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /users/:id
 * Get a specific user by ID with roles and office access
 */
router.get(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_READ),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      // Find user in the same company (exclude soft-deleted)
      const targetUser = await em.findOne(
        User,
        { id, company: company.id, deletedAt: null },
        { populate: ['currentOffice'] },
      );

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Get user's roles
      const roles = await permissionService.getUserRoles(id, company.id);

      // Get user's allowed offices
      const officeAccess = await em.find(
        UserOffice,
        { user: id },
        { populate: ['office'] },
      );

      res.status(200).json({
        user: {
          id: targetUser.id,
          email: targetUser.email,
          nameFirst: targetUser.nameFirst,
          nameLast: targetUser.nameLast,
          isActive: targetUser.isActive,
          mfaEnabled: targetUser.mfaEnabled,
          emailVerified: targetUser.emailVerified,
          needsResetPassword: targetUser.needsResetPassword,
          currentOffice: targetUser.currentOffice
            ? {
                id: targetUser.currentOffice.id,
                name: targetUser.currentOffice.name,
              }
            : null,
          roles: roles.map(r => ({
            id: r.id,
            name: r.name,
            displayName: r.displayName,
          })),
          allowedOffices: officeAccess.map(oa => ({
            id: oa.office.id,
            name: oa.office.name,
            assignedAt: oa.assignedAt,
          })),
          lastLoginDate: targetUser.lastLoginDate,
          createdAt: targetUser.createdAt,
          updatedAt: targetUser.updatedAt,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get user error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /users/:id
 * Update a user's profile
 */
router.patch(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const parseResult = updateUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const targetUser = await em.findOne(User, {
        id,
        company: company.id,
        deletedAt: null,
      });

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const { nameFirst, nameLast } = parseResult.data;
      if (nameFirst !== undefined) targetUser.nameFirst = nameFirst;
      if (nameLast !== undefined) targetUser.nameLast = nameLast;

      await em.flush();

      res.status(200).json({
        message: 'User updated',
        user: {
          id: targetUser.id,
          email: targetUser.email,
          nameFirst: targetUser.nameFirst,
          nameLast: targetUser.nameLast,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update user error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /users/:id/activate
 * Activate or deactivate a user
 */
router.post(
  '/:id/activate',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_ACTIVATE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      // Prevent self-deactivation
      if (id === user.id) {
        res.status(400).json({ error: 'Cannot deactivate your own account' });
        return;
      }

      const parseResult = activateUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const targetUser = await em.findOne(User, {
        id,
        company: company.id,
        deletedAt: null,
      });

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      targetUser.isActive = parseResult.data.isActive;
      await em.flush();

      res.status(200).json({
        message: parseResult.data.isActive
          ? 'User activated'
          : 'User deactivated',
        user: {
          id: targetUser.id,
          isActive: targetUser.isActive,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Activate user error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /users/:id
 * Soft delete a user from the company
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_DELETE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      // Prevent self-deletion
      if (id === user.id) {
        res.status(400).json({ error: 'Cannot delete your own account' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const targetUser = await em.findOne(User, {
        id,
        company: company.id,
        deletedAt: null,
      });

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Soft delete by setting deletedAt timestamp
      targetUser.deletedAt = new Date();
      targetUser.isActive = false;
      await em.flush();

      req.log.info({ userId: id, deletedBy: user.id }, 'Soft deleted user');

      res.status(204).send();
    } catch (err) {
      req.log.error({ err }, 'Delete user error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// Office Access Management Routes
// ============================================================================

/**
 * GET /users/:id/offices
 * Get the list of offices a user has access to
 */
router.get(
  '/:id/offices',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_READ),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      // Verify user belongs to the same company (exclude soft-deleted)
      const targetUser = await em.findOne(User, {
        id,
        company: company.id,
        deletedAt: null,
      });

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Get office access records
      const officeAccess = await em.find(
        UserOffice,
        { user: id },
        { populate: ['office', 'assignedBy'], orderBy: { assignedAt: 'DESC' } },
      );

      res.status(200).json({
        offices: officeAccess.map(oa => ({
          id: oa.office.id,
          name: oa.office.name,
          isActive: oa.office.isActive,
          assignedAt: oa.assignedAt,
          assignedBy: oa.assignedBy
            ? {
                id: oa.assignedBy.id,
                email: oa.assignedBy.email,
                nameFirst: oa.assignedBy.nameFirst,
                nameLast: oa.assignedBy.nameLast,
              }
            : null,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Get user offices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /users/:id/offices
 * Add office access for a user
 */
router.post(
  '/:id/offices',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const parseResult = addOfficeAccessSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { officeId } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      // Verify target user belongs to the same company (exclude soft-deleted)
      const targetUser = await em.findOne(User, {
        id,
        company: company.id,
        deletedAt: null,
      });

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Verify office belongs to the same company
      const office = await em.findOne(Office, {
        id: officeId,
        company: company.id,
      });

      if (!office) {
        res.status(404).json({ error: 'Office not found' });
        return;
      }

      // Check if access already exists
      const existing = await em.findOne(UserOffice, {
        user: id,
        office: officeId,
      });

      if (existing) {
        res
          .status(409)
          .json({ error: 'User already has access to this office' });
        return;
      }

      // Create office access
      const userOffice = new UserOffice();
      userOffice.user = em.getReference(User, id);
      userOffice.office = em.getReference(Office, officeId);
      userOffice.assignedBy = em.getReference(User, user.id);

      await em.persistAndFlush(userOffice);

      res.status(201).json({
        message: 'Office access granted',
        officeAccess: {
          id: userOffice.id,
          officeId: office.id,
          officeName: office.name,
          assignedAt: userOffice.assignedAt,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Add office access error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /users/:id/offices/:officeId
 * Remove office access from a user
 */
router.delete(
  '/:id/offices/:officeId',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id, officeId } = req.params;
      if (!id || !officeId) {
        res.status(400).json({ error: 'User ID and Office ID are required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      // Verify target user belongs to the same company (exclude soft-deleted)
      const targetUser = await em.findOne(
        User,
        { id, company: company.id, deletedAt: null },
        { populate: ['currentOffice'] },
      );

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Find the office access record
      const userOffice = await em.findOne(UserOffice, {
        user: id,
        office: officeId,
      });

      if (!userOffice) {
        res.status(404).json({ error: 'Office access not found' });
        return;
      }

      // If this is the user's current office, clear it
      if (targetUser.currentOffice?.id === officeId) {
        targetUser.currentOffice = undefined;
      }

      await em.removeAndFlush(userOffice);

      res.status(200).json({
        message: 'Office access revoked',
      });
    } catch (err) {
      req.log.error({ err }, 'Remove office access error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /users/:id/current-office
 * Set a user's current office (must be in their allowed offices)
 */
router.patch(
  '/:id/current-office',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const parseResult = setCurrentOfficeSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { officeId } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      // Verify target user belongs to the same company (exclude soft-deleted)
      const targetUser = await em.findOne(User, {
        id,
        company: company.id,
        deletedAt: null,
      });

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Handle clearing current office
      if (officeId === null) {
        targetUser.currentOffice = undefined;
        await em.flush();
        res.status(200).json({
          message: 'Current office cleared',
          user: { id: targetUser.id, currentOffice: null },
        });
        return;
      }

      // Verify user has access to the office
      const officeAccess = await em.findOne(UserOffice, {
        user: id,
        office: officeId,
      });

      if (!officeAccess) {
        res.status(400).json({
          error: 'User does not have access to this office',
        });
        return;
      }

      // Get the office for the response
      const office = await em.findOne(Office, { id: officeId });
      if (!office) {
        res.status(404).json({ error: 'Office not found' });
        return;
      }

      // Set current office
      targetUser.currentOffice = office;
      await em.flush();

      res.status(200).json({
        message: 'Current office updated',
        user: {
          id: targetUser.id,
          currentOffice: { id: office.id, name: office.name },
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Set current office error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
