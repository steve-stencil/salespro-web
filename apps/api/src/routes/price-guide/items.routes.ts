import { Router } from 'express';

import { Company, MeasureSheetItem, PriceGuideCategory } from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';

import { createItemSchema, updateItemSchema } from './schemas';

import type { User } from '../../entities';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';
import type { MeasureSheetItemListItem } from '@shared/core';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get company context from authenticated request.
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
 * Map item entity to response object.
 */
function mapItemToResponse(
  item: MeasureSheetItem,
  categoryName: string,
): MeasureSheetItemListItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    categoryId: item.category.id,
    categoryName,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /price-guide/items
 * List all measure sheet items for the company.
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { isActive, categoryId } = req.query;
      const orm = getORM();
      const em = orm.em.fork();

      const where: Record<string, unknown> = { company: company.id };
      if (isActive !== undefined) {
        where['isActive'] = isActive === 'true';
      }
      if (categoryId !== undefined) {
        where['category'] = categoryId;
      }

      const items = await em.find(MeasureSheetItem, where, {
        orderBy: { sortOrder: 'ASC', name: 'ASC' },
        populate: ['category'],
      });

      const itemsResponse = items.map(item =>
        mapItemToResponse(item, item.category.name),
      );

      res.status(200).json({ items: itemsResponse });
    } catch (err) {
      req.log.error({ err }, 'List items error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/items/:id
 * Get a specific item by ID.
 */
router.get(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_READ),
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
        res.status(400).json({ error: 'Item ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const item = await em.findOne(
        MeasureSheetItem,
        { id, company: company.id },
        { populate: ['category'] },
      );
      if (!item) {
        res.status(404).json({ error: 'Item not found' });
        return;
      }

      res.status(200).json({
        item: mapItemToResponse(item, item.category.name),
      });
    } catch (err) {
      req.log.error({ err }, 'Get item error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/items
 * Create a new measure sheet item.
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_CREATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const parseResult = createItemSchema.safeParse(req.body);
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

      const { name, description, categoryId, sortOrder, isActive } =
        parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      // Validate category exists and belongs to company
      const category = await em.findOne(PriceGuideCategory, {
        id: categoryId,
        company: company.id,
      });
      if (!category) {
        res.status(400).json({ error: 'Category not found' });
        return;
      }

      // Check for duplicate name in same category
      const existing = await em.findOne(MeasureSheetItem, {
        name,
        category: categoryId,
        company: company.id,
      });
      if (existing) {
        res.status(409).json({
          error: 'Item name already exists',
          message: `An item with the name "${name}" already exists in this category.`,
        });
        return;
      }

      const item = new MeasureSheetItem();
      item.name = name;
      item.description = description ?? undefined;
      item.category = em.getReference(PriceGuideCategory, categoryId);
      item.company = em.getReference(Company, company.id);
      item.sortOrder = sortOrder ?? 0;
      item.isActive = isActive ?? true;

      await em.persistAndFlush(item);
      req.log.info(
        { itemId: item.id, itemName: item.name, categoryId, userId: user.id },
        'Measure sheet item created',
      );

      res.status(201).json({
        message: 'Item created successfully',
        item: mapItemToResponse(item, category.name),
      });
    } catch (err) {
      req.log.error({ err }, 'Create item error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /price-guide/items/:id
 * Update an existing item.
 */
router.patch(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_UPDATE),
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
        res.status(400).json({ error: 'Item ID is required' });
        return;
      }

      const parseResult = updateItemSchema.safeParse(req.body);
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

      const { name, description, categoryId, sortOrder, isActive } =
        parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      const item = await em.findOne(
        MeasureSheetItem,
        { id, company: company.id },
        { populate: ['category'] },
      );
      if (!item) {
        res.status(404).json({ error: 'Item not found' });
        return;
      }

      // Validate new category if changing
      let newCategory: PriceGuideCategory | null = null;
      if (categoryId !== undefined && categoryId !== item.category.id) {
        newCategory = await em.findOne(PriceGuideCategory, {
          id: categoryId,
          company: company.id,
        });
        if (!newCategory) {
          res.status(400).json({ error: 'Category not found' });
          return;
        }
      }

      // Check for duplicate name if name is changing
      const effectiveCategoryId = categoryId ?? item.category.id;
      if (name && name !== item.name) {
        const existing = await em.findOne(MeasureSheetItem, {
          name,
          category: effectiveCategoryId,
          company: company.id,
        });
        if (existing && existing.id !== item.id) {
          res.status(409).json({
            error: 'Item name already exists',
            message: `An item with the name "${name}" already exists in this category.`,
          });
          return;
        }
      }

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (name !== undefined && name !== item.name) {
        changes['name'] = { from: item.name, to: name };
        item.name = name;
      }
      if (description !== undefined && description !== item.description) {
        changes['description'] = { from: item.description, to: description };
        item.description = description ?? undefined;
      }
      if (categoryId !== undefined && categoryId !== item.category.id) {
        changes['categoryId'] = { from: item.category.id, to: categoryId };
        item.category = em.getReference(PriceGuideCategory, categoryId);
      }
      if (sortOrder !== undefined && sortOrder !== item.sortOrder) {
        changes['sortOrder'] = { from: item.sortOrder, to: sortOrder };
        item.sortOrder = sortOrder;
      }
      if (isActive !== undefined && isActive !== item.isActive) {
        changes['isActive'] = { from: item.isActive, to: isActive };
        item.isActive = isActive;
      }

      await em.flush();
      req.log.info(
        { itemId: item.id, changes, userId: user.id },
        'Measure sheet item updated',
      );

      // Reload to get updated category name if changed
      const categoryName = newCategory?.name ?? item.category.name;
      res.status(200).json({
        message: 'Item updated successfully',
        item: mapItemToResponse(item, categoryName),
      });
    } catch (err) {
      req.log.error({ err }, 'Update item error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/items/:id
 * Delete an item.
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_DELETE),
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
        res.status(400).json({ error: 'Item ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const item = await em.findOne(MeasureSheetItem, {
        id,
        company: company.id,
      });
      if (!item) {
        res.status(404).json({ error: 'Item not found' });
        return;
      }

      await em.removeAndFlush(item);
      req.log.info(
        {
          itemId: item.id,
          itemName: item.name,
          userId: user.id,
        },
        'Measure sheet item deleted',
      );

      res.status(200).json({
        message: 'Item deleted successfully',
      });
    } catch (err) {
      req.log.error({ err }, 'Delete item error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
