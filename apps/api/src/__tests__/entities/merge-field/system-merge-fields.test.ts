import { describe, it, expect } from 'vitest';

import {
  SYSTEM_MERGE_FIELDS,
  SYSTEM_MERGE_FIELD_KEYS,
  isSystemMergeFieldKey,
  getSystemMergeFieldsByCategory,
  MergeFieldCategory,
} from '../../../entities/merge-field';

describe('System Merge Fields', () => {
  describe('SYSTEM_MERGE_FIELDS', () => {
    it('should have expected item fields', () => {
      expect(SYSTEM_MERGE_FIELDS['item.quantity']).toBeDefined();
      expect(SYSTEM_MERGE_FIELDS['item.name']).toBeDefined();
      expect(SYSTEM_MERGE_FIELDS['item.note']).toBeDefined();
      expect(SYSTEM_MERGE_FIELDS['item.category']).toBeDefined();
    });

    it('should have expected option fields', () => {
      expect(SYSTEM_MERGE_FIELDS['option.selected.name']).toBeDefined();
      expect(SYSTEM_MERGE_FIELDS['option.selected.totalPrice']).toBeDefined();
      expect(SYSTEM_MERGE_FIELDS['option.selected.unitPrice']).toBeDefined();
    });

    it('should have expected customer fields', () => {
      expect(SYSTEM_MERGE_FIELDS['customer.name']).toBeDefined();
      expect(SYSTEM_MERGE_FIELDS['customer.email']).toBeDefined();
      expect(SYSTEM_MERGE_FIELDS['customer.phone']).toBeDefined();
    });

    it('should have expected user fields', () => {
      expect(SYSTEM_MERGE_FIELDS['user.name']).toBeDefined();
      expect(SYSTEM_MERGE_FIELDS['user.email']).toBeDefined();
    });

    it('should have expected company fields', () => {
      expect(SYSTEM_MERGE_FIELDS['company.name']).toBeDefined();
      expect(SYSTEM_MERGE_FIELDS['company.phone']).toBeDefined();
    });

    it('should have displayName for all fields', () => {
      for (const key of SYSTEM_MERGE_FIELD_KEYS) {
        const field = SYSTEM_MERGE_FIELDS[key];
        expect(field.displayName).toBeDefined();
        expect(typeof field.displayName).toBe('string');
        expect(field.displayName.length).toBeGreaterThan(0);
      }
    });

    it('should have description for all fields', () => {
      for (const key of SYSTEM_MERGE_FIELD_KEYS) {
        const field = SYSTEM_MERGE_FIELDS[key];
        expect(field.description).toBeDefined();
        expect(typeof field.description).toBe('string');
      }
    });

    it('should have category for all fields', () => {
      const validCategories = Object.values(MergeFieldCategory);
      for (const key of SYSTEM_MERGE_FIELD_KEYS) {
        const field = SYSTEM_MERGE_FIELDS[key];
        expect(validCategories).toContain(field.category);
      }
    });
  });

  describe('SYSTEM_MERGE_FIELD_KEYS', () => {
    it('should be an array of all field keys', () => {
      expect(Array.isArray(SYSTEM_MERGE_FIELD_KEYS)).toBe(true);
      expect(SYSTEM_MERGE_FIELD_KEYS.length).toBeGreaterThan(0);
    });

    it('should contain expected keys', () => {
      expect(SYSTEM_MERGE_FIELD_KEYS).toContain('item.quantity');
      expect(SYSTEM_MERGE_FIELD_KEYS).toContain('customer.name');
      expect(SYSTEM_MERGE_FIELD_KEYS).toContain('option.selected.totalPrice');
    });
  });

  describe('isSystemMergeFieldKey', () => {
    it('should return true for valid system field keys', () => {
      expect(isSystemMergeFieldKey('item.quantity')).toBe(true);
      expect(isSystemMergeFieldKey('customer.name')).toBe(true);
      expect(isSystemMergeFieldKey('option.selected.totalPrice')).toBe(true);
    });

    it('should return false for invalid keys', () => {
      expect(isSystemMergeFieldKey('invalid.key')).toBe(false);
      expect(isSystemMergeFieldKey('custom.something')).toBe(false);
      expect(isSystemMergeFieldKey('')).toBe(false);
    });

    it('should narrow type correctly', () => {
      const key = 'item.quantity';
      if (isSystemMergeFieldKey(key)) {
        // TypeScript should know this is SystemMergeFieldKey
        const field = SYSTEM_MERGE_FIELDS[key];
        expect(field.displayName).toBe('Quantity');
      }
    });
  });

  describe('getSystemMergeFieldsByCategory', () => {
    it('should return a Map grouped by category', () => {
      const byCategory = getSystemMergeFieldsByCategory();
      expect(byCategory).toBeInstanceOf(Map);
    });

    it('should have ITEM category fields', () => {
      const byCategory = getSystemMergeFieldsByCategory();
      const itemFields = byCategory.get(MergeFieldCategory.ITEM);
      expect(itemFields).toBeDefined();
      expect(itemFields!.length).toBeGreaterThan(0);

      const keys = itemFields!.map(([key]) => key);
      expect(keys).toContain('item.quantity');
      expect(keys).toContain('item.name');
    });

    it('should have CUSTOMER category fields', () => {
      const byCategory = getSystemMergeFieldsByCategory();
      const customerFields = byCategory.get(MergeFieldCategory.CUSTOMER);
      expect(customerFields).toBeDefined();

      const keys = customerFields!.map(([key]) => key);
      expect(keys).toContain('customer.name');
      expect(keys).toContain('customer.email');
    });

    it('should include all fields across all categories', () => {
      const byCategory = getSystemMergeFieldsByCategory();
      let totalCount = 0;
      for (const fields of byCategory.values()) {
        totalCount += fields.length;
      }
      expect(totalCount).toBe(SYSTEM_MERGE_FIELD_KEYS.length);
    });
  });
});
