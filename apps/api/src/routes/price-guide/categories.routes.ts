import { Router } from 'express';
import { generateKeyBetween } from 'fractional-indexing';
import { z } from 'zod';

import {
  PriceGuideCategory,
  MeasureSheetItem,
  Company,
  User,
} from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';

import type { PriceGuideCategoryType } from '../../entities';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

/** Valid category type values */
const categoryTypeValues = ['default', 'detail', 'deep_drill_down'] as const;

const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less'),
  parentId: z.string().uuid().optional().nullable(),
  /**
   * Category display type - controls navigation behavior in mobile app.
   * Only applies to root-level categories (depth=0).
   */
  categoryType: z.enum(categoryTypeValues).optional().default('default'),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  /**
   * Category display type - controls navigation behavior in mobile app.
   * Only applies to root-level categories (depth=0).
   */
  categoryType: z.enum(categoryTypeValues).optional(),
  version: z.number().int().min(1, 'Version is required'),
});

const moveCategorySchema = z.object({
  newParentId: z.string().uuid().optional().nullable(),
  /** Fractional index string for positioning */
  sortOrder: z.string(),
});

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
 * Build category tree from flat list.
 */
type CategoryNode = {
  id: string;
  name: string;
  depth: number;
  sortOrder: string;
  parentId: string | null;
  /** Category display type - only applies to root categories (depth=0) */
  categoryType: string;
  children: CategoryNode[];
  /** Direct MSI count for this category only */
  directMsiCount: number;
  /** Total MSI count including all descendant categories */
  msiCount: number;
};

