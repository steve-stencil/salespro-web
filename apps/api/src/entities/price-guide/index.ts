/**
 * Price Guide Entities - Barrel Export
 *
 * Week 1 Core Entities:
 * - PriceGuideCategory: Self-referential hierarchy for organizing MSIs
 * - MeasureSheetItem: Main line item that sales reps add to estimates
 * - PriceGuideOption: Shared product variants library
 * - UpCharge: Shared add-ons/accessories library
 * - AdditionalDetailField: Shared custom input fields library
 * - PriceObjectType: TypeCodes for pricing breakdown (Materials, Labor, etc.)
 */

// Core entities
export { PriceGuideCategory } from './PriceGuideCategory.entity';
export { MeasureSheetItem } from './MeasureSheetItem.entity';
export { PriceGuideOption } from './PriceGuideOption.entity';
export { UpCharge } from './UpCharge.entity';
export { AdditionalDetailField } from './AdditionalDetailField.entity';
export { PriceObjectType, DEFAULT_PRICE_TYPES } from './PriceObjectType.entity';

// Types and enums
export {
  AdditionalDetailInputType,
  AdditionalDetailCellType,
  SizePickerPrecision,
  PriceChangeJobStatus,
  PriceChangeTargetType,
} from './types';

export type {
  SizePickerConfig,
  UnitedInchConfig,
  PhotoFieldConfig,
  PriceChangeOperation,
} from './types';
