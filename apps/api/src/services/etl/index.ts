/**
 * ETL Services
 *
 * Services for migrating data from legacy MongoDB.
 *
 * @see ./README.md for architecture documentation
 * @see ./queries/README.md for query module documentation
 */

// Types
export * from './types';
export type { BaseEtlService, FetchSourceResult, SourceItem } from './types';

// Generic source utilities (connection, pointers, etc.)
export {
  closeSourceConnection,
  isSourceConfigured,
  isConnectedToReplicaSet,
  parsePointer,
  createPointer,
  getCollection,
  getSourceCompanyIdByEmail,
} from './source-client';
export type { PaginatedResult, PaginationOptions } from './source-client';

// Office-specific queries (import directly when needed)
export {
  queryOffices,
  countOffices,
  queryAllOffices,
  queryOfficeById,
} from './queries/office.queries';

// Office ETL Service
export { OfficeEtlService } from './office-etl.service';
