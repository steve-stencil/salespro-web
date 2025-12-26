/**
 * Migration Feature Types
 */

/**
 * Generic source item from legacy database for preview.
 * Base type that works for any collection type.
 */
export type SourceItem = {
  objectId: string;
  name: string;
};

/**
 * Source item with import status for UI display.
 */
export type SourceItemWithStatus = SourceItem & {
  /** Whether this item has already been imported */
  isImported: boolean;
};

/**
 * Alias for backward compatibility.
 * @deprecated Use SourceItem instead
 */
export type SourceOffice = SourceItem;

/**
 * Migration session status.
 */
export type MigrationSessionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

/**
 * Migration session data.
 */
export type MigrationSession = {
  id: string;
  status: MigrationSessionStatus;
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors?: Array<{ sourceId: string; error: string }>;
  createdAt: string;
  completedAt?: string;
};

/**
 * Batch import result.
 */
export type BatchImportResult = {
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ sourceId: string; error: string }>;
  hasMore: boolean;
  session: MigrationSession;
};

/**
 * Source items response with pagination meta.
 */
export type SourceItemsResponse<T> = {
  data: T[];
  meta: {
    total: number;
    skip: number;
    limit: number;
  };
};
