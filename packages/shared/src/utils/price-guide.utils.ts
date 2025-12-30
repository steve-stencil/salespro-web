/**
 * Price Guide utility functions shared between API and web applications.
 */

import type {
  CategoryTreeNode,
  PriceEntry,
  PricingGridRow,
  MeasurementType,
} from '../types/price-guide';

// ============================================================================
// Price Formatting
// ============================================================================

/**
 * Format a price amount as currency string
 */
export function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a price amount as a short string (e.g., "$1.2K")
 */
export function formatPriceShort(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return formatPrice(amount);
}

/**
 * Calculate total price from price entries
 */
export function calculateTotalPrice(prices: PriceEntry[]): number {
  return prices.reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Build pricing grid rows from price entries
 */
export function buildPricingGrid(
  priceTypeCodes: string[],
  entries: Array<{
    officeId: string;
    officeName: string;
    prices: PriceEntry[];
  }>,
): PricingGridRow[] {
  return entries.map(entry => ({
    officeId: entry.officeId,
    officeName: entry.officeName,
    prices: priceTypeCodes.reduce(
      (acc, code) => {
        const price = entry.prices.find(p => p.priceTypeCode === code);
        acc[code] = price?.amount ?? 0;
        return acc;
      },
      {} as Record<string, number>,
    ),
  }));
}

// ============================================================================
// Category Utilities
// ============================================================================

/**
 * Flatten a category tree into a list
 */
export function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  result: CategoryTreeNode[] = [],
): CategoryTreeNode[] {
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      flattenCategoryTree(node.children, result);
    }
  }
  return result;
}

/**
 * Find a category by ID in a tree
 */
export function findCategoryInTree(
  nodes: CategoryTreeNode[],
  id: string,
): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children.length > 0) {
      const found = findCategoryInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get the path to a category (array of ancestor IDs)
 */
export function getCategoryPath(
  nodes: CategoryTreeNode[],
  targetId: string,
  path: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return [...path, node.id];
    }
    if (node.children.length > 0) {
      const result = getCategoryPath(node.children, targetId, [
        ...path,
        node.id,
      ]);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Count total MSIs in a category tree (including children).
 * Note: If using CategoryTreeNode from the API, you can simply use node.msiCount
 * which already includes the cascading total.
 */
export function countMsisInCategory(node: CategoryTreeNode): number {
  // msiCount from the API already includes cascading counts,
  // so we can return it directly
  return node.msiCount;
}

/**
 * Get maximum depth of a category tree
 */
export function getMaxCategoryDepth(nodes: CategoryTreeNode[]): number {
  let maxDepth = 0;
  for (const node of nodes) {
    maxDepth = Math.max(maxDepth, node.depth);
    if (node.children.length > 0) {
      maxDepth = Math.max(maxDepth, getMaxCategoryDepth(node.children));
    }
  }
  return maxDepth;
}

// ============================================================================
// Measurement Type Utilities
// ============================================================================

/** Display names for measurement types */
export const MEASUREMENT_TYPE_LABELS: Record<MeasurementType, string> = {
  each: 'Each',
  sqft: 'Square Feet',
  linear_ft: 'Linear Feet',
  united_inches: 'United Inches',
  pair: 'Pair',
};

/**
 * Get display label for a measurement type
 */
export function getMeasurementTypeLabel(type: string): string {
  if (type in MEASUREMENT_TYPE_LABELS) {
    return MEASUREMENT_TYPE_LABELS[type as MeasurementType];
  }
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get abbreviation for a measurement type
 */
export function getMeasurementTypeAbbr(type: string): string {
  switch (type) {
    case 'each':
      return 'ea';
    case 'sqft':
      return 'sq ft';
    case 'linear_ft':
      return 'lin ft';
    case 'united_inches':
      return 'UI';
    case 'pair':
      return 'pr';
    default:
      return type;
  }
}

// ============================================================================
// Search & Filter Utilities
// ============================================================================

/**
 * Highlight search matches in text
 */
export function highlightSearchMatch(
  text: string,
  search: string,
): { text: string; isMatch: boolean }[] {
  if (!search) {
    return [{ text, isMatch: false }];
  }

  const regex = new RegExp(`(${escapeRegex(search)})`, 'gi');
  const parts = text.split(regex);

  return parts.map(part => ({
    text: part,
    isMatch: part.toLowerCase() === search.toLowerCase(),
  }));
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Debounce a search query
 */
export function createSearchDebouncer(
  callback: (query: string) => void,
  delay = 300,
): (query: string) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (query: string) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(query), delay);
  };
}

// ============================================================================
// Cursor Pagination Utilities
// ============================================================================

/**
 * Encode cursor for pagination.
 * Uses btoa for browser/Node compatibility.
 */
export function encodeCursor(sortOrder: number, id: string): string {
  return btoa(`${sortOrder}:${id}`);
}

/**
 * Decode cursor from pagination.
 * Uses atob for browser/Node compatibility.
 */
export function decodeCursor(
  cursor: string,
): { sortOrder: number; id: string } | null {
  try {
    const decoded = atob(cursor);
    const parts = decoded.split(':');
    if (parts.length < 2) return null;
    const sortOrderStr = parts[0];
    const id = parts.slice(1).join(':'); // Handle IDs that might contain ':'
    if (!sortOrderStr || !id) return null;
    const sortOrder = parseInt(sortOrderStr, 10);
    if (isNaN(sortOrder)) return null;
    return { sortOrder, id };
  } catch {
    return null;
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate a category name
 */
export function validateCategoryName(name: string): string | null {
  if (!name.trim()) {
    return 'Category name is required';
  }
  if (name.length > 255) {
    return 'Category name must be 255 characters or less';
  }
  return null;
}

/**
 * Validate an option name
 */
export function validateOptionName(name: string): string | null {
  if (!name.trim()) {
    return 'Option name is required';
  }
  if (name.length > 255) {
    return 'Option name must be 255 characters or less';
  }
  return null;
}

/**
 * Validate a price amount
 */
export function validatePriceAmount(amount: number): string | null {
  if (isNaN(amount)) {
    return 'Price must be a valid number';
  }
  if (amount < 0) {
    return 'Price cannot be negative';
  }
  if (amount > 999999999.99) {
    return 'Price exceeds maximum allowed value';
  }
  return null;
}
