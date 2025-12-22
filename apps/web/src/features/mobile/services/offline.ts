/**
 * Offline service.
 * Handles template caching, storage management, and offline fallback.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m loadContracts
 */
import { openDB } from 'idb';

import type {
  CachedTemplateList,
  CachedTemplate,
  CachedCategory,
  StorageQuotaStatus,
  OfflineTemplateLoadResult,
} from '../types/offline';
import type { IDBPDatabase } from 'idb';

const DB_NAME = 'salespro-mobile';
const DB_VERSION = 1;
const TEMPLATES_STORE = 'templates';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

type OfflineDB = IDBPDatabase<{
  templates: {
    key: string;
    value: CachedTemplateList;
  };
}>;

/**
 * Get or create the IndexedDB database.
 */
async function getDB(): Promise<OfflineDB> {
  return openDB<{
    templates: {
      key: string;
      value: CachedTemplateList;
    };
  }>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(TEMPLATES_STORE)) {
        db.createObjectStore(TEMPLATES_STORE, { keyPath: 'cacheKey' });
      }
    },
  });
}

/**
 * Offline service methods.
 */
export const offlineService = {
  /**
   * Cache templates for offline access.
   * iOS: pinName pattern
   *
   * @param cacheKey - Unique cache key (e.g., companyId_officeId)
   * @param templates - Templates to cache
   * @param categories - Categories to cache
   * @param isPinned - Whether explicitly pinned by user
   */
  cacheTemplates: async (
    cacheKey: string,
    templates: CachedTemplate[],
    categories: CachedCategory[],
    isPinned = false,
  ): Promise<void> => {
    const db = await getDB();
    const cachedList: CachedTemplateList = {
      cacheKey,
      templates,
      categories,
      cachedAt: new Date().toISOString(),
      isPinned,
    };
    await db.put(TEMPLATES_STORE, cachedList);
  },

  /**
   * Load cached templates.
   * iOS: fromPin pattern
   *
   * @param cacheKey - Cache key to load
   * @returns Load result
   */
  loadCachedTemplates: async (
    cacheKey: string,
  ): Promise<OfflineTemplateLoadResult> => {
    try {
      const db = await getDB();
      const cached = await db.get(TEMPLATES_STORE, cacheKey);

      if (!cached) {
        return {
          success: false,
          failureReason: 'no_cache',
          message:
            'No cached templates available. Connect to the internet to load templates.',
        };
      }

      // Check if cache is expired (unless pinned)
      const cachedTime = new Date(cached.cachedAt).getTime();
      const isExpired = Date.now() - cachedTime > CACHE_EXPIRY_MS;

      if (isExpired && !cached.isPinned) {
        return {
          success: false,
          failureReason: 'cache_expired',
          message:
            'Cached templates are outdated. Connect to the internet to refresh.',
        };
      }

      return {
        success: true,
        templates: cached,
        message: `Loaded ${cached.templates.length} templates from cache.`,
      };
    } catch (error) {
      console.error('Failed to load cached templates:', error);
      return {
        success: false,
        failureReason: 'storage_error',
        message: 'Failed to access offline storage.',
      };
    }
  },

  /**
   * Pin templates for persistent offline access.
   *
   * @param cacheKey - Cache key to pin
   */
  pinTemplates: async (cacheKey: string): Promise<void> => {
    const db = await getDB();
    const cached = await db.get(TEMPLATES_STORE, cacheKey);
    if (cached) {
      cached.isPinned = true;
      await db.put(TEMPLATES_STORE, cached);
    }
  },

  /**
   * Unpin templates.
   *
   * @param cacheKey - Cache key to unpin
   */
  unpinTemplates: async (cacheKey: string): Promise<void> => {
    const db = await getDB();
    const cached = await db.get(TEMPLATES_STORE, cacheKey);
    if (cached) {
      cached.isPinned = false;
      await db.put(TEMPLATES_STORE, cached);
    }
  },

  /**
   * Clear expired caches (keeps pinned).
   */
  clearExpiredCaches: async (): Promise<void> => {
    const db = await getDB();
    const tx = db.transaction(TEMPLATES_STORE, 'readwrite');
    const store = tx.objectStore(TEMPLATES_STORE);

    let cursor = await store.openCursor();
    while (cursor) {
      const cached = cursor.value;
      const cachedTime = new Date(cached.cachedAt).getTime();
      const isExpired = Date.now() - cachedTime > CACHE_EXPIRY_MS;

      if (isExpired && !cached.isPinned) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }

    await tx.done;
  },

  /**
   * Get storage quota status.
   *
   * @returns Storage status
   */
  getStorageStatus: async (): Promise<StorageQuotaStatus> => {
    if (typeof navigator.storage.estimate !== 'function') {
      return {
        usedBytes: 0,
        availableBytes: 0,
        percentUsed: 0,
        isLow: false,
      };
    }

    const estimate = await navigator.storage.estimate();
    const usedBytes = estimate.usage ?? 0;
    const availableBytes = estimate.quota ?? 0;
    const percentUsed =
      availableBytes > 0 ? (usedBytes / availableBytes) * 100 : 0;

    return {
      usedBytes,
      availableBytes,
      percentUsed,
      isLow: percentUsed > 90,
    };
  },

  /**
   * Clear all cached data.
   */
  clearAllCaches: async (): Promise<void> => {
    const db = await getDB();
    await db.clear(TEMPLATES_STORE);
  },
};
