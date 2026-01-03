/**
 * Unified Input & Cell Types
 *
 * This module consolidates input types from three legacy systems:
 * 1. AdditionalDetailObject - price guide MSIs/PGIs (leap-one/Estimate Pro/PriceGuide/ItemPrices/AdditionalDetailObject.m)
 * 2. ContractDataBodyCellItem - contracts/forms (leap-one/Estimate Pro/ContractDataBodyCellItem.swift)
 * 3. ResultObject - results entry (leap-one/Estimate Pro/ResultsConfig.swift)
 *
 * Server validation: leaponeserver/cloud/classes/ContractObject/ValidateContractData/body.cjs
 *
 * @see leap-one/Estimate Pro/Constants.h for kInputType* and kCellType* definitions
 * @see leap-one/Estimate Pro/SSTextField.swift for TextFieldInputStyle enum
 */

// ============================================================================
// INPUT TYPES - Control what keyboard/picker appears for data entry
// ============================================================================

/**
 * Unified input types for all data entry fields.
 *
 * Organized into categories:
 * - TEXT: Basic text entry
 * - PICKER: Selection from options
 * - NUMERIC: Numbers and currency
 * - SIZE: Dimension entry with precision
 * - DATE_TIME: Temporal values
 * - SPECIAL: Phone, email, etc. with validation/formatting
 * - FORMULA: Calculated values (contracts only)
 * - DYNAMIC: Conditional inputs (contracts only)
 *
 * NOTE: Values use snake_case to match database schema and existing entities.
 * Legacy mappers handle conversion from camelCase legacy types.
 */
export enum UnifiedInputType {
  // ========== TEXT INPUTS ==========
  /** Single-line text input (default) */
  TEXT = 'text',
  /** Multi-line text input (textarea, textView) */
  TEXTAREA = 'textarea',

  // ========== PICKER INPUTS ==========
  /** Single-select dropdown picker */
  PICKER = 'picker',
  /** Multi-select picker allowing multiple selections */
  MULTI_SELECT_PICKER = 'multi_select_picker',
  /** US State picker (filtered list of states) */
  STATE_PICKER = 'state_picker',
  /** Finance options picker (contract-specific) */
  FINANCE_OPTIONS_PICKER = 'finance_options_picker',

  // ========== NUMERIC INPUTS ==========
  /**
   * Numeric input with configurable decimal places.
   * Use `numericConfig.decimalPlaces` to control precision (default: 0 for integers).
   * Legacy: keypad, numbers (decimalPlaces=0), numberKeyboard (decimalPlaces>0)
   */
  NUMBER = 'number',
  /**
   * Currency input with configurable decimal places.
   * Use `numericConfig.decimalPlaces` to control precision (default: 2 for cents).
   * Legacy: currency, currencyDecimal (decimalPlaces=2), currencyWhole (decimalPlaces=0)
   */
  CURRENCY = 'currency',

  // ========== SIZE PICKER INPUTS ==========
  /** 2D size picker (width x height) - requires precision in config */
  SIZE_PICKER = 'size_picker',
  /** 3D size picker (width x height x depth) - requires precision in config */
  SIZE_PICKER_3D = 'size_picker_3d',
  /** United inch picker - width + height combined as "UI" value */
  UNITED_INCH = 'united_inch',

  // ========== DATE/TIME INPUTS ==========
  /** Date picker (date only) */
  DATE = 'date',
  /** Time picker (time only) */
  TIME = 'time',
  /** DateTime picker (date and time) */
  DATETIME = 'datetime',

