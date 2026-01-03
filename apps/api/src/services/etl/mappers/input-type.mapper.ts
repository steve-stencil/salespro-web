/**
 * Input Type Mapper for ETL Operations
 *
 * Maps legacy MongoDB input types to new AdditionalDetailInputType enum values.
 * Handles all variations from iOS/Parse legacy system.
 */

import {
  AdditionalDetailCellType,
  AdditionalDetailInputType,
  SizePickerPrecision,
} from '../../../entities/price-guide/types';

import type {
  PhotoFieldConfig,
  SizePickerConfig,
  UnitedInchConfig,
} from '../../../entities/price-guide/types';
import type { LegacyAdditionalDetailObject } from '../types';

/**
 * Result of mapping a legacy input type.
 */
export type InputTypeMapping = {
  inputType: AdditionalDetailInputType;
  cellType?: AdditionalDetailCellType;
  precision?: SizePickerPrecision;
  allowDecimal?: boolean;
};

/**
 * Mapping from legacy input type strings to new schema types.
 * Handles iOS naming conventions and variations.
 *
 * @see leap-one/Estimate Pro/Constants.h for kInputType* definitions
 * @see leap-one/Estimate Pro/PriceGuide/ItemPrices/AdditionalDetailObject.m for kMeasureSheetAdditionalDetailObjectInputType* definitions
 * @see leap-one/Estimate Pro/SSTextField.swift for TextFieldInputStyle enum
 */
const INPUT_TYPE_MAP: Record<string, InputTypeMapping> = {
  // Text inputs
  default: { inputType: AdditionalDetailInputType.TEXT },
  text: { inputType: AdditionalDetailInputType.TEXT },
  plain: { inputType: AdditionalDetailInputType.TEXT },
  plainText: { inputType: AdditionalDetailInputType.TEXT },
  textView: { inputType: AdditionalDetailInputType.TEXTAREA },
  textarea: { inputType: AdditionalDetailInputType.TEXTAREA },

  // Picker inputs
  picker: { inputType: AdditionalDetailInputType.PICKER },
  multiSelectPicker: { inputType: AdditionalDetailInputType.PICKER },

  // Number inputs
  keypad: { inputType: AdditionalDetailInputType.NUMBER, allowDecimal: false },
  numbers: { inputType: AdditionalDetailInputType.NUMBER, allowDecimal: false },
  numberKeyboard: {
    inputType: AdditionalDetailInputType.NUMBER,
    allowDecimal: true,
  },

  // Currency inputs
  keypadDecimal: {
    inputType: AdditionalDetailInputType.CURRENCY,
    allowDecimal: true,
  },
  currency: {
    inputType: AdditionalDetailInputType.CURRENCY,
    allowDecimal: true,
  },
  currencyDecimal: {
    inputType: AdditionalDetailInputType.CURRENCY,
    allowDecimal: true,
  },
  currencyWhole: {
    inputType: AdditionalDetailInputType.CURRENCY,
    allowDecimal: false,
  },

  // 2D Size pickers - generic (defaults to INCH precision per iOS behavior)
  sizePicker: {
    inputType: AdditionalDetailInputType.SIZE_PICKER,
    precision: SizePickerPrecision.INCH,
  },
  // 2D Size pickers - with explicit precision
  sizePickerInch: {
    inputType: AdditionalDetailInputType.SIZE_PICKER,
    precision: SizePickerPrecision.INCH,
  },
  sizePickerQuarterInch: {
    inputType: AdditionalDetailInputType.SIZE_PICKER,
    precision: SizePickerPrecision.QUARTER_INCH,
  },
  sizePickerEighthInch: {
    inputType: AdditionalDetailInputType.SIZE_PICKER,
    precision: SizePickerPrecision.EIGHTH_INCH,
  },
  sizePickerSixteenthInch: {
    inputType: AdditionalDetailInputType.SIZE_PICKER,
    precision: SizePickerPrecision.SIXTEENTH_INCH,
  },

  // 3D Size pickers - generic (defaults to INCH precision per iOS behavior)
  '3DSizePicker': {
    inputType: AdditionalDetailInputType.SIZE_PICKER_3D,
    precision: SizePickerPrecision.INCH,
  },
  // 3D Size pickers - with explicit precision
  '3DSizePickerInch': {
    inputType: AdditionalDetailInputType.SIZE_PICKER_3D,
    precision: SizePickerPrecision.INCH,
  },
  '3DSizePickerQuarterInch': {
    inputType: AdditionalDetailInputType.SIZE_PICKER_3D,
    precision: SizePickerPrecision.QUARTER_INCH,
  },
  '3DSizePickerEighthInch': {
    inputType: AdditionalDetailInputType.SIZE_PICKER_3D,
    precision: SizePickerPrecision.EIGHTH_INCH,
  },
  '3DSizePickerSixteenthInch': {
    inputType: AdditionalDetailInputType.SIZE_PICKER_3D,
    precision: SizePickerPrecision.SIXTEENTH_INCH,
  },

  // United inch picker
  unitedInchPicker: { inputType: AdditionalDetailInputType.UNITED_INCH },

  // Date/time pickers
  datePicker: { inputType: AdditionalDetailInputType.DATE },
  timePicker: { inputType: AdditionalDetailInputType.TIME },
  dateTimePicker: { inputType: AdditionalDetailInputType.DATETIME },

  // Photos (handled via cellType)
  photos: {
    inputType: AdditionalDetailInputType.TEXT,
    cellType: AdditionalDetailCellType.PHOTOS,
  },
};

