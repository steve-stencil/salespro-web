/**
 * Merge Field Entities - Barrel Export
 *
 * System Fields:
 * - SYSTEM_MERGE_FIELDS: Code constant defining global system merge fields
 *
 * Custom Fields (Database):
 * - CustomMergeFieldDefinition: Per-company custom field library
 *
 * Junction Tables:
 * - MsiCustomMergeField: Links MSIs to custom merge field definitions
 * - OptionCustomMergeField: Links Options to custom merge field definitions
 * - UpChargeCustomMergeField: Links UpCharges to custom merge field definitions
 *
 * @see ADR-010-merge-field-system.md for design rationale
 */

// System merge fields (code-based, not database)
export {
  SYSTEM_MERGE_FIELDS,
  SYSTEM_MERGE_FIELD_KEYS,
  isSystemMergeFieldKey,
  getSystemMergeFieldsByCategory,
  type SystemMergeFieldDefinition,
  type SystemMergeFieldKey,
} from './system-merge-fields';

// Custom merge field entity (database)
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
