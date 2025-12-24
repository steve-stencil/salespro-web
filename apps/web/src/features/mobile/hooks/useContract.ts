/**
 * Contract hook for template loading and PDF preview.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

import { contractApi } from '../services/contract';

import type {
  ContractTemplate,
  ContractGenerateRequest,
  ContractGenerateResponse,
} from '../types/contract';

const QUERY_KEYS = {
  templates: (estimateId: string) =>
    ['contract', 'templates', estimateId] as const,
  config: (estimateId: string) => ['contract', 'config', estimateId] as const,
};

/**
 * Hook for loading and managing contract templates.
 *
 * @param estimateId - Estimate ID to load templates for
 * @returns Templates, categories, loading state, and selection handlers
 */
export function useContractTemplates(estimateId: string | undefined) {
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(
    new Set(),
  );

  const templatesQuery = useQuery({
    queryKey: QUERY_KEYS.templates(estimateId ?? ''),
    queryFn: () => contractApi.listTemplates(estimateId!),
    enabled: !!estimateId,
  });

  /**
   * Toggle template selection.
   */
  const toggleTemplate = useCallback((templateId: string): void => {
    setSelectedTemplateIds(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  }, []);

  /**
   * Select all templates in a category.
   */
  const selectCategory = useCallback(
    (categoryId: string): void => {
      if (!templatesQuery.data) return;
      const categoryTemplates = templatesQuery.data.templates.filter(
        t => t.categoryId === categoryId,
      );
      setSelectedTemplateIds(prev => {
        const next = new Set(prev);
        categoryTemplates.forEach(t => next.add(t.id));
        return next;
      });
    },
    [templatesQuery.data],
  );

  /**
   * Deselect all templates in a category.
   */
  const deselectCategory = useCallback(
    (categoryId: string): void => {
      if (!templatesQuery.data) return;
      const categoryTemplates = templatesQuery.data.templates.filter(
        t => t.categoryId === categoryId,
      );
      setSelectedTemplateIds(prev => {
        const next = new Set(prev);
        categoryTemplates.forEach(t => next.delete(t.id));
        return next;
      });
    },
    [templatesQuery.data],
  );

  /**
   * Clear all selections.
   */
  const clearSelection = useCallback((): void => {
    setSelectedTemplateIds(new Set());
  }, []);

  // Compute selected templates list
  const selectedTemplates: ContractTemplate[] =
    templatesQuery.data?.templates.filter(t => selectedTemplateIds.has(t.id)) ??
    [];

  return {
    templates: templatesQuery.data?.templates ?? [],
    categories: templatesQuery.data?.categories ?? [],
    config: templatesQuery.data?.config,
    isLoading: templatesQuery.isLoading,
    error: templatesQuery.error,
    selectedTemplateIds: Array.from(selectedTemplateIds),
    selectedTemplates,
    toggleTemplate,
    selectCategory,
    deselectCategory,
    clearSelection,
  };
}

/**
 * Hook for contract configuration.
 *
 * @param estimateId - Estimate ID
 * @returns Contract configuration
 */
export function useContractConfig(estimateId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.config(estimateId ?? ''),
    queryFn: () => contractApi.getConfig(estimateId!),
    enabled: !!estimateId,
  });
}

/**
 * Hook for generating PDF preview.
 * iOS: drawContractAndShow
 *
 * @returns Mutation for generating preview
 */
export function useGeneratePreview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ContractGenerateRequest) =>
      contractApi.generatePreview(request),
    onSuccess: (data, variables) => {
      // Cache the generated PDF for this session
      queryClient.setQueryData(['preview', variables.estimateId], data);
    },
  });
}

/**
 * Hook for managing the current PDF preview state.
 *
 * @param estimateId - Estimate ID
 * @returns Current preview and refresh handler
 */
export function useContractPreview(estimateId: string | undefined) {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);

  // Get cached preview data
  const previewData = queryClient.getQueryData<ContractGenerateResponse>([
    'preview',
    estimateId,
  ]);

  /**
   * Refresh current page after signature capture.
   * iOS: refreshPage
   */
  const refreshPage = useMutation({
    mutationFn: async () => {
      if (!previewData?.pdfUrl) return previewData?.pdfUrl;
      return contractApi.refreshPage(previewData.pdfUrl, currentPage);
    },
  });

  return {
    previewData,
    currentPage,
    setCurrentPage,
    refreshPage: refreshPage.mutate,
    isRefreshing: refreshPage.isPending,
  };
}