/**
 * Map a legacy input type string to new schema types.
 *
 * @param legacyType - Legacy input type string from MongoDB
 * @returns InputTypeMapping with inputType and optional precision/cellType
 */
export function mapInputType(legacyType: string): InputTypeMapping {
  const mapping = INPUT_TYPE_MAP[legacyType];
  if (!mapping) {
    // Log warning for unknown types but don't fail
    console.warn(`[ETL] Unknown inputType "${legacyType}" - mapping to TEXT`);
    return { inputType: AdditionalDetailInputType.TEXT };
  }
  return mapping;
}

/**
 * Map a legacy cell type string to new schema type.
 *
 * Legacy cell types from AdditionalDetailObject.m:
 * - kMeasureSheetAdditionalDetailObjectCellTypeWords = "textWords"
 * - kMeasureSheetAdditionalDetailObjectCellTypeSentence = "textSentence"
 * - kMeasureSheetAdditionalDetailObjectCellTypeParagraph = "textParagraph"
 * - kMeasureSheetAdditionalDetailObjectCellTypePhotos = "photos"
 *
 * @param legacyCellType - Legacy cell type string from MongoDB
 * @returns AdditionalDetailCellType or undefined
 */
export function mapCellType(
  legacyCellType: string | undefined,
): AdditionalDetailCellType | undefined {
  if (!legacyCellType) return undefined;

  switch (legacyCellType.toLowerCase()) {
    case 'photos':
    case 'photo':
      return AdditionalDetailCellType.PHOTOS;
    case 'text':
    case 'default':
    case 'textwords':
    case 'textsentence':
      return AdditionalDetailCellType.TEXT;
    case 'textparagraph':
      // textParagraph implies expanded text display, still TEXT type
      return AdditionalDetailCellType.TEXT;
    default:
      return undefined;
  }
}

/**
 * Build size picker configuration from legacy additional detail object.
 *
 * @param legacy - Legacy additional detail object
 * @param precision - Precision from input type mapping
 * @returns SizePickerConfig or undefined
 */
export function buildSizePickerConfig(
  legacy: LegacyAdditionalDetailObject,
  precision: SizePickerPrecision,
): SizePickerConfig {
  return {
    precision,
    minWidth: legacy.minSizePickerWidth,
    maxWidth: legacy.maxSizePickerWidth,
    minHeight: legacy.minSizePickerHeight,
    maxHeight: legacy.maxSizePickerHeight,
    minDepth: legacy.minSizePickerDepth,
    maxDepth: legacy.maxSizePickerDepth,
  };
}

