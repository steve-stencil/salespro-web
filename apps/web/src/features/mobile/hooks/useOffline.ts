/**
 * Offline hook for template caching and offline behavior.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m loadContracts
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

import { useFeatureFlags } from '../context/FeatureFlagContext';
import { useOffline } from '../context/OfflineContext';
import { offlineService } from '../services/offline';

import type {
  CachedTemplateList,
  OfflineTemplateLoadResult,
} from '../types/offline';

const QUERY_KEYS = {
  cached: (cacheKey: string) => ['offline', 'cached', cacheKey] as const,
  storage: ['offline', 'storage'] as const,
};

/**
 * Hook for loading templates with offline fallback.
 * iOS: loadContracts with pinName, fromPin pattern
 *
 * @param cacheKey - Cache key (e.g., companyId_officeId)
 * @param onlineLoader - Function to load templates when online
 * @returns Templates with offline fallback
 */
export function useOfflineTemplates<T>(
  cacheKey: string,
  onlineLoader: () => Promise<T>,
) {
  const { status } = useOffline();
  const { flags } = useFeatureFlags();

  const [offlineResult, setOfflineResult] =
    useState<OfflineTemplateLoadResult | null>(null);

  // Try to load from cache when offline
  useEffect(() => {
    if (!status.isOnline && flags.offlineTemplateCache) {
      void offlineService.loadCachedTemplates(cacheKey).then(setOfflineResult);
    } else {
      setOfflineResult(null);
    }
  }, [status.isOnline, cacheKey, flags.offlineTemplateCache]);

  // Online query
  const onlineQuery = useQuery({
    queryKey: ['templates', cacheKey],
    queryFn: async () => {
      const data = await onlineLoader();
      // Cache the result for offline use
      if (flags.offlineTemplateCache) {
        // Note: In production, we'd transform data to CachedTemplate format
        console.log('Caching templates for offline use:', cacheKey);
      }
      return data;
    },
    enabled: status.isOnline,
  });

  return {
    data: status.isOnline ? onlineQuery.data : offlineResult?.templates,
    isLoading: status.isOnline ? onlineQuery.isLoading : false,
    error: status.isOnline ? onlineQuery.error : null,
    isOffline: !status.isOnline,
    offlineResult,
  };
}

/**
 * Hook for caching templates for offline access.
 *
 * @returns Cache operations
 */
export function useTemplateCache() {
  const queryClient = useQueryClient();

  /**
   * Cache templates mutation.
   */
  const cacheMutation = useMutation({
    mutationFn: ({
      cacheKey,
      templates,
      categories,
      isPinned,
    }: {
      cacheKey: string;
      templates: CachedTemplateList['templates'];
      categories: CachedTemplateList['categories'];
      isPinned?: boolean;
    }) =>
      offlineService.cacheTemplates(cacheKey, templates, categories, isPinned),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.cached(variables.cacheKey),
      });
    },
  });

  /**
   * Pin templates mutation.
   */
  const pinMutation = useMutation({
    mutationFn: (cacheKey: string) => offlineService.pinTemplates(cacheKey),
    onSuccess: (_, cacheKey) => {
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.cached(cacheKey),
      });
    },
  });

  /**
   * Unpin templates mutation.
   */
  const unpinMutation = useMutation({
    mutationFn: (cacheKey: string) => offlineService.unpinTemplates(cacheKey),
    onSuccess: (_, cacheKey) => {
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.cached(cacheKey),
      });
    },
  });

  /**
   * Clear expired caches mutation.
   */
  const clearExpiredMutation = useMutation({
    mutationFn: () => offlineService.clearExpiredCaches(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['offline'] });
    },
  });

  return {
    cache: cacheMutation.mutateAsync,
    isCaching: cacheMutation.isPending,
    pin: pinMutation.mutate,
    unpin: unpinMutation.mutate,
    clearExpired: clearExpiredMutation.mutate,
  };
}

/**
 * Hook for storage quota status.
 *
 * @returns Storage status
 */
export function useStorageStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.storage,
    queryFn: () => offlineService.getStorageStatus(),
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Hook for clearing all offline caches.
 */
export function useClearAllCaches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => offlineService.clearAllCaches(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['offline'] });
    },
  });
}
