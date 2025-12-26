/**
 * Migration Feature Hooks
 *
 * Hooks for the Office migration feature.
 * Uses the officeServices convenience wrapper.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { officeServices } from './services';

import type { MigrationSession } from './types';

/**
 * Hook to get source office count.
 */
export function useSourceCount() {
  return useQuery({
    queryKey: ['migration', 'offices', 'source-count'],
    queryFn: officeServices.getSourceCount,
  });
}

/**
 * Hook to get source items for preview.
 */
export function useSourceItems(skip = 0, limit = 100) {
  return useQuery({
    queryKey: ['migration', 'offices', 'source', skip, limit],
    queryFn: () => officeServices.getSourceItems(skip, limit),
  });
}

/**
 * Hook to check which source items have already been imported.
 */
export function useImportedStatus(sourceIds: string[]) {
  return useQuery({
    queryKey: ['migration', 'offices', 'imported-status', sourceIds],
    queryFn: () =>
      sourceIds.length > 0 ? officeServices.getImportedStatus(sourceIds) : [],
    enabled: sourceIds.length > 0,
  });
}

/**
 * Hook to create a migration session.
 */
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: officeServices.createSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['migration', 'offices'],
      });
    },
  });
}

/**
 * Hook to get migration session status.
 */
export function useSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['migration', 'offices', 'session', sessionId],
    queryFn: () => (sessionId ? officeServices.getSession(sessionId) : null),
    enabled: !!sessionId,
  });
}

/**
 * Extract error message from various error types (axios, standard, etc.)
 */
function getErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    // Handle axios error response
    if (err['response'] && typeof err['response'] === 'object') {
      const response = err['response'] as Record<string, unknown>;
      if (response['data'] && typeof response['data'] === 'object') {
        const data = response['data'] as Record<string, unknown>;
        if (typeof data['message'] === 'string') return data['message'];
        if (typeof data['error'] === 'string') return data['error'];
      }
    }
    if (typeof err['message'] === 'string') return err['message'];
  }
  return 'An unexpected error occurred';
}

/**
 * Hook to manage batch imports with progress tracking.
 *
 * Supports two modes:
 * - Bulk import: Imports all items in batches (default)
 * - Selective import: Import only specific items by sourceIds
 */
export function useImportBatches() {
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [session, setSession] = useState<MigrationSession | null>(null);
  const [errors, setErrors] = useState<
    Array<{ sourceId: string; error: string }>
  >([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  const BATCH_SIZE = 50;

  /**
   * Start bulk import (all items).
   */
  const startImport = useCallback(async () => {
    setIsImporting(true);
    setProgress(0);
    setErrors([]);
    setImportError(null);
    setHasFailed(false);

    try {
      // Create session
      const newSession = await officeServices.createSession();
      setSession(newSession);

      if (newSession.totalCount === 0) {
        // Mark as complete with 0 items
        setSession({ ...newSession, status: 'completed' });
        setIsImporting(false);
        return;
      }

      // Import in batches
      let skip = 0;
      let hasMore = true;
      const allErrors: Array<{ sourceId: string; error: string }> = [];

      while (hasMore) {
        const result = await officeServices.importBatch(
          newSession.id,
          skip,
          BATCH_SIZE,
        );

        // Update session state
        setSession(result.session);

        // Accumulate errors
        if (result.errors.length > 0) {
          allErrors.push(...result.errors);
          setErrors([...allErrors]);
        }

        // Calculate progress
        const processed =
          result.session.importedCount +
          result.session.skippedCount +
          result.session.errorCount;
        const progressPercent = Math.round(
          (processed / result.session.totalCount) * 100,
        );
        setProgress(progressPercent);

        hasMore = result.hasMore;
        skip += BATCH_SIZE;
      }

      // Invalidate queries to refresh data
      void queryClient.invalidateQueries({ queryKey: ['offices'] });
      void queryClient.invalidateQueries({
        queryKey: ['migration', 'offices', 'imported-status'],
      });
    } catch (error) {
      console.error('Import failed:', error);
      setImportError(getErrorMessage(error));
      setHasFailed(true);
      // Create a failed session state for display
      setSession(
        session
          ? { ...session, status: 'failed' }
          : {
              id: '',
              status: 'failed',
              totalCount: 0,
              importedCount: 0,
              skippedCount: 0,
              errorCount: 0,
              createdAt: new Date().toISOString(),
            },
      );
    } finally {
      setIsImporting(false);
    }
  }, [queryClient, session]);

  /**
   * Start selective import (specific items by sourceIds).
   */
  const startSelectiveImport = useCallback(
    async (sourceIds: string[]) => {
      if (sourceIds.length === 0) {
        return;
      }

      setIsImporting(true);
      setProgress(0);
      setErrors([]);
      setImportError(null);
      setHasFailed(false);

      try {
        // Create session
        const newSession = await officeServices.createSession();
        // Override totalCount with selected count for progress tracking
        const adjustedSession = { ...newSession, totalCount: sourceIds.length };
        setSession(adjustedSession);

        // Import selected items
        const result = await officeServices.importSelectedItems(
          newSession.id,
          sourceIds,
        );

        // Update session state with actual results
        const finalSession = {
          ...result.session,
          totalCount: sourceIds.length,
          status: 'completed' as const,
        };
        setSession(finalSession);
        setProgress(100);

        // Accumulate errors
        if (result.errors.length > 0) {
          setErrors(result.errors);
        }

        // Invalidate queries to refresh data
        void queryClient.invalidateQueries({ queryKey: ['offices'] });
        void queryClient.invalidateQueries({
          queryKey: ['migration', 'offices', 'imported-status'],
        });
      } catch (error) {
        console.error('Selective import failed:', error);
        setImportError(getErrorMessage(error));
        setHasFailed(true);
        setSession(
          session
            ? { ...session, status: 'failed' }
            : {
                id: '',
                status: 'failed',
                totalCount: sourceIds.length,
                importedCount: 0,
                skippedCount: 0,
                errorCount: 0,
                createdAt: new Date().toISOString(),
              },
        );
      } finally {
        setIsImporting(false);
      }
    },
    [queryClient, session],
  );

  const reset = useCallback(() => {
    setIsImporting(false);
    setProgress(0);
    setSession(null);
    setErrors([]);
    setImportError(null);
    setHasFailed(false);
  }, []);

  return {
    isImporting,
    progress,
    session,
    importedCount: session?.importedCount ?? 0,
    skippedCount: session?.skippedCount ?? 0,
    errorCount: session?.errorCount ?? 0,
    totalCount: session?.totalCount ?? 0,
    errors,
    importError,
    hasFailed,
    isComplete: session?.status === 'completed',
    startImport,
    startSelectiveImport,
    reset,
  };
}
