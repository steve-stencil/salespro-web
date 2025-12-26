/**
 * User Queries for ETL Operations
 *
 * MongoDB queries for fetching User data from the legacy database.
 * Primarily used for looking up the user's company for scoping other queries.
 */

import { EtlErrorCode, EtlServiceError } from '../types';

import { getCollection, parsePointer } from './base';

import type { Document } from 'mongodb';

// ============================================================================
// Document Types
// ============================================================================

/**
 * Raw User document shape in legacy MongoDB.
 * Used to look up user's company by email.
 */
type MongoUserDocument = Document & {
  _id: string;
  email?: string;
  username?: string;
  /** Pointer to company in format "Company$<objectId>" */
  _p_company?: string;
  _created_at?: Date;
  _updated_at?: Date;
};

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Look up a user by email and return their source company ID.
 *
 * This is used to scope all ETL queries to the user's company,
 * ensuring users can only migrate their own company's data.
 *
 * @param email - User's email address
 * @returns The source company objectId, or null if not found
 *
 * @example
 * ```typescript
 * const companyId = await getSourceCompanyIdByEmail('user@example.com');
 * if (!companyId) {
 *   throw new Error('User not found in legacy system');
 * }
 * // Use companyId to scope office queries
 * const offices = await queryOffices(companyId);
 * ```
 */
export async function getSourceCompanyIdByEmail(
  email: string,
): Promise<string | null> {
  try {
    const collection = await getCollection<MongoUserDocument>('_User');

    // Try both email and username fields (legacy system often uses email as username)
    const user = await collection.findOne({
      $or: [{ email: email.toLowerCase() }, { username: email.toLowerCase() }],
    });

    if (!user) {
      return null;
    }

    // Parse the _p_company pointer: "Company$<objectId>"
    return parsePointer(user['_p_company']);
  } catch (error) {
    throw new EtlServiceError(
      `Failed to look up user company: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_QUERY_FAILED,
    );
  }
}
