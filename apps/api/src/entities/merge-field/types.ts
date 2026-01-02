/**
 * Shared types and enums for merge field entities.
 *
 * @module entities/merge-field/types
 */

/**
 * Categories for organizing merge fields.
 * Used for grouping fields in the UI and filtering by context.
 */
export enum MergeFieldCategory {
  /** Item-level fields (quantity, name, note, etc.) */
  ITEM = 'ITEM',
  /** Option-level fields (selected option details) */
  OPTION = 'OPTION',
  /** UpCharge-level fields (dynamic by identifier) */
  UPCHARGE = 'UPCHARGE',
  /** Customer-level fields (name, address, contact) */
  CUSTOMER = 'CUSTOMER',
  /** Sales rep/user fields */
  USER = 'USER',
  /** Company-level fields */
  COMPANY = 'COMPANY',
}

/**
 * Human-readable labels for merge field categories.
 */
export const MERGE_FIELD_CATEGORY_LABELS: Record<MergeFieldCategory, string> = {
  [MergeFieldCategory.ITEM]: 'Item',
  [MergeFieldCategory.OPTION]: 'Option',
  [MergeFieldCategory.UPCHARGE]: 'UpCharge',
  [MergeFieldCategory.CUSTOMER]: 'Customer',
  [MergeFieldCategory.USER]: 'User',
  [MergeFieldCategory.COMPANY]: 'Company',
};

/**
 * Data types for merge field values.
 * Controls formatting when rendered in documents.
 */
export enum MergeFieldDataType {
  /** Plain text - no special formatting */
  TEXT = 'TEXT',
  /** Numeric value - formatted with locale number formatting */
  NUMBER = 'NUMBER',
  /** Currency value - formatted with currency symbol and decimals */
  CURRENCY = 'CURRENCY',
  /** Date value - formatted according to locale */
  DATE = 'DATE',
  /** Boolean value - rendered as Yes/No or custom text */
  BOOLEAN = 'BOOLEAN',
  /** Image reference - rendered as embedded image */
  IMAGE = 'IMAGE',
}

/**
 * Human-readable labels for merge field data types.
 */
export const MERGE_FIELD_DATA_TYPE_LABELS: Record<MergeFieldDataType, string> =
  {
    [MergeFieldDataType.TEXT]: 'Text',
    [MergeFieldDataType.NUMBER]: 'Number',
    [MergeFieldDataType.CURRENCY]: 'Currency',
    [MergeFieldDataType.DATE]: 'Date',
    [MergeFieldDataType.BOOLEAN]: 'Boolean',
    [MergeFieldDataType.IMAGE]: 'Image',
  };
