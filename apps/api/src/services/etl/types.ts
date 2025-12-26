/**
 * ETL Service Types
 *
 * Types for ETL (Extract, Transform, Load) operations
 * for migrating data from a legacy MongoDB system.
 */

/**
 * Raw source Office object structure from legacy MongoDB.
 */
export type RawSourceOffice = {
  objectId: string;
  name?: string;
  /** Extracted company objectId from _p_company pointer */
  sourceCompanyId?: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Transformed office data ready for database insertion.
 */
export type TransformedOfficeData = {
  /** Source objectId from legacy system */
  sourceId: string;
  /** Office name */
  name: string;
  /** Source company objectId (for reference) */
  sourceCompanyId?: string;
};

/**
 * Source office for mapping UI.
 */
export type LegacySourceOffice = {
  objectId: string;
  name: string;
};

/**
 * Batch import options.
 */
export type BatchImportOptions = {
  /** Company ID to import into */
  companyId: string;
  /** Skip count for pagination (used when sourceIds not provided) */
  skip: number;
  /** Limit for batch size (used when sourceIds not provided) */
  limit: number;
  /** Migration session ID */
  sessionId: string;
  /** User ID who initiated the import */
  userId: string;
  /** Optional list of specific source IDs to import (if provided, skip/limit are ignored) */
  sourceIds?: string[];
};

/**
 * Batch import result.
 */
export type BatchImportResult = {
  /** Number of items imported in this batch */
  importedCount: number;
  /** Number of items skipped (already exist) */
  skippedCount: number;
  /** Number of items that failed */
  errorCount: number;
  /** Error details */
  errors: Array<{ sourceId: string; error: string }>;
  /** Whether there are more items to import */
  hasMore: boolean;
};

/**
 * Generic source item for migration preview.
 * All collection-specific source items extend this.
 */
export type SourceItem = {
  objectId: string;
  name: string;
};

/**
 * Result from fetching source items.
 */
export type FetchSourceResult = {
  items: SourceItem[];
  total: number;
};

/**
 * Base interface for all ETL services.
 * Ensures consistent API across different collection types.
 */
export type BaseEtlService = {
  /** Check if source database is configured */
  isSourceConfigured(): boolean;
  /** Fetch source items for preview */
  fetchSourceItems(skip: number, limit: number): Promise<FetchSourceResult>;
  /** Get total source count */
  getSourceCount(): Promise<number>;
  /** Create a new migration session */
  createSession(companyId: string, userId: string): Promise<{ id: string }>;
  /** Get migration session by ID */
  getSession(
    sessionId: string,
    companyId: string,
  ): Promise<{ id: string } | null>;
  /** Import a batch of items */
  importBatch(options: BatchImportOptions): Promise<BatchImportResult>;
};

/**
 * ETL Service error codes.
 */
export enum EtlErrorCode {
  SOURCE_CONNECTION_FAILED = 'SOURCE_CONNECTION_FAILED',
  SOURCE_QUERY_FAILED = 'SOURCE_QUERY_FAILED',
  SOURCE_COMPANY_NOT_FOUND = 'SOURCE_COMPANY_NOT_FOUND',
  TRANSFORM_FAILED = 'TRANSFORM_FAILED',
  IMPORT_FAILED = 'IMPORT_FAILED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID_STATE = 'SESSION_INVALID_STATE',
  UNSUPPORTED_COLLECTION = 'UNSUPPORTED_COLLECTION',
}

/**
 * ETL Service error.
 */
export class EtlServiceError extends Error {
  constructor(
    message: string,
    public readonly code: EtlErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EtlServiceError';
  }
}
