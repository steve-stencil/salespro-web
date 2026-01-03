/**
 * Legacy Type Mapper
 *
 * Maps legacy iOS/Parse input and cell types to the unified type system.
 * Handles all variations from three legacy systems:
 * 1. AdditionalDetailObject (price guide)
 * 2. ContractDataBodyCellItem (contracts)
 * 3. ResultObject (results entry)
 *
 * @see leap-one/Estimate Pro/Constants.h
 * @see leap-one/Estimate Pro/PriceGuide/ItemPrices/AdditionalDetailObject.m
 * @see leap-one/Estimate Pro/SSTextField.swift
 * @see leap-one/Estimate Pro/ResultsEntryTableView.m
 */

import {
  UnifiedInputType,
  UnifiedCellType,
  SizePickerPrecision,
  FormulaOutputFormat,
} from './input-types';

// ============================================================================
// LEGACY INPUT TYPE MAPPING
// ============================================================================

/**
 * Result of mapping a legacy input type.
 * Includes configuration needed to replicate legacy behavior.
 */
export type LegacyInputTypeMapping = {
  inputType: UnifiedInputType;
  /** Size picker precision */
  precision?: SizePickerPrecision;
  /** Number of decimal places (for NUMBER, CURRENCY, FORMULA) */
  decimalPlaces?: number;
  /** Formula output format */
  formulaOutputFormat?: FormulaOutputFormat;
  /**
   * @deprecated Use decimalPlaces instead. Kept for backwards compatibility.
   */
  allowDecimal?: boolean;
};

/**
 * Maps legacy input type strings to unified types.
 * Includes all variations from iOS, contracts, and results systems.
 *
 * Keys are legacy camelCase values from iOS/Parse.
 * Values are unified snake_case enum values for database storage.
 */
