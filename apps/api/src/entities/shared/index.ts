/**
 * Shared entity types and utilities
 *
 * This module contains types and utilities shared across entity domains:
 * - Unified input/cell types (consolidated from legacy systems)
 * - Legacy type mappers for ETL operations
 */

// Unified input/cell type system
export {
  UnifiedInputType,
  UnifiedCellType,
  SizePickerPrecision,
  FormulaOutputFormat,
  FieldScope,
  INPUT_TYPE_METADATA,
  CELL_TYPE_METADATA,
} from './input-types';

export type {
  SizePickerConfig,
  UnitedInchConfig,
  PhotoFieldConfig,
  SwitchConfig,
  DateTimeConfig,
  NumericConfig,
  FormulaConfig,
  LinkedValueConfig,
  PickerConfig,
  DynamicInputConfig,
  FontConfig,
} from './input-types';

// Legacy type mappers
export {
  mapLegacyInputType,
  mapLegacyCellType,
  mapLegacyPrecision,
  isFormulaInputType,
  isLegacyFormulaInputType,
  isPaymentInputType,
  isPaymentCellType,
  cellTypeSupportsInput,
  getAllLegacyInputTypes,
  getAllLegacyCellTypes,
} from './legacy-type-mapper';

export type { LegacyInputTypeMapping } from './legacy-type-mapper';
