/**
 * System Merge Fields - Code-based registry.
 *
 * These are global, computed fields shared across all companies.
 * Values are computed at runtime from entity data (e.g., item.quantity
 * comes from the line item's actual quantity).
 *
 * Unlike CustomMergeFieldDefinition (stored in DB per-company),
 * system fields are defined here as a constant and don't require
 * database storage or seeding.
 *
 * @example
 * ```typescript
 * // System fields appear in templates as:
 * // {{item.quantity}}, {{option.selected.totalPrice}}, etc.
 *
 * // Check if a key is valid:
 * if (key in SYSTEM_MERGE_FIELDS) { ... }
 *
 * // Get field metadata:
 * const field = SYSTEM_MERGE_FIELDS['item.quantity'];
 * console.log(field.displayName); // "Quantity"
 * ```
 *
 * @see ADR-010-merge-field-system.md for design rationale
 */

import { MergeFieldCategory, MergeFieldDataType } from './types';

/**
 * System merge field definition shape.
 */
export type SystemMergeFieldDefinition = {
  /** Human-readable name for UI display */
  displayName: string;
  /** Help text explaining what this field contains */
  description: string;
  /** Category for grouping in UI */
  category: MergeFieldCategory;
  /** Data type - controls formatting when rendered */
  dataType: MergeFieldDataType;
};

/**
 * Registry of all system merge fields.
 *
 * Keys are the field identifiers used in templates (e.g., "item.quantity").
 * Values contain metadata for display and formatting.
 */
export const SYSTEM_MERGE_FIELDS = {
  // ============ ITEM Fields ============
  'item.quantity': {
    displayName: 'Quantity',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.NUMBER,
    description: 'The quantity/count of this line item',
  },
  'item.name': {
    displayName: 'Item Name',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'The name of the measure sheet item',
  },
  'item.note': {
    displayName: 'Item Note',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'Notes/description for the item',
  },
  'item.category': {
    displayName: 'Category',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'The category this item belongs to',
  },
  'item.measurementType': {
    displayName: 'Measurement Type',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'Unit of measure (e.g., sqft, each, linft)',
  },
  'item.tag': {
    displayName: 'Tag Value',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'Value from the tag field (if configured)',
  },

  // ============ OPTION Fields ============
  'option.selected.name': {
    displayName: 'Selected Option Name',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.TEXT,
    description: 'Name of the selected product option',
  },
  'option.selected.brand': {
    displayName: 'Selected Option Brand',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.TEXT,
    description: 'Brand/manufacturer of the selected option',
  },
  'option.selected.unitPrice': {
    displayName: 'Unit Price',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.CURRENCY,
    description: 'Price per unit for the selected option',
  },
  'option.selected.totalPrice': {
    displayName: 'Total Price',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.CURRENCY,
    description: 'Total price (unit price × quantity)',
  },
  'option.selected.itemCode': {
    displayName: 'Item Code',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.TEXT,
    description: 'SKU/product code for the selected option',
  },

  // ============ CUSTOMER Fields ============
  'customer.name': {
    displayName: 'Customer Name',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Full name of the customer',
  },
  'customer.firstName': {
    displayName: 'Customer First Name',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'First name of the customer',
  },
  'customer.lastName': {
    displayName: 'Customer Last Name',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Last name of the customer',
  },
  'customer.email': {
    displayName: 'Customer Email',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Email address of the customer',
  },
  'customer.phone': {
    displayName: 'Customer Phone',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Phone number of the customer',
  },
  'customer.address': {
    displayName: 'Job Address',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Full address of the job site',
  },
  'customer.city': {
    displayName: 'City',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'City of the job site',
  },
  'customer.state': {
    displayName: 'State',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'State/province of the job site',
  },
  'customer.zip': {
    displayName: 'ZIP Code',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'ZIP/postal code of the job site',
  },

  // ============ USER (Sales Rep) Fields ============
  'user.name': {
    displayName: 'Sales Rep Name',
    category: MergeFieldCategory.USER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Full name of the sales representative',
  },
  'user.email': {
    displayName: 'Sales Rep Email',
    category: MergeFieldCategory.USER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Email address of the sales representative',
  },
  'user.phone': {
    displayName: 'Sales Rep Phone',
    category: MergeFieldCategory.USER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Phone number of the sales representative',
  },

  // ============ COMPANY Fields ============
  'company.name': {
    displayName: 'Company Name',
    category: MergeFieldCategory.COMPANY,
    dataType: MergeFieldDataType.TEXT,
    description: 'Name of the company',
  },
  'company.phone': {
    displayName: 'Company Phone',
    category: MergeFieldCategory.COMPANY,
    dataType: MergeFieldDataType.TEXT,
    description: 'Main phone number of the company',
  },
  'company.email': {
    displayName: 'Company Email',
    category: MergeFieldCategory.COMPANY,
    dataType: MergeFieldDataType.TEXT,
    description: 'Main email address of the company',
  },
  'company.address': {
    displayName: 'Company Address',
    category: MergeFieldCategory.COMPANY,
    dataType: MergeFieldDataType.TEXT,
    description: 'Physical address of the company',
  },
  'company.website': {
    displayName: 'Company Website',
    category: MergeFieldCategory.COMPANY,
    dataType: MergeFieldDataType.TEXT,
    description: 'Website URL of the company',
  },
} as const satisfies Record<string, SystemMergeFieldDefinition>;

/**
 * Type representing valid system merge field keys.
 * Use this for type-safe field key validation.
 */
export type SystemMergeFieldKey = keyof typeof SYSTEM_MERGE_FIELDS;

/**
 * Array of all system merge field keys.
 * Useful for iteration and validation.
 */
export const SYSTEM_MERGE_FIELD_KEYS = Object.keys(
  SYSTEM_MERGE_FIELDS,
) as SystemMergeFieldKey[];

/**
 * Check if a string is a valid system merge field key.
 *
 * @param key - The key to check
 * @returns True if the key is a valid system merge field
 */
export function isSystemMergeFieldKey(key: string): key is SystemMergeFieldKey {
  return key in SYSTEM_MERGE_FIELDS;
}

/**
 * Get system merge fields grouped by category.
 *
 * @returns Map of category to array of [key, definition] pairs
 */
export function getSystemMergeFieldsByCategory(): Map<
  MergeFieldCategory,
  Array<[SystemMergeFieldKey, SystemMergeFieldDefinition]>
> {
  const byCategory = new Map<
    MergeFieldCategory,
    Array<[SystemMergeFieldKey, SystemMergeFieldDefinition]>
  >();

  for (const [key, def] of Object.entries(SYSTEM_MERGE_FIELDS) as Array<
    [SystemMergeFieldKey, SystemMergeFieldDefinition]
  >) {
    const list = byCategory.get(def.category) ?? [];
    list.push([key, def]);
    byCategory.set(def.category, list);
  }

  return byCategory;
}
