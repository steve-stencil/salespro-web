/**
 * Tests for useOfficeSettings hooks.
 * Verifies data fetching and mutation behavior.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  useOfficeSettings,
  useUploadLogo,
  useRemoveLogo,
  officeSettingsKeys,
} from '../../hooks/useOfficeSettings';
import { officeSettingsApi } from '../../services/office-settings';

import type { ReactNode } from 'react';

// Mock the API service
vi.mock('../../services/office-settings', () => ({
  officeSettingsApi: {
    getSettings: vi.fn(),
    uploadLogo: vi.fn(),
    removeLogo: vi.fn(),
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const mockSettingsResponse = {
  settings: {
    id: 'settings-123',
    officeId: 'office-123',
    logo: {
      id: 'logo-123',
      url: 'https://example.com/logo.png',
      thumbnailUrl: 'https://example.com/logo-thumb.png',
      filename: 'logo.png',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
};

const mockUploadResponse = {
  message: 'Logo updated successfully',
  settings: mockSettingsResponse.settings,
};

const mockRemoveResponse = {
  message: 'Logo removed successfully',
  settings: {
    ...mockSettingsResponse.settings,
    logo: null,
  },
};

// ============================================================================
// Test Utilities
// ============================================================================

function createWrapper(): ({ children }: { children: ReactNode }) => ReactNode {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('officeSettingsKeys', () => {
  it('should generate correct query keys', () => {
    expect(officeSettingsKeys.all).toEqual(['officeSettings']);
    expect(officeSettingsKeys.settings()).toEqual([
      'officeSettings',
      'settings',
    ]);
    expect(officeSettingsKeys.setting('office-123')).toEqual([
      'officeSettings',
      'settings',
      'office-123',
    ]);
  });
});

describe('useOfficeSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch office settings', async () => {
    vi.mocked(officeSettingsApi.getSettings).mockResolvedValue(
      mockSettingsResponse,
    );

    const { result } = renderHook(() => useOfficeSettings('office-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSettingsResponse);
    expect(officeSettingsApi.getSettings).toHaveBeenCalledWith('office-123');
  });

  it('should not fetch when officeId is null', () => {
    const { result } = renderHook(() => useOfficeSettings(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(officeSettingsApi.getSettings).not.toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    const error = new Error('Failed to fetch settings');
    vi.mocked(officeSettingsApi.getSettings).mockRejectedValue(error);

    const { result } = renderHook(() => useOfficeSettings('office-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

describe('useUploadLogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upload logo successfully', async () => {
    vi.mocked(officeSettingsApi.uploadLogo).mockResolvedValue(
      mockUploadResponse,
    );

    const { result } = renderHook(() => useUploadLogo(), {
      wrapper: createWrapper(),
    });

    const mockFile = new File(['test'], 'logo.png', { type: 'image/png' });

    await result.current.mutateAsync({
      officeId: 'office-123',
      file: mockFile,
    });

    expect(officeSettingsApi.uploadLogo).toHaveBeenCalledWith(
      'office-123',
      mockFile,
    );
  });

  it('should handle upload errors', async () => {
    const error = new Error('Upload failed');
    vi.mocked(officeSettingsApi.uploadLogo).mockRejectedValue(error);

    const { result } = renderHook(() => useUploadLogo(), {
      wrapper: createWrapper(),
    });

    const mockFile = new File(['test'], 'logo.png', { type: 'image/png' });

    await expect(
      result.current.mutateAsync({
        officeId: 'office-123',
        file: mockFile,
      }),
    ).rejects.toThrow('Upload failed');
  });
});

describe('useRemoveLogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove logo successfully', async () => {
    vi.mocked(officeSettingsApi.removeLogo).mockResolvedValue(
      mockRemoveResponse,
    );

    const { result } = renderHook(() => useRemoveLogo(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync('office-123');

    expect(officeSettingsApi.removeLogo).toHaveBeenCalledWith('office-123');
  });

  it('should handle remove errors', async () => {
    const error = new Error('Remove failed');
    vi.mocked(officeSettingsApi.removeLogo).mockRejectedValue(error);

    const { result } = renderHook(() => useRemoveLogo(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync('office-123')).rejects.toThrow(
      'Remove failed',
    );
  });
});
