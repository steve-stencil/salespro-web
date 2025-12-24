/**
 * Draft API service.
 * Handles saving, loading, and syncing contract drafts.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m
 */
import { get, post, del } from '../lib/api-client';

import type {
  SavedDraft,
  DraftUploadStatus,
  SaveDraftResult,
  OpenDraftResult,
  DraftInteropContext,
} from '../types/draft';

/**
 * Draft API methods.
 */
export const draftApi = {
  /**
   * Save a draft of current contract selection.
   * iOS: showSaveDraftAlertOn:sender:, saveButtonTapped:
   *
   * @param draft - Draft data to save
   * @returns Save result with draft ID
   */
  save: async (
    draft: Omit<SavedDraft, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SaveDraftResult> => {
    return post<SaveDraftResult>('/drafts', draft);
  },

  /**
   * List saved drafts for an estimate.
   *
   * @param estimateId - Estimate ID
   * @returns List of saved drafts
   */
  list: async (estimateId: string): Promise<SavedDraft[]> => {
    return get<SavedDraft[]>(`/drafts`, { estimateId });
  },

  /**
   * Get a specific draft by ID.
   *
   * @param draftId - Draft ID
   * @returns Draft data
   */
  getById: async (draftId: string): Promise<SavedDraft> => {
    return get<SavedDraft>(`/drafts/${draftId}`);
  },

  /**
   * Open a saved draft.
   * iOS: openButtonTapped:, savedTemplatesWithViewController:selectedObjects:
   *
   * @param draftId - Draft to open
   * @param hasUnsavedChanges - Whether there are unsaved changes to confirm
   * @returns Open result with confirmation requirement
   */
  open: async (
    draftId: string,
    hasUnsavedChanges: boolean,
  ): Promise<OpenDraftResult> => {
    const draft = await draftApi.getById(draftId);
    return {
      success: true,
      draft,
      requiresConfirmation: hasUnsavedChanges,
    };
  },

  /**
   * Delete a saved draft.
   *
   * @param draftId - Draft to delete
   */
  delete: async (draftId: string): Promise<void> => {
    await del(`/drafts/${draftId}`);
  },

  /**
   * Upload pinned drafts that are pending sync.
   * iOS: SavedTemplate promiseTryUploadingPinnedTemplates
   *
   * @returns Upload statuses for all pending drafts
   */
  uploadPinnedDrafts: async (): Promise<DraftUploadStatus[]> => {
    return post<DraftUploadStatus[]>('/drafts/upload-pinned', {});
  },

  /**
   * Get upload status for a draft.
   *
   * @param draftId - Draft ID
   * @returns Upload status
   */
  getUploadStatus: async (draftId: string): Promise<DraftUploadStatus> => {
    return get<DraftUploadStatus>(`/drafts/${draftId}/status`);
  },

  /**
   * Pin a draft for offline access.
   *
   * @param draftId - Draft to pin
   */
  pin: async (draftId: string): Promise<void> => {
    await post(`/drafts/${draftId}/pin`, {});
  },

  /**
   * Unpin a draft.
   *
   * @param draftId - Draft to unpin
   */
  unpin: async (draftId: string): Promise<void> => {
    await post(`/drafts/${draftId}/unpin`, {});
  },

  /**
   * Get interoperability context for a draft.
   * iOS: handleSavedTemplateSelection: with imported PDFs and reports
   *
   * @param draftId - Draft ID
   * @returns Interop context with imported PDF and report IDs
   */
  getInteropContext: async (draftId: string): Promise<DraftInteropContext> => {
    return get<DraftInteropContext>(`/drafts/${draftId}/interop`);
  },
};
