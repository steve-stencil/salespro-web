/**
 * Price Guide Entities - Barrel Export
 *
 * Core Entities:
 * - PriceGuideCategory: Self-referential hierarchy for organizing MSIs
 * - MeasureSheetItem: Main line item that sales reps add to estimates
 * - PriceGuideOption: Shared product variants library (MSIs require ≥1 option)
 * - UpCharge: Shared add-ons/accessories library
 * - AdditionalDetailField: Shared custom input fields library
 * - PriceObjectType: TypeCodes for pricing breakdown (Materials, Labor, etc.)
 *
 * Junction Tables:
 * - MeasureSheetItemOffice: Office visibility for MSIs
 * - MeasureSheetItemOption: Links MSIs to options (required, ≥1 per MSI)
 * - MeasureSheetItemUpCharge: Links MSIs to upcharges
 * - MeasureSheetItemAdditionalDetailField: Links MSIs to additional detail fields
 * - UpChargeAdditionalDetailField: Links upcharges to additional detail fields
 * - UpChargeDisabledOption: Tracks disabled options per upcharge
 *
 * Pricing Entities:
 * - OptionPrice: Price breakdowns per option × office × priceType
 * - UpChargePrice: Default + option-specific override pricing
 * - UpChargePricePercentageBase: Percentage base configuration
 *
 * Operational Entities:
 * - PriceChangeLog: Append-only audit log for price changes
 * - PriceChangeJob: Mass price change job tracking with progress
 *
 * Note: All MSIs require at least one option. Pricing comes from OptionPrice.
 * See ADR-003 for rationale on removing base pricing.
 */

// Core entities
export { PriceGuideCategory } from './PriceGuideCategory.entity';
export { MeasureSheetItem } from './MeasureSheetItem.entity';
export { PriceGuideOption } from './PriceGuideOption.entity';
export { UpCharge } from './UpCharge.entity';
export { AdditionalDetailField } from './AdditionalDetailField.entity';
export { PriceObjectType, DEFAULT_PRICE_TYPES } from './PriceObjectType.entity';

// Junction tables
export { MeasureSheetItemOffice } from './MeasureSheetItemOffice.entity';
export { MeasureSheetItemOption } from './MeasureSheetItemOption.entity';
export { MeasureSheetItemUpCharge } from './MeasureSheetItemUpCharge.entity';
export { MeasureSheetItemAdditionalDetailField } from './MeasureSheetItemAdditionalDetailField.entity';
export { UpChargeAdditionalDetailField } from './UpChargeAdditionalDetailField.entity';
export { UpChargeDisabledOption } from './UpChargeDisabledOption.entity';

// Pricing entities
export { OptionPrice } from './OptionPrice.entity';
export { UpChargePrice } from './UpChargePrice.entity';
export { UpChargePricePercentageBase } from './UpChargePricePercentageBase.entity';

// Operational entities
export { PriceChangeLog } from './PriceChangeLog.entity';
export { PriceChangeJob } from './PriceChangeJob.entity';

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
