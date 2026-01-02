/**
 * Migration Feature Types
 */

/**
 * Generic source item from legacy database for preview.
 * Base type that works for any collection type.
 */
export type SourceItem = {
  objectId: string;
  name: string;
};

/**
 * Source item with import status for UI display.
 */
export type SourceItemWithStatus = SourceItem & {
  /** Whether this item has already been imported */
  isImported: boolean;
};

/**
 * Alias for backward compatibility.
 * @deprecated Use SourceItem instead
 */
export type SourceOffice = SourceItem;

/**
 * Migration session status.
 */
export type MigrationSessionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

/**
 * Migration session data.
 */
export type MigrationSession = {
  id: string;
  status: MigrationSessionStatus;
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors?: Array<{ sourceId: string; error: string }>;
  createdAt: string;
  completedAt?: string;
};

/**
 * Batch import result.
 */
export type BatchImportResult = {
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ sourceId: string; error: string }>;
  hasMore: boolean;
  session: MigrationSession;
};

/**
 * Source items response with pagination meta.
 */
export type SourceItemsResponse<T> = {
  data: T[];
  meta: {
    total: number;
    skip: number;
    limit: number;
  };
};

// =============================================================================
// Price Guide Import Types
// =============================================================================

/**
 * Price guide source counts from legacy database.
 */
export type PriceGuideSourceCounts = {
  categories: number;
  msis: number;
  options: number;
  upCharges: number;
  additionalDetails?: number;
  images?: number;
};

/**
 * Office mapping for price guide import.
 */
export type OfficeMapping = {
  sourceId: string;
  sourceName: string;
  targetId: string | null;
  targetName: string | null;
  msiCount: number;
};

/**
 * Price type configuration options for import.
 */
export type PriceTypeStrategy = 'materials' | 'labor' | 'combined' | 'custom';

/**
 * Price guide import configuration.
 */
export type PriceGuideImportConfig = {
  /** How to map legacy prices to new price types */
  priceTypeStrategy: PriceTypeStrategy;
  /** Custom price type ID if strategy is 'custom' */
  customPriceTypeId?: string;
  /** Auto-create categories from legacy data */
  autoCreateCategories: boolean;
  /** How to handle duplicates: 'skip' | 'update' | 'create' */
  duplicateHandling: 'skip' | 'update' | 'create';
  /** Include image migration */
  includeImages: boolean;
};

/**
 * Price guide import preview summary.
 */
export type PriceGuideImportPreview = {
  categories: { toCreate: number; existing: number };
  additionalDetails: { toCreate: number; existing: number };
  options: { toCreate: number; toUpdate: number; toSkip: number };
  upCharges: { toCreate: number; toUpdate: number; toSkip: number };
  msis: { toCreate: number; toUpdate: number; toSkip: number };
  images: { toDownload: number };
  prices: { options: number; upCharges: number };
  warnings: PriceGuideImportWarning[];
};

/**
 * Import warning item.
 */
export type PriceGuideImportWarning = {
  type: 'formula' | 'category' | 'office' | 'image' | 'additional_detail';
  message: string;
  count: number;
  details?: string[];
};

/**
 * Extended batch import result for price guide.
 */
export type PriceGuideBatchImportResult = BatchImportResult & {
  categoriesImported: number;
  msisImported: number;
  optionsImported: number;
  upChargesImported: number;
  additionalDetailsImported: number;
  imagesImported?: number;
  formulaWarnings: Array<{ msiSourceId: string; unresolvedRefs: string[] }>;
};

/**
 * Price guide import progress state.
 */
export type PriceGuideImportProgress = {
  phase:
    | 'idle'
    | 'categories'
    | 'additional_details'
    | 'options'
    | 'upcharges'
    | 'msis'
    | 'images'
    | 'complete';
  overallProgress: number;
  categories: { done: number; total: number };
  additionalDetails: { done: number; total: number };
  options: { done: number; total: number };
  upCharges: { done: number; total: number };
  msis: { done: number; total: number };
  images: { done: number; total: number };
  elapsedTime: number;
  estimatedRemaining: number;
};

/**
 * Price guide import results summary.
 */
export type PriceGuideImportResults = {
  success: boolean;
  duration: number;
  summary: {
    categories: { imported: number; skipped: number; errors: number };
    options: { imported: number; skipped: number; errors: number };
    upCharges: { imported: number; skipped: number; errors: number };
    msis: { imported: number; skipped: number; errors: number };
    images: { imported: number; skipped: number; errors: number };
  };
  actionItems: Array<{
    type: 'office_assignment' | 'formula_issue' | 'image_error';
    message: string;
    count: number;
  }>;
  formulaWarnings: Array<{ msiSourceId: string; unresolvedRefs: string[] }>;
};
