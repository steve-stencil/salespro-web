/**
 * CustomConfig Queries for ETL Operations
 *
 * MongoDB queries for fetching CustomConfig data from the legacy database.
 * CustomConfig contains category configuration (categories_) for price guide organization.
 */

import { EtlErrorCode, EtlServiceError } from '../types';

import { createPointer, getCollection, parsePointer } from './base';

import type { LegacyCategoryConfig } from '../types';
import type { Document } from 'mongodb';

// ============================================================================
// Document Types
// ============================================================================

/**
 * Raw category object as it comes from MongoDB (may have missing fields).
 */
type RawMongoCategory = {
  name?: string;
  order?: number;
  type?: string;
  objectId?: string;
  isLocked?: boolean;
};

/**
 * Raw CustomConfig document shape in legacy MongoDB.
 */
type MongoCustomConfigDocument = Document & {
  _id: string;
  /** Array of category configuration objects */
  categories_?: RawMongoCategory[];
  _created_at?: Date;
  _updated_at?: Date;
};

/**
 * Raw Office document with config pointer.
 */
type MongoOfficeWithConfigDocument = Document & {
  _id: string;
  /** Pointer to CustomConfig in format "CustomConfig$<objectId>" */
  _p_config?: string;
  /** Pointer to company in format "Company$<objectId>" */
  _p_company?: string;
};

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Query categories from CustomConfig via Office configs.
 *
 * Categories define root-level organization and display types in the mobile app.
 * Fetches all unique categories across all offices for a company.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @returns Array of deduplicated category configurations
 */
export async function queryCategories(
  sourceCompanyId: string,
): Promise<LegacyCategoryConfig[]> {
  try {
    const officeCollection =
      await getCollection<MongoOfficeWithConfigDocument>('Office');
    const configCollection =
      await getCollection<MongoCustomConfigDocument>('CustomConfig');

    const companyPointer = createPointer('Company', sourceCompanyId);

    // Find offices for this company
    const offices = await officeCollection
      .find({ _p_company: companyPointer })
      .project({ _id: 1, _p_config: 1 })
      .toArray();

    // Get unique config IDs
    const configIds = offices
      .map(o => parsePointer(o['_p_config'] as string | undefined))
      .filter((id): id is string => id !== null);

    if (configIds.length === 0) {
      return [];
    }

    // Fetch configs and extract categories_
    const configs = await configCollection
      .find({ _id: { $in: configIds } })
      .toArray();

    // Deduplicate and merge categories across offices
    const categoryMap = new Map<string, LegacyCategoryConfig>();
    for (const config of configs) {
      const categories = config['categories_'] ?? [];
      for (const cat of categories) {
        if (cat.name && !categoryMap.has(cat.name)) {
          // Validate and normalize type field
          const validTypes = ['default', 'detail', 'deep_drill_down'] as const;
          const rawType = cat.type;
          const type: 'default' | 'detail' | 'deep_drill_down' =
            rawType &&
            validTypes.includes(rawType as (typeof validTypes)[number])
              ? (rawType as 'default' | 'detail' | 'deep_drill_down')
              : 'default';

          categoryMap.set(cat.name, {
            name: cat.name,
            order: cat.order ?? 0,
            type,
            objectId: cat.objectId,
            isLocked: cat.isLocked,
          });
        }
      }
    }

    return Array.from(categoryMap.values()).sort((a, b) => a.order - b.order);
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch categories: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Count total unique categories for a source company.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @returns Total count of unique categories
 */
export async function countCategories(
  sourceCompanyId: string,
): Promise<number> {
  const categories = await queryCategories(sourceCompanyId);
  return categories.length;
}
