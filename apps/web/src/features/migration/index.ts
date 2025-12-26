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
} from './types';

// Services
export * as migrationService from './services';

// Hooks
export {
  useSourceCount,
  useSourceItems,
  useCreateSession,
  useSession,
  useImportBatches,
} from './hooks';

// Components
export { OfficeMigrationWizard } from './components/OfficeMigrationWizard';
