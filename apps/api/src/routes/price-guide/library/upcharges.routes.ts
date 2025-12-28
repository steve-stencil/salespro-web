import { Router } from 'express';
import { z } from 'zod';

import {
  UpCharge,
  PriceGuideOption,
  MeasureSheetItemUpCharge,
  UpChargeDisabledOption,
  Company,
  User,
} from '../../../entities';
import { getORM } from '../../../lib/db';
import { PERMISSIONS } from '../../../lib/permissions';
import { requireAuth, requirePermission } from '../../../middleware';

import type { AuthenticatedRequest } from '../../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
});

const createUpchargeSchema = z.object({
  name: z.string().min(1).max(255),
  note: z.string().max(2000).optional(),
  measurementType: z.string().max(50).optional(),
  identifier: z.string().max(255).optional(),
  imageUrl: z.string().max(255).optional(),
});

const updateUpchargeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  note: z.string().max(2000).optional().nullable(),
  measurementType: z.string().max(50).optional().nullable(),
  identifier: z.string().max(255).optional().nullable(),
  imageUrl: z.string().max(255).optional().nullable(),
  version: z.number().int().min(1),
});

const setDisabledOptionsSchema = z.object({
  optionIds: z.array(z.string().uuid()),
});

// ============================================================================
// Helper Functions
// ============================================================================

function getCompanyContext(
  req: Request,
): { user: User; company: Company } | null {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  const company = authReq.companyContext;
  return user && company ? { user, company } : null;
}

