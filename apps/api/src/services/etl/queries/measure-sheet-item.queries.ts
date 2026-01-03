/**
 * MeasureSheetItem Queries for ETL Operations
 *
 * MongoDB queries for fetching SSMeasureSheetItem data from the legacy database.
 * All queries are scoped by company ID to ensure data isolation.
 */

import { EtlErrorCode, EtlServiceError } from '../types';

import { createPointer, getCollection, parsePointer } from './base';

import type { PaginatedResult } from './base';
import type {
  LegacyAdditionalDetailObject,
  LegacyFileReference,
  LegacyPlaceholder,
  RawSourceMSI,
} from '../types';
import type { Document } from 'mongodb';

// ============================================================================
// Document Types
// ============================================================================

/**
 * Raw SSMeasureSheetItem document shape in legacy MongoDB.
 */
type MongoMSIDocument = Document & {
  _id: string;
  itemName?: string;
  itemNote?: string;
  category?: string;
  subCategory?: string;
  subSubCategories?: string;
  measurementType?: string;
  orderNumber_?: number;
  shouldShowSwitch?: boolean;
  defaultQty?: number;
  formulaID?: string;
  qtyFormula?: string;
  image?: LegacyFileReference;
  items?: Array<{ objectId: string }>;
  accessories?: Array<{ objectId: string }>;
  includedOffices?: Array<{ objectId: string }>;
  additionalDetailObjects?: LegacyAdditionalDetailObject[];
  tagTitle?: string;
  tagInputType?: string;
  tagRequired?: boolean;
  tagPickerOptions?: string[];
  tagParams?: Record<string, unknown>;
  placeholders?: LegacyPlaceholder[];
  _p_company?: string;
  _created_at?: Date;
  _updated_at?: Date;
};

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform raw MongoDB document to RawSourceMSI.
 */
function transformRawMSI(doc: MongoMSIDocument): RawSourceMSI {
  return {
    objectId: doc['_id'],
    itemName: doc['itemName'],
    itemNote: doc['itemNote'],
    category: doc['category'],
    subCategory: doc['subCategory'],
    subSubCategories: doc['subSubCategories'],
    measurementType: doc['measurementType'],
    orderNumber_: doc['orderNumber_'],
    shouldShowSwitch: doc['shouldShowSwitch'],
    defaultQty: doc['defaultQty'],
    formulaID: doc['formulaID'],
    qtyFormula: doc['qtyFormula'],
    image: doc['image'],
    items: doc['items'],
    accessories: doc['accessories'],
    includedOffices: doc['includedOffices'],
    additionalDetailObjects: doc['additionalDetailObjects'],
    tagTitle: doc['tagTitle'],
    tagInputType: doc['tagInputType'],
    tagRequired: doc['tagRequired'],
    tagPickerOptions: doc['tagPickerOptions'],
    tagParams: doc['tagParams'],
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
 * Query MSIs for preview UI, scoped by source company.
 *
 * Returns minimal data (id + name) for listing/selection.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param skip - Number of records to skip (default: 0)
 * @param limit - Maximum records to return (default: 100)
 * @returns Paginated list of MSIs with total count
 */
export async function queryMSIs(
  sourceCompanyId: string,
  skip = 0,
  limit = 100,
): Promise<PaginatedResult<{ objectId: string; name: string }>> {
  try {
    const collection =
      await getCollection<MongoMSIDocument>('SSMeasureSheetItem');
    const companyPointer = createPointer('Company', sourceCompanyId);

    const filter = { _p_company: companyPointer };

    const [items, total] = await Promise.all([
      collection
        .find(filter)
        .project({ _id: 1, itemName: 1 })
        .sort({ orderNumber_: 1, _created_at: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      items: items.map(doc => ({
        objectId: doc['_id'] as string,
        name: (doc['itemName'] as string | undefined) ?? 'Unknown',
      })),
      total,
    };
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch MSIs: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Count total MSIs for a source company.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @returns Total count of MSIs
 */
export async function countMSIs(sourceCompanyId: string): Promise<number> {
  try {
    const collection =
      await getCollection<MongoMSIDocument>('SSMeasureSheetItem');
    const companyPointer = createPointer('Company', sourceCompanyId);

    return await collection.countDocuments({ _p_company: companyPointer });
  } catch (error) {
    throw new EtlServiceError(
      `Failed to count MSIs: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Query all MSI fields for batch import, scoped by company.
 *
 * Returns full document data needed for ETL transformation.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param skip - Number of records to skip
 * @param limit - Maximum records to return
 * @returns Object with items array and total count
 */
export async function queryAllMSIs(
  sourceCompanyId: string,
  skip: number,
  limit: number,
): Promise<{ items: RawSourceMSI[]; total: number }> {
  try {
    const collection =
      await getCollection<MongoMSIDocument>('SSMeasureSheetItem');
    const companyPointer = createPointer('Company', sourceCompanyId);

    const filter = { _p_company: companyPointer };

    const [docs, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ orderNumber_: 1, _created_at: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      items: docs.map(transformRawMSI),
      total,
    };
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch MSIs: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Query a single MSI by ID (for verification).
 *
 * @param objectId - The MSI's objectId
 * @returns Raw MSI document or null if not found
 */
export async function queryMSIById(
  objectId: string,
): Promise<RawSourceMSI | null> {
  try {
    const collection =
      await getCollection<MongoMSIDocument>('SSMeasureSheetItem');

    const doc = await collection.findOne({ _id: objectId });

    if (!doc) return null;

    return transformRawMSI(doc);
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch MSI: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Query MSIs by specific IDs, scoped by company.
 *
 * Used for selective imports where user chooses specific items.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param objectIds - List of MSI objectIds to fetch
 * @returns Array of raw MSI documents
 */
export async function queryMSIsByIds(
  sourceCompanyId: string,
  objectIds: string[],
): Promise<RawSourceMSI[]> {
  if (objectIds.length === 0) {
    return [];
  }

  try {
    const collection =
      await getCollection<MongoMSIDocument>('SSMeasureSheetItem');
    const companyPointer = createPointer('Company', sourceCompanyId);

    const docs = await collection
      .find({
        _id: { $in: objectIds },
        _p_company: companyPointer,
      })
      .toArray();

    return docs.map(transformRawMSI);
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch MSIs by IDs: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Extract all unique category paths from MSIs.
 *
 * Used to build the category hierarchy during import.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @returns Array of unique category paths (category > subCategory > subSubCategories)
 */
export async function extractCategoryPaths(
  sourceCompanyId: string,
): Promise<
  Array<{ category: string; subCategory?: string; subSubCategories?: string }>
> {
  try {
    const collection =
      await getCollection<MongoMSIDocument>('SSMeasureSheetItem');
    const companyPointer = createPointer('Company', sourceCompanyId);

    // Use aggregation to get unique category paths
    const pipeline = [
      { $match: { _p_company: companyPointer } },
      {
        $group: {
          _id: {
            category: '$category',
            subCategory: '$subCategory',
            subSubCategories: '$subSubCategories',
          },
        },
      },
      {
        $sort: {
          '_id.category': 1,
          '_id.subCategory': 1,
          '_id.subSubCategories': 1,
        },
      },
    ];

    const results = await collection.aggregate(pipeline).toArray();

    return results
      .filter(r => r['_id']?.['category'])
      .map(r => ({
        category: r['_id']['category'] as string,
        subCategory: r['_id']['subCategory'] as string | undefined,
        subSubCategories: r['_id']['subSubCategories'] as string | undefined,
      }));
  } catch (error) {
    throw new EtlServiceError(
      `Failed to extract category paths: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}
