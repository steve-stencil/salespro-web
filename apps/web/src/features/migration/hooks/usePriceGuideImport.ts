/**
 * Price Guide Import Hooks
 *
 * React Query hooks for price guide migration feature.
 * Provides data fetching and mutation hooks for the import wizard.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { priceGuideServices } from '../services';
import {
  calculateRemainingTime,
  estimateImportTime,
} from '../utils/time-estimation';

import type {
  MigrationSession,
  PriceGuideBatchImportResult,
  PriceGuideImportConfig,
  PriceGuideImportProgress,
  PriceGuideImportResults,
  PriceGuideSourceCounts,
} from '../types';

// =============================================================================
// Query Keys
// =============================================================================

const priceGuideKeys = {
  all: ['migration', 'price-guide'] as const,
  sourceCounts: () => [...priceGuideKeys.all, 'source-counts'] as const,
  sourceItems: (skip: number, limit: number) =>
    [...priceGuideKeys.all, 'source', skip, limit] as const,
  officeMappings: () => [...priceGuideKeys.all, 'office-mappings'] as const,
  connectionStatus: () => [...priceGuideKeys.all, 'connection-status'] as const,
  session: (sessionId: string) =>
    [...priceGuideKeys.all, 'session', sessionId] as const,
  importedStatus: (sourceIds: string[]) =>
    [...priceGuideKeys.all, 'imported-status', sourceIds] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Hook to check source database connection status.
 */
