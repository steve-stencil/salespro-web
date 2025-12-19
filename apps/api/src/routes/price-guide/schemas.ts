import { z } from 'zod';

// ============================================================================
// Price Guide Category Schemas
// ============================================================================

/**
 * Schema for creating a new price guide category.
 */
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  parentId: z.string().uuid('Invalid parent ID').nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for updating a price guide category.
 */
export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().uuid('Invalid parent ID').nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for moving a category to a new parent.
 */
export const moveCategorySchema = z.object({
  parentId: z.string().uuid('Invalid parent ID').nullable(),
});

/**
 * Schema for batch reordering categories.
 */
export const reorderCategoriesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid('Invalid category ID'),
      sortOrder: z.number().int().min(0),
    }),
  ),
});

/**
 * Schema for assigning offices to a root category.
 */
export const assignOfficesSchema = z.object({
  officeIds: z.array(z.string().uuid('Invalid office ID')).min(1),
});

// ============================================================================
// Measure Sheet Item Schemas
// ============================================================================

/**
 * Schema for creating a new measure sheet item.
 */
export const createItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less'),
  description: z.string().max(2000).nullable().optional(),
  categoryId: z.string().uuid('Invalid category ID'),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for updating a measure sheet item.
 */
export const updateItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
