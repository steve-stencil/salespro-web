import { Router } from 'express';

import {
  Company,
  PriceGuideCategory,
  PriceGuideCategoryOffice,
  MeasureSheetItem,
  Office,
} from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';

import {
  createCategorySchema,
  updateCategorySchema,
  moveCategorySchema,
  reorderCategoriesSchema,
  assignOfficesSchema,
} from './schemas';

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
  requirePermission(PERMISSIONS.PRICE_GUIDE_READ),
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
  requirePermission(PERMISSIONS.PRICE_GUIDE_READ),
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
  requirePermission(PERMISSIONS.PRICE_GUIDE_CREATE),
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

/**
 * GET /price-guide/categories/:id/children
 * Get children of a category.
 */
router.get(
  '/:id/children',
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
        res.status(400).json({ error: 'Category ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      // Verify parent exists
      const parent = await em.findOne(PriceGuideCategory, {
        id,
        company: company.id,
      });
      if (!parent) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      const children = await em.find(
        PriceGuideCategory,
        { parent: id, company: company.id },
        { orderBy: { sortOrder: 'ASC', name: 'ASC' } },
      );

      const childrenWithCounts = await Promise.all(
        children.map(async cat => {
          const counts = await getCategoryCounts(em, cat.id);
          return mapCategoryToResponse(
            cat,
            counts.childCount,
            counts.itemCount,
          );
        }),
      );

      res.status(200).json({ categories: childrenWithCounts });
    } catch (err) {
      req.log.error({ err }, 'Get category children error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/categories/:id/breadcrumb
 * Get path from root to this category.
 */
router.get(
  '/:id/breadcrumb',
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

      // Build breadcrumb from current category to root
      const breadcrumb: Array<{ id: string; name: string }> = [];
      let current: PriceGuideCategory | null = category;

      while (current) {
        breadcrumb.unshift({ id: current.id, name: current.name });
        if (current.parent?.id) {
          current = await em.findOne(
            PriceGuideCategory,
            { id: current.parent.id },
            { populate: ['parent'] },
          );
        } else {
          current = null;
        }
      }

      res.status(200).json({ breadcrumb });
    } catch (err) {
      req.log.error({ err }, 'Get category breadcrumb error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /price-guide/categories/:id/move
 * Move category to a new parent.
 */
router.patch(
  '/:id/move',
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
        res.status(400).json({ error: 'Category ID is required' });
        return;
      }

      const parseResult = moveCategorySchema.safeParse(req.body);
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

      const { parentId } = parseResult.data;
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

      // Check for circular reference
      if (parentId && (await wouldCreateCircularReference(em, id, parentId))) {
        res.status(400).json({
          error: 'Invalid parent',
          message: 'Cannot move category to one of its descendants',
        });
        return;
      }

      // Validate new parent exists
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

      // Check for duplicate name at new level
      const existing = await em.findOne(PriceGuideCategory, {
        name: category.name,
        parent: parentId,
        company: company.id,
      });
      if (existing && existing.id !== category.id) {
        res.status(409).json({
          error: 'Category name already exists',
          message: `A category with the name "${category.name}" already exists at the destination.`,
        });
        return;
      }

      const oldParentId = category.parent?.id ?? null;
      category.parent = parentId
        ? em.getReference(PriceGuideCategory, parentId)
        : undefined;

      await em.flush();
      req.log.info(
        {
          categoryId: category.id,
          oldParentId,
          newParentId: parentId,
          userId: user.id,
        },
        'Price guide category moved',
      );

      const counts = await getCategoryCounts(em, category.id);
      res.status(200).json({
        message: 'Category moved successfully',
        category: mapCategoryToResponse(
          category,
          counts.childCount,
          counts.itemCount,
        ),
      });
    } catch (err) {
      req.log.error({ err }, 'Move category error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /price-guide/categories/reorder
 * Batch update sortOrder for categories.
 */
router.patch(
  '/reorder',
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
      const parseResult = reorderCategoriesSchema.safeParse(req.body);
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

      const { items } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      // Update sortOrder for each category
      for (const item of items) {
        const category = await em.findOne(PriceGuideCategory, {
          id: item.id,
          company: company.id,
        });
        if (category) {
          category.sortOrder = item.sortOrder;
        }
      }

      await em.flush();
      req.log.info(
        { itemCount: items.length, userId: user.id },
        'Price guide categories reordered',
      );

      res.status(200).json({
        message: 'Categories reordered successfully',
        updatedCount: items.length,
      });
    } catch (err) {
      req.log.error({ err }, 'Reorder categories error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/categories/:id/offices
 * Assign offices to a root category.
 */
router.post(
  '/:id/offices',
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
        res.status(400).json({ error: 'Category ID is required' });
        return;
      }

      const parseResult = assignOfficesSchema.safeParse(req.body);
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

      const { officeIds } = parseResult.data;
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

      // Only root categories can have office assignments
      if (category.parent) {
        res.status(400).json({
          error: 'Invalid operation',
          message: 'Only root categories can be assigned to offices',
        });
        return;
      }

      // Verify offices exist and belong to company
      const offices = await em.find(Office, {
        id: { $in: officeIds },
        company: company.id,
      });
      if (offices.length !== officeIds.length) {
        res.status(400).json({ error: 'One or more offices not found' });
        return;
      }

      // Create assignments (skip duplicates)
      const existingAssignments = await em.find(PriceGuideCategoryOffice, {
        category: id,
      });
      const existingOfficeIds = new Set(
        existingAssignments.map(a => a.office.id),
      );

      const newAssignments: PriceGuideCategoryOffice[] = [];
      for (const officeId of officeIds) {
        if (!existingOfficeIds.has(officeId)) {
          const assignment = new PriceGuideCategoryOffice();
          assignment.category = em.getReference(PriceGuideCategory, id);
          assignment.office = em.getReference(Office, officeId);
          em.persist(assignment);
          newAssignments.push(assignment);
        }
      }

      await em.flush();
      req.log.info(
        {
          categoryId: id,
          officeIds,
          newCount: newAssignments.length,
          userId: user.id,
        },
        'Offices assigned to category',
      );

      res.status(200).json({
        message: 'Offices assigned successfully',
        assignedCount: newAssignments.length,
      });
    } catch (err) {
      req.log.error({ err }, 'Assign offices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/categories/:id/offices/:officeId
 * Remove an office assignment from a root category.
 */
router.delete(
  '/:id/offices/:officeId',
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
      const { id, officeId } = req.params;
      if (!id || !officeId) {
        res
          .status(400)
          .json({ error: 'Category ID and Office ID are required' });
        return;
      }

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

      const assignment = await em.findOne(PriceGuideCategoryOffice, {
        category: id,
        office: officeId,
      });
      if (!assignment) {
        res.status(404).json({ error: 'Office assignment not found' });
        return;
      }

      await em.removeAndFlush(assignment);
      req.log.info(
        { categoryId: id, officeId, userId: user.id },
        'Office removed from category',
      );

      res.status(200).json({
        message: 'Office removed successfully',
      });
    } catch (err) {
      req.log.error({ err }, 'Remove office error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
