/**
 * Report hook for measurement report insertion.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m sortContracts
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';

import { useFeatureFlags } from '../context/FeatureFlagContext';
import { reportService } from '../services/report';

import type { ReportDocument, ReportInsertionConfig } from '../types/report';

const QUERY_KEYS = {
  available: (estimateId: string) =>
    ['reports', 'available', estimateId] as const,
  config: (companyId: string) => ['reports', 'config', companyId] as const,
};

/**
 * Hook for loading available reports.
 * iOS: sortContracts creates reportContract
 *
 * @param estimateId - Estimate ID
 * @returns Available reports
 */
export function useAvailableReports(estimateId: string | undefined) {
  const { flags } = useFeatureFlags();

  return useQuery({
    queryKey: QUERY_KEYS.available(estimateId ?? ''),
    queryFn: () => reportService.getAvailableReports(estimateId!),
    enabled: !!estimateId && flags.reportInsertionEnabled,
  });
}

/**
 * Hook for report insertion configuration.
 *
 * @param companyId - Company ID
 * @returns Report insertion config
 */
export function useReportInsertionConfig(companyId: string | undefined) {
  const { flags } = useFeatureFlags();

  return useQuery({
    queryKey: QUERY_KEYS.config(companyId ?? ''),
    queryFn: () => reportService.getInsertionConfig(companyId!),
    enabled: !!companyId && flags.reportInsertionEnabled,
  });
}

/**
 * Hook for managing report selection.
 *
 * @param estimateId - Estimate ID
 * @returns Report management handlers
 */
export function useReportSelection(estimateId: string | undefined) {
  const { flags } = useFeatureFlags();
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(
    new Set(),
  );

  const availableReportsQuery = useAvailableReports(estimateId);

  /**
   * Toggle report selection.
   */
  const toggleReport = useCallback((reportId: string): void => {
    setSelectedReportIds(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  }, []);

  /**
   * Select all reports.
   */
  const selectAll = useCallback((): void => {
    if (!availableReportsQuery.data) return;
    setSelectedReportIds(
      new Set(availableReportsQuery.data.reports.map(r => r.id)),
    );
  }, [availableReportsQuery.data]);

  /**
   * Deselect all reports.
   */
  const deselectAll = useCallback((): void => {
    setSelectedReportIds(new Set());
  }, []);

  /**
   * Get selected reports.
   */
  const selectedReports: ReportDocument[] = useMemo(() => {
    if (!availableReportsQuery.data) return [];
    return availableReportsQuery.data.reports.filter(r =>
      selectedReportIds.has(r.id),
    );
  }, [availableReportsQuery.data, selectedReportIds]);

  return {
    reports: availableReportsQuery.data?.reports ?? [],
    insertionConfig: availableReportsQuery.data?.insertionConfig,
    isLoading: availableReportsQuery.isLoading,
    error: availableReportsQuery.error,
    isEnabled: flags.reportInsertionEnabled,
    selectedReports,
    toggleReport,
    selectAll,
    deselectAll,
  };
}

/**
 * Hook for generating reports.
 *
 * @returns Report generation mutation
 */
export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      estimateId,
      reportType,
    }: {
      estimateId: string;
      reportType: string;
    }) => reportService.generateReport(estimateId, reportType),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.available(variables.estimateId),
      });
    },
  });
}

/**
 * Hook for inserting reports into template list.
 * iOS: sortContracts creates reportContract
 *
 * @param templates - Current templates list
 * @param reports - Reports to insert
 * @param config - Insertion configuration
 * @returns Merged template list
 */
export function useInsertReports<
  T extends { categoryId: string; sortOrder: number },
>(
  templates: T[],
  reports: ReportDocument[],
  config: ReportInsertionConfig | undefined,
) {
  const mergedList = useMemo(() => {
    if (!config || !config.enabled || reports.length === 0) {
      return templates;
    }
    return reportService.insertReportsIntoTemplates(templates, reports, config);
  }, [templates, reports, config]);

  return mergedList;
}
