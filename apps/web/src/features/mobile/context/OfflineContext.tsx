/**
 * Offline context for managing offline state and sync operations.
 * Based on iOS offline behavior patterns.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

import type { OfflineStatus, PendingSyncOperation } from '../types/offline';
import type { ReactNode } from 'react';

type OfflineContextValue = {
  status: OfflineStatus;
  /**
   * Queue a sync operation for when back online.
   */
  queueSync: (
    operation: Omit<PendingSyncOperation, 'id' | 'createdAt' | 'retryCount'>,
  ) => void;
  /**
   * Get all pending sync operations.
   */
  getPendingOperations: () => Promise<PendingSyncOperation[]>;
  /**
   * Force a sync attempt.
   */
  syncNow: () => Promise<void>;
  /**
   * Clear completed sync operations.
   */
  clearCompleted: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

type OfflineProviderProps = {
  children: ReactNode;
};

/**
 * Provider component for offline state management.
 * Tracks online/offline status and manages pending sync operations.
 */
export function OfflineProvider({
  children,
}: OfflineProviderProps): React.ReactElement {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    pendingSyncCount: 0,
  });

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = (): void => {
      setStatus(prev => ({
        ...prev,
        isOnline: true,
        lastOnlineAt: new Date().toISOString(),
      }));
    };

    const handleOffline = (): void => {
      setStatus(prev => ({
        ...prev,
        isOnline: false,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Queue a sync operation for when back online.
   */
  const queueSync = useCallback(
    (
      operation: Omit<PendingSyncOperation, 'id' | 'createdAt' | 'retryCount'>,
    ): void => {
      const fullOperation: PendingSyncOperation = {
        ...operation,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };

      // TODO: Persist to IndexedDB
      console.log('Queuing sync operation:', fullOperation);

      setStatus(prev => ({
        ...prev,
        pendingSyncCount: prev.pendingSyncCount + 1,
      }));
    },
    [],
  );

  /**
   * Get all pending sync operations.
   */
  const getPendingOperations = useCallback((): Promise<
    PendingSyncOperation[]
  > => {
    // TODO: Load from IndexedDB
    return Promise.resolve([]);
  }, []);

  /**
   * Force a sync attempt.
   */
  const syncNow = useCallback((): Promise<void> => {
    if (!status.isOnline) {
      console.warn('Cannot sync while offline');
      return Promise.resolve();
    }

    return getPendingOperations().then(operations => {
      for (const operation of operations) {
        // TODO: Process each operation
        console.log('Processing sync operation:', operation.id);
      }
    });
  }, [status.isOnline, getPendingOperations]);

  /**
   * Clear completed sync operations.
   */
  const clearCompleted = useCallback((): Promise<void> => {
    // TODO: Clear from IndexedDB
    setStatus(prev => ({
      ...prev,
      pendingSyncCount: 0,
    }));
    return Promise.resolve();
  }, []);

  const value: OfflineContextValue = {
    status,
    queueSync,
    getPendingOperations,
    syncNow,
    clearCompleted,
  };

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  );
}

/**
 * Hook to access offline state and operations.
 * @throws Error if used outside of OfflineProvider.
 */
export function useOffline(): OfflineContextValue {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
