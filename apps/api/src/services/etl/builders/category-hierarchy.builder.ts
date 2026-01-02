/**
 * Category Hierarchy Builder for ETL Operations
 *
 * Builds a category hierarchy tree from flat legacy data.
 * Categories come from two sources:
 * 1. CustomConfig.categories_ - root-level categories with display types
 * 2. MSI.category/subCategory/subSubCategories - derived subcategory paths
 */

import { generateKeyBetween } from 'fractional-indexing';

import { PriceGuideCategoryType } from '../../../entities/price-guide/types';

import type { LegacyCategoryConfig, RawSourceMSI } from '../types';

/**
 * Internal node type for building hierarchy.
 */
export type CategoryNode = {
  name: string;
  categoryType: PriceGuideCategoryType;
  sortOrder: string;
  depth: number;
  sourceId?: string;
  children: Map<string, CategoryNode>;
};

/**
 * Flattened category for database insertion.
 */
export type FlattenedCategory = {
  name: string;
  categoryType: PriceGuideCategoryType;
  sortOrder: string;
  depth: number;
  sourceId?: string;
  /** Full path from root to this category (for parent lookup) */
  path: string[];
};

/**
 * Map legacy category type string to PriceGuideCategoryType enum.
 *
 * @param legacyType - Legacy type string from CustomConfig
 * @returns PriceGuideCategoryType enum value
 */
function mapCategoryType(
  legacyType: string | undefined,
): PriceGuideCategoryType {
  switch (legacyType) {
    case 'detail':
      return PriceGuideCategoryType.DETAIL;
    case 'deep_drill_down':
      return PriceGuideCategoryType.DEEP_DRILL_DOWN;
    default:
      return PriceGuideCategoryType.DEFAULT;
  }
}

/**
 * Generate fractional keys for ordering.
 *
 * @param count - Number of keys to generate
 * @param startKey - Previous key (null for first)
 * @returns Array of sort order keys
 */
function generateSortKeys(
  count: number,
  startKey: string | null = null,
): string[] {
  if (count === 0) return [];

  const keys: string[] = [];
  let prevKey = startKey;

  for (let i = 0; i < count; i++) {
    const newKey = generateKeyBetween(prevKey, null);
    keys.push(newKey);
    prevKey = newKey;
  }

  return keys;
}

/**
 * Build category hierarchy from flat legacy data.
 *
 * Combines root categories from CustomConfig with subcategories
 * derived from MSI paths.
 *
 * @param rootCategories - Categories from CustomConfig.categories_
 * @param msis - MSIs to extract subcategory paths from
 * @returns Array of root CategoryNodes with nested children
 */
export function buildCategoryHierarchy(
  rootCategories: LegacyCategoryConfig[],
  msis: RawSourceMSI[],
): CategoryNode[] {
  // Create root nodes from CustomConfig.categories_
  const roots = new Map<string, CategoryNode>();

  // Sort by order and generate fractional keys
  const sortedRoots = [...rootCategories].sort((a, b) => a.order - b.order);
  const rootKeys = generateSortKeys(sortedRoots.length);

  sortedRoots.forEach((cat, idx) => {
    roots.set(cat.name, {
      name: cat.name,
      categoryType: mapCategoryType(cat.type),
      sortOrder: rootKeys[idx] ?? 'a0',
      depth: 0,
      sourceId: cat.objectId,
      children: new Map(),
    });
  });

  // Track last sort key per level for generating unique keys
  const lastKeyAtLevel = new Map<string, string>();

  // Build subcategory tree from MSI data
  for (const msi of msis) {
    if (!msi.category) continue;

    // Get or create root category
    let root = roots.get(msi.category);
    if (!root) {
      const sortKey = generateKeyBetween(
        lastKeyAtLevel.get('root') ?? null,
        null,
      );
      lastKeyAtLevel.set('root', sortKey);

      root = {
        name: msi.category,
        categoryType: PriceGuideCategoryType.DEFAULT,
        sortOrder: sortKey,
        depth: 0,
        children: new Map(),
      };
      roots.set(msi.category, root);
    }

    // Add subCategory (depth 1)
    if (msi.subCategory) {
      const subPath = `${msi.category}>${msi.subCategory}`;
      let sub = root.children.get(msi.subCategory);

      if (!sub) {
        const sortKey = generateKeyBetween(
          lastKeyAtLevel.get(msi.category) ?? null,
          null,
        );
        lastKeyAtLevel.set(msi.category, sortKey);

        sub = {
          name: msi.subCategory,
          categoryType: PriceGuideCategoryType.DEFAULT,
          sortOrder: sortKey,
          depth: 1,
          children: new Map(),
        };
        root.children.set(msi.subCategory, sub);
      }

      // Add subSubCategories (depth 2+)
      // subSubCategories is a ">" delimited string for nested levels
      if (msi.subSubCategories) {
        const parts = msi.subSubCategories.split('>');
        let current = sub;
        let pathSoFar = subPath;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]?.trim();
          if (!part) continue;

          pathSoFar = `${pathSoFar}>${part}`;
          let child = current.children.get(part);

          if (!child) {
            const parentPath = pathSoFar.split('>').slice(0, -1).join('>');
            const sortKey = generateKeyBetween(
              lastKeyAtLevel.get(parentPath) ?? null,
              null,
            );
            lastKeyAtLevel.set(parentPath, sortKey);

            child = {
              name: part,
              categoryType: PriceGuideCategoryType.DEFAULT,
              sortOrder: sortKey,
              depth: 2 + i,
              children: new Map(),
            };
            current.children.set(part, child);
          }
          current = child;
        }
      }
    }
  }

  return Array.from(roots.values());
}

