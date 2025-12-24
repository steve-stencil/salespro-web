/**
 * ETL Feature Types
 *
 * Types for document template import wizard.
 */

/**
 * Source office from Parse system.
 */
export type ParseSourceOffice = {
  objectId: string;
  name: string;
};

/**
 * Local office from database.
 */
export type LocalOffice = {
  id: string;
  name: string;
  isActive: boolean;
};

/**
 * Office mapping value.
 * - UUID of target office
 * - 'create' to create a new office
 * - 'none' to skip assignment
 */
export type OfficeMappingValue = string;

/**
 * Type mapping value.
 * - UUID of target document type
 * - 'create' to create a new type
 */
export type TypeMappingValue = string;

/**
 * Office mapping record.
 */
export type OfficeMapping = Record<string, OfficeMappingValue>;

/**
 * Type mapping record.
 */
export type TypeMapping = Record<string, TypeMappingValue>;

/**
 * Import session status.
 */
export type ImportSessionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

/**
 * Import session data.
 */
export type ImportSession = {
  id: string;
  status: ImportSessionStatus;
  officeMapping: OfficeMapping;
  typeMapping: TypeMapping;
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors?: Array<{ templateId: string; error: string }>;
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
  errors: Array<{ templateId: string; error: string }>;
  hasMore: boolean;
  session: {
    id: string;
    status: ImportSessionStatus;
    totalCount: number;
    importedCount: number;
    skippedCount: number;
    errorCount: number;
    completedAt?: string;
  };
};

/**
 * Document type from database.
 */
export type DocumentTypeItem = {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  officeIds: string[];
  createdAt: string;
  updatedAt: string;
};

/**
 * API response wrappers.
 */
export type SourceOfficesResponse = {
  data: ParseSourceOffice[];
};

export type SourceTypesResponse = {
  data: string[];
};

export type SourceDocumentCountResponse = {
  data: { count: number };
};

export type LocalOfficesResponse = {
  data: LocalOffice[];
};

export type DocumentTypesResponse = {
  data: DocumentTypeItem[];
};

export type CreateImportSessionResponse = {
  data: ImportSession;
};

export type GetImportSessionResponse = {
  data: ImportSession;
};

export type ImportBatchResponse = {
  data: BatchImportResult;
};