export function useSourceConnection() {
  return useQuery({
    queryKey: priceGuideKeys.connectionStatus(),
    queryFn: priceGuideServices.checkSourceConnection,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to get price guide source counts.
 */
export function usePriceGuideSourceCounts() {
  return useQuery({
    queryKey: priceGuideKeys.sourceCounts(),
    queryFn: priceGuideServices.getSourceCounts,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to get source MSI items for preview.
 */
export function usePriceGuideSourceItems(skip = 0, limit = 100) {
  return useQuery({
    queryKey: priceGuideKeys.sourceItems(skip, limit),
    queryFn: () => priceGuideServices.getSourceItems(skip, limit),
  });
}

/**
 * Hook to get office mappings for import configuration.
 */
export function useOfficeMappings() {
  return useQuery({
    queryKey: priceGuideKeys.officeMappings(),
    queryFn: priceGuideServices.getOfficeMappings,
  });
}

/**
 * Hook to check which MSIs have already been imported.
 */
export function usePriceGuideImportedStatus(sourceIds: string[]) {
  return useQuery({
    queryKey: priceGuideKeys.importedStatus(sourceIds),
    queryFn: () =>
      sourceIds.length > 0
        ? priceGuideServices.getImportedStatus(sourceIds)
        : [],
    enabled: sourceIds.length > 0,
  });
}

/**
 * Hook to get a migration session.
 */
export function usePriceGuideSession(sessionId: string | null) {
  return useQuery({
    queryKey: priceGuideKeys.session(sessionId ?? ''),
    queryFn: () =>
      sessionId ? priceGuideServices.getSession(sessionId) : null,
    enabled: !!sessionId,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Hook to create a price guide migration session.
 */
export function useCreatePriceGuideSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: priceGuideServices.createSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.all,
      });
    },
  });
}

// =============================================================================
// Import Progress Hook
// =============================================================================

/**
 * Extract error message from various error types.
 */
function getErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
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
 * Default import configuration.
 */
const DEFAULT_CONFIG: PriceGuideImportConfig = {
  priceTypeStrategy: 'combined',
  autoCreateCategories: true,
  duplicateHandling: 'skip',
  includeImages: true,
};

/**
 * Hook to manage price guide import with progress tracking.
 */
export function usePriceGuideImport() {
  const queryClient = useQueryClient();

  // State
  const [isImporting, setIsImporting] = useState(false);
  const [session, setSession] = useState<MigrationSession | null>(null);
  const [config, setConfig] = useState<PriceGuideImportConfig>(DEFAULT_CONFIG);
  const [progress, setProgress] = useState<PriceGuideImportProgress>({
    phase: 'idle',
    overallProgress: 0,
    categories: { done: 0, total: 0 },
    additionalDetails: { done: 0, total: 0 },
    options: { done: 0, total: 0 },
    upCharges: { done: 0, total: 0 },
    msis: { done: 0, total: 0 },
    images: { done: 0, total: 0 },
    elapsedTime: 0,
    estimatedRemaining: 0,
  });
  const [results, setResults] = useState<PriceGuideImportResults | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  // Refs for timing
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const BATCH_SIZE = 100;

  /**
   * Start the elapsed time timer.
   */
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setProgress(prev => ({
        ...prev,
        elapsedTime: elapsed,
        estimatedRemaining: calculateRemainingTime(
          elapsed,
          prev.overallProgress,
        ),
      }));
    }, 1000);
  }, []);

  /**
   * Stop the elapsed time timer.
   */
  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Update configuration.
   */
  const updateConfig = useCallback(
    (updates: Partial<PriceGuideImportConfig>) => {
      setConfig(prev => ({ ...prev, ...updates }));
    },
    [],
  );

  /**
   * Start the price guide import process.
   */
  const startImport = useCallback(
    async (sourceCounts: PriceGuideSourceCounts) => {
      setIsImporting(true);
      setImportError(null);
      setHasFailed(false);
      setResults(null);

      // Initialize progress with totals
      setProgress({
        phase: 'categories',
        overallProgress: 0,
        categories: { done: 0, total: sourceCounts.categories },
        additionalDetails: {
          done: 0,
          total: sourceCounts.additionalDetails ?? 0,
        },
        options: { done: 0, total: sourceCounts.options },
        upCharges: { done: 0, total: sourceCounts.upCharges },
        msis: { done: 0, total: sourceCounts.msis },
        images: { done: 0, total: sourceCounts.images ?? 0 },
        elapsedTime: 0,
        estimatedRemaining:
          estimateImportTime(sourceCounts, {
            includeImages: config.includeImages,
          }).maxMinutes * 60,
      });

      startTimer();

      try {
        // Create session
        const newSession = await priceGuideServices.createSession();
        setSession(newSession);

        // Calculate total items for progress
        const totalItems =
          sourceCounts.categories +
          sourceCounts.options +
          sourceCounts.upCharges +
          sourceCounts.msis +
          (config.includeImages ? (sourceCounts.images ?? 0) : 0);

        if (totalItems === 0) {
          setSession({ ...newSession, status: 'completed' });
          setProgress(prev => ({
            ...prev,
            phase: 'complete',
            overallProgress: 100,
          }));
          setIsImporting(false);
          stopTimer();
          return;
        }

        // Import in batches
        let skip = 0;
        let hasMore = true;
        const allWarnings: Array<{
          msiSourceId: string;
          unresolvedRefs: string[];
        }> = [];
        let totalImported = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        while (hasMore) {
          const result: PriceGuideBatchImportResult =
            await priceGuideServices.importBatch(
              newSession.id,
              skip,
              BATCH_SIZE,
            );

          // Update session state
          setSession(result.session);

          // Accumulate warnings
          if (result.formulaWarnings.length > 0) {
            allWarnings.push(...result.formulaWarnings);
          }

          // Update progress
          totalImported += result.importedCount;
          totalSkipped += result.skippedCount;
          totalErrors += result.errorCount;

          const processed = totalImported + totalSkipped + totalErrors;
          const progressPercent = Math.round((processed / totalItems) * 100);

          // Determine current phase based on what was imported
          let currentPhase: PriceGuideImportProgress['phase'] = 'categories';
          if (result.categoriesImported > 0) currentPhase = 'categories';
          if (result.optionsImported > 0) currentPhase = 'options';
          if (result.upChargesImported > 0) currentPhase = 'upcharges';
          if (result.msisImported > 0) currentPhase = 'msis';
          if (result.imagesImported && result.imagesImported > 0)
            currentPhase = 'images';

          setProgress(prev => ({
            ...prev,
            phase: currentPhase,
            overallProgress: progressPercent,
            categories: {
              ...prev.categories,
              done: prev.categories.done + result.categoriesImported,
            },
            options: {
              ...prev.options,
              done: prev.options.done + result.optionsImported,
            },
            upCharges: {
              ...prev.upCharges,
              done: prev.upCharges.done + result.upChargesImported,
            },
            msis: {
              ...prev.msis,
              done: prev.msis.done + result.msisImported,
            },
            additionalDetails: {
              ...prev.additionalDetails,
              done:
                prev.additionalDetails.done + result.additionalDetailsImported,
            },
          }));

          hasMore = result.hasMore;
          skip += BATCH_SIZE;
        }

        // Mark as complete
        stopTimer();
        setProgress(prev => ({
          ...prev,
          phase: 'complete',
          overallProgress: 100,
        }));

        // Build results
        const finalResults: PriceGuideImportResults = {
          success: true,
          duration: (Date.now() - startTimeRef.current) / 1000,
          summary: {
            categories: {
              imported: progress.categories.done,
              skipped: 0,
              errors: 0,
            },
            options: { imported: progress.options.done, skipped: 0, errors: 0 },
            upCharges: {
              imported: progress.upCharges.done,
              skipped: 0,
              errors: 0,
            },
            msis: { imported: progress.msis.done, skipped: 0, errors: 0 },
            images: { imported: progress.images.done, skipped: 0, errors: 0 },
          },
          actionItems: [],
          formulaWarnings: allWarnings,
        };

        // Add action items based on warnings
        if (allWarnings.length > 0) {
          finalResults.actionItems.push({
            type: 'formula_issue',
            message: 'MSIs have formula references that could not be resolved',
            count: allWarnings.length,
          });
        }

        setResults(finalResults);

        // Invalidate queries to refresh data
        void queryClient.invalidateQueries({ queryKey: ['price-guide'] });
        void queryClient.invalidateQueries({
          queryKey: priceGuideKeys.importedStatus([]),
        });
      } catch (error) {
        console.error('Price guide import failed:', error);
        setImportError(getErrorMessage(error));
        setHasFailed(true);
        stopTimer();
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
    },
    [
      config.includeImages,
      progress,
      queryClient,
      session,
      startTimer,
      stopTimer,
    ],
  );

  /**
   * Reset the import state.
   */
  const reset = useCallback(() => {
    stopTimer();
    setIsImporting(false);
    setSession(null);
    setConfig(DEFAULT_CONFIG);
    setProgress({
      phase: 'idle',
      overallProgress: 0,
      categories: { done: 0, total: 0 },
      additionalDetails: { done: 0, total: 0 },
      options: { done: 0, total: 0 },
      upCharges: { done: 0, total: 0 },
      msis: { done: 0, total: 0 },
      images: { done: 0, total: 0 },
      elapsedTime: 0,
      estimatedRemaining: 0,
    });
    setResults(null);
    setImportError(null);
    setHasFailed(false);
  }, [stopTimer]);

  return {
    // State
    isImporting,
    session,
    config,
    progress,
    results,
    importError,
    hasFailed,
    isComplete: session?.status === 'completed',

    // Actions
    updateConfig,
    startImport,
    reset,
  };
}
