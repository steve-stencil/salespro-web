/**
 * Price guide types shared between API and web applications.
 * These types define the contract for price guide management API endpoints.
 */

import type { Pagination, PaginationParams } from './api/pagination';

// ============================================================================
// Enum Types
// ============================================================================

/** Status of a price guide */
export type PriceGuideStatus = 'draft' | 'active' | 'archived';

/** Status of a price guide item */
export type PriceGuideItemStatus = 'active' | 'inactive' | 'discontinued';

/** Pricing type for a price guide item */
export type PricingType = 'fixed' | 'hourly' | 'per_unit' | 'variable';

// ============================================================================
// Price Guide Types
// ============================================================================

/** Price guide basic info for lists */
export type PriceGuideBasic = {
  id: string;
  name: string;
  status: PriceGuideStatus;
  isDefault: boolean;
  currency: string;
};

/** Full price guide details */
export type PriceGuide = PriceGuideBasic & {
  description?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  createdAt: string;
  updatedAt: string;
  /** Count of categories (optional, included in some responses) */
  categoryCount?: number;
  /** Count of items (optional, included in some responses) */
  itemCount?: number;
};

// ============================================================================
// Price Guide Category Types
// ============================================================================

/** Category basic info */
export type PriceGuideCategoryBasic = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

/** Full category details */
export type PriceGuideCategory = PriceGuideCategoryBasic & {
  description?: string;
  priceGuideId: string;
  parentCategoryId?: string;
  createdAt: string;
  updatedAt: string;
  /** Count of items in this category (optional) */
  itemCount?: number;
  /** Child categories for hierarchical display (optional) */
  children?: PriceGuideCategory[];
};

// ============================================================================
// Price Guide Item Types
// ============================================================================

/** Item basic info for lists */
export type PriceGuideItemBasic = {
  id: string;
  name: string;
  sku?: string;
  price: string;
  pricingType: PricingType;
  status: PriceGuideItemStatus;
};

/** Full item details */
export type PriceGuideItem = PriceGuideItemBasic & {
  description?: string;
  categoryId: string;
  minPrice?: string;
  maxPrice?: string;
  cost?: string;
  unit?: string;
  taxable: boolean;
  sortOrder: number;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
  /** Category info (optional, included in some responses) */
  category?: PriceGuideCategoryBasic;
};

// ============================================================================
// Price Guide API Response Types
// ============================================================================

/** Price guides list response */
export type PriceGuidesListResponse = {
  priceGuides: PriceGuide[];
  pagination: Pagination;
};

/** Price guide detail response */
export type PriceGuideDetailResponse = {
  priceGuide: PriceGuide;
};

/** Price guide create/update response */
export type PriceGuideMutationResponse = {
  message: string;
  priceGuide: PriceGuide;
};

/** Price guide delete response */
export type PriceGuideDeleteResponse = {
  message: string;
};

// ============================================================================
// Category API Response Types
// ============================================================================

/** Categories list response */
export type PriceGuideCategoriesListResponse = {
  categories: PriceGuideCategory[];
};

/** Category tree response (hierarchical) */
export type PriceGuideCategoryTreeResponse = {
  categories: PriceGuideCategory[];
};

/** Category detail response */
export type PriceGuideCategoryDetailResponse = {
  category: PriceGuideCategory;
};

/** Category create/update response */
export type PriceGuideCategoryMutationResponse = {
  message: string;
  category: PriceGuideCategory;
};

/** Category delete response */
export type PriceGuideCategoryDeleteResponse = {
  message: string;
  /** Number of items moved to uncategorized or deleted */
  itemsAffected: number;
};

// ============================================================================
// Item API Response Types
// ============================================================================

/** Items list response */
export type PriceGuideItemsListResponse = {
  items: PriceGuideItem[];
  pagination: Pagination;
};

/** Item detail response */
export type PriceGuideItemDetailResponse = {
  item: PriceGuideItem;
};

/** Item create/update response */
export type PriceGuideItemMutationResponse = {
  message: string;
  item: PriceGuideItem;
};

/** Item delete response */
export type PriceGuideItemDeleteResponse = {
  message: string;
};

/** Bulk items action response */
export type PriceGuideItemsBulkResponse = {
  message: string;
  affected: number;
};

// ============================================================================
// Price Guide API Request Types
// ============================================================================

/** Price guides list query params */
export type PriceGuidesListParams = PaginationParams & {
  status?: PriceGuideStatus;
  search?: string;
};

/** Create price guide request */
export type CreatePriceGuideRequest = {
  name: string;
  description?: string;
  status?: PriceGuideStatus;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
  currency?: string;
};

/** Update price guide request */
export type UpdatePriceGuideRequest = {
  name?: string;
  description?: string;
  status?: PriceGuideStatus;
  isDefault?: boolean;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  currency?: string;
};

// ============================================================================
// Category API Request Types
// ============================================================================

/** Create category request */
export type CreatePriceGuideCategoryRequest = {
  name: string;
  description?: string;
  parentCategoryId?: string;
  sortOrder?: number;
  isActive?: boolean;
};

/** Update category request */
export type UpdatePriceGuideCategoryRequest = {
  name?: string;
  description?: string;
  parentCategoryId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

/** Reorder categories request */
export type ReorderCategoriesRequest = {
  /** Array of category IDs in the desired order */
  categoryIds: string[];
};

// ============================================================================
// Item API Request Types
// ============================================================================

/** Items list query params */
export type PriceGuideItemsListParams = PaginationParams & {
  categoryId?: string;
  status?: PriceGuideItemStatus;
  pricingType?: PricingType;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
};

/** Create item request */
export type CreatePriceGuideItemRequest = {
  name: string;
  description?: string;
  sku?: string;
  categoryId: string;
  pricingType?: PricingType;
  price: string;
  minPrice?: string;
  maxPrice?: string;
  cost?: string;
  unit?: string;
  taxable?: boolean;
  status?: PriceGuideItemStatus;
  sortOrder?: number;
  internalNotes?: string;
};

/** Update item request */
export type UpdatePriceGuideItemRequest = {
  name?: string;
  description?: string;
  sku?: string | null;
  categoryId?: string;
  pricingType?: PricingType;
  price?: string;
  minPrice?: string | null;
  maxPrice?: string | null;
  cost?: string | null;
  unit?: string | null;
  taxable?: boolean;
  status?: PriceGuideItemStatus;
  sortOrder?: number;
  internalNotes?: string | null;
};

/** Bulk update items status request */
export type BulkUpdateItemsStatusRequest = {
  itemIds: string[];
  status: PriceGuideItemStatus;
};

/** Bulk move items to category request */
export type BulkMoveItemsRequest = {
  itemIds: string[];
  categoryId: string;
};
