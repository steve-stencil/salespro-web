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
  /** Direct MSI count for this category only */
  directMsiCount: number;
  /** Total MSI count including all descendant categories */
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
  /** Presigned URL for product thumbnail (full size) */
  imageUrl: string | null;
  /** Presigned URL for product thumbnail (thumbnail size) */
  thumbnailUrl: string | null;
  isActive: boolean;
};

/** UpCharge detail response */
export type UpChargeDetail = {
  id: string;
  name: string;
  note: string | null;
  measurementType: string | null;
  identifier: string | null;
  /** File ID for the thumbnail image */
  imageId: string | null;
  /** Presigned URL for product thumbnail (full size) */
  imageUrl: string | null;
  /** Presigned URL for product thumbnail (thumbnail size) */
  thumbnailUrl: string | null;
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
  /** MSIs using this additional detail (for detail view) */
  usedByMSIs?: Array<{
    id: string;
    name: string;
    category: string;
  }>;
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
  /** Names of linked offices (for tooltip display) */
  officeNames?: string[];
  /** Names of linked options (for tooltip display) */
  optionNames?: string[];
  /** Names of linked upcharges (for tooltip display) */
  upchargeNames?: string[];
  /** Presigned URL for product thumbnail (full size) */
  imageUrl: string | null;
  /** Presigned URL for product thumbnail (thumbnail size) */
  thumbnailUrl: string | null;
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
  /** File ID for the thumbnail image */
  imageId: string | null;
  /** Presigned URL for product thumbnail (full size) */
  imageUrl: string | null;
  /** Presigned URL for product thumbnail (thumbnail size) */
  thumbnailUrl: string | null;
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

// ============================================================================
// UpCharge Pricing Configuration Types (Mixed Mode Support)
// ============================================================================

/** Pricing mode for a single price type */
export type UpChargePriceTypeMode = 'fixed' | 'percentage';

/** Mode for option override - includes 'use_default' */
export type UpChargeOverrideMode = 'fixed' | 'percentage' | 'use_default';

/** Price configuration for a single price type */
export type UpChargePriceTypeConfig = {
  priceTypeId: string;
  mode: UpChargePriceTypeMode;
  /** Fixed amount (when mode='fixed'), keyed by officeId */
  fixedAmounts?: Record<string, number>;
  /** Percentage rate as decimal, e.g. 0.10 = 10% (when mode='percentage') */
  percentageRate?: number;
  /** Price type IDs to include in percentage base calculation */
  percentageBaseTypeIds?: string[];
};

/** Price configuration for option override */
export type UpChargeOverridePriceTypeConfig = {
  priceTypeId: string;
  mode: UpChargeOverrideMode;
  /** Fixed amount (when mode='fixed'), keyed by officeId */
  fixedAmounts?: Record<string, number>;
  /** Percentage rate as decimal (when mode='percentage') */
  percentageRate?: number;
  /** Price type IDs to include in percentage base calculation */
  percentageBaseTypeIds?: string[];
};

/** Single price entry from API response */
export type UpChargePriceData = {
  amount: number;
  isPercentage: boolean;
  percentageBaseTypeIds: string[];
};

/** Office pricing data from API response */
export type UpChargeOfficePricing = {
  office: { id: string; name: string };
  prices: Record<string, UpChargePriceData>;
};

/** Option override pricing data from API response (global option override) */
export type UpChargeOptionOverride = {
  option: { id: string; name: string };
  byOffice: Record<string, UpChargeOfficePricing>;
};

/** MSI+Option override pricing data from API response */
export type UpChargeMsiOptionOverride = {
  msi: { id: string; name: string };
  option: { id: string; name: string };
  byOffice: Record<string, UpChargeOfficePricing>;
};

/** Linked MSI with its options */
export type LinkedMsiWithOptions = {
  id: string;
  name: string;
  options: Array<{ id: string; name: string }>;
};

/** Full upcharge pricing response from API */
export type UpChargePricingDetail = {
  upcharge: {
    id: string;
    name: string;
    note: string | null;
    measurementType: string | null;
    version: number;
  };
  priceTypes: Array<{
    id: string;
    code: string;
    name: string;
    sortOrder: number;
  }>;
  /** Default pricing (applies when no overrides exist) */
  defaultPricing: UpChargeOfficePricing[];
  /** Global option overrides (apply across all MSIs) */
  globalOptionOverrides: UpChargeOptionOverride[];
  /** MSI+Option specific overrides */
  msiOptionOverrides: UpChargeMsiOptionOverride[];
  /** Options that can have overrides (from MSIs linked to this upcharge) */
  linkedOptions: Array<{ id: string; name: string }>;
  /** MSIs linked to this upcharge with their options */
  linkedMsis: LinkedMsiWithOptions[];
};

/** Request to update default prices for one office */
export type UpdateUpChargeDefaultPricesRequest = {
  officeId: string;
  prices: Array<{
    priceTypeId: string;
    amount: number;
    isPercentage: boolean;
    percentageBaseTypeIds?: string[];
  }>;
  version: number;
};

/** Request to update global option override prices */
export type UpdateUpChargeOverridePricesRequest = {
  optionId: string;
  officeId: string;
  prices: Array<{
    priceTypeId: string;
    amount: number;
    isPercentage: boolean;
    percentageBaseTypeIds?: string[];
  }>;
  version: number;
};

/** Request to update MSI+Option specific override prices */
export type UpdateUpChargeMsiOverridePricesRequest = {
  msiId: string;
  optionId: string;
  officeId?: string; // Optional - if not provided, applies to all offices
  prices: Array<{
    priceTypeId: string;
    amount: number;
    isPercentage: boolean;
    percentageBaseTypeIds?: string[];
  }>;
  version: number;
};

/** Request to delete MSI+Option override */
export type DeleteUpChargeMsiOverrideRequest = {
  msiId: string;
  optionId: string;
  officeId?: string; // Optional - if not provided, deletes all office configs
};

/**
 * Derives the display mode for an upcharge based on its pricing configuration.
 * Returns 'All Fixed', 'All X% of Y', or 'Mixed'
 */
export type UpChargeModeDisplay =
  | { type: 'all_fixed' }
  | { type: 'all_percentage'; rate: number; baseTypes: string[] }
  | { type: 'mixed' }
  | { type: 'none' };

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
  categoryIds?: string[];
  officeIds?: string[];
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
  /** File ID for product thumbnail image */
  imageId?: string;
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
  /** File ID for product thumbnail image (null to remove) */
  imageId?: string | null;
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

/** Additional detail field detail response */
export type AdditionalDetailFieldDetailResponse = {
  field: AdditionalDetailFieldDetail;
};

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
