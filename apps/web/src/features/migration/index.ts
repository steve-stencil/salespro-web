/**
 * Migration Feature Exports
 */

// Types
export type {
  SourceItem,
  SourceOffice, // deprecated alias
  MigrationSession,
  MigrationSessionStatus,
  BatchImportResult,
  SourceItemsResponse,
  // Price Guide Import Types
  PriceGuideSourceCounts,
  OfficeMapping,
  PriceTypeStrategy,
  PriceGuideImportConfig,
  PriceGuideImportPreview,
  PriceGuideImportWarning,
  PriceGuideBatchImportResult,
  PriceGuideImportProgress,
  PriceGuideImportResults,
} from './types';

// Services
export * as migrationService from './services';
export { priceGuideServices } from './services';

// Hooks - Office Migration
export {
  useSourceCount,
  useSourceItems,
  useImportedStatus,
  useCreateSession,
  useSession,
  useImportBatches,
  // Price Guide Migration Hooks
  useSourceConnection,
  usePriceGuideSourceCounts,
  usePriceGuideSourceItems,
  useOfficeMappings,
  usePriceGuideImportedStatus,
  usePriceGuideSession,
  useCreatePriceGuideSession,
  usePriceGuideImport,
} from './hooks';

// Utils
export {
  estimateImportTime,
  formatTimeRange,
  formatElapsedTime,
  calculateRemainingTime,
} from './utils';

// Components
export { OfficeMigrationWizard } from './components/OfficeMigrationWizard';
export { PriceGuideMigrationWizard } from './components/PriceGuideMigrationWizard';
