/**
 * Invite routes for user invitation management.
 * Handles creating, validating, accepting, revoking, and resending invites.
 */
import { Router } from 'express';
import { z } from 'zod';

import { getORM } from '../lib/db';
import { PERMISSIONS } from '../lib/permissions';
import { requireAuth, requirePermission } from '../middleware';
import {
  createInvite,
  validateInviteToken,
  acceptInvite,
  revokeInvite,
  resendInvite,
  listPendingInvites,
} from '../services';

import type { User, Company } from '../entities';
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

const createInviteSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    roles: z.array(z.string().uuid()).min(1, 'At least one role is required'),
    currentOfficeId: z.string().uuid('Current office must be a valid UUID'),
    allowedOfficeIds: z
      .array(z.string().uuid())
      .min(1, 'At least one allowed office is required'),
  })
  .refine(data => data.allowedOfficeIds.includes(data.currentOfficeId), {
    message: 'Current office must be one of the allowed offices',
    path: ['currentOfficeId'],
  });

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  nameFirst: z.string().max(100).optional(),
  nameLast: z.string().max(100).optional(),
});

const validateTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// ============================================================================
// Protected Routes (require authentication)
// ============================================================================

/**
 * POST /users/invites
 * Create and send a new user invitation
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_CREATE),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = createInviteSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { email, roles, currentOfficeId, allowedOfficeIds } =
        parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      const result = await createInvite(em, {
        email,
        companyId: user.company.id,
        invitedById: user.id,
        roles,
        inviterName: user.fullName,
        currentOfficeId,
        allowedOfficeIds,
      });

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      const response: Record<string, unknown> = {
        message: 'Invitation sent successfully',
        invite: {
          id: result.invite!.id,
          email: result.invite!.email,
          expiresAt: result.invite!.expiresAt,
          currentOffice: {
            id: result.invite!.currentOffice.id,
            name: result.invite!.currentOffice.name,
          },
          allowedOffices: result.invite!.allowedOffices,
        },
      };

      // Include token in development for testing
      if (result.token) {
        response['token'] = result.token;
      }

      res.status(201).json(response);
    } catch (err) {
      req.log.error({ err }, 'Create invite error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /users/invites
 * List pending invites for the company
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { page = '1', limit = '20' } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10) || 20),
      );

      const orm = getORM();
      const em = orm.em.fork();

      const { invites, total } = await listPendingInvites(em, user.company.id, {
        page: pageNum,
        limit: limitNum,
      });

      res.status(200).json({
        invites: invites.map(invite => ({
          id: invite.id,
          email: invite.email,
          roles: invite.roles,
          currentOffice: {
            id: invite.currentOffice.id,
            name: invite.currentOffice.name,
          },
          allowedOffices: invite.allowedOffices,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
          invitedBy: {
            id: invite.invitedBy.id,
            email: invite.invitedBy.email,
            nameFirst: invite.invitedBy.nameFirst,
            nameLast: invite.invitedBy.nameLast,
          },
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      req.log.error({ err }, 'List invites error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /users/invites/:id
 * Revoke a pending invitation
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_CREATE),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Invite ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const result = await revokeInvite(em, id, user.company.id);

      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }

      res.status(200).json({ message: 'Invitation revoked successfully' });
    } catch (err) {
      req.log.error({ err }, 'Revoke invite error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /users/invites/:id/resend
 * Resend an invitation email with a new token
 */
router.post(
  '/:id/resend',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_CREATE),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Invite ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const result = await resendInvite(em, id, user.company.id, user.fullName);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      const response: Record<string, unknown> = {
        message: 'Invitation resent successfully',
        invite: {
          id: result.invite!.id,
          email: result.invite!.email,
          expiresAt: result.invite!.expiresAt,
        },
      };

      // Include token in development for testing
      if (result.token) {
        response['token'] = result.token;
      }

      res.status(200).json(response);
    } catch (err) {
      req.log.error({ err }, 'Resend invite error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// Public Routes (no authentication required)
// ============================================================================

/**
 * GET /invites/validate
 * Validate an invitation token (public endpoint)
 */
router.get('/validate', async (req: Request, res: Response) => {
  try {
    const parseResult = validateTokenSchema.safeParse({
      token: req.query.token,
    });
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.issues,
      });
      return;
    }

    const { token } = parseResult.data;
    const orm = getORM();
    const em = orm.em.fork();

    const result = await validateInviteToken(em, token);

    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({
      valid: true,
      email: result.email,
      companyName: result.companyName,
    });
  } catch (err) {
    req.log.error({ err }, 'Validate invite token error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /invites/accept
 * Accept an invitation and create user account (public endpoint)
 */
router.post('/accept', async (req: Request, res: Response) => {
  try {
    const parseResult = acceptInviteSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.issues,
      });
      return;
    }

    const { token, password, nameFirst, nameLast } = parseResult.data;
    const orm = getORM();
    const em = orm.em.fork();

    const result = await acceptInvite(em, {
      token,
      password,
      nameFirst,
      nameLast,
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.get('user-agent') ?? 'unknown',
    });

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: result.user!.id,
        email: result.user!.email,
        nameFirst: result.user!.nameFirst,
        nameLast: result.user!.nameLast,
      },
    });
  } catch (err) {
    req.log.error({ err }, 'Accept invite error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
