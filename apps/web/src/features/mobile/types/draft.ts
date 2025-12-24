/**
 * Draft and saved template types for iOS parity.
 * Based on iOS source: ContractObjectSelectionCollectionViewController.m
 */

/**
 * A saved draft of contract template selection.
 * Persisted locally and optionally synced to server.
 */
export type SavedDraft = {
  id: string;
  name: string;
  estimateId: string;
  /** IDs of selected templates. */
  selectedTemplateIds: string[];
  /** Form values entered by user. */
  formValues: Record<string, unknown>;
  /** Captured signatures (base64 image data). */
  signatures: SavedSignatureData[];
  /** Captured initials (base64 image data). */
  initials: SavedInitialsData[];
  /** Local photo references. */
  photoIds: string[];
  createdAt: string;
  updatedAt: string;
  /** Whether this draft has been uploaded to server. */
  isSynced: boolean;
  /** Whether this draft is pinned for offline access. */
  isPinned: boolean;
};

/**
 * Saved signature data within a draft.
 */
export type SavedSignatureData = {
  id: string;
  signerId: string;
  imageDataUrl: string;
};

/**
 * Saved initials data within a draft.
 */
export type SavedInitialsData = {
  id: string;
  signerId: string;
  imageDataUrl: string;
};

/**
 * Draft upload status for retry tracking.
 */
export type DraftUploadStatus = {
  draftId: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  lastAttempt?: string;
  retryCount: number;
  errorMessage?: string;
};

/**
 * Result of saving a draft.
 */
export type SaveDraftResult = {
  success: boolean;
  draft?: SavedDraft;
  errorMessage?: string;
};

/**
 * Result of opening a saved draft.
 */
export type OpenDraftResult = {
  success: boolean;
  draft?: SavedDraft;
  /** Whether current unsaved changes should be replaced. */
  requiresConfirmation: boolean;
  errorMessage?: string;
};

/**
 * Interoperability context for imported PDFs and reports.
 */
export type DraftInteropContext = {
  /** Imported PDF document IDs included in the draft. */
  importedPdfIds: string[];
  /** Report object IDs included in the draft. */
  reportObjectIds: string[];
};
