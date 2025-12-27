/**
 * Source Client for ETL Operations
 *
 * Provides generic utilities for connecting to and querying
 * the legacy MongoDB database. Collection-specific queries
 * are in the queries/ folder.
 *
 * @example
 * ```typescript
 * import { isSourceConfigured, getSourceCompanyIdByEmail } from './source-client';
 * import { queryOffices } from './queries/office.queries';
 *
 * // Check configuration
 * if (!isSourceConfigured()) {
 *   throw new Error('Legacy MongoDB not configured');
 * }
 *
 * // Look up user's company (shared across all collections)
 * const companyId = await getSourceCompanyIdByEmail('user@example.com');
 *
 * // Query specific collection
 * const offices = await queryOffices(companyId, 0, 100);
 * ```
 */

// Re-export shared utilities from queries
export {
  // Connection management
  closeSourceConnection,
  isSourceConfigured,
  isConnectedToReplicaSet,
  // Pointer utilities
  parsePointer,
  createPointer,
  // Collection access
  getCollection,
} from './queries';

// Re-export user lookup (shared across all ETL operations)
export { getSourceCompanyIdByEmail } from './queries';

// Re-export types
export type { PaginatedResult, PaginationOptions } from './queries';
