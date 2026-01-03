/**
 * PriceGuideItem Queries for ETL Operations
 *
 * MongoDB queries for fetching SSPriceGuideItem data from the legacy database.
 * PGIs can be either Options (isAccessory=false) or UpCharges (isAccessory=true).
 * All queries are scoped by company ID to ensure data isolation.
 */

import { EtlErrorCode, EtlServiceError } from '../types';

import { createPointer, getCollection, parsePointer } from './base';

import type { PaginatedResult } from './base';
import type {
  LegacyAccessoryPrice,
  LegacyAdditionalDetailObject,
  LegacyItemPrice,
  LegacyPlaceholder,
  RawSourcePGI,
} from '../types';
import type { Document } from 'mongodb';

// ============================================================================
// Document Types
// ============================================================================

/**
 * Raw SSPriceGuideItem document shape in legacy MongoDB.
 */
type MongoPGIDocument = Document & {
  _id: string;
  isAccessory?: boolean;
  // Option fields (isAccessory=false)
  displayTitle?: string;
  subCategory2?: string;
  itemPrices?: LegacyItemPrice[];
  itemCodes?: Record<string, string>;
  // UpCharge fields (isAccessory=true)
  name?: string;
  info?: string;
  identifier?: string;
  accessoryPrices?: LegacyAccessoryPrice[];
  percentagePrice?: boolean;
  disabledParents?: string[];
  additionalDetails?: LegacyAdditionalDetailObject[];
  placeholders?: LegacyPlaceholder[];
  _p_company?: string;
  _created_at?: Date;
  _updated_at?: Date;
};

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform raw MongoDB document to RawSourcePGI.
 */