  // ========== SPECIAL FORMAT INPUTS ==========
  /** Phone number with formatting */
  PHONE = 'phone',
  /** Email address with validation */
  EMAIL = 'email',
  /** Social security number (masked) */
  SSN = 'ssn',
  /** Zip code (5 or 9 digit) */
  ZIP_CODE = 'zip_code',
  /** Credit card number (masked, with validation) */
  CREDIT_CARD = 'credit_card',
  /** Credit card expiration date (MM/YY) */
  CREDIT_CARD_EXP = 'credit_card_exp',
  /** Years numeric input (1-99) */
  YEARS = 'years',
  /** Months numeric input (1-12) */
  MONTHS = 'months',
  /** Numbers with punctuation (. , - etc.) */
  NUMBERS_PUNCTUATION = 'numbers_punctuation',

  // ========== FORMULA INPUTS (Contract-specific) ==========
  /**
   * Calculated value from formula expression.
   * Use `formulaConfig.outputFormat` to control output type (number, currency, text).
   * Use `formulaConfig.decimalPlaces` to control precision.
   * Legacy: formula, formulaWhole, formulaCurrency, formulaCurrencyWhole, textFormula
   */
  FORMULA = 'formula',

  // ========== DYNAMIC/CONDITIONAL INPUTS ==========
  /** Dynamic input - changes based on other field values */
  DYNAMIC = 'dynamic',
  /** Linked value - value sourced from another field */
  LINKED_VALUE = 'linked_value',
}

// ============================================================================
// CELL TYPES - Control how the field is displayed/rendered
// ============================================================================

/**
 * Unified cell types for field rendering.
 *
 * Cell type determines the visual appearance and layout of the field,
 * independent of the input type (which controls data entry).
 *
 * NOTE: Values use snake_case to match database schema.
 */
export enum UnifiedCellType {
  // ========== TEXT DISPLAY CELLS ==========
  /** Short single-line text field (default) - legacy: textShort, textWords */
  TEXT_SHORT = 'text_short',
  /** Medium text field - legacy: textLong, textSentence */
  TEXT_LONG = 'text_long',
  /** Extra long text field - legacy: textXLong, textParagraph */
  TEXT_XLONG = 'text_xlong',
  /** Display-only text (no input) - legacy: textOnly */
  TEXT_ONLY = 'text_only',

  // ========== SIMPLE TEXT (for backwards compat with price guide) ==========
  /** Simple text display - legacy: text */
  TEXT = 'text',

  // ========== TOGGLE/SWITCH CELLS ==========
  /** Boolean toggle switch - legacy: switched */
  SWITCH = 'switch',

  // ========== MEDIA CELLS ==========
  /** Photo selector/display - legacy: photos, photoPickerCell */
  PHOTOS = 'photos',
  /** Drawing canvas - legacy: drawing */
  DRAWING = 'drawing',
  /** Image picker from library - legacy: imagePicker */
  IMAGE_PICKER = 'image_picker',

  // ========== STRUCTURAL CELLS ==========
  /** Expandable detail section - legacy: detailCell */
  DETAIL = 'detail',
  /** Section header - legacy: header */
  HEADER = 'header',
  /** Empty space/divider - legacy: emptySpace */
  SPACER = 'spacer',

  // ========== SIGNATURE CELLS ==========
  /** Signature capture - legacy: signatures */
  SIGNATURE = 'signature',

  // ========== PAYMENT CELLS ==========
  /** Credit card entry UI - legacy: creditCardCell */
  CREDIT_CARD = 'credit_card',
  /** Bank account entry UI - legacy: bankAccountCell */
  BANK_ACCOUNT = 'bank_account',
  /** Omnibus payment capture - legacy: securePaymentCaptureAll */
  PAYMENT_CAPTURE = 'payment_capture',

  // ========== INTEGRATION CELLS ==========
  /** ProVia integration cell - legacy: provia */
  PROVIA = 'provia',
  /** Measure sheet item detail - legacy: measureSheetItemDetail */
  MSI_DETAIL = 'msi_detail',
}

// ============================================================================
// SIZE PICKER PRECISION
// ============================================================================

/**
 * Precision options for SIZE_PICKER and SIZE_PICKER_3D input types.
 *
 * NOTE: Values match existing database schema from price-guide entities.
 */
