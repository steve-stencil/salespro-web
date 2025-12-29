/**
 * Price Guide types shared between API and web applications.
 * These types define the contract for price-guide-related API endpoints.
 */

// ============================================================================
// Enums
// ============================================================================

/** Measurement types for MSIs and options */
export type MeasurementType =
  | 'each'
  | 'sqft'
  | 'linear_ft'
  | 'united_inches'
  | 'pair';

/** Input types for additional detail fields */
export type AdditionalDetailInputType =
  | 'text'
  | 'number'
  | 'picker'
  | 'date'
  | 'toggle';

// ============================================================================
// Category Types
// ============================================================================

/** Category reference (minimal) */
export type CategoryRef = {
  id: string;
  name: string;
  fullPath: string;
};

/** Category in tree structure */
export type CategoryTreeNode = {
  id: string;
  name: string;
  depth: number;
  sortOrder: number;
  parentId: string | null;
  msiCount: number;
  children: CategoryTreeNode[];
};

/** Category detail response */
export type CategoryDetail = {
  id: string;
  name: string;
  depth: number;
  sortOrder: number;
  parentId: string | null;
  fullPath: string;
  msiCount: number;
  isActive: boolean;
  version: number;
  lastModifiedBy?: {
    id: string;
    name: string;
  };
  lastModifiedAt?: string;
};

// ============================================================================
// Option Types
// ============================================================================

/** Option summary for lists */
export type OptionSummary = {
  id: string;
  name: string;
  brand: string | null;
  itemCode: string | null;
  measurementType: string | null;
  linkedMsiCount: number;
  isActive: boolean;
};

/** Option detail response */
export type OptionDetail = {
  id: string;
  name: string;
  brand: string | null;
  itemCode: string | null;
  measurementType: string | null;
  linkedMsiCount: number;
  isActive: boolean;
  version: number;
  usedByMSIs: Array<{
    id: string;
    name: string;
    categoryName: string;
  }>;
  lastModifiedBy?: {
    id: string;
    name: string;
  };
  lastModifiedAt?: string;
};

/** Option linked to an MSI */
export type LinkedOption = {
  junctionId: string;
  optionId: string;
  name: string;
  brand: string | null;
  itemCode: string | null;
  measurementType: string | null;
  sortOrder: number;
};

// ============================================================================
// UpCharge Types
// ============================================================================

/** UpCharge summary for lists */
export type UpChargeSummary = {
  id: string;
  name: string;
  note: string | null;
  measurementType: string | null;
  identifier: string | null;
  linkedMsiCount: number;
  isActive: boolean;
};

/** UpCharge detail response */
export type UpChargeDetail = {
  id: string;
  name: string;
  note: string | null;
  measurementType: string | null;
  identifier: string | null;
  imageUrl: string | null;
  linkedMsiCount: number;
  isActive: boolean;
  version: number;
  usedByMSIs: Array<{
    id: string;
    name: string;
    categoryName: string;
  }>;
  disabledOptions: Array<{
    id: string;
    name: string;
  }>;
  lastModifiedBy?: {
    id: string;
    name: string;
  };
  lastModifiedAt?: string;
};

/** UpCharge linked to an MSI */
export type LinkedUpCharge = {
  junctionId: string;
  upchargeId: string;
  name: string;
  note: string | null;
  measurementType: string | null;
  sortOrder: number;
};

// ============================================================================
// Additional Detail Field Types
// ============================================================================

/** Additional detail field summary */
export type AdditionalDetailFieldSummary = {
  id: string;
  title: string;
  inputType: AdditionalDetailInputType;
  isRequired: boolean;
  linkedMsiCount: number;
  isActive: boolean;
};

/** Additional detail field detail */
export type AdditionalDetailFieldDetail = {
  id: string;
  title: string;
  inputType: AdditionalDetailInputType;
  isRequired: boolean;
  placeholder: string | null;
  note: string | null;
  defaultValue: string | null;
  pickerValues: string[] | null;
  numericMin: number | null;
  numericMax: number | null;
  numericStep: number | null;
  numericUnit: string | null;
  dateDisplayFormat: string | null;
  notAddedReplacement: string | null;
  linkedMsiCount: number;
  isActive: boolean;
  version: number;
};

/** Additional detail linked to an MSI */
export type LinkedAdditionalDetail = {
  junctionId: string;
  fieldId: string;
  title: string;
  inputType: AdditionalDetailInputType;
  isRequired: boolean;
  sortOrder: number;
};

// ============================================================================
// Measure Sheet Item Types
// ============================================================================

/** MSI summary for catalog list */
export type MeasureSheetItemSummary = {
  id: string;
  name: string;
  category: CategoryRef;
  /** Measurement type - free-form string (e.g., "each", "sqft", "United Inches") */
  measurementType: string;
  officeCount: number;
  optionCount: number;
  upchargeCount: number;
  imageUrl: string | null;
  sortOrder: number;
};

