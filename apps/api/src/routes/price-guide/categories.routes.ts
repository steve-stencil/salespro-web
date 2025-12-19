import { Router } from 'express';

import { Company, PriceGuideCategory, MeasureSheetItem } from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';

import { createCategorySchema, updateCategorySchema } from './schemas';

import type { User } from '../../entities';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';
import type { PriceGuideCategoryListItem } from '@shared/core';
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
 * Map category entity to response object.
 */
function mapCategoryToResponse(
  category: PriceGuideCategory,
  childCount: number,
  itemCount: number,
): PriceGuideCategoryListItem {
  return {
    id: category.id,
    name: category.name,
    parentId: category.parent?.id ?? null,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    childCount,
    itemCount,
  };
}

/**
 * Get child and item counts for a category.
 */
async function getCategoryCounts(
  em: ReturnType<ReturnType<typeof getORM>['em']['fork']>,
  categoryId: string,
): Promise<{ childCount: number; itemCount: number }> {
  const [childCount, itemCount] = await Promise.all([
    em.count(PriceGuideCategory, { parent: categoryId }),
    em.count(MeasureSheetItem, { category: categoryId }),
  ]);
  return { childCount, itemCount };
}

/**
 * Check if moving a category to a new parent would create a circular reference.
 */
async function wouldCreateCircularReference(
  em: ReturnType<ReturnType<typeof getORM>['em']['fork']>,
  categoryId: string,
  newParentId: string,
): Promise<boolean> {
  // Can't be parent of self
  if (categoryId === newParentId) {
    return true;
  }

  // Walk up the parent chain to check for cycles
  let currentParentId: string | null = newParentId;
  while (currentParentId) {
    if (currentParentId === categoryId) {
      return true;
    }
    const parentCategory: PriceGuideCategory | null = await em.findOne(
      PriceGuideCategory,
      { id: currentParentId },
      { populate: ['parent'] },
    );
    currentParentId = parentCategory?.parent?.id ?? null;
  }

  return false;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /price-guide/categories
 * List all price guide categories for the company (flat list).
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_CATEGORY_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { isActive, parentId } = req.query;
      const orm = getORM();
      const em = orm.em.fork();

      const where: Record<string, unknown> = { company: company.id };
      if (isActive !== undefined) {
        where['isActive'] = isActive === 'true';
      }
      if (parentId !== undefined) {
        where['parent'] = parentId === 'null' ? null : parentId;
      }

      const categories = await em.find(PriceGuideCategory, where, {
        orderBy: { sortOrder: 'ASC', name: 'ASC' },
        populate: ['parent'],
      });

      // Get counts for all categories
      const categoriesWithCounts = await Promise.all(
        categories.map(async cat => {
          const counts = await getCategoryCounts(em, cat.id);
          return mapCategoryToResponse(
            cat,
            counts.childCount,
            counts.itemCount,
          );
        }),
      );

      res.status(200).json({ categories: categoriesWithCounts });
    } catch (err) {
      req.log.error({ err }, 'List categories error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/categories/tree
 * Get categories as a nested tree structure.
 */
router.get(
  '/tree',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_CATEGORY_READ),
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

      const allCategories = await em.find(PriceGuideCategory, where, {
        orderBy: { sortOrder: 'ASC', name: 'ASC' },
      });

      // Get item counts for all categories
      const itemCounts = new Map<string, number>();
      await Promise.all(
        allCategories.map(async cat => {
          const count = await em.count(MeasureSheetItem, { category: cat.id });
          itemCounts.set(cat.id, count);
        }),
      );

      // Build tree structure
      type TreeNode = {
        id: string;
        name: string;
        parentId: string | null;
        sortOrder: number;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        children: TreeNode[];
        itemCount: number;
      };

      const categoryMap = new Map<string, TreeNode>();
      const rootCategories: TreeNode[] = [];

      // First pass: create nodes
      for (const cat of allCategories) {
        categoryMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          parentId: cat.parent?.id ?? null,
          sortOrder: cat.sortOrder,
          isActive: cat.isActive,
          createdAt: cat.createdAt.toISOString(),
          updatedAt: cat.updatedAt.toISOString(),
          children: [],
          itemCount: itemCounts.get(cat.id) ?? 0,
        });
      }

      // Second pass: build tree
      for (const cat of allCategories) {
        const node = categoryMap.get(cat.id);
        if (!node) continue;

        if (cat.parent?.id) {
          const parentNode = categoryMap.get(cat.parent.id);
          if (parentNode) {
            parentNode.children.push(node);
          } else {
            // Parent not found (maybe filtered out), treat as root
            rootCategories.push(node);
          }
        } else {
          rootCategories.push(node);
        }
      }

      res.status(200).json({ categories: rootCategories });
    } catch (err) {
      req.log.error({ err }, 'Get category tree error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/categories/:id
 * Get a specific category by ID.
 */
router.get(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_CATEGORY_READ),
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
        res.status(400).json({ error: 'Category ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const category = await em.findOne(
        PriceGuideCategory,
        { id, company: company.id },
        { populate: ['parent'] },
      );
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      const counts = await getCategoryCounts(em, category.id);
      res.status(200).json({
        category: mapCategoryToResponse(
          category,
          counts.childCount,
          counts.itemCount,
        ),
      });
    } catch (err) {
      req.log.error({ err }, 'Get category error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/categories
 * Create a new price guide category.
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_CATEGORY_CREATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const parseResult = createCategorySchema.safeParse(req.body);
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

      const { name, parentId, sortOrder, isActive } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      // Validate parent exists if provided
      if (parentId) {
        const parent = await em.findOne(PriceGuideCategory, {
          id: parentId,
          company: company.id,
        });
        if (!parent) {
          res.status(400).json({ error: 'Parent category not found' });
          return;
        }
      }

      // Check for duplicate name under same parent
      const existing = await em.findOne(PriceGuideCategory, {
        name,
        parent: parentId ?? null,
        company: company.id,
      });
      if (existing) {
        res.status(409).json({
          error: 'Category name already exists',
          message: `A category with the name "${name}" already exists at this level.`,
        });
        return;
      }

      const category = new PriceGuideCategory();
      category.name = name;
      category.sortOrder = sortOrder ?? 0;
      category.isActive = isActive ?? true;
      category.company = em.getReference(Company, company.id);
      if (parentId) {
        category.parent = em.getReference(PriceGuideCategory, parentId);
      }

      await em.persistAndFlush(category);
      req.log.info(
        {
          categoryId: category.id,
          categoryName: category.name,
          userId: user.id,
        },
        'Price guide category created',
      );

      res.status(201).json({
        message: 'Category created successfully',
        category: mapCategoryToResponse(category, 0, 0),
      });
    } catch (err) {
      req.log.error({ err }, 'Create category error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /price-guide/categories/:id
 * Update an existing category.
 */
router.patch(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_CATEGORY_UPDATE),
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
        res.status(400).json({ error: 'Category ID is required' });
        return;
      }

      const parseResult = updateCategorySchema.safeParse(req.body);
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

      const { name, parentId, sortOrder, isActive } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      const category = await em.findOne(
        PriceGuideCategory,
        { id, company: company.id },
        { populate: ['parent'] },
      );
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      // Handle parent change
      if (parentId !== undefined) {
        const newParentId = parentId;

        // Check for circular reference
        if (
          newParentId &&
          (await wouldCreateCircularReference(em, id, newParentId))
        ) {
          res.status(400).json({
            error: 'Invalid parent',
            message: 'Cannot move category to one of its descendants',
          });
          return;
        }

        // Validate new parent exists
        if (newParentId) {
          const parent = await em.findOne(PriceGuideCategory, {
            id: newParentId,
            company: company.id,
          });
          if (!parent) {
            res.status(400).json({ error: 'Parent category not found' });
            return;
          }
        }
      }

      // Check for duplicate name if name is changing
      const effectiveParentId =
        parentId !== undefined ? parentId : (category.parent?.id ?? null);
      if (name && name !== category.name) {
        const existing = await em.findOne(PriceGuideCategory, {
          name,
          parent: effectiveParentId,
          company: company.id,
        });
        if (existing && existing.id !== category.id) {
          res.status(409).json({
            error: 'Category name already exists',
            message: `A category with the name "${name}" already exists at this level.`,
          });
          return;
        }
      }

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (name !== undefined && name !== category.name) {
        changes['name'] = { from: category.name, to: name };
        category.name = name;
      }
      if (parentId !== undefined) {
        const oldParentId = category.parent?.id ?? null;
        if (oldParentId !== parentId) {
          changes['parentId'] = { from: oldParentId, to: parentId };
          category.parent = parentId
            ? em.getReference(PriceGuideCategory, parentId)
            : undefined;
        }
      }
      if (sortOrder !== undefined && sortOrder !== category.sortOrder) {
        changes['sortOrder'] = { from: category.sortOrder, to: sortOrder };
        category.sortOrder = sortOrder;
      }
      if (isActive !== undefined && isActive !== category.isActive) {
        changes['isActive'] = { from: category.isActive, to: isActive };
        category.isActive = isActive;
      }

      await em.flush();
      req.log.info(
        { categoryId: category.id, changes, userId: user.id },
        'Price guide category updated',
      );

      const counts = await getCategoryCounts(em, category.id);
      res.status(200).json({
        message: 'Category updated successfully',
        category: mapCategoryToResponse(
          category,
          counts.childCount,
          counts.itemCount,
        ),
      });
    } catch (err) {
      req.log.error({ err }, 'Update category error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/categories/:id
 * Delete a category (with force option for categories with children/items).
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_CATEGORY_DELETE),
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
        res.status(400).json({ error: 'Category ID is required' });
        return;
      }

      const force = req.query['force'] === 'true';
      const orm = getORM();
      const em = orm.em.fork();

      const category = await em.findOne(PriceGuideCategory, {
        id,
        company: company.id,
      });
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      const counts = await getCategoryCounts(em, category.id);

      if ((counts.childCount > 0 || counts.itemCount > 0) && !force) {
        res.status(409).json({
          error: 'Category has children or items',
          childCount: counts.childCount,
          itemCount: counts.itemCount,
          message: `This category has ${counts.childCount} child category(ies) and ${counts.itemCount} item(s). Use ?force=true to delete (will cascade to children and items).`,
        });
        return;
      }

      // Cascade delete happens via DB constraints
      await em.removeAndFlush(category);
      req.log.info(
        {
          categoryId: category.id,
          categoryName: category.name,
          force,
          userId: user.id,
          deletedChildren: counts.childCount,
          deletedItems: counts.itemCount,
        },
        'Price guide category deleted',
      );

      res.status(200).json({
        message: 'Category deleted successfully',
        deletedChildren: counts.childCount,
        deletedItems: counts.itemCount,
      });
    } catch (err) {
      req.log.error({ err }, 'Delete category error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
