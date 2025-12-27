/**
 * ETL Query Exports
 *
 * Re-exports all query modules for convenient importing.
 *
 * @example
 * ```typescript
 * import { queryOffices, getSourceCompanyIdByEmail } from './queries';
 * ```
 */

// Base utilities
export {
  closeSourceConnection,
  createPointer,
  getCollection,
  isConnectedToReplicaSet,
  isSourceConfigured,
  parsePointer,
  queryWithPagination,
} from './base';
export type {
  BaseMongoDocument,
  PaginatedResult,
  PaginationOptions,
} from './base';

// User queries (for company lookup)
export { getSourceCompanyIdByEmail } from './user.queries';

// Office queries
export {
  countOffices,
  queryAllOffices,
  queryOfficeById,
  queryOffices,
} from './office.queries';

// Future collection queries will be added here:
// export * from './customer.queries';
// export * from './contract.queries';
// export * from './template.queries';
