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

// CustomConfig queries
export {
  queryCategories,
  countCategories,
} from './queries/custom-config.queries';

// MeasureSheetItem queries
export {
  queryMSIs,
  countMSIs,
  queryAllMSIs,
  queryMSIById,
  queryMSIsByIds,
  extractCategoryPaths,
} from './queries/measure-sheet-item.queries';

// PriceGuideItem queries (Options and UpCharges)
export {
  queryPGIs,
  countPGIs,
  queryAllPGIs,
  queryPGIById,
  queryPGIsByIds,
  queryOptions,
  queryUpCharges,
  countOptions,
  countUpCharges,
} from './queries/price-guide-item.queries';

// Mappers
export {
  mapInputType,
  mapCellType,
  transformAdditionalDetail,
  buildSizePickerConfig,
  buildUnitedInchConfig,
  buildPhotoConfig,
  normalizeDefaultValue,
} from './mappers';
export type { InputTypeMapping } from './mappers';

// Builders
export {
  buildCategoryHierarchy,
  flattenCategoryHierarchy,
  getCategoryPath,
  countUniqueCategoryPaths,
} from './builders';
export type { CategoryNode, FlattenedCategory } from './builders';

// ETL Services
export { OfficeEtlService } from './office-etl.service';
export { PriceGuideEtlService } from './price-guide-etl.service';
export { FormulaEvaluatorService } from './formula-evaluator.service';
export { ImportRollbackService } from './rollback.service';
