import { Router } from 'express';
import { z } from 'zod';

import { PriceObjectType, Company } from '../../../entities';
import { getORM } from '../../../lib/db';
import { PERMISSIONS } from '../../../lib/permissions';
import { requireAuth, requirePermission } from '../../../middleware';

import type { User } from '../../../entities';
import type { AuthenticatedRequest } from '../../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createPriceTypeSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const updatePriceTypeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
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

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /price-guide/pricing/price-types
 * List all price types (global + company-specific)
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
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Get global types (company=null) and company-specific types
      const priceTypes = await em.find(
        PriceObjectType,
        {
          $or: [{ company: null }, { company: company.id }],
          isActive: true,
        },
        { orderBy: { sortOrder: 'ASC', name: 'ASC' } },
      );

      res.status(200).json({
        priceTypes: priceTypes.map(pt => ({
          id: pt.id,
          code: pt.code,
          name: pt.name,
          description: pt.description,
          sortOrder: pt.sortOrder,
          isGlobal: !pt.company,
          isEditable: !!pt.company,
          isActive: true, // All returned types are active (filtered in query)
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'List price types error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/pricing/price-types/:id
 * Get a specific price type
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
        res.status(400).json({ error: 'Price type ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const priceType = await em.findOne(PriceObjectType, {
        id,
        $or: [{ company: null }, { company: company.id }],
      });

      if (!priceType) {
        res.status(404).json({ error: 'Price type not found' });
        return;
      }

      res.status(200).json({
        priceType: {
          id: priceType.id,
          code: priceType.code,
          name: priceType.name,
          description: priceType.description,
          sortOrder: priceType.sortOrder,
          isGlobal: !priceType.company,
          isEditable: !!priceType.company,
          createdAt: priceType.createdAt,
          updatedAt: priceType.updatedAt,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get price type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/pricing/price-types
 * Create a company-specific price type
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

      const { company } = context;
      const parseResult = createPriceTypeSchema.safeParse(req.body);
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

      // Check for duplicate code within company
      const existing = await em.findOne(PriceObjectType, {
        company: company.id,
        code: data.code,
      });

      if (existing) {
        res.status(409).json({
          error: 'A price type with this code already exists',
          existingCode: existing.code,
        });
        return;
      }

      // Also check global types
      const globalExisting = await em.findOne(PriceObjectType, {
        company: null,
        code: data.code,
      });

      if (globalExisting) {
        res.status(409).json({
          error: 'A global price type with this code already exists',
          existingCode: globalExisting.code,
        });
        return;
      }

      // Get max sort order if not provided
      if (data.sortOrder === undefined) {
        const existingTypes = await em.find(
          PriceObjectType,
          { $or: [{ company: null }, { company: company.id }] },
          { orderBy: { sortOrder: 'DESC' }, limit: 1 },
        );
        const firstType = existingTypes[0];
        const maxSort = firstType ? firstType.sortOrder : 0;
        data.sortOrder = maxSort + 1;
      }

      const priceType = new PriceObjectType();
      priceType.company = em.getReference(Company, company.id);
      priceType.code = data.code;
      priceType.name = data.name;
      priceType.description = data.description;
      priceType.sortOrder = data.sortOrder;

      await em.persistAndFlush(priceType);

      req.log.info(
        {
          priceTypeId: priceType.id,
          code: priceType.code,
          userId: context.user.id,
        },
        'Price type created',
      );

      res.status(201).json({
        message: 'Price type created successfully',
        priceType: {
          id: priceType.id,
          code: priceType.code,
          name: priceType.name,
          description: priceType.description,
          sortOrder: priceType.sortOrder,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create price type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/price-types/:id
 * Update a company-specific price type
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

      const { company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Price type ID is required' });
        return;
      }

      const parseResult = updatePriceTypeSchema.safeParse(req.body);
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

      const priceType = await em.findOne(PriceObjectType, {
        id,
        company: company.id, // Only company-specific types are editable
      });

      if (!priceType) {
        // Check if it's a global type
        const globalType = await em.findOne(PriceObjectType, {
          id,
          company: null,
        });
        if (globalType) {
          res.status(403).json({
            error: 'Global price types cannot be modified',
          });
          return;
        }
        res.status(404).json({ error: 'Price type not found' });
        return;
      }

      // Update fields
      if (data.name !== undefined) priceType.name = data.name;
      if (data.description !== undefined)
        priceType.description = data.description ?? undefined;
      if (data.sortOrder !== undefined) priceType.sortOrder = data.sortOrder;

      await em.flush();

      req.log.info(
        { priceTypeId: priceType.id, userId: context.user.id },
        'Price type updated',
      );

      res.status(200).json({
        message: 'Price type updated successfully',
        priceType: {
          id: priceType.id,
          code: priceType.code,
          name: priceType.name,
          description: priceType.description,
          sortOrder: priceType.sortOrder,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update price type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/pricing/price-types/:id
 * Soft delete a company-specific price type
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

      const { company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Price type ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const priceType = await em.findOne(PriceObjectType, {
        id,
        company: company.id,
      });

      if (!priceType) {
        // Check if it's a global type
        const globalType = await em.findOne(PriceObjectType, {
          id,
          company: null,
        });
        if (globalType) {
          res.status(403).json({
            error: 'Global price types cannot be deleted',
          });
          return;
        }
        res.status(404).json({ error: 'Price type not found' });
        return;
      }

      // Soft delete
      priceType.isActive = false;
      await em.flush();

      req.log.info(
        { priceTypeId: priceType.id, userId: context.user.id },
        'Price type deleted',
      );

      res.status(200).json({
        message: 'Price type deleted successfully',
      });
    } catch (err) {
      req.log.error({ err }, 'Delete price type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/price-types/reorder
 * Reorder price types
 */
router.put(
  '/reorder',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;

      const parseResult = z
        .object({
          order: z.array(
            z.object({
              id: z.string().uuid(),
              sortOrder: z.number().int().min(0),
            }),
          ),
        })
        .safeParse(req.body);

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

      const { order } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Only update company-specific types
      for (const item of order) {
        const priceType = await em.findOne(PriceObjectType, {
          id: item.id,
          company: company.id,
        });
        if (priceType) {
          priceType.sortOrder = item.sortOrder;
        }
      }

      await em.flush();

      req.log.info(
        { userId: context.user.id, count: order.length },
        'Price types reordered',
      );

      res.status(200).json({
        message: 'Price types reordered successfully',
      });
    } catch (err) {
      req.log.error({ err }, 'Reorder price types error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
