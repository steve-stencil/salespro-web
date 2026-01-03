/**
 * ETL Service Types
 *
 * Types for ETL (Extract, Transform, Load) operations
 * for migrating data from a legacy MongoDB system.
 */

// ============================================================================
// OFFICE TYPES
// ============================================================================

/**
 * Raw source Office object structure from legacy MongoDB.
 */
export type RawSourceOffice = {
  objectId: string;
  name?: string;
  /** Extracted company objectId from _p_company pointer */
  sourceCompanyId?: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Transformed office data ready for database insertion.
 */
export type TransformedOfficeData = {
  /** Source objectId from legacy system */
  sourceId: string;
  /** Office name */
  name: string;
  /** Source company objectId (for reference) */
  sourceCompanyId?: string;
};

/**
 * Source office for mapping UI.
 */
export type LegacySourceOffice = {
  objectId: string;
  name: string;
};

/**
 * Batch import options.
 */
export type BatchImportOptions = {
  /** Company ID to import into */
  companyId: string;
  /** Skip count for pagination (used when sourceIds not provided) */
  skip: number;
  /** Limit for batch size (used when sourceIds not provided) */
  limit: number;
  /** Migration session ID */
  sessionId: string;
  /** User ID who initiated the import */
  userId: string;
  /** Optional list of specific source IDs to import (if provided, skip/limit are ignored) */
  sourceIds?: string[];
};

/**
 * Batch import result.
 */
export type BatchImportResult = {
  /** Number of items imported in this batch */
  importedCount: number;
  /** Number of items skipped (already exist) */
  skippedCount: number;
  /** Number of items that failed */
  errorCount: number;
  /** Error details */
  errors: Array<{ sourceId: string; error: string }>;
  /** Whether there are more items to import */
  hasMore: boolean;
};

/**
 * Generic source item for migration preview.
 * All collection-specific source items extend this.
 */
export type SourceItem = {
  objectId: string;
  name: string;
};

/**
 * Result from fetching source items.
 */
export type FetchSourceResult = {
  items: SourceItem[];
  total: number;
};

/**
 * Base interface for all ETL services.
 * Ensures consistent API across different collection types.
 */
export type BaseEtlService = {
  /** Check if source database is configured */
  isSourceConfigured(): boolean;
  /** Fetch source items for preview */
  fetchSourceItems(skip: number, limit: number): Promise<FetchSourceResult>;
  /** Get total source count */
  getSourceCount(): Promise<number>;
  /** Create a new migration session */
  createSession(companyId: string, userId: string): Promise<{ id: string }>;
  /** Get migration session by ID */
  getSession(
    sessionId: string,
    companyId: string,
  ): Promise<{ id: string } | null>;
  /** Import a batch of items */
  importBatch(options: BatchImportOptions): Promise<BatchImportResult>;
};

/**
 * ETL Service error codes.
 */
export enum EtlErrorCode {
  SOURCE_CONNECTION_FAILED = 'SOURCE_CONNECTION_FAILED',
  SOURCE_QUERY_FAILED = 'SOURCE_QUERY_FAILED',
  SOURCE_COMPANY_NOT_FOUND = 'SOURCE_COMPANY_NOT_FOUND',
  TRANSFORM_FAILED = 'TRANSFORM_FAILED',
  IMPORT_FAILED = 'IMPORT_FAILED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID_STATE = 'SESSION_INVALID_STATE',
  UNSUPPORTED_COLLECTION = 'UNSUPPORTED_COLLECTION',
}

/**
 * ETL Service error.
 */
export class EtlServiceError extends Error {
  constructor(
    message: string,
    public readonly code: EtlErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EtlServiceError';
  }
}

// ============================================================================
// PRICE GUIDE RAW SOURCE TYPES (from MongoDB)
// ============================================================================

/**
 * Legacy additional detail object embedded in MSIs and PGIs.
 * Maps to AdditionalDetailField entity in new schema.
 */
export type LegacyAdditionalDetailObject = {
  objectId: string;
  title: string;
  inputType: string;
  cellType?: string;
  required?: boolean;
  shouldCopy?: boolean;
  placeholder?: string;
  note?: string;
  defaultValue?: string | string[];
  notAddedReplacement?: string;
  pickerValues?: string[];
  dateDisplayFormat?: string;
  minSizePickerWidth?: number;
  maxSizePickerWidth?: number;
  minSizePickerHeight?: number;
  maxSizePickerHeight?: number;
  minSizePickerDepth?: number;
  maxSizePickerDepth?: number;
  unitedInchSuffix?: string;
  disableTemplatePhotoLinking?: boolean;
};

/**
 * Legacy category configuration from CustomConfig.categories_.
 * Defines root-level category organization and display types.
 */
export type LegacyCategoryConfig = {
  name: string;
  order: number;
  type: 'default' | 'detail' | 'deep_drill_down';
  objectId?: string;
  isLocked?: boolean;
};

/**
 * Legacy placeholder replacement configuration.
 */
export type LegacyPlaceholder = {
  placeholder: string;
  replacement: string;
};

/**
 * Parse file reference from legacy MongoDB.
 */
export type LegacyFileReference = {
  __type: 'File';
  name: string;
  url: string;
};

/**
 * Raw source SSMeasureSheetItem from legacy MongoDB.
 * Maps to MeasureSheetItem entity in new schema.
 */
export type RawSourceMSI = {
  objectId: string;
  itemName?: string;
  itemNote?: string;
  category?: string;
  subCategory?: string;
  subSubCategories?: string;
  measurementType?: string;
  orderNumber_?: number;
  shouldShowSwitch?: boolean;
  defaultQty?: number;
  formulaID?: string;
  qtyFormula?: string;
  image?: LegacyFileReference;
  /** Linked PGI objectIds (Options) */
  items?: Array<{ objectId: string }>;
  /** Linked PGI objectIds (UpCharges/Accessories) */
  accessories?: Array<{ objectId: string }>;
  /** Office objectIds that can see this item */
  includedOffices?: Array<{ objectId: string }>;
  /** Embedded additional detail fields */
  additionalDetailObjects?: LegacyAdditionalDetailObject[];
  /** Custom tag field configuration */
  tagTitle?: string;
  tagInputType?: string;
  tagRequired?: boolean;
  tagPickerOptions?: string[];
  tagParams?: Record<string, unknown>;
  /** Placeholder replacements */
  placeholders?: LegacyPlaceholder[];
  sourceCompanyId?: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Legacy item price entry (per office).
 */
export type LegacyItemPrice = {
  officeId: string;
  total: number;
};

/**
 * Legacy accessory/upcharge price entry with option-specific totals.
 */
export type LegacyAccessoryPrice = {
  priceGuideItemId: string;
  itemTotals: LegacyItemPrice[];
};

/**
 * Raw source SSPriceGuideItem from legacy MongoDB.
 * Maps to either PriceGuideOption (isAccessory=false) or UpCharge (isAccessory=true).
 */
export type RawSourcePGI = {
  objectId: string;
  isAccessory: boolean;
  // Option fields (isAccessory=false)
  displayTitle?: string;
  subCategory2?: string;
  itemPrices?: LegacyItemPrice[];
  itemCodes?: Record<string, string>;
  // UpCharge fields (isAccessory=true)
  name?: string;
  info?: string;
  identifier?: string;
  accessoryPrices?: LegacyAccessoryPrice[];
  percentagePrice?: boolean;
  disabledParents?: string[];
  additionalDetails?: LegacyAdditionalDetailObject[];
  /** Placeholder replacements */
  placeholders?: LegacyPlaceholder[];
  sourceCompanyId?: string;
  createdAt?: string;
  updatedAt?: string;
};

// ============================================================================
// PRICE GUIDE TRANSFORMED TYPES
// ============================================================================

/**
 * Transformed category data ready for database insertion.
 */
export type TransformedCategoryData = {
  name: string;
  categoryType: 'default' | 'detail' | 'deep_drill_down';
  sortOrder: string;
  depth: number;
  sourceId?: string;
  parentSourceId?: string;
};

/**
 * Transformed MSI data ready for database insertion.
 */
export type TransformedMsiData = {
  sourceId: string;
  name: string;
  note?: string;
  measurementType: string;
  formulaId?: string;
  qtyFormula?: string;
  defaultQty: number;
  showSwitch: boolean;
  sortOrder: string;
  categoryPath: string[];
  linkedOptionSourceIds: string[];
  linkedUpChargeSourceIds: string[];
  linkedOfficeSourceIds: string[];
  additionalDetails: LegacyAdditionalDetailObject[];
  image?: LegacyFileReference;
};

/**
 * Transformed Option data ready for database insertion.
 */
export type TransformedOptionData = {
  sourceId: string;
  name: string;
  itemCode?: string;
  prices: Array<{
    officeSourceId: string;
    amount: number;
  }>;
};

/**
 * Transformed UpCharge data ready for database insertion.
 */
export type TransformedUpChargeData = {
  sourceId: string;
  name: string;
  note?: string;
  identifier?: string;
  isPercentage: boolean;
  disabledOptionSourceIds: string[];
  additionalDetails: LegacyAdditionalDetailObject[];
  defaultPrices: Array<{
    officeSourceId: string;
    amount: number;
  }>;
  optionPrices: Array<{
    optionSourceId: string;
    prices: Array<{
      officeSourceId: string;
      amount: number;
    }>;
  }>;
};

// ============================================================================
// PRICE GUIDE BATCH IMPORT TYPES
// ============================================================================

/**
 * Price guide batch import options.
 */
export type PriceGuideBatchImportOptions = BatchImportOptions & {
  /** Whether to include images in import */
  includeImages?: boolean;
  /** Whether to validate formulas */
  validateFormulas?: boolean;
};

/**
 * Price guide batch import result with detailed counts.
 */
export type PriceGuideBatchImportResult = BatchImportResult & {
  /** Categories imported */
  categoriesImported: number;
  /** MSIs imported */
  msisImported: number;
  /** Options imported */
  optionsImported: number;
  /** UpCharges imported */
  upChargesImported: number;
  /** Additional detail fields imported */
  additionalDetailsImported: number;
  /** Formula warnings (unresolved references) */
  formulaWarnings: Array<{
    msiSourceId: string;
    unresolvedRefs: string[];
  }>;
};

/**
 * Rollback statistics.
 */
export type RollbackStats = {
  categoriesDeleted: number;
  msisDeleted: number;
  optionsDeleted: number;
  upChargesDeleted: number;
  additionalDetailsDeleted: number;
  pricesDeleted: number;
  junctionsDeleted: number;
};
