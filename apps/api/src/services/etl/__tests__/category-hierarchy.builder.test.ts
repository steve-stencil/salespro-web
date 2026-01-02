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

    it('should default to DEFAULT type for undefined category type', () => {
      const rootCategories = [
        { name: 'Windows', order: 1, type: undefined as unknown as 'default' },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, []);

      const windows = hierarchy.find(c => c.name === 'Windows');
      expect(windows?.categoryType).toBe(PriceGuideCategoryType.DEFAULT);
    });

    it('should default to DEFAULT type for unknown category type', () => {
      const rootCategories = [
        {
          name: 'Windows',
          order: 1,
          type: 'unknown_type' as 'default',
        },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, []);

      const windows = hierarchy.find(c => c.name === 'Windows');
      expect(windows?.categoryType).toBe(PriceGuideCategoryType.DEFAULT);
    });

    it('should merge root config categories with MSI-discovered subcategories', () => {
      // Root category defined in config with specific type
      const rootCategories: LegacyCategoryConfig[] = [
        {
          name: 'Windows',
          order: 1,
          type: 'detail',
          objectId: 'cat-windows',
        },
      ];

      // MSIs that reference the same root and add subcategories
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

      expect(hierarchy).toHaveLength(1);
      const windows = hierarchy.find(c => c.name === 'Windows');

      // Should preserve config properties
      expect(windows?.categoryType).toBe(PriceGuideCategoryType.DETAIL);
      expect(windows?.sourceId).toBe('cat-windows');

      // Should have discovered subcategories
      expect(windows?.children.size).toBe(2);
      expect(windows?.children.has('Double Hung')).toBe(true);
      expect(windows?.children.has('Casement')).toBe(true);
    });

    it('should handle very deep nesting (5+ levels)', () => {
      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Level3 > Level4 > Level5 > Level6',
        },
      ];

      const hierarchy = buildCategoryHierarchy([], msis);
      const flattened = flattenCategoryHierarchy(hierarchy);

      // Should have 6 categories total
      expect(flattened).toHaveLength(6);

      // Verify depths
      expect(flattened.find(c => c.name === 'Windows')?.depth).toBe(0);
      expect(flattened.find(c => c.name === 'Double Hung')?.depth).toBe(1);
      expect(flattened.find(c => c.name === 'Level3')?.depth).toBe(2);
      expect(flattened.find(c => c.name === 'Level4')?.depth).toBe(3);
      expect(flattened.find(c => c.name === 'Level5')?.depth).toBe(4);
      expect(flattened.find(c => c.name === 'Level6')?.depth).toBe(5);

      // Verify full path for deepest node
      const level6 = flattened.find(c => c.name === 'Level6');
      expect(level6?.path).toEqual([
        'Windows',
        'Double Hung',
        'Level3',
        'Level4',
        'Level5',
        'Level6',
      ]);
    });

    it('should handle multiple roots each with children', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Windows', order: 1, type: 'default' },
        { name: 'Doors', order: 2, type: 'detail' },
        { name: 'Siding', order: 3, type: 'deep_drill_down' },
      ];

      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1', category: 'Windows', subCategory: 'Double Hung' },
        { objectId: 'msi-2', category: 'Windows', subCategory: 'Casement' },
        { objectId: 'msi-3', category: 'Doors', subCategory: 'Entry' },
        { objectId: 'msi-4', category: 'Doors', subCategory: 'Patio' },
        { objectId: 'msi-5', category: 'Siding', subCategory: 'Vinyl' },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, msis);

      expect(hierarchy).toHaveLength(3);

      const windows = hierarchy.find(c => c.name === 'Windows');
      expect(windows?.children.size).toBe(2);

      const doors = hierarchy.find(c => c.name === 'Doors');
      expect(doors?.children.size).toBe(2);
      expect(doors?.categoryType).toBe(PriceGuideCategoryType.DETAIL);

      const siding = hierarchy.find(c => c.name === 'Siding');
      expect(siding?.children.size).toBe(1);
      expect(siding?.categoryType).toBe(PriceGuideCategoryType.DEEP_DRILL_DOWN);
    });

    it('should generate unique sortOrder keys for siblings', () => {
      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1', category: 'Windows', subCategory: 'Double Hung' },
        { objectId: 'msi-2', category: 'Windows', subCategory: 'Casement' },
        { objectId: 'msi-3', category: 'Windows', subCategory: 'Awning' },
        { objectId: 'msi-4', category: 'Windows', subCategory: 'Slider' },
      ];

      const hierarchy = buildCategoryHierarchy([], msis);
      const windows = hierarchy.find(c => c.name === 'Windows');
      const children = Array.from(windows?.children.values() ?? []);

      // All sort keys should be unique
      const sortKeys = children.map(c => c.sortOrder);
      const uniqueKeys = new Set(sortKeys);
      expect(uniqueKeys.size).toBe(sortKeys.length);

      // Sort keys should be comparable (lexicographically orderable)
      const sorted = [...sortKeys].sort();
      expect(sorted).toEqual(sortKeys); // Already in order
    });

    it('should handle special characters in category names', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Windows & Doors (Exterior)', order: 1, type: 'default' },
      ];

      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Windows & Doors (Exterior)',
          subCategory: '36" x 48" Standard',
          subSubCategories: 'Vinyl/Composite > White (Bright)',
        },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, msis);
      const flattened = flattenCategoryHierarchy(hierarchy);

      expect(flattened).toHaveLength(4);
      expect(flattened[0]?.name).toBe('Windows & Doors (Exterior)');
      expect(flattened[1]?.name).toBe('36" x 48" Standard');
      expect(flattened[2]?.name).toBe('Vinyl/Composite');
      expect(flattened[3]?.name).toBe('White (Bright)');
    });

    it('should handle MSI with only category (no subcategory) correctly', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Windows', order: 1, type: 'default' },
      ];

      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1', category: 'Windows' }, // No subCategory
        { objectId: 'msi-2', category: 'Windows', subCategory: 'Double Hung' },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, msis);

      expect(hierarchy).toHaveLength(1);
      const windows = hierarchy.find(c => c.name === 'Windows');

      // Root should exist and only have one child (Double Hung)
      // The MSI without subCategory doesn't create any additional categories
      expect(windows?.children.size).toBe(1);
      expect(windows?.children.has('Double Hung')).toBe(true);
    });

    it('should handle subcategory branches that share common ancestors', () => {
      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Standard > Vinyl',
        },
        {
          objectId: 'msi-2',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Standard > Wood',
        },
        {
          objectId: 'msi-3',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Premium > Vinyl',
        },
      ];

      const hierarchy = buildCategoryHierarchy([], msis);
      const flattened = flattenCategoryHierarchy(hierarchy);

      // Windows > Double Hung > Standard > Vinyl
      // Windows > Double Hung > Standard > Wood
      // Windows > Double Hung > Premium > Vinyl
      // Total unique: Windows, Double Hung, Standard, Vinyl(Standard), Wood, Premium, Vinyl(Premium) = 7
      // Note: "Vinyl" under Standard and "Vinyl" under Premium are different category nodes
      expect(flattened).toHaveLength(7);

      const windows = hierarchy.find(c => c.name === 'Windows');
      const doubleHung = windows?.children.get('Double Hung');

      // Double Hung should have 2 children: Standard and Premium
      expect(doubleHung?.children.size).toBe(2);
      expect(doubleHung?.children.has('Standard')).toBe(true);
      expect(doubleHung?.children.has('Premium')).toBe(true);

      // Standard should have 2 children: Vinyl and Wood
      const standard = doubleHung?.children.get('Standard');
      expect(standard?.children.size).toBe(2);
      expect(standard?.children.has('Vinyl')).toBe(true);
      expect(standard?.children.has('Wood')).toBe(true);

      // Premium should have 1 child: Vinyl (different from Standard's Vinyl)
      const premium = doubleHung?.children.get('Premium');
      expect(premium?.children.size).toBe(1);
      expect(premium?.children.has('Vinyl')).toBe(true);

      // Verify both Vinyl categories have different paths
      const vinylCategories = flattened.filter(c => c.name === 'Vinyl');
      expect(vinylCategories).toHaveLength(2);

      const paths = vinylCategories.map(c => c.path.join('>'));
      expect(paths).toContain('Windows>Double Hung>Standard>Vinyl');
      expect(paths).toContain('Windows>Double Hung>Premium>Vinyl');
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

    it('should flatten in depth-first order (parent before children)', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Root1', order: 1, type: 'default' },
        { name: 'Root2', order: 2, type: 'default' },
      ];

      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Root1',
          subCategory: 'Child1A',
          subSubCategories: 'Grandchild1A1',
        },
        {
          objectId: 'msi-2',
          category: 'Root1',
          subCategory: 'Child1B',
        },
        {
          objectId: 'msi-3',
          category: 'Root2',
          subCategory: 'Child2A',
        },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, msis);
      const flattened = flattenCategoryHierarchy(hierarchy);

      // Expected order (depth-first):
      // Root1 -> Child1A -> Grandchild1A1 -> Child1B -> Root2 -> Child2A
      const names = flattened.map(c => c.name);
      expect(names).toEqual([
        'Root1',
        'Child1A',
        'Grandchild1A1',
        'Child1B',
        'Root2',
        'Child2A',
      ]);
    });

    it('should preserve sourceId through flattening', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        {
          name: 'Windows',
          order: 1,
          type: 'default',
          objectId: 'legacy-cat-1',
        },
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, []);
      const flattened = flattenCategoryHierarchy(hierarchy);

      expect(flattened[0]?.sourceId).toBe('legacy-cat-1');
    });

    it('should correctly build paths for complex hierarchies', () => {
      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Standard > Vinyl',
        },
        {
          objectId: 'msi-2',
          category: 'Windows',
          subCategory: 'Casement',
        },
        {
          objectId: 'msi-3',
          category: 'Doors',
          subCategory: 'Entry',
        },
      ];

      const hierarchy = buildCategoryHierarchy([], msis);
      const flattened = flattenCategoryHierarchy(hierarchy);

      // Find specific categories and verify their paths
      const vinyl = flattened.find(c => c.name === 'Vinyl');
      expect(vinyl?.path).toEqual([
        'Windows',
        'Double Hung',
        'Standard',
        'Vinyl',
      ]);

      const entry = flattened.find(c => c.name === 'Entry');
      expect(entry?.path).toEqual(['Doors', 'Entry']);

      const casement = flattened.find(c => c.name === 'Casement');
      expect(casement?.path).toEqual(['Windows', 'Casement']);
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

    it('should handle subSubCategories with only whitespace parts', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
        category: 'Windows',
        subCategory: 'Double Hung',
        subSubCategories: '   >   >   ', // All whitespace
      };

      const path = getCategoryPath(msi);

      // Should only have category and subCategory
      expect(path).toEqual(['Windows', 'Double Hung']);
    });

    it('should handle special characters in all path components', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
        category: 'Windows & Doors',
        subCategory: '36" x 48"',
        subSubCategories: 'Vinyl/PVC > White (Bright)',
      };

      const path = getCategoryPath(msi);

      expect(path).toEqual([
        'Windows & Doors',
        '36" x 48"',
        'Vinyl/PVC',
        'White (Bright)',
      ]);
    });

    it('should handle empty string category', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
        category: '',
      };

      const path = getCategoryPath(msi);

      // Empty string is falsy, should return empty array
      expect(path).toEqual([]);
    });

    it('should handle empty string subCategory', () => {
      const msi: RawSourceMSI = {
        objectId: 'msi-1',
        category: 'Windows',
        subCategory: '',
      };

      const path = getCategoryPath(msi);

      // Empty string subCategory is falsy, should only return category
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

    it('should handle complex deduplication across branching paths', () => {
      const msis: RawSourceMSI[] = [
        // Branch 1: Windows > Double Hung > Standard > Vinyl
        {
          objectId: 'msi-1',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Standard > Vinyl',
        },
        // Branch 2: Windows > Double Hung > Standard > Wood (shares common ancestor)
        {
          objectId: 'msi-2',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Standard > Wood',
        },
        // Branch 3: Windows > Casement (sibling to Double Hung)
        {
          objectId: 'msi-3',
          category: 'Windows',
          subCategory: 'Casement',
        },
      ];

      const count = countUniqueCategoryPaths(msis);

      // Unique paths:
      // 1. Windows
      // 2. Windows>Double Hung
      // 3. Windows>Double Hung>Standard
      // 4. Windows>Double Hung>Standard>Vinyl
      // 5. Windows>Double Hung>Standard>Wood
      // 6. Windows>Casement
      expect(count).toBe(6);
    });

    it('should skip MSIs with empty string category', () => {
      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1', category: '' }, // Empty string
        { objectId: 'msi-2', category: 'Windows' },
      ];

      const count = countUniqueCategoryPaths(msis);

      expect(count).toBe(1);
    });

    it('should handle whitespace-only subSubCategories parts', () => {
      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: '   >   > Standard', // Leading whitespace-only parts
        },
      ];

      const count = countUniqueCategoryPaths(msis);

      // Unique paths:
      // 1. Windows
      // 2. Windows>Double Hung
      // 3. Windows>Double Hung>Standard (whitespace parts skipped)
      expect(count).toBe(3);
    });
  });

  // ==========================================================================
  // Edge Cases and Integration Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle single MSI with all category levels', () => {
      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Windows',
          subCategory: 'Double Hung',
          subSubCategories: 'Standard > Vinyl > White',
        },
      ];

      const hierarchy = buildCategoryHierarchy([], msis);
      const flattened = flattenCategoryHierarchy(hierarchy);
      const pathCount = countUniqueCategoryPaths(msis);

      // All counts should match
      expect(flattened).toHaveLength(pathCount);
      expect(flattened).toHaveLength(5);
    });

    it('should maintain consistency between build and flatten operations', () => {
      const rootCategories: LegacyCategoryConfig[] = [
        { name: 'Windows', order: 2, type: 'detail', objectId: 'cat-win' },
        { name: 'Doors', order: 1, type: 'default', objectId: 'cat-door' },
      ];

      const msis: RawSourceMSI[] = [
        { objectId: 'msi-1', category: 'Windows', subCategory: 'Double Hung' },
        { objectId: 'msi-2', category: 'Windows', subCategory: 'Casement' },
        { objectId: 'msi-3', category: 'Doors', subCategory: 'Entry' },
        { objectId: 'msi-4', category: 'Siding', subCategory: 'Vinyl' }, // New root not in config
      ];

      const hierarchy = buildCategoryHierarchy(rootCategories, msis);
      const flattened = flattenCategoryHierarchy(hierarchy);

      // Verify all categories have required properties
      for (const cat of flattened) {
        expect(cat.name).toBeTruthy();
        expect(cat.sortOrder).toBeTruthy();
        expect(cat.path.length).toBe(cat.depth + 1);
        expect(cat.categoryType).toBeDefined();
      }

      // Verify root categories maintain their config types
      const doors = flattened.find(c => c.name === 'Doors');
      expect(doors?.categoryType).toBe(PriceGuideCategoryType.DEFAULT);
      expect(doors?.sourceId).toBe('cat-door');

      const windows = flattened.find(c => c.name === 'Windows');
      expect(windows?.categoryType).toBe(PriceGuideCategoryType.DETAIL);
      expect(windows?.sourceId).toBe('cat-win');

      // Verify discovered root defaults to DEFAULT
      const siding = flattened.find(c => c.name === 'Siding');
      expect(siding?.categoryType).toBe(PriceGuideCategoryType.DEFAULT);
      expect(siding?.sourceId).toBeUndefined();
    });

    it('should handle identical names at different hierarchy levels', () => {
      // This tests the case where "Standard" appears at multiple levels
      const msis: RawSourceMSI[] = [
        {
          objectId: 'msi-1',
          category: 'Standard', // Root named "Standard"
          subCategory: 'Windows',
          subSubCategories: 'Standard', // Leaf also named "Standard"
        },
      ];

      const hierarchy = buildCategoryHierarchy([], msis);
      const flattened = flattenCategoryHierarchy(hierarchy);

      // Should have 3 categories
      expect(flattened).toHaveLength(3);

      // Two categories named "Standard" at different depths
      const standardCategories = flattened.filter(c => c.name === 'Standard');
      expect(standardCategories).toHaveLength(2);

      // They should have different depths
      const depths = standardCategories.map(c => c.depth);
      expect(depths).toContain(0); // Root
      expect(depths).toContain(2); // Leaf

      // They should have different paths
      const paths = standardCategories.map(c => c.path);
      expect(paths).toContainEqual(['Standard']);
      expect(paths).toContainEqual(['Standard', 'Windows', 'Standard']);
    });
  });
});
