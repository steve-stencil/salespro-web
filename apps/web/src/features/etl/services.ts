/**
 * ETL API Services
 *
 * Services for document template import.
 */

import { apiClient } from '../../lib/api-client';

import type {
  CreateImportSessionResponse,
  DocumentTypesResponse,
  GetImportSessionResponse,
  ImportBatchResponse,
  LocalOfficesResponse,
  OfficeMapping,
  SourceDocumentCountResponse,
  SourceOfficesResponse,
  SourceTypesResponse,
  TypeMapping,
} from './types';

/**
 * ETL API endpoints.
 */
export const etlApi = {
  /**
   * Fetch source offices from Parse.
   */
  getSourceOffices: async (): Promise<SourceOfficesResponse> => {
    return apiClient.get<SourceOfficesResponse>('/etl/source-offices');
  },

  /**
   * Fetch source types from Parse.
   */
  getSourceTypes: async (): Promise<SourceTypesResponse> => {
    return apiClient.get<SourceTypesResponse>('/etl/source-types');
  },

  /**
   * Get source document count.
   */
  getSourceDocumentCount: async (): Promise<SourceDocumentCountResponse> => {
    return apiClient.get<SourceDocumentCountResponse>(
      '/etl/source-document-count',
    );
  },

  /**
   * Get local offices for mapping.
   */
  getLocalOffices: async (): Promise<LocalOfficesResponse> => {
    return apiClient.get<LocalOfficesResponse>('/etl/local-offices');
  },

  /**
   * Create an import session.
   */
  createImportSession: async (
    officeMapping: OfficeMapping,
    typeMapping: TypeMapping,
  ): Promise<CreateImportSessionResponse> => {
    return apiClient.post<CreateImportSessionResponse>('/etl/import-sessions', {
      officeMapping,
      typeMapping,
    });
  },

  /**
   * Get import session status.
   */
  getImportSession: async (
    sessionId: string,
  ): Promise<GetImportSessionResponse> => {
    return apiClient.get<GetImportSessionResponse>(
      `/etl/import-sessions/${sessionId}`,
    );
  },

  /**
   * Import a batch of documents.
   */
  importBatch: async (
    sessionId: string,
    skip: number,
    limit: number,
  ): Promise<ImportBatchResponse> => {
    return apiClient.post<ImportBatchResponse>(
      `/etl/import-sessions/${sessionId}/batch`,
      { skip, limit },
    );
  },
};

/**
 * Document Types API endpoints.
 */
export const documentTypesApi = {
  /**
   * List document types.
   */
  list: async (officeId?: string): Promise<DocumentTypesResponse> => {
    const url = officeId
      ? `/document-types?officeId=${officeId}`
      : '/document-types';
    return apiClient.get<DocumentTypesResponse>(url);
  },

  /**
   * Create a document type.
   */
  create: async (
    name: string,
    sortOrder?: number,
    officeIds?: string[],
  ): Promise<{ data: { id: string; name: string } }> => {
    return apiClient.post('/document-types', { name, sortOrder, officeIds });
  },
};
