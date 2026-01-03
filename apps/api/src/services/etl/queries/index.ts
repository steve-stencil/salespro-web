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

// CustomConfig queries (for categories)
export { countCategories, queryCategories } from './custom-config.queries';

// MeasureSheetItem queries
export {
  countMSIs,
  extractCategoryPaths,
  queryAllMSIs,
  queryMSIById,
  queryMSIs,
  queryMSIsByIds,
} from './measure-sheet-item.queries';

// PriceGuideItem queries (Options and UpCharges)
export {
  countOptions,
  countPGIs,
  countUpCharges,
  queryAllPGIs,
  queryOptions,
  queryPGIById,
  queryPGIs,
  queryPGIsByIds,
  queryUpCharges,
} from './price-guide-item.queries';
