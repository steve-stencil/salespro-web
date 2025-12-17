import { Router } from 'express';
import { z } from 'zod';

import { Company, Session } from '../entities';
import { getORM } from '../lib/db';
import { PERMISSIONS } from '../lib/permissions';
import {
  requireAuth,
  requireInternalUser,
  requirePermission,
} from '../middleware';

import type { AuthenticatedRequest } from '../middleware/requireAuth';
import type { Request, Response } from 'express';

const router: Router = Router();

/**
 * UUID v4 validation regex
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Parse session ID from cookie value.
 * Express-session signed cookies have format: s:UUID.signature
 * This extracts just the UUID part.
 */
function parseSessionIdFromCookie(cookieValue: string): string | null {
  if (!cookieValue) return null;

  // If it's a signed cookie (starts with s:), extract the session ID
  if (cookieValue.startsWith('s:')) {
    const dotIndex = cookieValue.indexOf('.', 2);
    const sessionId =
      dotIndex > 2 ? cookieValue.slice(2, dotIndex) : cookieValue.slice(2);
    return UUID_REGEX.test(sessionId) ? sessionId : null;
  }

  // If it's already a plain UUID
  return UUID_REGEX.test(cookieValue) ? cookieValue : null;
}

// Validation schemas
const switchCompanySchema = z.object({
  companyId: z.string().uuid('Invalid company ID format'),
});

/**
 * GET /platform/companies
 * List all companies in the platform.
 * Requires internal user with platform:view_companies permission.
 */
router.get(
  '/companies',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_VIEW_COMPANIES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orm = getORM();
      const em = orm.em.fork();

      const companies = await em.find(
        Company,
        {},
        {
          orderBy: { name: 'asc' },
          fields: ['id', 'name', 'isActive', 'createdAt'],
        },
      );

      res.json({
        companies: companies.map(c => ({
          id: c.id,
          name: c.name,
          isActive: c.isActive,
          createdAt: c.createdAt,
        })),
        total: companies.length,
      });
    } catch (err) {
      req.log.error({ err }, 'Error listing companies');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /platform/companies/:id
 * Get details of a specific company.
 * Requires internal user with platform:view_companies permission.
 */
router.get(
  '/companies/:id',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_VIEW_COMPANIES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid company ID format' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const company = await em.findOne(Company, { id });

      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      res.json({
        id: company.id,
        name: company.name,
        isActive: company.isActive,
        subscriptionTier: company.tier,
        maxUsers: company.maxSeats,
        maxSessions: company.maxSessionsPerUser,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      });
    } catch (err) {
      req.log.error({ err }, 'Error fetching company');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /platform/active-company
 * Get the current active company for the internal user.
 * Returns null if no company is currently selected.
 */
router.get(
  '/active-company',
  requireAuth(),
  requireInternalUser(),
  (req: Request, res: Response): void => {
    try {
      const authReq = req as AuthenticatedRequest;
      const companyContext = authReq.companyContext;

      if (!companyContext) {
        res.json({ activeCompany: null });
        return;
      }

      res.json({
        activeCompany: {
          id: companyContext.id,
          name: companyContext.name,
          isActive: companyContext.isActive,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Error fetching active company');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /platform/switch-company
 * Switch the active company for the internal user.
 * Requires internal user with platform:switch_company permission.
 */
router.post(
  '/switch-company',
  requireAuth(),
  requireInternalUser(),
  requirePermission(PERMISSIONS.PLATFORM_SWITCH_COMPANY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parseResult = switchCompanySchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.issues,
        });
        return;
      }

      const { companyId } = parseResult.data;

      const orm = getORM();
      const em = orm.em.fork();

      // Verify company exists and is active
      const company = await em.findOne(Company, { id: companyId });

      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      if (!company.isActive) {
        res.status(400).json({ error: 'Cannot switch to inactive company' });
        return;
      }

      // Get session ID from cookie
      const rawCookie = (req.cookies as Record<string, string | undefined>)[
        'sid'
      ];
      const sessionId = rawCookie ? parseSessionIdFromCookie(rawCookie) : null;

      if (!sessionId) {
        res.status(400).json({ error: 'Invalid session' });
        return;
      }

      // Update the session's activeCompany
      const session = await em.findOne(Session, { sid: sessionId });

      if (!session) {
        res.status(400).json({ error: 'Session not found' });
        return;
      }

      session.activeCompany = company;
      await em.flush();

      req.log.info(
        { companyId: company.id, companyName: company.name },
        'Internal user switched company',
      );

      res.json({
        success: true,
        activeCompany: {
          id: company.id,
          name: company.name,
          isActive: company.isActive,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Error switching company');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /platform/active-company
 * Clear the active company (exit company context).
 */
router.delete(
  '/active-company',
  requireAuth(),
  requireInternalUser(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orm = getORM();
      const em = orm.em.fork();

      // Get session ID from cookie
      const rawCookie = (req.cookies as Record<string, string | undefined>)[
        'sid'
      ];
      const sessionId = rawCookie ? parseSessionIdFromCookie(rawCookie) : null;

      if (!sessionId) {
        res.status(400).json({ error: 'Invalid session' });
        return;
      }

      const session = await em.findOne(Session, { sid: sessionId });

      if (!session) {
        res.status(400).json({ error: 'Session not found' });
        return;
      }

      session.activeCompany = undefined;
      await em.flush();

      req.log.info('Internal user exited company context');

      res.json({ success: true, activeCompany: null });
    } catch (err) {
      req.log.error({ err }, 'Error clearing active company');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