/**
 * Build united inch configuration from legacy additional detail object.
 *
 * @param legacy - Legacy additional detail object
 * @returns UnitedInchConfig or undefined
 */
export function buildUnitedInchConfig(
  legacy: LegacyAdditionalDetailObject,
): UnitedInchConfig | undefined {
  if (!legacy.unitedInchSuffix) return undefined;
  return {
    suffix: legacy.unitedInchSuffix,
  };
}

/**
 * Build photo field configuration from legacy additional detail object.
 *
 * @param legacy - Legacy additional detail object
 * @returns PhotoFieldConfig or undefined
 */
export function buildPhotoConfig(
  legacy: LegacyAdditionalDetailObject,
): PhotoFieldConfig | undefined {
  if (legacy.disableTemplatePhotoLinking === undefined) return undefined;
  return {
    disableTemplatePhotoLinking: legacy.disableTemplatePhotoLinking,
  };
}

/**
 * Get default value from legacy object, normalizing arrays.
 *
 * @param legacy - Legacy additional detail object
 * @returns Default value as string or undefined
 */
export function normalizeDefaultValue(
  legacy: LegacyAdditionalDetailObject,
): string | undefined {
  if (legacy.defaultValue === undefined) return undefined;

  // Arrays become JSON strings for multi-select pickers
  if (Array.isArray(legacy.defaultValue)) {
    return JSON.stringify(legacy.defaultValue);
  }

  return String(legacy.defaultValue);
}

/**
 * Transform a complete legacy additional detail object to entity fields.
 *
 * @param legacy - Legacy additional detail object from MongoDB
 * @returns Object with all mapped fields ready for entity creation
 */
export function transformAdditionalDetail(
  legacy: LegacyAdditionalDetailObject,
): {
  sourceId: string;
  title: string;
  inputType: AdditionalDetailInputType;
  cellType?: AdditionalDetailCellType;
  placeholder?: string;
  note?: string;
  defaultValue?: string;
  isRequired: boolean;
  shouldCopy: boolean;
  pickerValues?: string[];
  sizePickerConfig?: SizePickerConfig;
  unitedInchConfig?: UnitedInchConfig;
  photoConfig?: PhotoFieldConfig;
  allowDecimal: boolean;
  dateDisplayFormat?: string;
  notAddedReplacement?: string;
} {
  const mapping = mapInputType(legacy.inputType);
  const cellType = mapCellType(legacy.cellType) ?? mapping.cellType;

  const result: ReturnType<typeof transformAdditionalDetail> = {
    sourceId: legacy.objectId,
    title: legacy.title,
    inputType: mapping.inputType,
    cellType,
    placeholder: legacy.placeholder,
    note: legacy.note,
    defaultValue: normalizeDefaultValue(legacy),
    isRequired: legacy.required ?? false,
    shouldCopy: legacy.shouldCopy ?? false,
    pickerValues: legacy.pickerValues,
    allowDecimal: mapping.allowDecimal ?? false,
    dateDisplayFormat: legacy.dateDisplayFormat,
    notAddedReplacement: legacy.notAddedReplacement,
  };

  // Add size picker config if applicable
  if (
    mapping.precision &&
    (mapping.inputType === AdditionalDetailInputType.SIZE_PICKER ||
      mapping.inputType === AdditionalDetailInputType.SIZE_PICKER_3D)
  ) {
    result.sizePickerConfig = buildSizePickerConfig(legacy, mapping.precision);
  }

  // Add united inch config if applicable
  if (mapping.inputType === AdditionalDetailInputType.UNITED_INCH) {
    result.unitedInchConfig = buildUnitedInchConfig(legacy);
  }

  // Add photo config if applicable
  if (cellType === AdditionalDetailCellType.PHOTOS) {
    result.photoConfig = buildPhotoConfig(legacy);
  }

  return result;
}
