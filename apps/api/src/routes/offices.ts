import { Router } from 'express';
import { z } from 'zod';

import { Office, User, UserOffice, Company } from '../entities';
import { getORM } from '../lib/db';
import { PERMISSIONS } from '../lib/permissions';
import { requireAuth, requirePermission } from '../middleware';

import type { AuthenticatedRequest } from '../middleware/requireAuth';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createOfficeSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  isActive: z.boolean().optional(),
});

const updateOfficeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get company context from authenticated request.
 * @returns Company context or null if not available
 */
function getCompanyContext(
  req: Request,
): { user: User; company: Company } | null {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  const company = authReq.companyContext;
  return user && company ? { user, company } : null;
}

/**
 * Map office entity to response object with user count.
 */
function mapOfficeToResponse(office: Office, userCount: number) {
  return {
    id: office.id,
    name: office.name,
    isActive: office.isActive,
    createdAt: office.createdAt,
    updatedAt: office.updatedAt,
    userCount,
  };
}

/**
 * Get user counts for multiple offices.
 */
async function getOfficeCounts(
  em: ReturnType<ReturnType<typeof getORM>['em']['fork']>,
  offices: Office[],
): Promise<Map<string, number>> {
  const counts = await Promise.all(
    offices.map(async o => ({
      officeId: o.id,
      count: await em.count(UserOffice, { office: o.id }),
    })),
  );
  return new Map(counts.map(c => [c.officeId, c.count]));
}

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
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { isActive } = req.query;
      const orm = getORM();
      const em = orm.em.fork();

      const where: Record<string, unknown> = { company: company.id };
      if (isActive !== undefined) {
        where['isActive'] = isActive === 'true';
      }

      const offices = await em.find(Office, where, {
        orderBy: { name: 'ASC' },
      });
      const countMap = await getOfficeCounts(em, offices);

      res.status(200).json({
        offices: offices.map(o =>
          mapOfficeToResponse(o, countMap.get(o.id) ?? 0),
        ),
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
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Office ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const office = await em.findOne(Office, {
        id,
        company: company.id,
      });
      if (!office) {
        res.status(404).json({ error: 'Office not found' });
        return;
      }

      const userCount = await em.count(UserOffice, { office: office.id });
      res.status(200).json({ office: mapOfficeToResponse(office, userCount) });
    } catch (err) {
      req.log.error({ err }, 'Get office error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /offices
 * Create a new office
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.OFFICE_CREATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const parseResult = createOfficeSchema.safeParse(req.body);
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

      const { name, isActive } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      const existing = await em.findOne(Office, {
        name,
        company: company.id,
      });
      if (existing) {
        res.status(409).json({
          error: 'Office name already exists',
          message: `An office with the name "${name}" already exists.`,
        });
        return;
      }

      const office = new Office();
      office.name = name;
      office.isActive = isActive ?? true;
      office.company = em.getReference(Company, company.id);

      await em.persistAndFlush(office);
      req.log.info(
        { officeId: office.id, officeName: office.name, userId: user.id },
        'Office created',
      );

      res.status(201).json({
        message: 'Office created successfully',
        office: mapOfficeToResponse(office, 0),
      });
    } catch (err) {
      req.log.error({ err }, 'Create office error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /offices/:id
 * Update an existing office
 */
router.patch(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.OFFICE_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Office ID is required' });
        return;
      }

      const parseResult = updateOfficeSchema.safeParse(req.body);
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

      const name = parseResult.data['name'];
      const isActive = parseResult.data['isActive'];
      const orm = getORM();
      const em = orm.em.fork();

      const office = await em.findOne(Office, {
        id,
        company: company.id,
      });
      if (!office) {
        res.status(404).json({ error: 'Office not found' });
        return;
      }

      if (name && name !== office.name) {
        const existing = await em.findOne(Office, {
          name,
          company: company.id,
        });
        if (existing) {
          res.status(409).json({
            error: 'Office name already exists',
            message: `An office with the name "${name}" already exists.`,
          });
          return;
        }
      }

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (name !== undefined && name !== office.name) {
        changes['name'] = { from: office.name, to: name };
        office.name = name;
      }
      if (isActive !== undefined && isActive !== office.isActive) {
        changes['isActive'] = { from: office.isActive, to: isActive };
        office.isActive = isActive;
      }

      await em.flush();
      req.log.info(
        { officeId: office.id, changes, userId: user.id },
        'Office updated',
      );

      const userCount = await em.count(UserOffice, { office: office.id });
      res.status(200).json({
        message: 'Office updated successfully',
        office: mapOfficeToResponse(office, userCount),
      });
    } catch (err) {
      req.log.error({ err }, 'Update office error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /offices/:id
 * Delete an office (with force option for assigned users)
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.OFFICE_DELETE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Office ID is required' });
        return;
      }

      const force = req.query['force'] === 'true';
      const orm = getORM();
      const em = orm.em.fork();

      const office = await em.findOne(Office, {
        id,
        company: company.id,
      });
      if (!office) {
        res.status(404).json({ error: 'Office not found' });
        return;
      }

      const assignedCount = await em.count(UserOffice, { office: office.id });
      const currentOfficeCount = await em.count(User, {
        currentOffice: office.id,
        company: company.id,
      });

      if (assignedCount + currentOfficeCount > 0 && !force) {
        res.status(409).json({
          error: 'Office has assigned users',
          userCount: assignedCount + currentOfficeCount,
          assignedCount,
          currentOfficeCount,
          message: `This office has ${assignedCount} assigned user(s) and ${currentOfficeCount} user(s) with it as current office. Use ?force=true to delete.`,
        });
        return;
      }

      if (assignedCount > 0 && force) {
        await em.nativeDelete(UserOffice, { office: office.id });
        req.log.info(
          {
            officeId: office.id,
            removedAssignments: assignedCount,
            userId: user.id,
          },
          'Force deleted assignments',
        );
      }

      if (currentOfficeCount > 0 && force) {
        await em.nativeUpdate(
          User,
          { currentOffice: office.id, company: company.id },
          { currentOffice: null },
        );
        req.log.info(
          {
            officeId: office.id,
            clearedCurrentOffice: currentOfficeCount,
            userId: user.id,
          },
          'Cleared current office',
        );
      }

      await em.removeAndFlush(office);
      req.log.info(
        {
          officeId: office.id,
          officeName: office.name,
          force,
          userId: user.id,
        },
        'Office deleted',
      );

      res.status(200).json({
        message: 'Office deleted successfully',
        removedAssignments: assignedCount,
        clearedCurrentOffice: currentOfficeCount,
      });
    } catch (err) {
      req.log.error({ err }, 'Delete office error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
