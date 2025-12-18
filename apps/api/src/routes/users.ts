import { Router } from 'express';
import { z } from 'zod';

import {
  User,
  Office,
  UserOffice,
  UserCompany,
  InternalUserCompany,
  UserType,
  Session,
} from '../entities';
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

const switchCompanySchema = z.object({
  companyId: z.string().uuid(),
});

const pinCompanySchema = z.object({
  isPinned: z.boolean(),
});

// ============================================================================
// Current User Company Access Routes (/users/me/*)
// ============================================================================

/**
 * GET /users/me/companies
 * List companies the current user has access to (paginated, searchable)
 * Returns recent, pinned, and all companies sections for scalable UI
 */
router.get(
  '/me/companies',
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { search, limit = '20', offset = '0' } = req.query;
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10) || 20),
      );
      const offsetNum = Math.max(0, parseInt(offset as string, 10) || 0);

      const orm = getORM();
      const em = orm.em.fork();
      const userType = user.userType as UserType;

      if (userType === UserType.COMPANY) {
        // For company users, fetch from UserCompany
        const baseWhere: Record<string, unknown> = {
          user: user.id,
          isActive: true,
        };

        // Build search filter
        const searchWhere =
          search && typeof search === 'string'
            ? { ...baseWhere, company: { name: { $ilike: `%${search}%` } } }
            : baseWhere;

        // Get recent companies (last 5 accessed)
        const recentCompanies = await em.find(
          UserCompany,
          { user: user.id, isActive: true, lastAccessedAt: { $ne: null } },
          {
            orderBy: { lastAccessedAt: 'DESC' },
            limit: 5,
            populate: ['company'],
          },
        );

        // Get pinned companies
        const pinnedCompanies = await em.find(
          UserCompany,
          { user: user.id, isActive: true, isPinned: true },
          { populate: ['company'] },
        );

        // Get total count for pagination
        const total = await em.count(UserCompany, searchWhere);

        // Get paginated results
        const results = await em.find(UserCompany, searchWhere, {
          limit: limitNum,
          offset: offsetNum,
          orderBy: { company: { name: 'ASC' } },
          populate: ['company'],
        });

        res.status(200).json({
          recent: recentCompanies.map(uc => ({
            id: uc.company.id,
            name: uc.company.name,
            lastAccessedAt: uc.lastAccessedAt,
            isPinned: uc.isPinned,
          })),
          pinned: pinnedCompanies.map(uc => ({
            id: uc.company.id,
            name: uc.company.name,
            isPinned: true,
          })),
          results: results.map(uc => ({
            id: uc.company.id,
            name: uc.company.name,
            isActive: uc.isActive,
            isPinned: uc.isPinned,
            lastAccessedAt: uc.lastAccessedAt,
          })),
          total,
          hasMore: offsetNum + results.length < total,
        });
      } else {
        // For internal users, check if they have restricted access
        const restrictedCount = await em.count(InternalUserCompany, {
          user: user.id,
        });

        if (restrictedCount > 0) {
          // Internal user with restricted access - fetch from InternalUserCompany
          const baseWhere: Record<string, unknown> = { user: user.id };

          const searchWhere =
            search && typeof search === 'string'
              ? { ...baseWhere, company: { name: { $ilike: `%${search}%` } } }
              : baseWhere;

          // Get recent companies
          const recentCompanies = await em.find(
            InternalUserCompany,
            { user: user.id, lastAccessedAt: { $ne: null } },
            {
              orderBy: { lastAccessedAt: 'DESC' },
              limit: 5,
              populate: ['company'],
            },
          );

          // Get pinned companies
          const pinnedCompanies = await em.find(
            InternalUserCompany,
            { user: user.id, isPinned: true },
            { populate: ['company'] },
          );

          // Get total and results
          const total = await em.count(InternalUserCompany, searchWhere);
          const results = await em.find(InternalUserCompany, searchWhere, {
            limit: limitNum,
            offset: offsetNum,
            orderBy: { company: { name: 'ASC' } },
            populate: ['company'],
          });

          res.status(200).json({
            recent: recentCompanies.map(iuc => ({
              id: iuc.company.id,
              name: iuc.company.name,
              lastAccessedAt: iuc.lastAccessedAt,
              isPinned: iuc.isPinned,
            })),
            pinned: pinnedCompanies.map(iuc => ({
              id: iuc.company.id,
              name: iuc.company.name,
              isPinned: true,
            })),
            results: results.map(iuc => ({
              id: iuc.company.id,
              name: iuc.company.name,
              isActive: true,
              isPinned: iuc.isPinned,
              lastAccessedAt: iuc.lastAccessedAt,
            })),
            total,
            hasMore: offsetNum + results.length < total,
          });
        } else {
          // Internal user with full access - fetch from Company table
          const { Company: CompanyEntity } = await import('../entities');

          const searchWhere: Record<string, unknown> = { isActive: true };
          if (search && typeof search === 'string') {
            searchWhere['name'] = { $ilike: `%${search}%` };
          }

          const total = await em.count(CompanyEntity, searchWhere);
          const results = await em.find(CompanyEntity, searchWhere, {
            limit: limitNum,
            offset: offsetNum,
            orderBy: { name: 'ASC' },
          });

          res.status(200).json({
            recent: [], // No tracking for unrestricted internal users
            pinned: [],
            results: results.map(c => ({
              id: c.id,
              name: c.name,
              isActive: true,
              isPinned: false,
              lastAccessedAt: null,
            })),
            total,
            hasMore: offsetNum + results.length < total,
          });
        }
      }
    } catch (err) {
      req.log.error({ err }, 'List user companies error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /users/me/active-company
 * Get the current user's active company from their session
 */
router.get(
  '/me/active-company',
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      // Get session ID from cookie
      const rawCookie = (req.cookies as Record<string, string | undefined>)[
        'sid'
      ];
      if (!rawCookie) {
        res.status(200).json({ activeCompany: null });
        return;
      }

      // Find session and get active company
      const session = await em.findOne(
        Session,
        { sid: rawCookie },
        { populate: ['activeCompany'] },
      );

      if (!session?.activeCompany) {
        res.status(200).json({ activeCompany: null });
        return;
      }

      res.status(200).json({
        activeCompany: {
          id: session.activeCompany.id,
          name: session.activeCompany.name,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get active company error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /users/me/switch-company
 * Switch the current user's active company
 */
router.post(
  '/me/switch-company',
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = switchCompanySchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { companyId } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const userType = user.userType as UserType;

      // Verify user has access to the company
      const { Company: CompanyEntity } = await import('../entities');
      const targetCompany = await em.findOne(CompanyEntity, {
        id: companyId,
        isActive: true,
      });

      if (!targetCompany) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      if (userType === UserType.COMPANY) {
        // Check UserCompany access
        const userCompany = await em.findOne(UserCompany, {
          user: user.id,
          company: companyId,
          isActive: true,
        });

        if (!userCompany) {
          res
            .status(403)
            .json({ error: 'No active membership for this company' });
          return;
        }

        // Update lastAccessedAt
        userCompany.lastAccessedAt = new Date();
      } else {
        // For internal users, check if they have restricted access
        const restrictedCount = await em.count(InternalUserCompany, {
          user: user.id,
        });

        if (restrictedCount > 0) {
          // Check InternalUserCompany access
          const internalUserCompany = await em.findOne(InternalUserCompany, {
            user: user.id,
            company: companyId,
          });

          if (!internalUserCompany) {
            res
              .status(403)
              .json({ error: 'You do not have access to this company' });
            return;
          }

          // Update lastAccessedAt
          internalUserCompany.lastAccessedAt = new Date();
        }
        // If no restrictions, internal user can access any company
      }

      // Get session and update activeCompany
      const rawCookie = (req.cookies as Record<string, string | undefined>)[
        'sid'
      ];
      if (!rawCookie) {
        res.status(400).json({ error: 'No active session' });
        return;
      }

      const session = await em.findOne(Session, { sid: rawCookie });
      if (!session) {
        res.status(400).json({ error: 'Session not found' });
        return;
      }

      session.activeCompany = targetCompany;
      await em.flush();

      req.log.info(
        { userId: user.id, companyId, companyName: targetCompany.name },
        'User switched company',
      );

      res.status(200).json({
        message: 'Company switched successfully',
        activeCompany: {
          id: targetCompany.id,
          name: targetCompany.name,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Switch company error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /users/me/companies/:companyId
 * Pin or unpin a company for the current user
 */
router.patch(
  '/me/companies/:companyId',
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { companyId } = req.params;
      if (!companyId) {
        res.status(400).json({ error: 'Company ID is required' });
        return;
      }

      const parseResult = pinCompanySchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { isPinned } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const userType = user.userType as UserType;

      if (userType === UserType.COMPANY) {
        // Update UserCompany
        const userCompany = await em.findOne(UserCompany, {
          user: user.id,
          company: companyId,
          isActive: true,
        });

        if (!userCompany) {
          res.status(404).json({ error: 'Company membership not found' });
          return;
        }

        userCompany.isPinned = isPinned;
        await em.flush();
      } else {
        // For internal users with restricted access, update InternalUserCompany
        const internalUserCompany = await em.findOne(InternalUserCompany, {
          user: user.id,
          company: companyId,
        });

        if (!internalUserCompany) {
          res.status(404).json({ error: 'Company access not found' });
          return;
        }

        internalUserCompany.isPinned = isPinned;
        await em.flush();
      }

      res.status(200).json({
        message: isPinned ? 'Company pinned' : 'Company unpinned',
      });
    } catch (err) {
      req.log.error({ err }, 'Pin company error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// User List and Details Routes
// ============================================================================

/**
 * GET /users
 * List all users in the company with pagination and optional office filter
 *
 * Note: Uses companyContext for proper multi-company support.
 * The middleware sets companyContext from session.activeCompany (or falls back to user.company).
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
          const roles = await permissionService.getUserRoles(
            u.id,
            user.company!.id,
          );
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
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
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
        { id, company: user.company.id, deletedAt: null },
        { populate: ['currentOffice'] },
      );

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Get user's roles
      const roles = await permissionService.getUserRoles(id, user.company.id);

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
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
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
        company: user.company.id,
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
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
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
        company: user.company.id,
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
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
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
        company: user.company.id,
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
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
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
        company: user.company.id,
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
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
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
        company: user.company.id,
        deletedAt: null,
      });

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Verify office belongs to the same company
      const office = await em.findOne(Office, {
        id: officeId,
        company: user.company.id,
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
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
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
        { id, company: user.company.id, deletedAt: null },
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
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
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
        company: user.company.id,
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
