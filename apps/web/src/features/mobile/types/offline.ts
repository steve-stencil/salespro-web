/**
 * Offline behavior types for iOS parity.
 * Based on iOS source: ContractObjectSelectionCollectionViewController.m loadContracts
 */

/**
 * Offline status of the device/app.
 */
export type OfflineStatus = {
  isOnline: boolean;
  lastOnlineAt?: string;
  /** Pending sync operations count. */
  pendingSyncCount: number;
};

/**
 * Cached template list for offline access.
 * Based on iOS pinName, fromPin pattern.
 */
export type CachedTemplateList = {
  /** Unique cache key (e.g., companyId_officeId). */
  cacheKey: string;
  templates: CachedTemplate[];
  categories: CachedCategory[];
  cachedAt: string;
  /** Whether this cache was explicitly pinned by user. */
  isPinned: boolean;
};

/**
 * Cached template with offline-ready data.
 */
export type CachedTemplate = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  /** Base64 thumbnail for offline display. */
  thumbnailBase64?: string;
  /** Cached PDF data for offline generation. */
  pdfDataBase64?: string;
  sortOrder: number;
};

/**
 * Cached category for offline display.
 */
export type CachedCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

/**
 * Sync operation pending upload when back online.
 */
export type PendingSyncOperation = {
  id: string;
  type: 'draft' | 'contract' | 'signature' | 'photo';
  data: unknown;
  createdAt: string;
  retryCount: number;
  lastError?: string;
};

/**
 * Offline storage quota status.
 */
export type StorageQuotaStatus = {
  usedBytes: number;
  availableBytes: number;
  percentUsed: number;
  /** Whether quota is critically low. */
  isLow: boolean;
};

/**
 * Result of attempting to load templates while offline.
 */
export type OfflineTemplateLoadResult = {
  success: boolean;
  templates?: CachedTemplateList;
  /** Reason for failure if not successful. */
  failureReason?: 'no_cache' | 'cache_expired' | 'storage_error';
  /** User-friendly message. */
  message: string;
};