function decodeCursor(cursor: string): { name: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const separatorIndex = decoded.lastIndexOf(':');
    if (separatorIndex === -1) return null;
    return {
      name: decoded.substring(0, separatorIndex),
      id: decoded.substring(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function encodeCursor(name: string, id: string): string {
  return Buffer.from(`${name}:${id}`).toString('base64');
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /price-guide/library/upcharges
 * List upcharges with cursor-based pagination
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const parseResult = listQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.issues,
        });
        return;
      }

      const { cursor, limit, search } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const qb = em
        .createQueryBuilder(UpCharge, 'u')
        .select('*')
        .where({ company: company.id, isActive: true });

      // Full-text search
      if (search) {
        qb.andWhere({
          $or: [
            { name: { $ilike: `%${search}%` } },
            { note: { $ilike: `%${search}%` } },
            { identifier: { $ilike: `%${search}%` } },
          ],
        });
      }

      // Cursor pagination
      if (cursor) {
        const decoded = decodeCursor(cursor);
        if (decoded) {
          qb.andWhere({
            $or: [
              { name: { $gt: decoded.name } },
              { name: decoded.name, id: { $gt: decoded.id } },
            ],
          });
        }
      }

      qb.orderBy({ name: 'ASC', id: 'ASC' }).limit(limit + 1);

      const items = await qb.getResultList();
      const hasMore = items.length > limit;
      if (hasMore) items.pop();

      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? encodeCursor(lastItem.name, lastItem.id)
          : undefined;

      res.status(200).json({
        items: items.map(u => ({
          id: u.id,
          name: u.name,
          note: u.note,
          measurementType: u.measurementType,
          identifier: u.identifier,
          linkedMsiCount: u.linkedMsiCount,
          isActive: u.isActive,
        })),
        nextCursor,
        hasMore,
        total: items.length,
      });
    } catch (err) {
      req.log.error({ err }, 'List upcharges error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/library/upcharges/:id
 * Get upcharge detail
 */
router.get(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_READ),
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(
        UpCharge,
        { id, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Get MSIs using this upcharge
      const msiLinks = await em.find(
        MeasureSheetItemUpCharge,
        { upCharge: upcharge.id },
        {
          populate: ['measureSheetItem', 'measureSheetItem.category'],
          limit: 20,
        },
      );

      // Get disabled options
      const disabledOptions = await em.find(
        UpChargeDisabledOption,
        { upCharge: upcharge.id },
        { populate: ['option'] },
      );

      res.status(200).json({
        upcharge: {
          id: upcharge.id,
          name: upcharge.name,
          note: upcharge.note,
          measurementType: upcharge.measurementType,
          identifier: upcharge.identifier,
          imageUrl: upcharge.imageUrl,
          usageCount: upcharge.linkedMsiCount,
          hasAllOfficePricing: true, // TODO: Calculate
          disabledOptionIds: disabledOptions.map(d => d.option.id),
          usedByMSIs: msiLinks.map(l => ({
            id: l.measureSheetItem.id,
            name: l.measureSheetItem.name,
            category: l.measureSheetItem.category.name,
          })),
          version: upcharge.version,
          updatedAt: upcharge.updatedAt,
          lastModifiedBy: upcharge.lastModifiedBy
            ? {
                id: upcharge.lastModifiedBy.id,
                email: upcharge.lastModifiedBy.email,
                nameFirst: upcharge.lastModifiedBy.nameFirst,
                nameLast: upcharge.lastModifiedBy.nameLast,
              }
            : null,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get upcharge error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/library/upcharges
 * Create a new upcharge
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const parseResult = createUpchargeSchema.safeParse(req.body);
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

      const data = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = new UpCharge();
      upcharge.name = data.name;
      upcharge.note = data.note;
      upcharge.measurementType = data.measurementType;
      upcharge.identifier = data.identifier;
      upcharge.imageUrl = data.imageUrl;
      upcharge.company = em.getReference(Company, company.id);
      upcharge.lastModifiedBy = em.getReference(User, user.id);

      await em.persistAndFlush(upcharge);

      req.log.info(
        {
          upchargeId: upcharge.id,
          upchargeName: upcharge.name,
          userId: user.id,
        },
        'Upcharge created',
      );

      res.status(201).json({
        message: 'Upcharge created successfully',
        upcharge: {
          id: upcharge.id,
          name: upcharge.name,
          version: upcharge.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create upcharge error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/library/upcharges/:id
 * Update an upcharge
 */
router.put(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const parseResult = updateUpchargeSchema.safeParse(req.body);
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

      const data = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(
        UpCharge,
        { id, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Check optimistic locking
      if (upcharge.version !== data.version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This upcharge was modified by another user.',
          lastModifiedBy: upcharge.lastModifiedBy
            ? {
                id: upcharge.lastModifiedBy.id,
                email: upcharge.lastModifiedBy.email,
                nameFirst: upcharge.lastModifiedBy.nameFirst,
                nameLast: upcharge.lastModifiedBy.nameLast,
              }
            : null,
          lastModifiedAt: upcharge.updatedAt,
          currentVersion: upcharge.version,
        });
        return;
      }

      // Update fields
      if (data.name !== undefined) upcharge.name = data.name;
      if (data.note !== undefined) upcharge.note = data.note ?? undefined;
      if (data.measurementType !== undefined)
        upcharge.measurementType = data.measurementType ?? undefined;
      if (data.identifier !== undefined)
        upcharge.identifier = data.identifier ?? undefined;
      if (data.imageUrl !== undefined)
        upcharge.imageUrl = data.imageUrl ?? undefined;

      upcharge.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { upchargeId: upcharge.id, userId: user.id },
        'Upcharge updated',
      );

      res.status(200).json({
        message: 'Upcharge updated successfully',
        upcharge: {
          id: upcharge.id,
          name: upcharge.name,
          version: upcharge.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update upcharge error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/library/upcharges/:id
 * Soft delete an upcharge
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
      });

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Warn if in use
      if (upcharge.linkedMsiCount > 0) {
        const force = req.query['force'] === 'true';
        if (!force) {
          res.status(409).json({
            error: 'Upcharge is in use',
            message: `This upcharge is used by ${upcharge.linkedMsiCount} measure sheet item(s). Use ?force=true to delete anyway.`,
            usageCount: upcharge.linkedMsiCount,
          });
          return;
        }
      }

      // Soft delete
      upcharge.isActive = false;
      upcharge.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        {
          upchargeId: upcharge.id,
          upchargeName: upcharge.name,
          userId: user.id,
        },
        'Upcharge deleted',
      );

      res.status(200).json({ message: 'Upcharge deleted successfully' });
    } catch (err) {
      req.log.error({ err }, 'Delete upcharge error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/library/upcharges/:id/disabled-options
 * Get disabled options for an upcharge
 */
router.get(
  '/:id/disabled-options',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_READ),
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
      });

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      const disabledOptions = await em.find(
        UpChargeDisabledOption,
        { upCharge: upcharge.id },
        { populate: ['option'] },
      );

      res.status(200).json({
        disabledOptions: disabledOptions.map(d => ({
          id: d.option.id,
          name: d.option.name,
          brand: d.option.brand,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Get disabled options error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/library/upcharges/:id/disabled-options
 * Set disabled options for an upcharge
 */
router.put(
  '/:id/disabled-options',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const parseResult = setDisabledOptionsSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { optionIds } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
      });

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Validate options
      const options = await em.find(PriceGuideOption, {
        id: { $in: optionIds },
        company: company.id,
      });
      const validOptionIds = new Set(options.map(o => o.id));

      // Remove existing disabled options
      await em.nativeDelete(UpChargeDisabledOption, { upCharge: upcharge.id });

      // Create new disabled options
      for (const optionId of optionIds) {
        if (!validOptionIds.has(optionId)) continue;

        const disabled = new UpChargeDisabledOption();
        disabled.upCharge = upcharge;
        disabled.option = em.getReference(PriceGuideOption, optionId);
        em.persist(disabled);
      }

      upcharge.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        {
          upchargeId: upcharge.id,
          disabledCount: optionIds.length,
          userId: user.id,
        },
        'Disabled options updated',
      );

      res.status(200).json({
        message: 'Disabled options updated successfully',
        disabledCount: optionIds.length,
      });
    } catch (err) {
      req.log.error({ err }, 'Set disabled options error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
