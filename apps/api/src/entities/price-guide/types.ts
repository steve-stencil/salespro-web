/**
 * Shared types and enums for price guide entities
 */

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

/** Status for mass price change jobs */
export enum PriceChangeJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
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
