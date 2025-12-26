/**
 * Office Queries for ETL Operations
 *
 * MongoDB queries for fetching Office data from the legacy database.
 * All queries are scoped by company ID to ensure data isolation.
 */

import { EtlErrorCode, EtlServiceError } from '../types';

import { createPointer, getCollection, parsePointer } from './base';

import type { PaginatedResult } from './base';
import type { LegacySourceOffice, RawSourceOffice } from '../types';
import type { Document } from 'mongodb';

// ============================================================================
// Document Types
// ============================================================================

/**
 * Raw Office document shape in legacy MongoDB.
 *
 * Note: Pointer fields use `_p_<fieldName>` format with value "ClassName$objectId"
 */
type MongoOfficeDocument = Document & {
  _id: string;
  name?: string;
  /** Pointer to company in format "Company$<objectId>" */
  _p_company?: string;
  _created_at?: Date;
  _updated_at?: Date;
};

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Query offices for preview UI, scoped by source company.
 *
 * Returns minimal data (id + name) for listing/selection.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param skip - Number of records to skip (default: 0)
 * @param limit - Maximum records to return (default: 100)
 * @returns Paginated list of offices with total count
 */
export async function queryOffices(
  sourceCompanyId: string,
  skip = 0,
  limit = 100,
): Promise<PaginatedResult<LegacySourceOffice>> {
  try {
    const collection = await getCollection<MongoOfficeDocument>('Office');
    const companyPointer = createPointer('Company', sourceCompanyId);

    const filter = { _p_company: companyPointer };

    const [offices, total] = await Promise.all([
      collection
        .find(filter)
        .project({ _id: 1, name: 1 })
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      items: offices.map(doc => ({
        objectId: doc['_id'] as string,
        name: (doc['name'] as string | undefined) ?? 'Unknown',
      })),
      total,
    };
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch offices: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Count total offices for a source company.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @returns Total count of offices
 */
export async function countOffices(sourceCompanyId: string): Promise<number> {
  try {
    const collection = await getCollection<MongoOfficeDocument>('Office');
    const companyPointer = createPointer('Company', sourceCompanyId);

    return await collection.countDocuments({ _p_company: companyPointer });
  } catch (error) {
    throw new EtlServiceError(
      `Failed to count offices: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Query all office fields for batch import, scoped by company.
 *
 * Returns full document data needed for ETL transformation.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param skip - Number of records to skip
 * @param limit - Maximum records to return
 * @returns Array of raw office documents
 */
export async function queryAllOffices(
  sourceCompanyId: string,
  skip: number,
  limit: number,
): Promise<RawSourceOffice[]> {
  try {
    const collection = await getCollection<MongoOfficeDocument>('Office');
    const companyPointer = createPointer('Company', sourceCompanyId);

    const offices = await collection
      .find({ _p_company: companyPointer })
      .sort({ _created_at: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return offices.map(doc => ({
      objectId: doc['_id'],
      name: doc['name'],
      sourceCompanyId: parsePointer(doc['_p_company']) ?? undefined,
      createdAt: doc['_created_at']?.toISOString(),
      updatedAt: doc['_updated_at']?.toISOString(),
    }));
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch offices: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Query a single office by ID (for verification).
 *
 * @param objectId - The office's objectId
 * @returns Raw office document or null if not found
 */
export async function queryOfficeById(
  objectId: string,
): Promise<RawSourceOffice | null> {
  try {
    const collection = await getCollection<MongoOfficeDocument>('Office');

    const doc = await collection.findOne({ _id: objectId });

    if (!doc) return null;

    return {
      objectId: doc['_id'],
      name: doc['name'],
      sourceCompanyId: parsePointer(doc['_p_company']) ?? undefined,
      createdAt: doc['_created_at']?.toISOString(),
      updatedAt: doc['_updated_at']?.toISOString(),
    };
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch office: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}

/**
 * Query offices by specific IDs, scoped by company.
 *
 * Used for selective imports where user chooses specific offices.
 *
 * @param sourceCompanyId - The source company objectId to filter by
 * @param objectIds - List of office objectIds to fetch
 * @returns Array of raw office documents
 */
export async function queryOfficesByIds(
  sourceCompanyId: string,
  objectIds: string[],
): Promise<RawSourceOffice[]> {
  if (objectIds.length === 0) {
    return [];
  }

  try {
    const collection = await getCollection<MongoOfficeDocument>('Office');
    const companyPointer = createPointer('Company', sourceCompanyId);

    const offices = await collection
      .find({
        _id: { $in: objectIds },
        _p_company: companyPointer,
      })
      .toArray();

    return offices.map(doc => ({
      objectId: doc['_id'],
      name: doc['name'],
      sourceCompanyId: parsePointer(doc['_p_company']) ?? undefined,
      createdAt: doc['_created_at']?.toISOString(),
      updatedAt: doc['_updated_at']?.toISOString(),
    }));
  } catch (error) {
    throw new EtlServiceError(
      `Failed to fetch offices by IDs: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}