function buildCategoryTree(
  categories: PriceGuideCategory[],
  msiCountMap: Map<string, number>,
): CategoryNode[] {
  const nodeMap = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  // Create nodes with direct counts
  for (const cat of categories) {
    const directCount = msiCountMap.get(cat.id) ?? 0;
    nodeMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      depth: cat.depth,
      sortOrder: cat.sortOrder,
      parentId: cat.parent?.id ?? null,
      categoryType: cat.categoryType,
      children: [],
      directMsiCount: directCount,
      msiCount: directCount, // Will be updated with cascading count
    });
  }

  // Build tree
  for (const cat of categories) {
    const node = nodeMap.get(cat.id)!;
    if (cat.parent) {
      const parentNode = nodeMap.get(cat.parent.id);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  // Sort children by sortOrder (fractional index strings)
  const sortChildren = (nodes: CategoryNode[]): void => {
    nodes.sort((a, b) => a.sortOrder.localeCompare(b.sortOrder));
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  // Calculate cascading counts (post-order traversal)
  const calculateCascadingCount = (node: CategoryNode): number => {
    let total = node.directMsiCount;
    for (const child of node.children) {
      total += calculateCascadingCount(child);
    }
    node.msiCount = total;
    return total;
  };

  for (const root of roots) {
    calculateCascadingCount(root);
  }

  return roots;
}

/**
 * Calculate depth for a category based on parent.
 */
async function calculateDepth(
  em: EntityManager,
  parentId: string | null | undefined,
): Promise<number> {
  if (!parentId) return 0;

  const parent = await em.findOne(PriceGuideCategory, { id: parentId });
  if (!parent) return 0;

  return parent.depth + 1;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /price-guide/categories
 * Get category tree for the company
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

      // Get all categories for company
      const categories = await em.find(
        PriceGuideCategory,
        { company: company.id, isActive: true },
        {
          orderBy: { depth: 'ASC', sortOrder: 'ASC' },
          populate: ['parent'],
        },
      );

      // Get MSI counts per category using raw SQL for reliability
      const msiCounts = await em
        .getConnection()
        .execute<{ category_id: string; count: string }[]>(
          `SELECT category_id, count(*)::text as count 
         FROM measure_sheet_item 
         WHERE company_id = ? AND is_active = true 
         GROUP BY category_id`,
          [company.id],
        );

      const msiCountMap = new Map<string, number>(
        msiCounts.map(r => [r.category_id, parseInt(r.count, 10)]),
      );

      const tree = buildCategoryTree(categories, msiCountMap);

      res.status(200).json({ categories: tree });
    } catch (err) {
      req.log.error({ err }, 'List categories error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/categories/:id
 * Get a single category by ID
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
        res.status(400).json({ error: 'Category ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const category = await em.findOne(
        PriceGuideCategory,
        { id, company: company.id },
        { populate: ['parent', 'lastModifiedBy'] },
      );

      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      // Get MSI count
      const msiCount = await em.count(MeasureSheetItem, {
        category: category.id,
        isActive: true,
      });

      // Build full path
      const pathParts: string[] = [category.name];
      let current = category;
      while (current.parent) {
        await em.populate(current, ['parent']);
        pathParts.unshift(current.parent.name);
        current = current.parent;
      }

      res.status(200).json({
        category: {
          id: category.id,
          name: category.name,
          depth: category.depth,
          sortOrder: category.sortOrder,
          parentId: category.parent?.id ?? null,
          fullPath: pathParts.join(' > '),
          categoryType: category.categoryType,
          msiCount,
          isActive: category.isActive,
          version: category.version,
          updatedAt: category.updatedAt,
          lastModifiedBy: category.lastModifiedBy
            ? {
                id: category.lastModifiedBy.id,
                email: category.lastModifiedBy.email,
                nameFirst: category.lastModifiedBy.nameFirst,
                nameLast: category.lastModifiedBy.nameLast,
              }
            : null,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get category error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/categories
 * Create a new category
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

      const { name, parentId, categoryType } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Validate parent exists if provided
      let parentRef: PriceGuideCategory | undefined;
      if (parentId) {
        const parent = await em.findOne(PriceGuideCategory, {
          id: parentId,
          company: company.id,
        });
        if (!parent) {
          res.status(400).json({ error: 'Parent category not found' });
          return;
        }
        parentRef = em.getReference(PriceGuideCategory, parentId);
      }

      // Check for duplicate name at same level
      const existing = await em.findOne(PriceGuideCategory, {
        name,
        company: company.id,
        parent: parentId ?? null,
      });
      if (existing) {
        res.status(409).json({
          error: 'Category name already exists',
          message: `A category with the name "${name}" already exists at this level.`,
        });
        return;
      }

      // Calculate depth and get next sort order
      const depth = await calculateDepth(em, parentId);
      const lastCategory = await em.findOne(
        PriceGuideCategory,
        { company: company.id, parent: parentId ?? null },
        { orderBy: { sortOrder: 'DESC' } },
      );
      const sortOrder = generateKeyBetween(
        lastCategory?.sortOrder ?? null,
        null,
      );

      const category = new PriceGuideCategory();
      category.name = name;
      category.company = em.getReference(Company, company.id);
      category.parent = parentRef;
      category.depth = depth;
      category.sortOrder = sortOrder;
      category.lastModifiedBy = em.getReference(User, user.id);
      // Only set categoryType for root categories (depth=0)
      if (depth === 0) {
        category.categoryType = categoryType as PriceGuideCategoryType;
      }

      await em.persistAndFlush(category);

      req.log.info(
        { categoryId: category.id, categoryName: name, userId: user.id },
        'Category created',
      );

      res.status(201).json({
        message: 'Category created successfully',
        category: {
          id: category.id,
          name: category.name,
          depth: category.depth,
          sortOrder: category.sortOrder,
          parentId: parentId ?? null,
          categoryType: category.categoryType,
          msiCount: 0,
          version: category.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create category error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/categories/:id
 * Update a category
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

      const { name, categoryType, version } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const category = await em.findOne(
        PriceGuideCategory,
        { id, company: company.id },
        { populate: ['parent', 'lastModifiedBy'] },
      );

      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      // Check optimistic locking
      if (category.version !== version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This category was modified by another user.',
          lastModifiedBy: category.lastModifiedBy
            ? {
                id: category.lastModifiedBy.id,
                email: category.lastModifiedBy.email,
                nameFirst: category.lastModifiedBy.nameFirst,
                nameLast: category.lastModifiedBy.nameLast,
              }
            : null,
          lastModifiedAt: category.updatedAt,
          currentVersion: category.version,
        });
        return;
      }

      // Check for duplicate name at same level
      if (name && name !== category.name) {
        const existing = await em.findOne(PriceGuideCategory, {
          name,
          company: company.id,
          parent: category.parent?.id ?? null,
          id: { $ne: id },
        });
        if (existing) {
          res.status(409).json({
            error: 'Category name already exists',
            message: `A category with the name "${name}" already exists at this level.`,
          });
          return;
        }
        category.name = name;
      }

      // Only allow categoryType changes for root categories (depth=0)
      if (categoryType && category.depth === 0) {
        category.categoryType = categoryType as PriceGuideCategoryType;
      }

      category.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { categoryId: category.id, userId: user.id },
        'Category updated',
      );

      res.status(200).json({
        message: 'Category updated successfully',
        category: {
          id: category.id,
          name: category.name,
          depth: category.depth,
          sortOrder: category.sortOrder,
          parentId: category.parent?.id ?? null,
          categoryType: category.categoryType,
          version: category.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update category error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/categories/:id
 * Soft delete a category (sets isActive = false)
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
        res.status(400).json({ error: 'Category ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const category = await em.findOne(PriceGuideCategory, {
        id,
        company: company.id,
      });

      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      // Check for MSIs assigned to this category
      const msiCount = await em.count(MeasureSheetItem, {
        category: category.id,
        isActive: true,
      });
      if (msiCount > 0) {
        res.status(409).json({
          error: 'Category has items',
          message: `Cannot delete category with ${msiCount} measure sheet item(s). Move or delete them first.`,
          msiCount,
        });
        return;
      }

      // Check for child categories
      const childCount = await em.count(PriceGuideCategory, {
        parent: category.id,
        isActive: true,
      });
      if (childCount > 0) {
        res.status(409).json({
          error: 'Category has children',
          message: `Cannot delete category with ${childCount} child category(ies). Delete them first.`,
          childCount,
        });
        return;
      }

      // Soft delete
      category.isActive = false;
      category.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        {
          categoryId: category.id,
          categoryName: category.name,
          userId: user.id,
        },
        'Category deleted',
      );

      res.status(200).json({
        message: 'Category deleted successfully',
      });
    } catch (err) {
      req.log.error({ err }, 'Delete category error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/categories/:id/move
 * Move a category to a new parent and/or reorder
 */
router.put(
  '/:id/move',
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

      const { newParentId, sortOrder } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const category = await em.findOne(
        PriceGuideCategory,
        { id, company: company.id },
        { populate: ['parent'] },
      );

      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      // Prevent moving to itself
      if (newParentId === id) {
        res.status(400).json({
          error: 'Invalid move',
          message: 'Cannot move a category to itself.',
        });
        return;
      }

      // Validate new parent if provided
      let newParentRef: PriceGuideCategory | null = null;
      if (newParentId) {
        const newParent = await em.findOne(PriceGuideCategory, {
          id: newParentId,
          company: company.id,
        });
        if (!newParent) {
          res.status(400).json({ error: 'New parent category not found' });
          return;
        }

        // Prevent circular reference (moving to a descendant)
        let checkParent: PriceGuideCategory | null = newParent;
        while (checkParent) {
          if (checkParent.id === id) {
            res.status(400).json({
              error: 'Invalid move',
              message: 'Cannot move a category to its own descendant.',
            });
            return;
          }
          await em.populate(checkParent, ['parent']);
          checkParent = checkParent.parent ?? null;
        }

        newParentRef = em.getReference(PriceGuideCategory, newParentId);
      }

      // Check for duplicate name at new level
      const existingAtLevel = await em.findOne(PriceGuideCategory, {
        name: category.name,
        company: company.id,
        parent: newParentId ?? null,
        id: { $ne: id },
      });
      if (existingAtLevel) {
        res.status(409).json({
          error: 'Category name already exists',
          message: `A category with the name "${category.name}" already exists at the target level.`,
        });
        return;
      }

      // Update category
      const oldParentId = category.parent?.id ?? null;
      category.parent = newParentRef ?? undefined;
      category.depth = await calculateDepth(em, newParentId);
      category.sortOrder = sortOrder;
      category.lastModifiedBy = em.getReference(User, user.id);

      // Update depth of all descendants if parent changed
      if (oldParentId !== newParentId) {
        const updateDescendantDepths = async (
          parentCat: PriceGuideCategory,
          parentDepth: number,
        ): Promise<void> => {
          const children = await em.find(PriceGuideCategory, {
            parent: parentCat.id,
            company: company.id,
          });
          for (const child of children) {
            child.depth = parentDepth + 1;
            await updateDescendantDepths(child, child.depth);
          }
        };
        await updateDescendantDepths(category, category.depth);
      }

      await em.flush();

      req.log.info(
        {
          categoryId: category.id,
          oldParentId,
          newParentId,
          sortOrder,
          userId: user.id,
        },
        'Category moved',
      );

      res.status(200).json({
        message: 'Category moved successfully',
        category: {
          id: category.id,
          name: category.name,
          depth: category.depth,
          sortOrder: category.sortOrder,
          parentId: newParentId ?? null,
          version: category.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Move category error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