export enum SizePickerPrecision {
  /** Whole inches only (1, 2, 3...) */
  INCH = 'inch',
  /** Quarter inch increments (1, 1.25, 1.5, 1.75...) */
  QUARTER_INCH = 'quarter_inch',
  /** Eighth inch increments (1, 1.125, 1.25...) */
  EIGHTH_INCH = 'eighth_inch',
  /** Sixteenth inch increments (1, 1.0625, 1.125...) */
  SIXTEENTH_INCH = 'sixteenth_inch',
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for SIZE_PICKER and SIZE_PICKER_3D input types.
 */
export type SizePickerConfig = {
  /** Measurement precision */
  precision: SizePickerPrecision;
  /** Minimum width value (default: 1) */
  minWidth?: number;
  /** Maximum width value (default: 1000) */
  maxWidth?: number;
  /** Minimum height value (default: 1) */
  minHeight?: number;
  /** Maximum height value (default: 1000) */
  maxHeight?: number;
  /** Minimum depth value - SIZE_PICKER_3D only (default: 1) */
  minDepth?: number;
  /** Maximum depth value - SIZE_PICKER_3D only (default: 1000) */
  maxDepth?: number;
};

/**
 * Configuration for UNITED_INCH input type.
 */
export type UnitedInchConfig = {
  /** Suffix to display after the value (default: " UI") */
  suffix?: string;
};

/**
 * Configuration for PHOTOS cell type.
 */
export type PhotoFieldConfig = {
  /** Whether to disable template photo linking */
  disableTemplatePhotoLinking?: boolean;
  /** Allow photos from measurement reports */
  allowReportPhotos?: boolean;
  /** Image source mode: 'default' or 'unique' */
  imagesSource?: 'default' | 'unique';
};

/**
 * Configuration for SWITCH cell type.
 */
export type SwitchConfig = {
  /** Value when switch is ON (default: "YES") */
  valueOn?: string;
  /** Value when switch is OFF (default: "NO") */
  valueOff?: string;
};

/**
 * Configuration for date/time input types.
 */
export type DateTimeConfig = {
  /** Display format string (e.g., "MM/dd/yyyy", "h:mm a") */
  displayFormat?: string;
};

/**
 * Configuration for numeric input types (NUMBER, CURRENCY).
 */
export type NumericConfig = {
  /**
   * Number of decimal places to display/allow.
   * - For NUMBER: default is 0 (integers)
   * - For CURRENCY: default is 2 (cents)
   */
  decimalPlaces?: number;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
};

/**
 * Output format for formula results.
 */
export enum FormulaOutputFormat {
  /** Raw number output */
  NUMBER = 'number',
  /** Currency formatted output (with $ symbol) */
  CURRENCY = 'currency',
  /** Text output (for text formulas with placeholders) */
  TEXT = 'text',
}

/**
 * Configuration for formula input types.
 */
export type FormulaConfig = {
  /** Formula expression with cell references [cellId] */
  formula: string;
  /**
   * Output format for the calculated result.
   * - NUMBER: numeric output (e.g., "42.5")
   * - CURRENCY: currency formatted (e.g., "$42.50")
   * - TEXT: text template with placeholders
   */
  outputFormat?: FormulaOutputFormat;
  /**
   * Number of decimal places for numeric/currency output.
   * - For NUMBER: default is variable (as calculated)
   * - For CURRENCY: default is 2
   * Legacy mapping:
   * - formula → NUMBER, variable decimals
   * - formulaWhole → NUMBER, decimalPlaces=0
   * - formulaCurrency → CURRENCY, decimalPlaces=2
   * - formulaCurrencyWhole → CURRENCY, decimalPlaces=0
   * - textFormula → TEXT
   */
  decimalPlaces?: number;
  /** Whether to clear value if result is zero */
  clearIfZero?: boolean;
};

/**
 * Configuration for linked value inputs.
 */
export type LinkedValueConfig = {
  /** ID of the source field to link to */
  sourceFieldId: string;
  /** Priority for overwriting (0-1000, higher wins) */
  overwritePriority?: number;
};

/**
 * Configuration for PICKER and MULTI_SELECT_PICKER input types.
 */
export type PickerConfig = {
  /** Available options */
  values: string[];
  /** Separator for multi-select display (default: ", ") */
  multiSelectSeparator?: string;
};

/**
 * Configuration for dynamic inputs.
 */
export type DynamicInputConfig = {
  /** Cell ID for targeting */
  cellId: string;
  /** Array of conditional input configurations */
  objects: Array<{
    inputType: UnifiedInputType;
    enabled: boolean;
    required: boolean;
    values?: string[];
    pickerValues?: string[];
    defaultValue?: string;
  }>;
};

// ============================================================================
// FONT/STYLING CONFIGURATION (Contract cells)
// ============================================================================

/**
 * Font styling configuration for contract cells.
 */
export type FontConfig = {
  /** Font size in points */
  size?: number;
  /** Bold text */
  bold?: boolean;
  /** Underlined text */
  underline?: boolean;
  /** Font family name */
  fontName?: string;
  /** Color in "R-G-B-A" format (e.g., "255-0-0-1" for red) */
  color?: string;
};

// ============================================================================
// SCOPE INDICATORS
// ============================================================================

/**
 * Indicates where an input/cell type can be used.
 * Used for validation and UI filtering.
 */
export enum FieldScope {
  /** Price guide additional details (MSIs, UpCharges) */
  PRICE_GUIDE = 'priceGuide',
  /** Contract form cells */
  CONTRACT = 'contract',
  /** Results entry fields */
  RESULTS = 'results',
  /** Universal - can be used anywhere */
  UNIVERSAL = 'universal',
}

/**
 * Metadata about each input type including allowed scopes.
 */
export const INPUT_TYPE_METADATA: Record<
  UnifiedInputType,
  {
    label: string;
    description: string;
    scopes: FieldScope[];
    requiresConfig?: string;
  }
> = {
  // Text
  [UnifiedInputType.TEXT]: {
    label: 'Text',
    description: 'Single-line text input',
    scopes: [FieldScope.UNIVERSAL],
  },
  [UnifiedInputType.TEXTAREA]: {
    label: 'Text Area',
    description: 'Multi-line text input',
    scopes: [FieldScope.UNIVERSAL],
  },

  // Pickers
  [UnifiedInputType.PICKER]: {
    label: 'Picker',
    description: 'Single-select dropdown',
    scopes: [FieldScope.UNIVERSAL],
    requiresConfig: 'pickerConfig',
  },
  [UnifiedInputType.MULTI_SELECT_PICKER]: {
    label: 'Multi-Select Picker',
    description: 'Multiple selection picker',
    scopes: [FieldScope.UNIVERSAL],
    requiresConfig: 'pickerConfig',
  },
  [UnifiedInputType.STATE_PICKER]: {
    label: 'State Picker',
    description: 'US State dropdown',
    scopes: [FieldScope.CONTRACT],
  },
  [UnifiedInputType.FINANCE_OPTIONS_PICKER]: {
    label: 'Finance Options',
    description: 'Finance options picker',
    scopes: [FieldScope.CONTRACT],
  },

  // Numeric
  [UnifiedInputType.NUMBER]: {
    label: 'Number',
    description: 'Numeric input with configurable decimal places',
    scopes: [FieldScope.UNIVERSAL],
    requiresConfig: 'numericConfig',
  },
  [UnifiedInputType.CURRENCY]: {
    label: 'Currency',
    description: 'Currency input with configurable decimal places',
    scopes: [FieldScope.UNIVERSAL],
    requiresConfig: 'numericConfig',
  },

  // Size Pickers
  [UnifiedInputType.SIZE_PICKER]: {
    label: 'Size Picker (2D)',
    description: 'Width x Height dimensions',
    scopes: [FieldScope.UNIVERSAL],
    requiresConfig: 'sizePickerConfig',
  },
  [UnifiedInputType.SIZE_PICKER_3D]: {
    label: 'Size Picker (3D)',
    description: 'Width x Height x Depth dimensions',
    scopes: [FieldScope.UNIVERSAL],
    requiresConfig: 'sizePickerConfig',
  },
  [UnifiedInputType.UNITED_INCH]: {
    label: 'United Inch',
    description: 'Combined W+H as united inches',
    scopes: [FieldScope.UNIVERSAL],
    requiresConfig: 'unitedInchConfig',
  },

  // Date/Time
  [UnifiedInputType.DATE]: {
    label: 'Date',
    description: 'Date picker',
    scopes: [FieldScope.UNIVERSAL],
    requiresConfig: 'dateTimeConfig',
  },
  [UnifiedInputType.TIME]: {
    label: 'Time',
    description: 'Time picker',
    scopes: [FieldScope.UNIVERSAL],
    requiresConfig: 'dateTimeConfig',
  },
  [UnifiedInputType.DATETIME]: {
    label: 'Date & Time',
    description: 'Date and time picker',
    scopes: [FieldScope.UNIVERSAL],
    requiresConfig: 'dateTimeConfig',
  },

  // Special Formats
  [UnifiedInputType.PHONE]: {
    label: 'Phone Number',
    description: 'Phone with formatting',
    scopes: [FieldScope.CONTRACT, FieldScope.RESULTS],
  },
  [UnifiedInputType.EMAIL]: {
    label: 'Email',
    description: 'Email address with validation',
    scopes: [FieldScope.CONTRACT, FieldScope.RESULTS],
  },
  [UnifiedInputType.SSN]: {
    label: 'SSN',
    description: 'Social security number (masked)',
    scopes: [FieldScope.CONTRACT],
  },
  [UnifiedInputType.ZIP_CODE]: {
    label: 'Zip Code',
    description: 'US zip code',
    scopes: [FieldScope.CONTRACT],
  },
  [UnifiedInputType.CREDIT_CARD]: {
    label: 'Credit Card',
    description: 'Credit card number',
    scopes: [FieldScope.CONTRACT],
  },
  [UnifiedInputType.CREDIT_CARD_EXP]: {
    label: 'CC Expiration',
    description: 'Credit card expiration',
    scopes: [FieldScope.CONTRACT],
  },
  [UnifiedInputType.YEARS]: {
    label: 'Years',
    description: 'Years numeric input',
    scopes: [FieldScope.CONTRACT],
  },
  [UnifiedInputType.MONTHS]: {
    label: 'Months',
    description: 'Months numeric input',
    scopes: [FieldScope.CONTRACT],
  },
  [UnifiedInputType.NUMBERS_PUNCTUATION]: {
    label: 'Numbers & Punctuation',
    description: 'Numbers with . , -',
    scopes: [FieldScope.CONTRACT],
  },

  // Formula
  [UnifiedInputType.FORMULA]: {
    label: 'Formula',
    description:
      'Calculated value with configurable output format and precision',
    scopes: [FieldScope.CONTRACT],
    requiresConfig: 'formulaConfig',
  },

  // Dynamic
  [UnifiedInputType.DYNAMIC]: {
    label: 'Dynamic',
    description: 'Conditional input',
    scopes: [FieldScope.CONTRACT, FieldScope.RESULTS],
    requiresConfig: 'dynamicConfig',
  },
  [UnifiedInputType.LINKED_VALUE]: {
    label: 'Linked Value',
    description: 'Value from another field',
    scopes: [FieldScope.CONTRACT, FieldScope.RESULTS],
    requiresConfig: 'linkedValueConfig',
  },
};

/**
 * Metadata about each cell type including allowed scopes.
 */
export const CELL_TYPE_METADATA: Record<
  UnifiedCellType,
  {
    label: string;
    description: string;
    scopes: FieldScope[];
    supportsInput: boolean;
  }
> = {
  // Text Display
  [UnifiedCellType.TEXT_SHORT]: {
    label: 'Text (Short)',
    description: 'Short single-line field',
    scopes: [FieldScope.UNIVERSAL],
    supportsInput: true,
  },
  [UnifiedCellType.TEXT_LONG]: {
    label: 'Text (Long)',
    description: 'Medium text field',
    scopes: [FieldScope.UNIVERSAL],
    supportsInput: true,
  },
  [UnifiedCellType.TEXT_XLONG]: {
    label: 'Text (Extra Long)',
    description: 'Large text field',
    scopes: [FieldScope.UNIVERSAL],
    supportsInput: true,
  },
  [UnifiedCellType.TEXT_ONLY]: {
    label: 'Text Only',
    description: 'Display only (no input)',
    scopes: [FieldScope.CONTRACT],
    supportsInput: false,
  },
  [UnifiedCellType.TEXT]: {
    label: 'Text',
    description: 'Simple text display (price guide)',
    scopes: [FieldScope.PRICE_GUIDE],
    supportsInput: true,
  },

  // Toggle
  [UnifiedCellType.SWITCH]: {
    label: 'Switch',
    description: 'Toggle switch',
    scopes: [FieldScope.CONTRACT],
    supportsInput: true,
  },

  // Media
  [UnifiedCellType.PHOTOS]: {
    label: 'Photos',
    description: 'Photo selector',
    scopes: [FieldScope.PRICE_GUIDE, FieldScope.CONTRACT],
    supportsInput: true,
  },
  [UnifiedCellType.DRAWING]: {
    label: 'Drawing',
    description: 'Drawing canvas',
    scopes: [FieldScope.CONTRACT],
    supportsInput: true,
  },
  [UnifiedCellType.IMAGE_PICKER]: {
    label: 'Image Picker',
    description: 'Image selection',
    scopes: [FieldScope.CONTRACT],
    supportsInput: true,
  },

  // Structural
  [UnifiedCellType.DETAIL]: {
    label: 'Detail',
    description: 'Expandable section',
    scopes: [FieldScope.CONTRACT],
    supportsInput: false,
  },
  [UnifiedCellType.HEADER]: {
    label: 'Header',
    description: 'Section header',
    scopes: [FieldScope.CONTRACT],
    supportsInput: false,
  },
  [UnifiedCellType.SPACER]: {
    label: 'Spacer',
    description: 'Empty space',
    scopes: [FieldScope.CONTRACT],
    supportsInput: false,
  },

  // Signature
  [UnifiedCellType.SIGNATURE]: {
    label: 'Signature',
    description: 'Signature capture',
    scopes: [FieldScope.CONTRACT],
    supportsInput: true,
  },

  // Payment
  [UnifiedCellType.CREDIT_CARD]: {
    label: 'Credit Card',
    description: 'Credit card entry',
    scopes: [FieldScope.CONTRACT],
    supportsInput: true,
  },
  [UnifiedCellType.BANK_ACCOUNT]: {
    label: 'Bank Account',
    description: 'Bank account entry',
    scopes: [FieldScope.CONTRACT],
    supportsInput: true,
  },
  [UnifiedCellType.PAYMENT_CAPTURE]: {
    label: 'Payment Capture',
    description: 'Omnibus payment',
    scopes: [FieldScope.CONTRACT],
    supportsInput: true,
  },

  // Integration
  [UnifiedCellType.PROVIA]: {
    label: 'ProVia',
    description: 'ProVia integration',
    scopes: [FieldScope.CONTRACT],
    supportsInput: true,
  },
  [UnifiedCellType.MSI_DETAIL]: {
    label: 'MSI Detail',
    description: 'Measure sheet item detail',
    scopes: [FieldScope.CONTRACT],
    supportsInput: false,
  },
};
