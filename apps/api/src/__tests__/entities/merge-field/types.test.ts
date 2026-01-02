import { describe, it, expect } from 'vitest';

import {
  MergeFieldCategory,
  MergeFieldDataType,
  MERGE_FIELD_CATEGORY_LABELS,
  MERGE_FIELD_DATA_TYPE_LABELS,
} from '../../../entities/merge-field';

describe('Merge Field Types', () => {
  describe('MergeFieldCategory', () => {
    it('should have all expected category values', () => {
      expect(MergeFieldCategory.ITEM).toBe('ITEM');
      expect(MergeFieldCategory.OPTION).toBe('OPTION');
      expect(MergeFieldCategory.UPCHARGE).toBe('UPCHARGE');
      expect(MergeFieldCategory.CUSTOMER).toBe('CUSTOMER');
      expect(MergeFieldCategory.USER).toBe('USER');
      expect(MergeFieldCategory.COMPANY).toBe('COMPANY');
    });

    it('should have exactly 6 categories', () => {
      const categories = Object.values(MergeFieldCategory);
      expect(categories).toHaveLength(6);
    });
  });

  describe('MergeFieldDataType', () => {
    it('should have all expected data type values', () => {
      expect(MergeFieldDataType.TEXT).toBe('TEXT');
      expect(MergeFieldDataType.NUMBER).toBe('NUMBER');
      expect(MergeFieldDataType.CURRENCY).toBe('CURRENCY');
      expect(MergeFieldDataType.DATE).toBe('DATE');
      expect(MergeFieldDataType.BOOLEAN).toBe('BOOLEAN');
      expect(MergeFieldDataType.IMAGE).toBe('IMAGE');
    });

    it('should have exactly 6 data types', () => {
      const dataTypes = Object.values(MergeFieldDataType);
      expect(dataTypes).toHaveLength(6);
    });
  });

  describe('MERGE_FIELD_CATEGORY_LABELS', () => {
    it('should have labels for all categories', () => {
      expect(MERGE_FIELD_CATEGORY_LABELS[MergeFieldCategory.ITEM]).toBe('Item');
      expect(MERGE_FIELD_CATEGORY_LABELS[MergeFieldCategory.OPTION]).toBe(
        'Option',
      );
      expect(MERGE_FIELD_CATEGORY_LABELS[MergeFieldCategory.UPCHARGE]).toBe(
        'UpCharge',
      );
      expect(MERGE_FIELD_CATEGORY_LABELS[MergeFieldCategory.CUSTOMER]).toBe(
        'Customer',
      );
      expect(MERGE_FIELD_CATEGORY_LABELS[MergeFieldCategory.USER]).toBe('User');
      expect(MERGE_FIELD_CATEGORY_LABELS[MergeFieldCategory.COMPANY]).toBe(
        'Company',
      );
    });

    it('should have a label for every category', () => {
      const categories = Object.values(MergeFieldCategory);
      for (const category of categories) {
        expect(MERGE_FIELD_CATEGORY_LABELS[category]).toBeDefined();
        expect(typeof MERGE_FIELD_CATEGORY_LABELS[category]).toBe('string');
      }
    });
  });

  describe('MERGE_FIELD_DATA_TYPE_LABELS', () => {
    it('should have labels for all data types', () => {
      expect(MERGE_FIELD_DATA_TYPE_LABELS[MergeFieldDataType.TEXT]).toBe(
        'Text',
      );
      expect(MERGE_FIELD_DATA_TYPE_LABELS[MergeFieldDataType.NUMBER]).toBe(
        'Number',
      );
      expect(MERGE_FIELD_DATA_TYPE_LABELS[MergeFieldDataType.CURRENCY]).toBe(
        'Currency',
      );
      expect(MERGE_FIELD_DATA_TYPE_LABELS[MergeFieldDataType.DATE]).toBe(
        'Date',
      );
      expect(MERGE_FIELD_DATA_TYPE_LABELS[MergeFieldDataType.BOOLEAN]).toBe(
        'Boolean',
      );
      expect(MERGE_FIELD_DATA_TYPE_LABELS[MergeFieldDataType.IMAGE]).toBe(
        'Image',
      );
    });

    it('should have a label for every data type', () => {
      const dataTypes = Object.values(MergeFieldDataType);
      for (const dataType of dataTypes) {
        expect(MERGE_FIELD_DATA_TYPE_LABELS[dataType]).toBeDefined();
        expect(typeof MERGE_FIELD_DATA_TYPE_LABELS[dataType]).toBe('string');
      }
    });
  });
});
