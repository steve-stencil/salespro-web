/**
 * Price Guide Import Hooks Tests
 *
 * Unit tests for the price guide import hooks.
 * Tests error handling, state management, and API interaction.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  useSourceConnection,
  usePriceGuideSourceCounts,
  usePriceGuideSourceItems,
  useOfficeMappings,
  usePriceGuideImportedStatus,
  usePriceGuideImport,
} from '../hooks/usePriceGuideImport';
import { priceGuideServices } from '../services';

import type { MigrationSession, PriceGuideSourceCounts } from '../types';
import type { ReactNode } from 'react';

// Mock the services module
vi.mock('../services', () => ({
  priceGuideServices: {
    checkSourceConnection: vi.fn(),
    getSourceCounts: vi.fn(),
    getSourceItems: vi.fn(),
    getOfficeMappings: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    importBatch: vi.fn(),
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

describe('useSourceConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch and return connection status when connected', async () => {
    vi.mocked(priceGuideServices.checkSourceConnection).mockResolvedValue({
      connected: true,
    });

    const { result } = renderHook(() => useSourceConnection(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ connected: true });
    expect(priceGuideServices.checkSourceConnection).toHaveBeenCalled();
  });

  it('should return connection status with error message when not connected', async () => {
    vi.mocked(priceGuideServices.checkSourceConnection).mockResolvedValue({
      connected: false,
      message: 'MongoDB connection refused',
    });

    const { result } = renderHook(() => useSourceConnection(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.connected).toBe(false);
    expect(result.current.data?.message).toBe('MongoDB connection refused');
  });

  it('should handle errors', async () => {
    const error = new Error('Network error');
    vi.mocked(priceGuideServices.checkSourceConnection).mockRejectedValue(
      error,
    );

    const { result } = renderHook(() => useSourceConnection(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

describe('usePriceGuideSourceCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return source counts', async () => {
    const mockCounts: PriceGuideSourceCounts = {
      categories: 24,
      msis: 1247,
      options: 3892,
      upCharges: 856,
      additionalDetails: 412,
      images: 156,
    };

    vi.mocked(priceGuideServices.getSourceCounts).mockResolvedValue(mockCounts);

    const { result } = renderHook(() => usePriceGuideSourceCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockCounts);
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch counts');
    vi.mocked(priceGuideServices.getSourceCounts).mockRejectedValue(error);

    const { result } = renderHook(() => usePriceGuideSourceCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('usePriceGuideSourceItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return source items', async () => {
    const mockResponse = {
      data: [
        { objectId: 'msi1', name: 'MSI 1' },
        { objectId: 'msi2', name: 'MSI 2' },
      ],
      meta: { total: 100, skip: 0, limit: 100 },
    };

    vi.mocked(priceGuideServices.getSourceItems).mockResolvedValue(
      mockResponse,
    );

    const { result } = renderHook(() => usePriceGuideSourceItems(0, 100), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(priceGuideServices.getSourceItems).toHaveBeenCalledWith(0, 100);
  });
});

describe('useOfficeMappings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return office mappings', async () => {
    const mockMappings = [
      {
        sourceId: 'source-office-1',
        sourceName: 'Main Office',
        targetId: 'target-office-1',
        targetName: 'Main Office (New)',
        msiCount: 847,
      },
      {
        sourceId: 'source-office-2',
        sourceName: 'West Branch',
        targetId: null,
        targetName: null,
        msiCount: 234,
      },
    ];

    vi.mocked(priceGuideServices.getOfficeMappings).mockResolvedValue(
      mockMappings,
    );

    const { result } = renderHook(() => useOfficeMappings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockMappings);
  });
});

describe('usePriceGuideImportedStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch imported status for source IDs', async () => {
    vi.mocked(priceGuideServices.getImportedStatus).mockResolvedValue([
      'msi1',
      'msi3',
    ]);

    const { result } = renderHook(
      () => usePriceGuideImportedStatus(['msi1', 'msi2', 'msi3']),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(['msi1', 'msi3']);
    expect(priceGuideServices.getImportedStatus).toHaveBeenCalledWith([
      'msi1',
      'msi2',
      'msi3',
    ]);
  });

  it('should not fetch when sourceIds is empty', () => {
    const { result } = renderHook(() => usePriceGuideImportedStatus([]), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(priceGuideServices.getImportedStatus).not.toHaveBeenCalled();
  });
});

describe('usePriceGuideImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => usePriceGuideImport(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isImporting).toBe(false);
    expect(result.current.session).toBeNull();
    expect(result.current.importError).toBeNull();
    expect(result.current.hasFailed).toBe(false);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.progress.phase).toBe('idle');
    expect(result.current.progress.overallProgress).toBe(0);
  });

  it('should have default config values', () => {
    const { result } = renderHook(() => usePriceGuideImport(), {
      wrapper: createWrapper(),
    });

    expect(result.current.config.priceTypeStrategy).toBe('combined');
    expect(result.current.config.autoCreateCategories).toBe(true);
    expect(result.current.config.duplicateHandling).toBe('skip');
    expect(result.current.config.includeImages).toBe(true);
  });

  it('should update config correctly', () => {
    const { result } = renderHook(() => usePriceGuideImport(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.updateConfig({ priceTypeStrategy: 'materials' });
    });

    expect(result.current.config.priceTypeStrategy).toBe('materials');
    expect(result.current.config.autoCreateCategories).toBe(true); // Unchanged
  });

  it('should handle session creation failure', async () => {
    const error = new Error('Source company not found');
    vi.mocked(priceGuideServices.createSession).mockRejectedValue(error);

    const { result } = renderHook(() => usePriceGuideImport(), {
      wrapper: createWrapper(),
    });

    const sourceCounts: PriceGuideSourceCounts = {
      categories: 10,
      msis: 100,
      options: 200,
      upCharges: 50,
    };

    await act(async () => {
      await result.current.startImport(sourceCounts);
    });

    expect(result.current.hasFailed).toBe(true);
    expect(result.current.importError).toBe('Source company not found');
    expect(result.current.isImporting).toBe(false);
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

    vi.mocked(priceGuideServices.createSession).mockResolvedValue(mockSession);

    const { result } = renderHook(() => usePriceGuideImport(), {
      wrapper: createWrapper(),
    });

    const sourceCounts: PriceGuideSourceCounts = {
      categories: 0,
      msis: 0,
      options: 0,
      upCharges: 0,
    };

    await act(async () => {
      await result.current.startImport(sourceCounts);
    });

    expect(result.current.isImporting).toBe(false);
    expect(result.current.progress.phase).toBe('complete');
    expect(result.current.progress.overallProgress).toBe(100);
  });

  it('should reset state correctly', () => {
    const { result } = renderHook(() => usePriceGuideImport(), {
      wrapper: createWrapper(),
    });

    // Set some config
    act(() => {
      result.current.updateConfig({ priceTypeStrategy: 'labor' });
    });

    expect(result.current.config.priceTypeStrategy).toBe('labor');

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.isImporting).toBe(false);
    expect(result.current.session).toBeNull();
    expect(result.current.config.priceTypeStrategy).toBe('combined'); // Back to default
    expect(result.current.progress.phase).toBe('idle');
    expect(result.current.importError).toBeNull();
    expect(result.current.hasFailed).toBe(false);
  });

  it('should extract error message from axios errors', async () => {
    const axiosError = {
      response: {
        data: {
          message: 'Source company not found in legacy system',
        },
      },
      message: 'Request failed',
    };
    vi.mocked(priceGuideServices.createSession).mockRejectedValue(axiosError);

    const { result } = renderHook(() => usePriceGuideImport(), {
      wrapper: createWrapper(),
    });

    const sourceCounts: PriceGuideSourceCounts = {
      categories: 10,
      msis: 100,
      options: 200,
      upCharges: 50,
    };

    await act(async () => {
      await result.current.startImport(sourceCounts);
    });

    expect(result.current.hasFailed).toBe(true);
    expect(result.current.importError).toBe(
      'Source company not found in legacy system',
    );
  });

  it('should extract error property from axios errors', async () => {
    const axiosError = {
      response: {
        data: {
          error: 'Legacy database unavailable',
        },
      },
    };
    vi.mocked(priceGuideServices.createSession).mockRejectedValue(axiosError);

    const { result } = renderHook(() => usePriceGuideImport(), {
      wrapper: createWrapper(),
    });

    const sourceCounts: PriceGuideSourceCounts = {
      categories: 10,
      msis: 100,
      options: 200,
      upCharges: 50,
    };

    await act(async () => {
      await result.current.startImport(sourceCounts);
    });

    expect(result.current.hasFailed).toBe(true);
    expect(result.current.importError).toBe('Legacy database unavailable');
  });
});