/** MSI detail response */
export type MeasureSheetItemDetail = {
  id: string;
  name: string;
  category: CategoryRef;
  measurementType: string;
  note: string | null;
  defaultQty: number;
  showSwitch: boolean;
  formulaId: string | null;
  qtyFormula: string | null;
  tagTitle: string | null;
  tagRequired: boolean;
  tagPickerOptions: unknown[] | null;
  tagParams: Record<string, unknown> | null;
  imageUrl: string | null;
  sortOrder: number;
  offices: Array<{
    id: string;
    name: string;
  }>;
  options: LinkedOption[];
  upcharges: LinkedUpCharge[];
  additionalDetails: LinkedAdditionalDetail[];
  isActive: boolean;
  version: number;
  lastModifiedBy?: {
    id: string;
    name: string;
  };
  lastModifiedAt?: string;
};

// ============================================================================
// Price Types
// ============================================================================

/** Price object type (MATERIAL, LABOR, TAX, OTHER, custom) */
export type PriceType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isGlobal: boolean;
  isActive: boolean;
};

/** Single price entry */
export type PriceEntry = {
  priceTypeId: string;
  priceTypeCode: string;
  priceTypeName: string;
  amount: number;
  effectiveDate: string | null;
};

/** Option pricing for an office */
export type OptionPricing = {
  optionId: string;
  optionName: string;
  officeId: string;
  officeName: string;
  prices: PriceEntry[];
};

/** UpCharge pricing (default or option-specific) */
export type UpChargePricing = {
  upchargeId: string;
  upchargeName: string;
  officeId: string;
  officeName: string;
  optionId: string | null;
  optionName: string | null;
  prices: PriceEntry[];
  isPercentage: boolean;
};

/** Pricing grid row (for UI display) */
export type PricingGridRow = {
  officeId: string;
  officeName: string;
  prices: Record<string, number>; // priceTypeCode -> amount
};

// ============================================================================
// API Request Types
// ============================================================================

/** Cursor-based pagination params */
export type CursorPaginationParams = {
  cursor?: string;
  limit?: number;
  search?: string;
};

/** MSI list query params */
export type MsiListParams = CursorPaginationParams & {
  categoryId?: string;
  officeId?: string;
};

/** Library list query params */
export type LibraryListParams = CursorPaginationParams & {
  // Additional filters can be added
};

/** Create MSI request */
/**
 * Create MSI request.
 * Note: optionIds is required - at least one option is needed for pricing.
 * See ADR-003.
 */
export type CreateMsiRequest = {
  name: string;
  categoryId: string;
  measurementType: string;
  note?: string;
  defaultQty?: number;
  showSwitch?: boolean;
  formulaId?: string;
  qtyFormula?: string;
  tagTitle?: string;
  tagRequired?: boolean;
  tagPickerOptions?: unknown[];
  tagParams?: Record<string, unknown>;
  officeIds: string[];
  /** Required: At least one option is required for pricing. */
  optionIds: string[];
  upchargeIds?: string[];
  additionalDetailFieldIds?: string[];
};

/** Update MSI request */
export type UpdateMsiRequest = {
  name?: string;
  categoryId?: string;
  measurementType?: string;
  note?: string | null;
  defaultQty?: number;
  showSwitch?: boolean;
  formulaId?: string | null;
  qtyFormula?: string | null;
  tagTitle?: string | null;
  tagRequired?: boolean;
  tagPickerOptions?: unknown[] | null;
  tagParams?: Record<string, unknown> | null;
  version: number;
};

/** Link options/upcharges request */
export type LinkItemsRequest = {
  optionIds?: string[];
  upchargeIds?: string[];
};

/** Link result response */
export type LinkResult = {
  linked: number;
  skipped: number;
  message: string;
};

// ============================================================================
// API Response Types
// ============================================================================

/** Cursor-paginated list response */
export type CursorPaginatedResponse<T> = {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  total: number;
};

/** Category tree response */
export type CategoryTreeResponse = {
  categories: CategoryTreeNode[];
};

/** MSI list response */
export type MsiListResponse = CursorPaginatedResponse<MeasureSheetItemSummary>;

/** MSI detail response */
export type MsiDetailResponse = {
  item: MeasureSheetItemDetail;
};

/** Option list response */
export type OptionListResponse = CursorPaginatedResponse<OptionSummary>;

/** Option detail response */
export type OptionDetailResponse = {
  option: OptionDetail;
};

/** UpCharge list response */
export type UpChargeListResponse = CursorPaginatedResponse<UpChargeSummary>;

/** UpCharge detail response */
export type UpChargeDetailResponse = {
  upcharge: UpChargeDetail;
};

/** Additional detail field list response */
export type AdditionalDetailFieldListResponse =
  CursorPaginatedResponse<AdditionalDetailFieldSummary>;

/** Price types response */
export type PriceTypesResponse = {
  priceTypes: PriceType[];
};

/** Option pricing response */
export type OptionPricingResponse = {
  pricing: OptionPricing[];
};

/** UpCharge pricing response */
export type UpChargePricingResponse = {
  pricing: UpChargePricing[];
};

// ============================================================================
// Mutation Response Types
// ============================================================================

/** Generic success response */
export type SuccessResponse = {
  message: string;
};

/** Create response with ID */
export type CreateResponse = {
  message: string;
  id: string;
};

/** Update response with version */
export type UpdateResponse = {
  message: string;
  version: number;
};

/** Concurrent modification error */
export type ConcurrentModificationError = {
  error: 'CONCURRENT_MODIFICATION';
  message: string;
  currentVersion: number;
  lastModifiedBy?: {
    id: string;
    name: string;
  };
  lastModifiedAt?: string;
};