/**
 * Flatten category hierarchy for database insertion.
 *
 * Performs depth-first traversal to create flat array with path info
 * for reconstructing parent relationships.
 *
 * @param roots - Root category nodes from buildCategoryHierarchy
 * @returns Flat array of categories with path info
 */
export function flattenCategoryHierarchy(
  roots: CategoryNode[],
): FlattenedCategory[] {
  const result: FlattenedCategory[] = [];

  function traverse(node: CategoryNode, path: string[]): void {
    const currentPath = [...path, node.name];

    result.push({
      name: node.name,
      categoryType: node.categoryType,
      sortOrder: node.sortOrder,
      depth: node.depth,
      sourceId: node.sourceId,
      path: currentPath,
    });

    // Sort children by sortOrder before traversing
    const sortedChildren = Array.from(node.children.values()).sort((a, b) =>
      a.sortOrder.localeCompare(b.sortOrder),
    );

    for (const child of sortedChildren) {
      traverse(child, currentPath);
    }
  }

  // Sort roots by sortOrder before traversing
  const sortedRoots = [...roots].sort((a, b) =>
    a.sortOrder.localeCompare(b.sortOrder),
  );

  for (const root of sortedRoots) {
    traverse(root, []);
  }

  return result;
}

/**
 * Find category path from MSI data.
 *
 * Constructs the full category path array from MSI category fields.
 *
 * @param msi - Raw source MSI
 * @returns Array of category names from root to leaf
 */
export function getCategoryPath(msi: RawSourceMSI): string[] {
  const path: string[] = [];

  if (msi.category) {
    path.push(msi.category);

    if (msi.subCategory) {
      path.push(msi.subCategory);

      if (msi.subSubCategories) {
        const parts = msi.subSubCategories.split('>');
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed) {
            path.push(trimmed);
          }
        }
      }
    }
  }

  return path;
}

/**
 * Get unique category paths from MSIs.
 *
 * Used to count expected categories before import.
 *
 * @param msis - Array of raw source MSIs
 * @returns Number of unique category paths
 */
export function countUniqueCategoryPaths(msis: RawSourceMSI[]): number {
  const paths = new Set<string>();

  for (const msi of msis) {
    if (msi.category) {
      paths.add(msi.category);

      if (msi.subCategory) {
        paths.add(`${msi.category}>${msi.subCategory}`);

        if (msi.subSubCategories) {
          const parts = msi.subSubCategories.split('>');
          let currentPath = `${msi.category}>${msi.subCategory}`;
          for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed) {
              currentPath = `${currentPath}>${trimmed}`;
              paths.add(currentPath);
            }
          }
        }
      }
    }
  }

  return paths.size;
}
