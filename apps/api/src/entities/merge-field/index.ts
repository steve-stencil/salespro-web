/**
 * Merge Field Entities - Barrel Export
 *
 * Core Entities:
 * - MergeField: Global SYSTEM merge fields (shared across all companies)
 * - CustomMergeFieldDefinition: Per-company custom field library
 *
 * Junction Tables:
 * - MsiCustomMergeField: Links MSIs to custom merge field definitions
 * - OptionCustomMergeField: Links Options to custom merge field definitions
 * - UpChargeCustomMergeField: Links UpCharges to custom merge field definitions
 *
 * @see ADR-010-merge-field-system.md for design rationale
 */

// Core entities
export { MergeField } from './MergeField.entity';
export { CustomMergeFieldDefinition } from './CustomMergeFieldDefinition.entity';

// Junction tables
export { MsiCustomMergeField } from './MsiCustomMergeField.entity';
export { OptionCustomMergeField } from './OptionCustomMergeField.entity';
export { UpChargeCustomMergeField } from './UpChargeCustomMergeField.entity';

// Types and enums
export {
  MergeFieldCategory,
  MergeFieldDataType,
  MERGE_FIELD_CATEGORY_LABELS,
  MERGE_FIELD_DATA_TYPE_LABELS,
} from './types';
