/**
 * Shared types and enums for price guide entities
 */

// ============================================================================
// Parent Price Type Codes (for cross-company reporting aggregation)
// ============================================================================

/**
 * Parent price type codes - hardcoded categories for cross-company aggregation.
 * All company-specific price types must map to one of these parent codes.
 */
export const PARENT_PRICE_TYPE_CODES = [
  'MATERIAL',
  'LABOR',
  'MATERIAL_LABOR',
  'TAX',
  'OTHER',
] as const;

export type ParentPriceTypeCode = (typeof PARENT_PRICE_TYPE_CODES)[number];

/**
 * Human-readable labels for parent price type codes.
 */
export const PARENT_PRICE_TYPE_LABELS: Record<ParentPriceTypeCode, string> = {
  MATERIAL: 'Materials',
  LABOR: 'Labor',
  MATERIAL_LABOR: 'Materials & Labor',
  TAX: 'Tax',
  OTHER: 'Other',
};

/**
 * Descriptions for parent price type codes.
 */
export const PARENT_PRICE_TYPE_DESCRIPTIONS: Record<
  ParentPriceTypeCode,
  string
> = {
  MATERIAL: 'Cost of materials only',
  LABOR: 'Cost of labor only',
  MATERIAL_LABOR: 'Combined installed price (materials + labor not separated)',
  TAX: 'Tax charges',
  OTHER: 'Miscellaneous charges',
};

// ============================================================================
// Additional Detail Field Types
// ============================================================================

/**
 * Input type for additional detail fields - controls input control used.
 * The input type also implies display size (textarea = expanded, others = compact).
 */
export enum AdditionalDetailInputType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  CURRENCY = 'currency',
  PICKER = 'picker',
  SIZE_PICKER = 'size_picker',
  SIZE_PICKER_3D = 'size_picker_3d',
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'datetime',
  UNITED_INCH = 'united_inch',
}

/** Cell type for additional detail fields - controls display rendering */
export enum AdditionalDetailCellType {
  TEXT = 'text',
  PHOTOS = 'photos',
}

/** Precision for size pickers */
export enum SizePickerPrecision {
  INCH = 'inch',
  QUARTER_INCH = 'quarter_inch',
  EIGHTH_INCH = 'eighth_inch',
  SIXTEENTH_INCH = 'sixteenth_inch',
}

// ============================================================================
// Price Guide Category Types
// ============================================================================

/**
 * Category display type - controls navigation behavior in the mobile app.
 *
 * - DEFAULT: Shows MSIs directly when selected (no subcategory drill-down)
 * - DETAIL: Shows subcategories first, then MSIs (one level of drill-down)
 * - DEEP_DRILL_DOWN: Multiple levels of subcategory hierarchy before MSIs
 *
 * @see leap-one/Estimate Pro/CategoryObject.swift for iOS implementation
 */
export enum PriceGuideCategoryType {
  /** Standard category - shows MSIs directly when selected */
  DEFAULT = 'default',
  /** Detail category - shows subcategories first, then MSIs */
  DETAIL = 'detail',
  /** Deep drill-down - multiple levels of subcategory navigation */
  DEEP_DRILL_DOWN = 'deep_drill_down',
}

/** Human-readable labels for category types */
export const CATEGORY_TYPE_LABELS: Record<PriceGuideCategoryType, string> = {
  [PriceGuideCategoryType.DEFAULT]: 'Default',
  [PriceGuideCategoryType.DETAIL]: 'Detail',
  [PriceGuideCategoryType.DEEP_DRILL_DOWN]: 'Deep Drill Down',
};

/** Descriptions for category types */
export const CATEGORY_TYPE_DESCRIPTIONS: Record<
  PriceGuideCategoryType,
  string
> = {
  [PriceGuideCategoryType.DEFAULT]:
    'Standard category - shows items directly when selected',
  [PriceGuideCategoryType.DETAIL]:
    'Detail category - shows subcategories first, then items',
  [PriceGuideCategoryType.DEEP_DRILL_DOWN]:
    'Deep drill-down - multiple levels of subcategory navigation',
};

/** Status for mass price change jobs */
export enum PriceChangeJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * How MSI quantity is determined.
 */
export enum QuantityMode {
  /** User manually enters quantity (default) */
  MANUAL = 'MANUAL',
  /** Quantity computed from formula referencing other items */
  FORMULA = 'FORMULA',
}

/** Status for pricing import jobs */
export enum PricingImportJobStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/** Target type for mass price change jobs */
export enum PriceChangeTargetType {
  OPTIONS = 'options',
  UPCHARGES = 'upcharges',
}

/**
 * Entity types that support tagging via the polymorphic ItemTag junction table.
 * Add new values here as tagging is enabled for additional entity types.
 */
export enum TaggableEntityType {
  OPTION = 'OPTION',
  UPCHARGE = 'UPCHARGE',
  ADDITIONAL_DETAIL = 'ADDITIONAL_DETAIL',
  MEASURE_SHEET_ITEM = 'MEASURE_SHEET_ITEM',
  PRICE_GUIDE_IMAGE = 'PRICE_GUIDE_IMAGE',
  CUSTOM_MERGE_FIELD = 'CUSTOM_MERGE_FIELD',
}

/** Size picker configuration for 2D/3D size pickers */
export type SizePickerConfig = {
  precision: SizePickerPrecision;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  /** Only used for SIZE_PICKER_3D */
  minDepth?: number;
  /** Only used for SIZE_PICKER_3D */
  maxDepth?: number;
};

/** United inch picker configuration */
export type UnitedInchConfig = {
  suffix?: string;
};

/** Photo field configuration */
export type PhotoFieldConfig = {
  disableTemplatePhotoLinking?: boolean;
};

/** Operation configuration for mass price change jobs */
export type PriceChangeOperation = {
  type: 'increase' | 'decrease';
  valueType: 'percent' | 'fixed';
  value: number;
  filters?: {
    officeIds?: string[];
    priceTypeIds?: string[];
  };
};