function transformRawPGI(doc: MongoPGIDocument): RawSourcePGI {
  return {
    objectId: doc['_id'],
    isAccessory: doc['isAccessory'] ?? false,
    // Option fields
    displayTitle: doc['displayTitle'],
    subCategory2: doc['subCategory2'],
    itemPrices: doc['itemPrices'],
    itemCodes: doc['itemCodes'],
    // UpCharge fields
    name: doc['name'],
    info: doc['info'],
    identifier: doc['identifier'],
    accessoryPrices: doc['accessoryPrices'],
    percentagePrice: doc['percentagePrice'],
    disabledParents: doc['disabledParents'],
    additionalDetails: doc['additionalDetails'],
    placeholders: doc['placeholders'],
    sourceCompanyId: parsePointer(doc['_p_company']) ?? undefined,
    createdAt: doc['_created_at']?.toISOString(),
    updatedAt: doc['_updated_at']?.toISOString(),
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Query PGIs (Options or UpCharges) for preview UI, scoped by source company.
 *
 * Returns minimal data (id + name) for listing/selection.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param isAccessory - false for Options, true for UpCharges
 * @param skip - Number of records to skip (default: 0)
 * @param limit - Maximum records to return (default: 100)
 * @returns Paginated list of PGIs with total count
 */
export async function queryPGIs(
  sourceCompanyId: string,
  isAccessory: boolean,
  skip = 0,
  limit = 100,
): Promise<PaginatedResult<{ objectId: string; name: string }>> {
  try {
    const collection =
      await getCollection<MongoPGIDocument>('SSPriceGuideItem');
    const companyPointer = createPointer('Company', sourceCompanyId);

    const filter = {
      _p_company: companyPointer,
      isAccessory: isAccessory,
    };

    const [items, total] = await Promise.all([
      collection
        .find(filter)
        .project({ _id: 1, displayTitle: 1, name: 1 })
        .sort({ _created_at: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      items: items.map(doc => ({
        objectId: doc['_id'] as string,
        // Options use displayTitle, UpCharges use name
        name:
          (isAccessory
            ? (doc['name'] as string | undefined)
            : (doc['displayTitle'] as string | undefined)) ?? 'Unknown',
      })),
      total,
    };
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch PGIs: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Count total PGIs for a source company by type.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param isAccessory - false for Options, true for UpCharges
 * @returns Total count of PGIs
 */
export async function countPGIs(
  sourceCompanyId: string,
  isAccessory: boolean,
): Promise<number> {
  try {
    const collection =
      await getCollection<MongoPGIDocument>('SSPriceGuideItem');
    const companyPointer = createPointer('Company', sourceCompanyId);

    return await collection.countDocuments({
      _p_company: companyPointer,
      isAccessory: isAccessory,
    });
  } catch (error) {
    throw new EtlServiceError(
      `Failed to count PGIs: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Query all PGI fields for batch import, scoped by company and type.
 *
 * Returns full document data needed for ETL transformation.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param isAccessory - false for Options, true for UpCharges
 * @param skip - Number of records to skip
 * @param limit - Maximum records to return
 * @returns Object with items array and total count
 */
export async function queryAllPGIs(
  sourceCompanyId: string,
  isAccessory: boolean,
  skip: number,
  limit: number,
): Promise<{ items: RawSourcePGI[]; total: number }> {
  try {
    const collection =
      await getCollection<MongoPGIDocument>('SSPriceGuideItem');
    const companyPointer = createPointer('Company', sourceCompanyId);

    const filter = {
      _p_company: companyPointer,
      isAccessory: isAccessory,
    };

    const [docs, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ _created_at: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      items: docs.map(transformRawPGI),
      total,
    };
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch PGIs: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Query a single PGI by ID (for verification).
 *
 * @param objectId - The PGI's objectId
 * @returns Raw PGI document or null if not found
 */
export async function queryPGIById(
  objectId: string,
): Promise<RawSourcePGI | null> {
  try {
    const collection =
      await getCollection<MongoPGIDocument>('SSPriceGuideItem');

    const doc = await collection.findOne({ _id: objectId });

    if (!doc) return null;

    return transformRawPGI(doc);
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch PGI: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Query PGIs by specific IDs, scoped by company.
 *
 * Used for selective imports where user chooses specific items.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param objectIds - List of PGI objectIds to fetch
 * @returns Array of raw PGI documents
 */
export async function queryPGIsByIds(
  sourceCompanyId: string,
  objectIds: string[],
): Promise<RawSourcePGI[]> {
  if (objectIds.length === 0) {
    return [];
  }

  try {
    const collection =
      await getCollection<MongoPGIDocument>('SSPriceGuideItem');
    const companyPointer = createPointer('Company', sourceCompanyId);

    const docs = await collection
      .find({
        _id: { $in: objectIds },
        _p_company: companyPointer,
      })
      .toArray();

    return docs.map(transformRawPGI);
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch PGIs by IDs: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Query all Options (isAccessory=false) for batch import.
 *
 * Convenience wrapper around queryAllPGIs.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param skip - Number of records to skip
 * @param limit - Maximum records to return
 * @returns Object with items array and total count
 */
export async function queryOptions(
  sourceCompanyId: string,
  skip: number,
  limit: number,
): Promise<{ items: RawSourcePGI[]; total: number }> {
  return queryAllPGIs(sourceCompanyId, false, skip, limit);
}

/**
 * Query all UpCharges (isAccessory=true) for batch import.
 *
 * Convenience wrapper around queryAllPGIs.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param skip - Number of records to skip
 * @param limit - Maximum records to return
 * @returns Object with items array and total count
 */
export async function queryUpCharges(
  sourceCompanyId: string,
  skip: number,
  limit: number,
): Promise<{ items: RawSourcePGI[]; total: number }> {
  return queryAllPGIs(sourceCompanyId, true, skip, limit);
}

/**
 * Count total Options for a source company.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @returns Total count of Options
 */
export async function countOptions(sourceCompanyId: string): Promise<number> {
  return countPGIs(sourceCompanyId, false);
}

/**
 * Count total UpCharges for a source company.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @returns Total count of UpCharges
 */
export async function countUpCharges(sourceCompanyId: string): Promise<number> {
  return countPGIs(sourceCompanyId, true);
}
