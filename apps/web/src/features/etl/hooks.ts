/**
 * ETL React Hooks
 *
 * Hooks for managing import wizard state and API calls.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { documentTypesApi, etlApi } from './services';

import type {
  DocumentTypeItem,
  LocalOffice,
  OfficeMapping,
  ParseSourceOffice,
  TypeMapping,
} from './types';

/**
 * Query keys for ETL data.
 */
export const etlQueryKeys = {
  sourceOffices: ['etl', 'sourceOffices'] as const,
  sourceTypes: ['etl', 'sourceTypes'] as const,
  sourceDocumentCount: ['etl', 'sourceDocumentCount'] as const,
  localOffices: ['etl', 'localOffices'] as const,
  documentTypes: ['documentTypes'] as const,
  importSession: (id: string) => ['etl', 'importSession', id] as const,
};

/**
 * Hook to fetch source offices from Parse.
 */
export function useSourceOffices() {
  return useQuery({
    queryKey: etlQueryKeys.sourceOffices,
    queryFn: async (): Promise<ParseSourceOffice[]> => {
      const response = await etlApi.getSourceOffices();
      return response.data;
    },
  });
}

/**
 * Hook to fetch source types from Parse.
 */
export function useSourceTypes() {
  return useQuery({
    queryKey: etlQueryKeys.sourceTypes,
    queryFn: async (): Promise<string[]> => {
      const response = await etlApi.getSourceTypes();
      return response.data;
    },
  });
}

/**
 * Hook to fetch source document count.
 */
export function useSourceDocumentCount() {
  return useQuery({
    queryKey: etlQueryKeys.sourceDocumentCount,
    queryFn: async (): Promise<number> => {
      const response = await etlApi.getSourceDocumentCount();
      return response.data.count;
    },
  });
}

/**
 * Hook to fetch local offices.
 */
export function useLocalOffices() {
  return useQuery({
    queryKey: etlQueryKeys.localOffices,
    queryFn: async (): Promise<LocalOffice[]> => {
      const response = await etlApi.getLocalOffices();
      return response.data;
    },
  });
}

/**
 * Hook to fetch document types.
 */
export function useDocumentTypes(officeId?: string) {
  return useQuery({
    queryKey: [...etlQueryKeys.documentTypes, officeId],
    queryFn: async (): Promise<DocumentTypeItem[]> => {
      const response = await documentTypesApi.list(officeId);
      return response.data;
    },
  });
}

/**
 * Hook to create an import session.
 */
export function useCreateImportSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      officeMapping,
      typeMapping,
    }: {
      officeMapping: OfficeMapping;
      typeMapping: TypeMapping;
    }) => {
      const response = await etlApi.createImportSession(
        officeMapping,
        typeMapping,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['etl', 'importSession'],
      });
    },
  });
}

/**
 * Hook to import documents in batches with progress tracking.
 */
export function useImportBatches() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [errors, setErrors] = useState<
    Array<{ templateId: string; error: string }>
  >([]);
  const [isComplete, setIsComplete] = useState(false);

  const BATCH_SIZE = 20;

  const startImport = useCallback(
    async (
      officeMapping: OfficeMapping,
      typeMapping: TypeMapping,
    ): Promise<void> => {
      setIsImporting(true);
      setProgress(0);
      setImportedCount(0);
      setSkippedCount(0);
      setErrorCount(0);
      setErrors([]);
      setIsComplete(false);

      try {
        // Create session
        const sessionResponse = await etlApi.createImportSession(
          officeMapping,
          typeMapping,
        );
        const session = sessionResponse.data;
        setCurrentSession(session.id);
        setTotalCount(session.totalCount);

        // Import in batches
        let skip = 0;
        let hasMore = true;

        while (hasMore) {
          const result = await etlApi.importBatch(session.id, skip, BATCH_SIZE);

          setImportedCount(prev => prev + result.data.importedCount);
          setSkippedCount(prev => prev + result.data.skippedCount);
          setErrorCount(prev => prev + result.data.errorCount);

          if (result.data.errors.length > 0) {
            setErrors(prev => [...prev, ...result.data.errors]);
          }

          // Update progress
          const processed = skip + BATCH_SIZE;
          setProgress(Math.min((processed / session.totalCount) * 100, 100));

          skip += BATCH_SIZE;
          hasMore = result.data.hasMore;

          // Check if complete
          if (result.data.session.status === 'completed') {
            hasMore = false;
            setIsComplete(true);
          }
        }

        setProgress(100);
        setIsComplete(true);
      } catch (error) {
        console.error('Import failed:', error);
        throw error;
      } finally {
        setIsImporting(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setIsImporting(false);
    setProgress(0);
    setCurrentSession(null);
    setImportedCount(0);
    setSkippedCount(0);
    setErrorCount(0);
    setTotalCount(0);
    setErrors([]);
    setIsComplete(false);
  }, []);

  return {
    isImporting,
    progress,
    currentSession,
    importedCount,
    skippedCount,
    errorCount,
    totalCount,
    errors,
    isComplete,
    startImport,
    reset,
  };
}
