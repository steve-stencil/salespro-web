import { Router } from 'express';
import { z } from 'zod';

import {
  PriceGuideOption,
  MeasureSheetItemOption,
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

const createOptionSchema = z.object({
  name: z.string().min(1).max(255),
  brand: z.string().max(255).optional(),
  itemCode: z.string().max(255).optional(),
  measurementType: z.string().max(50).optional(),
});

const updateOptionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  brand: z.string().max(255).optional().nullable(),
  itemCode: z.string().max(255).optional().nullable(),
  measurementType: z.string().max(50).optional().nullable(),
  version: z.number().int().min(1),
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
 * GET /price-guide/library/options
 * List options with cursor-based pagination
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
        .createQueryBuilder(PriceGuideOption, 'o')
        .select('*')
        .where({ company: company.id, isActive: true });

      // Full-text search
      if (search) {
        qb.andWhere({
          $or: [
            { name: { $ilike: `%${search}%` } },
            { brand: { $ilike: `%${search}%` } },
            { itemCode: { $ilike: `%${search}%` } },
            { searchVector: { $ilike: `%${search}%` } },
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
        items: items.map(o => ({
          id: o.id,
          name: o.name,
          brand: o.brand,
          itemCode: o.itemCode,
          measurementType: o.measurementType,
          linkedMsiCount: o.linkedMsiCount,
          isActive: o.isActive,
        })),
        nextCursor,
        hasMore,
        total: items.length, // Note: This is the page count, not total - would need separate count query
      });
    } catch (err) {
      req.log.error({ err }, 'List options error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/library/options/:id
 * Get option detail
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
        res.status(400).json({ error: 'Option ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const option = await em.findOne(
        PriceGuideOption,
        { id, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!option) {
        res.status(404).json({ error: 'Option not found' });
        return;
      }

      // Get MSIs using this option
      const msiLinks = await em.find(
        MeasureSheetItemOption,
        { option: option.id },
        {
          populate: ['measureSheetItem', 'measureSheetItem.category'],
          limit: 20,
        },
      );

      res.status(200).json({
        option: {
          id: option.id,
          name: option.name,
          brand: option.brand,
          itemCode: option.itemCode,
          measurementType: option.measurementType,
          usageCount: option.linkedMsiCount,
          hasAllOfficePricing: true, // TODO: Calculate
          usedByMSIs: msiLinks.map(l => ({
            id: l.measureSheetItem.id,
            name: l.measureSheetItem.name,
            category: l.measureSheetItem.category.name,
          })),
          version: option.version,
          updatedAt: option.updatedAt,
          lastModifiedBy: option.lastModifiedBy
            ? {
                id: option.lastModifiedBy.id,
                email: option.lastModifiedBy.email,
                nameFirst: option.lastModifiedBy.nameFirst,
                nameLast: option.lastModifiedBy.nameLast,
              }
            : null,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get option error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/library/options
 * Create a new option
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
      const parseResult = createOptionSchema.safeParse(req.body);
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

      const option = new PriceGuideOption();
      option.name = data.name;
      option.brand = data.brand;
      option.itemCode = data.itemCode;
      option.measurementType = data.measurementType;
      option.company = em.getReference(Company, company.id);
      option.searchVector = [data.name, data.brand, data.itemCode]
        .filter(Boolean)
        .join(' ');
      option.lastModifiedBy = em.getReference(User, user.id);

      await em.persistAndFlush(option);

      req.log.info(
        { optionId: option.id, optionName: option.name, userId: user.id },
        'Option created',
      );

      res.status(201).json({
        message: 'Option created successfully',
        option: {
          id: option.id,
          name: option.name,
          brand: option.brand,
          itemCode: option.itemCode,
          version: option.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create option error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/library/options/:id
 * Update an option
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
        res.status(400).json({ error: 'Option ID is required' });
        return;
      }

      const parseResult = updateOptionSchema.safeParse(req.body);
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

      const option = await em.findOne(
        PriceGuideOption,
        { id, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!option) {
        res.status(404).json({ error: 'Option not found' });
        return;
      }

      // Check optimistic locking
      if (option.version !== data.version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This option was modified by another user.',
          lastModifiedBy: option.lastModifiedBy
            ? {
                id: option.lastModifiedBy.id,
                email: option.lastModifiedBy.email,
                nameFirst: option.lastModifiedBy.nameFirst,
                nameLast: option.lastModifiedBy.nameLast,
              }
            : null,
          lastModifiedAt: option.updatedAt,
          currentVersion: option.version,
        });
        return;
      }

      // Update fields
      if (data.name !== undefined) option.name = data.name;
      if (data.brand !== undefined) option.brand = data.brand ?? undefined;
      if (data.itemCode !== undefined)
        option.itemCode = data.itemCode ?? undefined;
      if (data.measurementType !== undefined)
        option.measurementType = data.measurementType ?? undefined;

      // Update search vector
      option.searchVector = [option.name, option.brand, option.itemCode]
        .filter(Boolean)
        .join(' ');
      option.lastModifiedBy = em.getReference(User, user.id);

      await em.flush();

      req.log.info({ optionId: option.id, userId: user.id }, 'Option updated');

      res.status(200).json({
        message: 'Option updated successfully',
        option: {
          id: option.id,
          name: option.name,
          brand: option.brand,
          itemCode: option.itemCode,
          version: option.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update option error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/library/options/:id
 * Soft delete an option
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
        res.status(400).json({ error: 'Option ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const option = await em.findOne(PriceGuideOption, {
        id,
        company: company.id,
      });

      if (!option) {
        res.status(404).json({ error: 'Option not found' });
        return;
      }

      // Warn if in use
      if (option.linkedMsiCount > 0) {
        const force = req.query['force'] === 'true';
        if (!force) {
          res.status(409).json({
            error: 'Option is in use',
            message: `This option is used by ${option.linkedMsiCount} measure sheet item(s). Use ?force=true to delete anyway.`,
            usageCount: option.linkedMsiCount,
          });
          return;
        }
      }

      // Soft delete
      option.isActive = false;
      option.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { optionId: option.id, optionName: option.name, userId: user.id },
        'Option deleted',
      );

      res.status(200).json({ message: 'Option deleted successfully' });
    } catch (err) {
      req.log.error({ err }, 'Delete option error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
