/**
 * Shared types for Price Guide Categories and Measure Sheet Items.
 * These types are used for API request/response consistency between API and web.
 */

// ============================================================================
// Price Guide Category Types
// ============================================================================

/**
 * Base price guide category fields.
 */
export type PriceGuideCategoryBase = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Price guide category list item (flat representation).
 */
export type PriceGuideCategoryListItem = PriceGuideCategoryBase & {
  childCount: number;
  itemCount: number;
};

/**
 * Price guide category with nested children (tree representation).
 */
export type PriceGuideCategoryTreeNode = PriceGuideCategoryBase & {
  children: PriceGuideCategoryTreeNode[];
  itemCount: number;
};

/**
 * Request body for creating a price guide category.
 */
export type CreatePriceGuideCategoryRequest = {
  name: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

/**
 * Request body for updating a price guide category.
 */
export type UpdatePriceGuideCategoryRequest = {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

/**
 * Response for price guide category list endpoint.
 */
export type PriceGuideCategoryListResponse = {
  categories: PriceGuideCategoryListItem[];
};

/**
 * Response for price guide category tree endpoint.
 */
export type PriceGuideCategoryTreeResponse = {
  categories: PriceGuideCategoryTreeNode[];
};

/**
 * Response for single price guide category.
 */
export type PriceGuideCategoryResponse = {
  category: PriceGuideCategoryListItem;
};

/**
 * Response for price guide category create/update operations.
 */
export type PriceGuideCategoryMutationResponse = {
  message: string;
  category: PriceGuideCategoryListItem;
};

// ============================================================================
// Measure Sheet Item Types
// ============================================================================

/**
 * Base measure sheet item fields.
 */
export type MeasureSheetItemBase = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Measure sheet item list item.
 */
export type MeasureSheetItemListItem = MeasureSheetItemBase & {
  categoryName: string;
};

/**
 * Request body for creating a measure sheet item.
 */
export type CreateMeasureSheetItemRequest = {
  name: string;
  description?: string | null;
  categoryId: string;
  sortOrder?: number;
  isActive?: boolean;
};

/**
 * Request body for updating a measure sheet item.
 */
export type UpdateMeasureSheetItemRequest = {
  name?: string;
  description?: string | null;
  categoryId?: string;
  sortOrder?: number;
  isActive?: boolean;
};

/**
 * Response for measure sheet item list endpoint.
 */
export type MeasureSheetItemListResponse = {
  items: MeasureSheetItemListItem[];
};

/**
 * Response for single measure sheet item.
 */
export type MeasureSheetItemResponse = {
  item: MeasureSheetItemListItem;
};

/**
 * Response for measure sheet item create/update operations.
 */
export type MeasureSheetItemMutationResponse = {
  message: string;
  item: MeasureSheetItemListItem;
};