const LEGACY_INPUT_TYPE_MAP: Record<string, LegacyInputTypeMapping> = {
  // ========== TEXT INPUTS ==========
  default: { inputType: UnifiedInputType.TEXT },
  text: { inputType: UnifiedInputType.TEXT },
  plain: { inputType: UnifiedInputType.TEXT },
  plainText: { inputType: UnifiedInputType.TEXT },
  textView: { inputType: UnifiedInputType.TEXTAREA },
  textarea: { inputType: UnifiedInputType.TEXTAREA },

  // ========== PICKER INPUTS ==========
  picker: { inputType: UnifiedInputType.PICKER },
  multiSelectPicker: { inputType: UnifiedInputType.MULTI_SELECT_PICKER },
  statePicker: { inputType: UnifiedInputType.STATE_PICKER },
  financeOptionsPicker: { inputType: UnifiedInputType.FINANCE_OPTIONS_PICKER },

  // ========== NUMBER INPUTS ==========
  // Integer-only (legacy: keypad, numbers) → decimalPlaces: 0
  keypad: { inputType: UnifiedInputType.NUMBER, decimalPlaces: 0 },
  numbers: { inputType: UnifiedInputType.NUMBER, decimalPlaces: 0 },
  // Decimal (legacy: numberKeyboard) → decimalPlaces: undefined (variable)
  numberKeyboard: {
    inputType: UnifiedInputType.NUMBER,
    decimalPlaces: undefined,
  },

  // ========== CURRENCY INPUTS ==========
  // With cents → decimalPlaces: 2
  currency: { inputType: UnifiedInputType.CURRENCY, decimalPlaces: 2 },
  currencyDecimal: { inputType: UnifiedInputType.CURRENCY, decimalPlaces: 2 },
  keypadDecimal: { inputType: UnifiedInputType.CURRENCY, decimalPlaces: 2 },
  // Without cents → decimalPlaces: 0
  currencyWhole: { inputType: UnifiedInputType.CURRENCY, decimalPlaces: 0 },

  // ========== 2D SIZE PICKERS ==========
  // Generic (defaults to INCH)
  sizePicker: {
    inputType: UnifiedInputType.SIZE_PICKER,
    precision: SizePickerPrecision.INCH,
  },
  // With explicit precision
  sizePickerInch: {
    inputType: UnifiedInputType.SIZE_PICKER,
    precision: SizePickerPrecision.INCH,
  },
  sizePickerQuarterInch: {
    inputType: UnifiedInputType.SIZE_PICKER,
    precision: SizePickerPrecision.QUARTER_INCH,
  },
  sizePickerEighthInch: {
    inputType: UnifiedInputType.SIZE_PICKER,
    precision: SizePickerPrecision.EIGHTH_INCH,
  },
  sizePickerSixteenthInch: {
    inputType: UnifiedInputType.SIZE_PICKER,
    precision: SizePickerPrecision.SIXTEENTH_INCH,
  },

  // ========== 3D SIZE PICKERS ==========
  // Generic (defaults to INCH)
  '3DSizePicker': {
    inputType: UnifiedInputType.SIZE_PICKER_3D,
    precision: SizePickerPrecision.INCH,
  },
  // With explicit precision
  '3DSizePickerInch': {
    inputType: UnifiedInputType.SIZE_PICKER_3D,
    precision: SizePickerPrecision.INCH,
  },
  '3DSizePickerQuarterInch': {
    inputType: UnifiedInputType.SIZE_PICKER_3D,
    precision: SizePickerPrecision.QUARTER_INCH,
  },
  '3DSizePickerEighthInch': {
    inputType: UnifiedInputType.SIZE_PICKER_3D,
    precision: SizePickerPrecision.EIGHTH_INCH,
  },
  '3DSizePickerSixteenthInch': {
    inputType: UnifiedInputType.SIZE_PICKER_3D,
    precision: SizePickerPrecision.SIXTEENTH_INCH,
  },

  // ========== UNITED INCH ==========
  unitedInchPicker: { inputType: UnifiedInputType.UNITED_INCH },

  // ========== DATE/TIME INPUTS ==========
  datePicker: { inputType: UnifiedInputType.DATE },
  timePicker: { inputType: UnifiedInputType.TIME },
  dateTimePicker: { inputType: UnifiedInputType.DATETIME },

  // ========== SPECIAL FORMAT INPUTS ==========
  phone: { inputType: UnifiedInputType.PHONE },
  email: { inputType: UnifiedInputType.EMAIL },
  ssn: { inputType: UnifiedInputType.SSN },
  zipCode: { inputType: UnifiedInputType.ZIP_CODE },
  creditCard: { inputType: UnifiedInputType.CREDIT_CARD },
  ccExpDate: { inputType: UnifiedInputType.CREDIT_CARD_EXP },
  years: { inputType: UnifiedInputType.YEARS },
  months: { inputType: UnifiedInputType.MONTHS },
  numbersAndPunctuation: { inputType: UnifiedInputType.NUMBERS_PUNCTUATION },

  // ========== FORMULA INPUTS (Contract-specific) ==========
  // formula → NUMBER output, variable decimal places
  formula: {
    inputType: UnifiedInputType.FORMULA,
    formulaOutputFormat: FormulaOutputFormat.NUMBER,
    decimalPlaces: undefined,
  },
  // formulaWhole → NUMBER output, 0 decimal places
  formulaWhole: {
    inputType: UnifiedInputType.FORMULA,
    formulaOutputFormat: FormulaOutputFormat.NUMBER,
    decimalPlaces: 0,
  },
  // formulaCurrency → CURRENCY output, 2 decimal places
  formulaCurrency: {
    inputType: UnifiedInputType.FORMULA,
    formulaOutputFormat: FormulaOutputFormat.CURRENCY,
    decimalPlaces: 2,
  },
  // formulaCurrencyWhole → CURRENCY output, 0 decimal places
  formulaCurrencyWhole: {
    inputType: UnifiedInputType.FORMULA,
    formulaOutputFormat: FormulaOutputFormat.CURRENCY,
    decimalPlaces: 0,
  },
  // textFormula → TEXT output (placeholder substitution)
  textFormula: {
    inputType: UnifiedInputType.FORMULA,
    formulaOutputFormat: FormulaOutputFormat.TEXT,
  },

  // ========== DYNAMIC INPUTS ==========
  dynamic: { inputType: UnifiedInputType.DYNAMIC },
  linkedValue: { inputType: UnifiedInputType.LINKED_VALUE },

  // ========== RESULTS-SPECIFIC INPUTS (legacy prefixed with __) ==========
  // These are internal results types that map to standard types
  __keyboardNormal: { inputType: UnifiedInputType.TEXT },
  __picker: { inputType: UnifiedInputType.PICKER },
  __saleAmount: { inputType: UnifiedInputType.CURRENCY, decimalPlaces: 2 },
  __saleAmountWhole: { inputType: UnifiedInputType.CURRENCY, decimalPlaces: 0 },
  __totalPrice: { inputType: UnifiedInputType.CURRENCY, decimalPlaces: 2 },
  __email: { inputType: UnifiedInputType.EMAIL },
  __managerList: { inputType: UnifiedInputType.PICKER },
  __commission: { inputType: UnifiedInputType.CURRENCY, decimalPlaces: 2 },
  __textView: { inputType: UnifiedInputType.TEXTAREA },
  __keyboardCurrency: {
    inputType: UnifiedInputType.CURRENCY,
    decimalPlaces: 2,
  },
  __financeOption: { inputType: UnifiedInputType.FINANCE_OPTIONS_PICKER },
  __msLeadResult: { inputType: UnifiedInputType.PICKER },
  __msResultReason: { inputType: UnifiedInputType.TEXTAREA },
};

