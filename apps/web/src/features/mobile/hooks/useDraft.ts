/**
 * Draft hook for saving and loading contract drafts.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

import { useFeatureFlags } from '../context/FeatureFlagContext';
import { draftApi } from '../services/draft';

import type { SavedDraft } from '../types/draft';
import type { SignaturePage, InitialsRequirement } from '../types/signing';

const QUERY_KEYS = {
  list: (estimateId: string) => ['drafts', estimateId] as const,
  detail: (draftId: string) => ['drafts', 'detail', draftId] as const,
  status: (draftId: string) => ['drafts', 'status', draftId] as const,
};

/**
 * Hook for listing saved drafts.
 *
 * @param estimateId - Estimate ID
 * @returns List of drafts
 */
export function useDraftList(estimateId: string | undefined) {
  const { flags } = useFeatureFlags();

  return useQuery({
    queryKey: QUERY_KEYS.list(estimateId ?? ''),
    queryFn: () => draftApi.list(estimateId!),
    enabled: !!estimateId && flags.draftSavingEnabled,
  });
}

/**
 * Hook for loading a specific draft.
 *
 * @param draftId - Draft ID
 * @returns Draft data
 */
export function useDraft(draftId: string | undefined) {
  const { flags } = useFeatureFlags();

  return useQuery({
    queryKey: QUERY_KEYS.detail(draftId ?? ''),
    queryFn: () => draftApi.getById(draftId!),
    enabled: !!draftId && flags.draftSavingEnabled,
  });
}

/**
 * Hook for draft operations (save, open, delete).
 *
 * @returns Draft operation handlers
 */
export function useDraftOperations() {
  const queryClient = useQueryClient();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /**
   * Save draft mutation.
   * iOS: showSaveDraftAlertOn:sender:
   */
  const saveMutation = useMutation({
    mutationFn: (draft: Omit<SavedDraft, 'id' | 'createdAt' | 'updatedAt'>) =>
      draftApi.save(draft),
    onSuccess: (result, variables) => {
      if (result.success) {
        void queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.list(variables.estimateId),
        });
        setHasUnsavedChanges(false);
      }
    },
  });

  /**
   * Open draft mutation.
   * iOS: openButtonTapped:
   */
  const openMutation = useMutation({
    mutationFn: (draftId: string) => draftApi.open(draftId, hasUnsavedChanges),
  });

  /**
   * Delete draft mutation.
   */
  const deleteMutation = useMutation({
    mutationFn: (draftId: string) => draftApi.delete(draftId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });

  /**
   * Pin draft mutation.
   */
  const pinMutation = useMutation({
    mutationFn: (draftId: string) => draftApi.pin(draftId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });

  /**
   * Unpin draft mutation.
   */
  const unpinMutation = useMutation({
    mutationFn: (draftId: string) => draftApi.unpin(draftId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });

  /**
   * Mark that there are unsaved changes.
   */
  const markDirty = useCallback((): void => {
    setHasUnsavedChanges(true);
  }, []);

  /**
   * Clear unsaved changes flag.
   */
  const markClean = useCallback((): void => {
    setHasUnsavedChanges(false);
  }, []);

  return {
    hasUnsavedChanges,
    markDirty,
    markClean,
    saveDraft: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    openDraft: openMutation.mutateAsync,
    isOpening: openMutation.isPending,
    deleteDraft: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    pinDraft: pinMutation.mutate,
    unpinDraft: unpinMutation.mutate,
  };
}

/**
 * Hook for creating draft data from current state.
 *
 * @param estimateId - Estimate ID
 * @param selectedTemplateIds - Selected template IDs
 * @param formValues - Current form values
 * @param signatures - Current signatures
 * @param initials - Current initials
 * @returns Draft creation helper
 */
export function useCreateDraftData(
  estimateId: string,
  selectedTemplateIds: string[],
  formValues: Record<string, unknown>,
  signatures: SignaturePage[],
  initials: InitialsRequirement[],
) {
  /**
   * Create draft data from current state.
   */
  const createDraftData = useCallback(
    (name: string): Omit<SavedDraft, 'id' | 'createdAt' | 'updatedAt'> => {
      return {
        name,
        estimateId,
        selectedTemplateIds,
        formValues,
        signatures: signatures
          .filter(s => s.isCaptured && s.imageDataUrl)
          .map(s => ({
            id: s.id,
            signerId: s.signerId,
            imageDataUrl: s.imageDataUrl!,
          })),
        initials: initials
          .filter(i => i.isCaptured && i.imageDataUrl)
          .map(i => ({
            id: i.id,
            signerId: i.signerId,
            imageDataUrl: i.imageDataUrl!,
          })),
        photoIds: [],
        isSynced: false,
        isPinned: false,
      };
    },
    [estimateId, selectedTemplateIds, formValues, signatures, initials],
  );

  return { createDraftData };
}

/**
 * Hook for uploading pinned drafts.
 * iOS: SavedTemplate promiseTryUploadingPinnedTemplates
 */
export function useUploadPinnedDrafts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => draftApi.uploadPinnedDrafts(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}
