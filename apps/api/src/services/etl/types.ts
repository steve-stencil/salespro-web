/**
 * ETL Service Types
 *
 * Types for document template ETL (Extract, Transform, Load) operations.
 */

import type { DocumentDataJson } from '../../entities';

/**
 * Raw Parse document object structure from JSON files.
 * Uses 'contractData' as the field name (legacy Parse naming).
 * Note: Most fields are optional because Parse data can be incomplete.
 */
export type RawDocumentObject = {
  objectId: string;
  type?: string;
  pageId?: string;
  category?: string;
  displayName?: string;
  order?: number;
  canAddMultiplePages?: boolean;
  isTemplate?: boolean;
  includedStates?: string[];
  excludedStates?: string[];
  includedOffices?: Array<{
    objectId: string;
    className: string;
    __type: string;
  }>;
  pageSize?: string;
  hMargin?: number;
  wMargin?: number;
  photosPerPage?: number;
  useWatermark?: boolean;
  watermarkWidthPercent?: number;
  watermarkAlpha?: number;
  /** Note: Legacy Parse uses 'contractData', not 'documentData' */
  contractData?: DocumentDataJson;
  /** Parse file references for images (will be downloaded and stored as File entities) */
  images?: Array<{ url?: string; name?: string; __type?: string }>;
  iconBackgroundColor?: number[];
  iconImage?: { url: string; name: string; __type: string };
  pdf?: { url: string; name: string; __type: string };
  watermark?: { url: string; name: string; __type: string };
  company?: { objectId: string; className: string; __type: string };
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Transformed template data ready for database insertion.
 */
export type TransformedTemplateData = {
  /** Category name (will be resolved to entity later) */
  categoryName: string;
  /** Source office IDs from Parse (will be mapped to local offices) */
  sourceOfficeIds: string[];
  /** Source type from Parse (will be mapped to DocumentType) */
  sourceType: string;
  /** Source template ID */
  sourceTemplateId: string;
  /** Page identifier */
  pageId: string;
  /** Display name */
  displayName: string;
  /** Sort order */
  sortOrder: number;
  /** Whether multiple pages can be added */
  canAddMultiplePages: boolean;
  /** Whether this is a template */
  isTemplate: boolean;
  /** Included states */
  includedStates: string[];
  /** Excluded states */
  excludedStates: string[];
  /** Page width in points */
  pageWidth: number;
  /** Page height in points */
  pageHeight: number;
  /** Horizontal margin */
  hMargin: number;
  /** Vertical/width margin */
  wMargin: number;
  /** Photos per page */
  photosPerPage: number;
  /** Whether watermark is enabled */
  useWatermark: boolean;
  /** Watermark width percent */
  watermarkWidthPercent: number;
  /** Watermark alpha (0-1) */
  watermarkAlpha: number;
  /** Document data JSON (parsed from contractData) */
  documentDataJson: DocumentDataJson;
  /** Image URLs to download and store as File entities */
  imageUrls: string[];
  /** Whether template has user input fields */
  hasUserInput: boolean;
  /** Count of signature fields */
  signatureFieldCount: number;
  /** Count of initials fields */
  initialsFieldCount: number;
  /** Optional PDF URL for download */
  pdfUrl?: string;
  /** Optional icon image URL for download */
  iconUrl?: string;
  /** Optional watermark URL for download */
  watermarkUrl?: string;
};

/**
 * Parse source office object.
 */
export type ParseSourceOffice = {
  objectId: string;
  name: string;
};

/**
 * Batch import options.
 */
export type BatchImportOptions = {
  /** Company ID to import into */
  companyId: string;
  /**
   * Office mapping from source to target.
   * Value can be: target office UUID, 'create', or 'none'
   */
  officeMapping: Record<string, string>;
  /** Type mapping from source type to DocumentType ID */
  typeMapping: Record<string, string>;
  /** Skip count for pagination */
  skip: number;
  /** Limit for batch size */
  limit: number;
  /** Import session ID */
  sessionId: string;
  /** User ID who initiated the import */
  userId: string;
  /** Optional: source office name cache (for 'create' mappings) */
  sourceOfficeNames?: Record<string, string>;
};

/**
 * Batch import result.
 */
export type BatchImportResult = {
  /** Number of documents imported in this batch */
  importedCount: number;
  /** Number of documents skipped (already exist) */
  skippedCount: number;
  /** Number of documents that failed */
  errorCount: number;
  /** Error details */
  errors: Array<{ templateId: string; error: string }>;
  /** Whether there are more documents to import */
  hasMore: boolean;
};

/**
 * ETL Service error codes.
 */
export enum EtlErrorCode {
  PARSE_CONNECTION_FAILED = 'PARSE_CONNECTION_FAILED',
  PARSE_QUERY_FAILED = 'PARSE_QUERY_FAILED',
  FILE_DOWNLOAD_FAILED = 'FILE_DOWNLOAD_FAILED',
  TRANSFORM_FAILED = 'TRANSFORM_FAILED',
  IMPORT_FAILED = 'IMPORT_FAILED',
  INVALID_MAPPING = 'INVALID_MAPPING',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID_STATE = 'SESSION_INVALID_STATE',
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