// ============================================================================
// LEGACY CELL TYPE MAPPING
// ============================================================================

/**
 * Maps legacy cell type strings to unified cell types.
 *
 * Keys are legacy camelCase values from iOS/Parse.
 * Values are unified snake_case enum values for database storage.
 */
const LEGACY_CELL_TYPE_MAP: Record<string, UnifiedCellType> = {
  // Text display cells
  textOnly: UnifiedCellType.TEXT_ONLY,
  textShort: UnifiedCellType.TEXT_SHORT,
  textLong: UnifiedCellType.TEXT_LONG,
  textXLong: UnifiedCellType.TEXT_XLONG,

  // AdditionalDetail cell types (from AdditionalDetailObject.m)
  textWords: UnifiedCellType.TEXT_SHORT,
  textSentence: UnifiedCellType.TEXT_LONG,
  textParagraph: UnifiedCellType.TEXT_XLONG,

  // Toggle/Switch
  switched: UnifiedCellType.SWITCH,

  // Media cells
  photos: UnifiedCellType.PHOTOS,
  photo: UnifiedCellType.PHOTOS,
  photoPickerCell: UnifiedCellType.PHOTOS,
  drawing: UnifiedCellType.DRAWING,
  imagePicker: UnifiedCellType.IMAGE_PICKER,

  // Structural cells
  detailCell: UnifiedCellType.DETAIL,
  header: UnifiedCellType.HEADER,
  emptySpace: UnifiedCellType.SPACER,

  // Signature
  signatures: UnifiedCellType.SIGNATURE,

  // Payment cells
  creditCardCell: UnifiedCellType.CREDIT_CARD,
  bankAccountCell: UnifiedCellType.BANK_ACCOUNT,
  securePaymentCaptureAll: UnifiedCellType.PAYMENT_CAPTURE,

  // Integration cells
  provia: UnifiedCellType.PROVIA,
  proviaDetail: UnifiedCellType.PROVIA,
  measureSheetItemDetail: UnifiedCellType.MSI_DETAIL,

  // Fallback mappings (simple text)
  text: UnifiedCellType.TEXT,
  default: UnifiedCellType.TEXT,
};

// ============================================================================
// LEGACY PRECISION MAPPING
// ============================================================================

/**
 * Maps legacy fractionDigits strings to SizePickerPrecision.
 *
 * Legacy values from leaponeserver VALID_FRACTION_DIGITS:
 * ['inch', 'quarter', 'eighth', 'sixteenth']
 */
const LEGACY_PRECISION_MAP: Record<string, SizePickerPrecision> = {
  inch: SizePickerPrecision.INCH,
  quarter: SizePickerPrecision.QUARTER_INCH,
  eighth: SizePickerPrecision.EIGHTH_INCH,
  sixteenth: SizePickerPrecision.SIXTEENTH_INCH,
  // Also accept the new snake_case values
  quarter_inch: SizePickerPrecision.QUARTER_INCH,
  eighth_inch: SizePickerPrecision.EIGHTH_INCH,
  sixteenth_inch: SizePickerPrecision.SIXTEENTH_INCH,
};

