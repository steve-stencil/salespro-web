import { Router } from 'express';

import { Office   } from '../entities';
import { getORM } from '../lib/db';
import { PERMISSIONS } from '../lib/permissions';
import { requireAuth, requirePermission } from '../middleware';

import type {User, Company} from '../entities';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * Request type with authenticated user
 */
type AuthenticatedRequest = Request & {
  user?: User & { company?: Company };
};

// ============================================================================
// Office List Routes
// ============================================================================

/**
 * GET /offices
 * List all offices for the authenticated user's company
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.OFFICE_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { isActive } = req.query;

      const orm = getORM();
      const em = orm.em.fork();

      // Build query filters
      const where: Record<string, unknown> = {
        company: user.company.id,
      };

      // Optional filter by active status
      if (isActive !== undefined) {
        where['isActive'] = isActive === 'true';
      }

      const offices = await em.find(Office, where, {
        orderBy: { name: 'ASC' },
      });

      res.status(200).json({
        offices: offices.map(o => ({
          id: o.id,
          name: o.name,
          address1: o.address1,
          address2: o.address2,
          city: o.city,
          state: o.state,
          postalCode: o.postalCode,
          country: o.country,
          phone: o.phone,
          email: o.email,
          isActive: o.isActive,
          createdAt: o.createdAt,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'List offices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /offices/:id
 * Get a specific office by ID
 */
router.get(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.OFFICE_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Office ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const office = await em.findOne(Office, {
        id,
        company: user.company.id,
      });

      if (!office) {
        res.status(404).json({ error: 'Office not found' });
        return;
      }

      res.status(200).json({
        office: {
          id: office.id,
          name: office.name,
          address1: office.address1,
          address2: office.address2,
          city: office.city,
          state: office.state,
          postalCode: office.postalCode,
          country: office.country,
          phone: office.phone,
          email: office.email,
          isActive: office.isActive,
          settings: office.settings,
          createdAt: office.createdAt,
          updatedAt: office.updatedAt,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get office error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
