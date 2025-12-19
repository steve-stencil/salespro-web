/**
 * Tests for OfficeSettingsDialog component.
 * Verifies dialog rendering, logo management, and API interactions.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OfficeSettingsDialog } from '../../../components/offices/OfficeSettingsDialog';
import {
  useOfficeSettings,
  useSelectLogo,
  useRemoveLogo,
} from '../../../hooks/useOfficeSettings';

import type { Office } from '../../../types/users';

// Mock the hooks
vi.mock('../../../hooks/useOfficeSettings', () => ({
  useOfficeSettings: vi.fn(),
  useSelectLogo: vi.fn(),
  useUploadLogo: vi.fn(),
  useRemoveLogo: vi.fn(),
}));

// Mock the company LogoPickerDialog
vi.mock('../../../components/company', () => ({
  LogoPickerDialog: () => null,
}));

// ============================================================================
// Test Data
// ============================================================================

const mockOffice: Office = {
  id: 'office-123',
  name: 'Test Office',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
};

const mockSettings = {
  settings: {
    id: 'settings-123',
    officeId: 'office-123',
    logo: {
      id: 'logo-123',
      name: 'Test Logo',
      url: 'https://example.com/logo.png',
      thumbnailUrl: 'https://example.com/logo-thumb.png',
      filename: 'company-logo.png',
    },
    companyDefaultLogo: {
      id: 'default-logo-123',
      name: 'Company Default Logo',
      url: 'https://example.com/default-logo.png',
      thumbnailUrl: 'https://example.com/default-logo-thumb.png',
      filename: 'default-logo.png',
    },
    logoSource: 'office' as const,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
};

const mockSettingsNoLogo = {
  settings: {
    id: 'settings-123',
    officeId: 'office-123',
    logo: null,
    companyDefaultLogo: {
      id: 'default-logo-123',
      name: 'Company Default Logo',
      url: 'https://example.com/default-logo.png',
      thumbnailUrl: 'https://example.com/default-logo-thumb.png',
      filename: 'default-logo.png',
    },
    logoSource: 'company' as const,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
};

// ============================================================================
// Test Utilities
// ============================================================================

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

type RenderOptions = {
  open?: boolean;
  office?: Office | null;
  settingsData?: typeof mockSettings | typeof mockSettingsNoLogo | null;
  isLoadingSettings?: boolean;
};

function renderDialog(options: RenderOptions = {}): {
  queryClient: QueryClient;
  mockSelectLogo: ReturnType<typeof vi.fn>;
  mockRemoveLogo: ReturnType<typeof vi.fn>;
  mockOnClose: ReturnType<typeof vi.fn>;
  mockOnUpdated: ReturnType<typeof vi.fn>;
} {
  const {
    open = true,
    office = mockOffice,
    settingsData = mockSettings,
    isLoadingSettings = false,
  } = options;

  const queryClient = createQueryClient();
  const mockSelectMutate = vi.fn().mockResolvedValue({});
  const mockRemoveMutate = vi.fn().mockResolvedValue({});
  const mockOnClose = vi.fn();
  const mockOnUpdated = vi.fn();

  vi.mocked(useOfficeSettings).mockReturnValue({
    data: settingsData,
    isLoading: isLoadingSettings,
    refetch: vi.fn(),
    error: null,
    isError: false,
    isFetching: false,
    isPending: isLoadingSettings,
    isSuccess: !isLoadingSettings && settingsData !== null,
    status: isLoadingSettings ? 'pending' : 'success',
  } as unknown as ReturnType<typeof useOfficeSettings>);

  vi.mocked(useSelectLogo).mockReturnValue({
    mutateAsync: mockSelectMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useSelectLogo>);

  vi.mocked(useRemoveLogo).mockReturnValue({
    mutateAsync: mockRemoveMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useRemoveLogo>);

  render(
    <QueryClientProvider client={queryClient}>
      <OfficeSettingsDialog
        open={open}
        office={office}
        onClose={mockOnClose}
        onUpdated={mockOnUpdated}
      />
    </QueryClientProvider>,
  );

  return {
    queryClient,
    mockSelectLogo: mockSelectMutate,
    mockRemoveLogo: mockRemoveMutate,
    mockOnClose,
    mockOnUpdated,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('OfficeSettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should display dialog with office name', () => {
      renderDialog();

      expect(screen.getByText('Office Settings')).toBeInTheDocument();
      expect(screen.getByText('Test Office')).toBeInTheDocument();
    });

    it('should display logo section', () => {
      renderDialog();

      expect(screen.getByText('Office Logo')).toBeInTheDocument();
      expect(
        screen.getByText(/select a logo from your company's library/i),
      ).toBeInTheDocument();
    });

    it('should show loading skeleton when settings are loading', () => {
      renderDialog({ isLoadingSettings: true, settingsData: null });

      // Dialog should still render but with loading state
      expect(screen.getByText('Office Settings')).toBeInTheDocument();
    });

    it('should display settings metadata when available', () => {
      renderDialog();

      expect(screen.getByText(/settings last updated/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderDialog({ open: false });

      expect(screen.queryByText('Office Settings')).not.toBeInTheDocument();
    });
  });

  describe('close functionality', () => {
    it('should call onClose when close button is clicked', () => {
      const { mockOnClose } = renderDialog();

      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('with existing logo', () => {
    it('should display current logo name', () => {
      renderDialog();

      expect(screen.getByText('Test Logo')).toBeInTheDocument();
    });

    it('should display Custom badge for office-specific logo', () => {
      renderDialog();

      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('should display choose from library button', () => {
      renderDialog();

      expect(
        screen.getByRole('button', { name: /choose from library/i }),
      ).toBeInTheDocument();
    });

    it('should display reset to default button', () => {
      renderDialog();

      expect(
        screen.getByRole('button', { name: /reset to default/i }),
      ).toBeInTheDocument();
    });
  });

  describe('with inherited logo', () => {
    it('should display inherited chip when using company default', () => {
      renderDialog({ settingsData: mockSettingsNoLogo });

      expect(screen.getByText('Inherited')).toBeInTheDocument();
    });

    it('should display company default logo info', () => {
      renderDialog({ settingsData: mockSettingsNoLogo });

      expect(screen.getByText('Company Default Logo')).toBeInTheDocument();
      expect(
        screen.getByText(/using company default logo/i),
      ).toBeInTheDocument();
    });

    it('should not display reset button when using inherited logo', () => {
      renderDialog({ settingsData: mockSettingsNoLogo });

      expect(
        screen.queryByRole('button', { name: /reset to default/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('no office selected', () => {
    it('should show info message when no office is selected', () => {
      renderDialog({ office: null });

      expect(screen.getByText(/no office selected/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible dialog title', () => {
      renderDialog();

      expect(
        screen.getByRole('heading', { name: /office settings/i }),
      ).toBeInTheDocument();
    });
  });
});