// ============================================================================
// PUBLIC MAPPER FUNCTIONS
// ============================================================================

/**
 * Map a legacy input type string to unified input type.
 *
 * @param legacyType - Legacy input type string
 * @returns LegacyInputTypeMapping with inputType and optional precision/allowDecimal
 */
export function mapLegacyInputType(legacyType: string): LegacyInputTypeMapping {
  const mapping = LEGACY_INPUT_TYPE_MAP[legacyType];
  if (!mapping) {
    console.warn(
      `[TypeMapper] Unknown legacy inputType "${legacyType}" - mapping to TEXT`,
    );
    return { inputType: UnifiedInputType.TEXT };
  }
  return mapping;
}

/**
 * Map a legacy cell type string to unified cell type.
 *
 * @param legacyCellType - Legacy cell type string
 * @returns UnifiedCellType or undefined
 */
export function mapLegacyCellType(
  legacyCellType: string | undefined,
): UnifiedCellType | undefined {
  if (!legacyCellType) return undefined;

  const normalized = legacyCellType.toLowerCase();
  const mapping =
    LEGACY_CELL_TYPE_MAP[normalized] ?? LEGACY_CELL_TYPE_MAP[legacyCellType];

  if (!mapping) {
    console.warn(`[TypeMapper] Unknown legacy cellType "${legacyCellType}"`);
    return undefined;
  }

  return mapping;
}

/**
 * Map a legacy fractionDigits string to SizePickerPrecision.
 *
 * @param fractionDigits - Legacy fraction digits string
 * @returns SizePickerPrecision (defaults to INCH if unknown)
 */
export function mapLegacyPrecision(
  fractionDigits: string | undefined,
): SizePickerPrecision {
  if (!fractionDigits) return SizePickerPrecision.INCH;
  return LEGACY_PRECISION_MAP[fractionDigits] ?? SizePickerPrecision.INCH;
}

/**
 * Check if a legacy input type is a formula type.
 *
 * @param legacyType - Legacy input type string
 * @returns true if it's a formula type
 */
export function isLegacyFormulaInputType(legacyType: string): boolean {
  return [
    'formula',
    'formulaWhole',
    'formulaCurrency',
    'formulaCurrencyWhole',
    'textFormula',
  ].includes(legacyType);
}

/**
 * Check if a unified input type is a formula type.
 *
 * @param inputType - Unified input type
 * @returns true if it's a formula type
 */
export function isFormulaInputType(inputType: UnifiedInputType): boolean {
  return inputType === UnifiedInputType.FORMULA;
}

/**
 * Check if a legacy input type is a payment/card type.
 *
 * @param legacyType - Legacy input type string
 * @returns true if it's a payment-related type
 */
export function isPaymentInputType(legacyType: string): boolean {
  return ['creditCard', 'ccExpDate'].includes(legacyType);
}

/**
 * Check if a legacy cell type is a payment cell.
 *
 * @param legacyCellType - Legacy cell type string
 * @returns true if it's a payment-related cell
 */
export function isPaymentCellType(legacyCellType: string): boolean {
  return [
    'creditCardCell',
    'bankAccountCell',
    'securePaymentCaptureAll',
  ].includes(legacyCellType);
}

/**
 * Check if a legacy cell type supports user input.
 *
 * @param legacyCellType - Legacy cell type string
 * @returns true if the cell supports user input
 */
export function cellTypeSupportsInput(legacyCellType: string): boolean {
  const nonInputTypes = [
    'textOnly',
    'emptySpace',
    'header',
    'detailCell',
    'measureSheetItemDetail',
  ];
  return !nonInputTypes.includes(legacyCellType);
}

/**
 * Get all supported legacy input type strings.
 *
 * @returns Array of all supported legacy input type strings
 */
export function getAllLegacyInputTypes(): string[] {
  return Object.keys(LEGACY_INPUT_TYPE_MAP);
}

/**
 * Get all supported legacy cell type strings.
 *
 * @returns Array of all supported legacy cell type strings
 */
export function getAllLegacyCellTypes(): string[] {
  return Object.keys(LEGACY_CELL_TYPE_MAP);
}
