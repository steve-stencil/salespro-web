/**
 * Migration Hooks Tests
 *
 * Unit tests for the migration feature hooks.
 * Tests error handling, state management, and API interaction.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  useSourceCount,
  useSourceItems,
  useImportedStatus,
  useImportBatches,
} from '../hooks';
import { officeServices } from '../services';

import type { MigrationSession } from '../types';
import type { ReactNode } from 'react';

// Mock the services module
vi.mock('../services', () => ({
  officeServices: {
    getSourceCount: vi.fn(),
    getSourceItems: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    importBatch: vi.fn(),
    importSelectedItems: vi.fn(),
    getImportedStatus: vi.fn(),
  },
}));

// Create a test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe('useSourceCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch and return source count', async () => {
    vi.mocked(officeServices.getSourceCount).mockResolvedValue(5);

    const { result } = renderHook(() => useSourceCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(5);
    expect(officeServices.getSourceCount).toHaveBeenCalled();
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch count');
    vi.mocked(officeServices.getSourceCount).mockRejectedValue(error);

    const { result } = renderHook(() => useSourceCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

describe('useSourceItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return source items', async () => {
    const mockResponse = {
      data: [
        { objectId: 'office1', name: 'Office 1' },
        { objectId: 'office2', name: 'Office 2' },
      ],
      meta: { total: 2, skip: 0, limit: 100 },
    };
    vi.mocked(officeServices.getSourceItems).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useSourceItems(0, 100), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(officeServices.getSourceItems).toHaveBeenCalledWith(0, 100);
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch items');
    vi.mocked(officeServices.getSourceItems).mockRejectedValue(error);

    const { result } = renderHook(() => useSourceItems(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useImportedStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch imported status for source IDs', async () => {
    vi.mocked(officeServices.getImportedStatus).mockResolvedValue([
      'office1',
      'office3',
    ]);

    const { result } = renderHook(
      () => useImportedStatus(['office1', 'office2', 'office3']),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(['office1', 'office3']);
    expect(officeServices.getImportedStatus).toHaveBeenCalledWith([
      'office1',
      'office2',
      'office3',
    ]);
  });

  it('should not fetch when sourceIds is empty', () => {
    const { result } = renderHook(() => useImportedStatus([]), {
      wrapper: createWrapper(),
    });

    // Should not be loading or fetching
    expect(result.current.isLoading).toBe(false);
    expect(officeServices.getImportedStatus).not.toHaveBeenCalled();
  });
});

describe('useImportBatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useImportBatches(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isImporting).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.session).toBeNull();
    expect(result.current.errors).toEqual([]);
    expect(result.current.importError).toBeNull();
    expect(result.current.hasFailed).toBe(false);
    expect(result.current.isComplete).toBe(false);
  });

  it('should handle successful import', async () => {
    const mockSession: MigrationSession = {
      id: 'session-123',
      status: 'pending',
      totalCount: 3,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      createdAt: new Date().toISOString(),
    };

    const mockBatchResult = {
      importedCount: 3,
      skippedCount: 0,
      errorCount: 0,
      errors: [] as Array<{ sourceId: string; error: string }>,
      hasMore: false,
      session: {
        ...mockSession,
        status: 'completed' as const,
        importedCount: 3,
      },
    };

    vi.mocked(officeServices.createSession).mockResolvedValue(mockSession);
    vi.mocked(officeServices.importBatch).mockResolvedValue(mockBatchResult);

    const { result } = renderHook(() => useImportBatches(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startImport();
    });

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });

    expect(result.current.importedCount).toBe(3);
    expect(result.current.hasFailed).toBe(false);
  });

  it('should handle session creation failure', async () => {
    const error = new Error('Internal server error');
    vi.mocked(officeServices.createSession).mockRejectedValue(error);

    const { result } = renderHook(() => useImportBatches(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startImport();
    });

    await waitFor(() => {
      expect(result.current.hasFailed).toBe(true);
    });

    expect(result.current.importError).toBe('Internal server error');
    expect(result.current.isImporting).toBe(false);
  });

  it('should handle batch import failure', async () => {
    const mockSession: MigrationSession = {
      id: 'session-123',
      status: 'pending',
      totalCount: 3,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(officeServices.createSession).mockResolvedValue(mockSession);
    vi.mocked(officeServices.importBatch).mockRejectedValue(
      new Error('Batch import failed'),
    );

    const { result } = renderHook(() => useImportBatches(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startImport();
    });

    await waitFor(() => {
      expect(result.current.hasFailed).toBe(true);
    });

    expect(result.current.importError).toBe('Batch import failed');
  });

  it('should handle zero items gracefully', async () => {
    const mockSession: MigrationSession = {
      id: 'session-123',
      status: 'pending',
      totalCount: 0,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(officeServices.createSession).mockResolvedValue(mockSession);

    const { result } = renderHook(() => useImportBatches(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startImport();
    });

    await waitFor(() => {
      expect(result.current.isImporting).toBe(false);
    });

    // Should complete immediately with 0 items
    expect(result.current.isComplete).toBe(true);
  });

  it('should reset state correctly', async () => {
    const mockSession: MigrationSession = {
      id: 'session-123',
      status: 'completed',
      totalCount: 3,
      importedCount: 3,
      skippedCount: 0,
      errorCount: 0,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(officeServices.createSession).mockResolvedValue(mockSession);
    vi.mocked(officeServices.importBatch).mockResolvedValue({
      importedCount: 3,
      skippedCount: 0,
      errorCount: 0,
      errors: [] as Array<{ sourceId: string; error: string }>,
      hasMore: false,
      session: mockSession,
    });

    const { result } = renderHook(() => useImportBatches(), {
      wrapper: createWrapper(),
    });

    // Run import
    await act(async () => {
      await result.current.startImport();
    });

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.isImporting).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.session).toBeNull();
    expect(result.current.importError).toBeNull();
    expect(result.current.hasFailed).toBe(false);
  });

  it('should extract error message from axios errors', async () => {
    // Mock an axios-style error with response data
    const axiosError = {
      response: {
        data: {
          message: 'Source company not found in legacy system',
        },
      },
      message: 'Request failed',
    };
    vi.mocked(officeServices.createSession).mockRejectedValue(axiosError);

    const { result } = renderHook(() => useImportBatches(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startImport();
    });

    await waitFor(() => {
      expect(result.current.hasFailed).toBe(true);
    });

    expect(result.current.importError).toBe(
      'Source company not found in legacy system',
    );
  });

  describe('startSelectiveImport', () => {
    it('should import only selected items', async () => {
      const mockSession: MigrationSession = {
        id: 'session-123',
        status: 'pending',
        totalCount: 5, // Total count in source
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        createdAt: new Date().toISOString(),
      };

      const mockImportResult = {
        importedCount: 2,
        skippedCount: 0,
        errorCount: 0,
        errors: [] as Array<{ sourceId: string; error: string }>,
        hasMore: false,
        session: {
          ...mockSession,
          status: 'completed' as const,
          importedCount: 2,
        },
      };

      vi.mocked(officeServices.createSession).mockResolvedValue(mockSession);
      vi.mocked(officeServices.importSelectedItems).mockResolvedValue(
        mockImportResult,
      );

      const { result } = renderHook(() => useImportBatches(), {
        wrapper: createWrapper(),
      });

      const selectedIds = ['office1', 'office2'];

      await act(async () => {
        await result.current.startSelectiveImport(selectedIds);
      });

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true);
      });

      expect(officeServices.importSelectedItems).toHaveBeenCalledWith(
        'session-123',
        selectedIds,
      );
      expect(result.current.importedCount).toBe(2);
      // totalCount should reflect selected items, not source total
      expect(result.current.totalCount).toBe(2);
    });

    it('should do nothing when no items are selected', async () => {
      const { result } = renderHook(() => useImportBatches(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startSelectiveImport([]);
      });

      expect(officeServices.createSession).not.toHaveBeenCalled();
      expect(result.current.isImporting).toBe(false);
    });

    it('should handle selective import failure', async () => {
      const mockSession: MigrationSession = {
        id: 'session-123',
        status: 'pending',
        totalCount: 5,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(officeServices.createSession).mockResolvedValue(mockSession);
      vi.mocked(officeServices.importSelectedItems).mockRejectedValue(
        new Error('Import failed'),
      );

      const { result } = renderHook(() => useImportBatches(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startSelectiveImport(['office1']);
      });

      await waitFor(() => {
        expect(result.current.hasFailed).toBe(true);
      });

      expect(result.current.importError).toBe('Import failed');
    });
  });
});
