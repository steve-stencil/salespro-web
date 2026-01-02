/**
 * Category Hierarchy Builder Tests
 *
 * Unit tests for the category hierarchy builder functions.
 * Tests building and flattening category hierarchies from legacy data.
 */

import { describe, it, expect } from 'vitest';

import { PriceGuideCategoryType } from '../../../entities/price-guide/types';
import {
  buildCategoryHierarchy,
  countUniqueCategoryPaths,
  flattenCategoryHierarchy,
  getCategoryPath,
} from '../builders/category-hierarchy.builder';

import type { LegacyCategoryConfig, RawSourceMSI } from '../types';

describe('Category Hierarchy Builder', () => {
  // ==========================================================================
  // buildCategoryHierarchy Tests
  // ==========================================================================

  describe('buildCategoryHierarchy', () => {
    it('should build root categories from CustomConfig', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Windows', order: 1, type: 'default' },
        { name: 'Doors', order: 2, type: 'detail' },
        { name: 'Siding', order: 3, type: 'deep_drill_down' },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, []);

      expect(hierarchy).toHaveLength(3);

      const windows = hierarchy.find(c => c.name === 'Windows');
      expect(windows).toBeDefined();
      expect(windows?.categoryType).toBe(PriceGuideCategoryType.DEFAULT);
      expect(windows?.depth).toBe(0);

      const doors = hierarchy.find(c => c.name === 'Doors');
      expect(doors?.categoryType).toBe(PriceGuideCategoryType.DETAIL);

      const siding = hierarchy.find(c => c.name === 'Siding');
      expect(siding?.categoryType).toBe(PriceGuideCategoryType.DEEP_DRILL_DOWN);
    });

    it('should preserve root category order', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Z-Category', order: 3, type: 'default' },
        { name: 'A-Category', order: 1, type: 'default' },
        { name: 'M-Category', order: 2, type: 'default' },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, []);

      // Should be sorted by order, not name
      expect(hierarchy[0]?.name).toBe('A-Category');
      expect(hierarchy[1]?.name).toBe('M-Category');
      expect(hierarchy[2]?.name).toBe('Z-Category');
    });

    it('should build subcategories from MSI data', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Windows', order: 1, type: 'default' },
      ];

      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Windows',
          subCategory: 'Double Hung',
        },
        {
          objectId: 'msi-2',
          category: 'Windows',
          subCategory: 'Casement',
        },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, msis);

      const windows = hierarchy.find(c => c.name === 'Windows');
      expect(windows?.children.size).toBe(2);
      expect(windows?.children.has('Double Hung')).toBe(true);
      expect(windows?.children.has('Casement')).toBe(true);

      const doubleHung = windows?.children.get('Double Hung');
      expect(doubleHung?.depth).toBe(1);
    });

    it('should build nested subSubCategories', () => {
      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Standard > Vinyl',
        },
      ];

      const hierarchy = buildCategoryHierarchy([], msis);

      const windows = hierarchy.find(c => c.name === 'Windows');
      const doubleHung = windows?.children.get('Double Hung');
      expect(doubleHung?.children.has('Standard')).toBe(true);

      const standard = doubleHung?.children.get('Standard');
      expect(standard?.depth).toBe(2);
      expect(standard?.children.has('Vinyl')).toBe(true);

      const vinyl = standard?.children.get('Vinyl');
      expect(vinyl?.depth).toBe(3);
    });

    it('should create missing root categories from MSI data', () => {
      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Roofing',
          subCategory: 'Shingles',
        },
      ];

      const hierarchy = buildCategoryHierarchy([], msis);

      const roofing = hierarchy.find(c => c.name === 'Roofing');
      expect(roofing).toBeDefined();
      expect(roofing?.categoryType).toBe(PriceGuideCategoryType.DEFAULT);
      expect(roofing?.children.has('Shingles')).toBe(true);
    });

    it('should deduplicate categories from multiple MSIs', () => {
      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1', category: 'Windows', subCategory: 'Double Hung' },
        { objectId: 'msi-2', category: 'Windows', subCategory: 'Double Hung' },
        { objectId: 'msi-3', category: 'Windows', subCategory: 'Double Hung' },
      ];

      const hierarchy = buildCategoryHierarchy([], msis);

      expect(hierarchy).toHaveLength(1);
      const windows = hierarchy[0];
      expect(windows?.children.size).toBe(1);
    });

    it('should handle empty inputs', () => {
      const hierarchy = buildCategoryHierarchy([], []);

      expect(hierarchy).toHaveLength(0);
    });

    it('should handle MSIs without category', () => {
      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1' }, // No category
        { objectId: 'msi-2', category: 'Windows' },
      ];

      const hierarchy = buildCategoryHierarchy([], msis);

      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0]?.name).toBe('Windows');
    });

    it('should preserve sourceId from root categories', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Windows', order: 1, type: 'default', objectId: 'cat-123' },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, []);

      const windows = hierarchy.find(c => c.name === 'Windows');
      expect(windows?.sourceId).toBe('cat-123');
    });
  });

  // ==========================================================================
  // flattenCategoryHierarchy Tests
  // ==========================================================================

  describe('flattenCategoryHierarchy', () => {
    it('should flatten hierarchy to array with paths', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Windows', order: 1, type: 'default' },
      ];

      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Standard',
        },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, msis);
      const flattened = flattenCategoryHierarchy(hierarchy);

      expect(flattened.length).toBe(3);

      const windows = flattened.find(c => c.name === 'Windows');
      expect(windows?.path).toEqual(['Windows']);
      expect(windows?.depth).toBe(0);

      const doubleHung = flattened.find(c => c.name === 'Double Hung');
      expect(doubleHung?.path).toEqual(['Windows', 'Double Hung']);
      expect(doubleHung?.depth).toBe(1);

      const standard = flattened.find(c => c.name === 'Standard');
      expect(standard?.path).toEqual(['Windows', 'Double Hung', 'Standard']);
      expect(standard?.depth).toBe(2);
    });

    it('should maintain sort order within levels', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'B-Category', order: 2, type: 'default' },
        { name: 'A-Category', order: 1, type: 'default' },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, []);
      const flattened = flattenCategoryHierarchy(hierarchy);

      expect(flattened[0]?.name).toBe('A-Category');
      expect(flattened[1]?.name).toBe('B-Category');
    });

    it('should return empty array for empty hierarchy', () => {
      const flattened = flattenCategoryHierarchy([]);

      expect(flattened).toEqual([]);
    });

    it('should include categoryType in flattened categories', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Detail Category', order: 1, type: 'detail' },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, []);
      const flattened = flattenCategoryHierarchy(hierarchy);

      expect(flattened[0]?.categoryType).toBe(PriceGuideCategoryType.DETAIL);
    });
  });

  // ==========================================================================
  // getCategoryPath Tests
  // ==========================================================================

  describe('getCategoryPath', () => {
    it('should return single element for category only', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
        category: 'Windows',
      };

      const path = getCategoryPath(msi);

      expect(path).toEqual(['Windows']);
    });

    it('should return two elements for category and subCategory', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
        category: 'Windows',
        subCategory: 'Double Hung',
      };

      const path = getCategoryPath(msi);

      expect(path).toEqual(['Windows', 'Double Hung']);
    });

    it('should split subSubCategories by ">"', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
        category: 'Windows',
        subCategory: 'Double Hung',
        subSubCategories: 'Standard > Vinyl > White',
      };

      const path = getCategoryPath(msi);

      expect(path).toEqual([
        'Windows',
        'Double Hung',
        'Standard',
        'Vinyl',
        'White',
      ]);
    });

    it('should trim whitespace from subSubCategories parts', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
        category: 'Windows',
        subCategory: 'Double Hung',
        subSubCategories: '  Standard  >  Vinyl  ',
      };

      const path = getCategoryPath(msi);

      expect(path).toEqual(['Windows', 'Double Hung', 'Standard', 'Vinyl']);
    });

    it('should return empty array for MSI without category', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
      };

      const path = getCategoryPath(msi);

      expect(path).toEqual([]);
    });

    it('should skip empty subSubCategories parts', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
        category: 'Windows',
        subCategory: 'Double Hung',
        subSubCategories: 'Standard > > Vinyl',
      };

      const path = getCategoryPath(msi);

      expect(path).toEqual(['Windows', 'Double Hung', 'Standard', 'Vinyl']);
    });

    it('should ignore subSubCategories without subCategory', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
        category: 'Windows',
        subSubCategories: 'Should Be Ignored',
      };

      const path = getCategoryPath(msi);

      expect(path).toEqual(['Windows']);
    });
  });

  // ==========================================================================
  // countUniqueCategoryPaths Tests
  // ==========================================================================

  describe('countUniqueCategoryPaths', () => {
    it('should count unique category paths', () => {
      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1', category: 'Windows' },
        { objectId: 'msi-2', category: 'Doors' },
        { objectId: 'msi-3', category: 'Siding' },
      ];

      const count = countUniqueCategoryPaths(msis);

      expect(count).toBe(3);
    });

    it('should count subcategory paths as separate', () => {
      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1', category: 'Windows', subCategory: 'Double Hung' },
        { objectId: 'msi-2', category: 'Windows', subCategory: 'Casement' },
      ];

      const count = countUniqueCategoryPaths(msis);

      // Windows, Windows>Double Hung, Windows>Casement
      expect(count).toBe(3);
    });

    it('should count nested subSubCategories paths', () => {
      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Standard > Vinyl',
        },
      ];

      const count = countUniqueCategoryPaths(msis);

      // Windows, Windows>Double Hung, Windows>Double Hung>Standard, Windows>Double Hung>Standard>Vinyl
      expect(count).toBe(4);
    });

    it('should deduplicate same paths from multiple MSIs', () => {
      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1', category: 'Windows', subCategory: 'Double Hung' },
        { objectId: 'msi-2', category: 'Windows', subCategory: 'Double Hung' },
        { objectId: 'msi-3', category: 'Windows', subCategory: 'Double Hung' },
      ];

      const count = countUniqueCategoryPaths(msis);

      // Windows, Windows>Double Hung (deduplicated)
      expect(count).toBe(2);
    });

    it('should return 0 for empty input', () => {
      const count = countUniqueCategoryPaths([]);

      expect(count).toBe(0);
    });

    it('should skip MSIs without category', () => {
      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1' }, // No category
        { objectId: 'msi-2', category: 'Windows' },
      ];

      const count = countUniqueCategoryPaths(msis);

      expect(count).toBe(1);
    });
  });
});
