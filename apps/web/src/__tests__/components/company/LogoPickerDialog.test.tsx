/**
 * Tests for LogoPickerDialog component.
 * Verifies logo selection, tabs, and upload functionality.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LogoPickerDialog } from '../../../components/company/LogoPickerDialog';
import { companyApi } from '../../../services/company';

import type { CompanyLogoLibraryItem } from '../../../types/company';

// Mock the company API
vi.mock('../../../services/company', () => ({
  companyApi: {
    getLogoLibrary: vi.fn(),
    addLogoToLibrary: vi.fn(),
  },
}));

// Mock the api-client error handler
vi.mock('../../../lib/api-client', () => ({
  handleApiError: vi.fn(err =>
    err instanceof Error ? err.message : 'An error occurred',
  ),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockLogos: CompanyLogoLibraryItem[] = [
  {
    id: 'logo-1',
    name: 'Main Logo',
    url: 'https://example.com/logo1.png',
    thumbnailUrl: 'https://example.com/logo1-thumb.png',
    filename: 'logo1.png',
    isDefault: true,
    usedByOfficeCount: 2,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'logo-2',
    name: 'Secondary Logo',
    url: 'https://example.com/logo2.png',
    thumbnailUrl: 'https://example.com/logo2-thumb.png',
    filename: 'logo2.png',
    isDefault: false,
    usedByOfficeCount: 0,
    createdAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 'logo-3',
    name: 'Office Logo',
    url: 'https://example.com/logo3.png',
    thumbnailUrl: 'https://example.com/logo3-thumb.png',
    filename: 'logo3.png',
    isDefault: false,
    usedByOfficeCount: 1,
    createdAt: '2024-01-03T00:00:00Z',
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('LogoPickerDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();
  const mockOnUpload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(companyApi.getLogoLibrary).mockResolvedValue({
      logos: mockLogos,
      defaultLogoId: 'logo-1',
    });
    mockOnUpload.mockResolvedValue(undefined);
  });

  describe('rendering', () => {
    it('should display dialog with title', () => {
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      expect(
        screen.getByRole('heading', { name: /select logo/i }),
      ).toBeInTheDocument();
    });

    it('should display custom title when provided', () => {
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          title="Choose Office Logo"
        />,
      );

      expect(
        screen.getByRole('heading', { name: /choose office logo/i }),
      ).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(
        <LogoPickerDialog
          open={false}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      expect(
        screen.queryByRole('heading', { name: /select logo/i }),
      ).not.toBeInTheDocument();
    });

    it('should display tabs for library and upload', () => {
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      expect(
        screen.getByRole('tab', { name: /select from library/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /upload new/i }),
      ).toBeInTheDocument();
    });

    it('should default to library tab', () => {
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      const libraryTab = screen.getByRole('tab', {
        name: /select from library/i,
      });
      expect(libraryTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('logo library display', () => {
    it('should fetch and display logos when dialog opens', async () => {
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(companyApi.getLogoLibrary).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Main Logo')).toBeInTheDocument();
      });

      expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      expect(screen.getByText('Office Logo')).toBeInTheDocument();
    });

    it('should show empty state when no logos exist', async () => {
      vi.mocked(companyApi.getLogoLibrary).mockResolvedValue({
        logos: [],
        defaultLogoId: null,
      });

      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByText(/no logos in the library yet/i),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole('button', { name: /upload logo/i }),
      ).toBeInTheDocument();
    });

    it('should show error when fetch fails', async () => {
      vi.mocked(companyApi.getLogoLibrary).mockRejectedValue(
        new Error('Failed to load logos'),
      );

      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load logos/i)).toBeInTheDocument();
      });
    });
  });

  describe('logo selection', () => {
    it('should highlight selected logo', async () => {
      render(
        <LogoPickerDialog
          open={true}
          selectedLogoId="logo-2"
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      // The selected logo card should have visual distinction
      const selectedCard = screen.getByTestId('logo-card-logo-2');
      expect(selectedCard).toHaveStyle({ borderWidth: '2px' });
    });

    it('should update selection when logo is clicked', async () => {
      const user = userEvent.setup();
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      // Click on a logo
      await user.click(screen.getByTestId('logo-card-logo-2'));

      // Confirm button should now show the selected logo name
      expect(
        screen.getByRole('button', { name: /select "secondary logo"/i }),
      ).toBeInTheDocument();
    });

    it('should call onSelect when confirmed', async () => {
      const user = userEvent.setup();
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      // Click on a logo
      await user.click(screen.getByTestId('logo-card-logo-2'));

      // Click confirm button
      await user.click(
        screen.getByRole('button', { name: /select "secondary logo"/i }),
      );

      expect(mockOnSelect).toHaveBeenCalledWith(mockLogos[1]);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have disabled confirm button when no logo selected', async () => {
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Main Logo')).toBeInTheDocument();
      });

      const selectButton = screen.getByRole('button', { name: /select logo/i });
      expect(selectButton).toBeDisabled();
    });
  });

  describe('cancel functionality', () => {
    it('should call onClose when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('upload tab', () => {
    it('should switch to upload tab when clicked', async () => {
      const user = userEvent.setup();
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await user.click(screen.getByRole('tab', { name: /upload new/i }));

      expect(
        screen.getByText(/upload a new logo to the company library/i),
      ).toBeInTheDocument();
    });

    it('should display upload button in upload tab', async () => {
      const user = userEvent.setup();
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await user.click(screen.getByRole('tab', { name: /upload new/i }));

      expect(
        screen.getByRole('button', { name: /choose file to upload/i }),
      ).toBeInTheDocument();
    });

    it('should switch to upload tab from empty state', async () => {
      const user = userEvent.setup();
      vi.mocked(companyApi.getLogoLibrary).mockResolvedValue({
        logos: [],
        defaultLogoId: null,
      });

      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByText(/no logos in the library yet/i),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /upload logo/i }));

      // Should now be on upload tab
      const uploadTab = screen.getByRole('tab', { name: /upload new/i });
      expect(uploadTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('dialog reset on reopen', () => {
    it('should reset to library tab when reopened', async () => {
      const { rerender } = render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Main Logo')).toBeInTheDocument();
      });

      // Close and reopen
      rerender(
        <LogoPickerDialog
          open={false}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      rerender(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      // Should be back on library tab
      const libraryTab = screen.getByRole('tab', {
        name: /select from library/i,
      });
      expect(libraryTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should clear pending selection when reopened', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Main Logo')).toBeInTheDocument();
      });

      // Select a logo
      await user.click(screen.getByTestId('logo-card-logo-2'));

      // Close and reopen
      rerender(
        <LogoPickerDialog
          open={false}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      rerender(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Main Logo')).toBeInTheDocument();
      });

      // Confirm button should be back to generic text
      expect(
        screen.getByRole('button', { name: /^select logo$/i }),
      ).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have accessible dialog title', () => {
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      expect(
        screen.getByRole('heading', { name: /select logo/i }),
      ).toBeInTheDocument();
    });

    it('should have accessible tab navigation', () => {
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(2);
    });

    it('should have accessible action buttons', () => {
      render(
        <LogoPickerDialog
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />,
      );

      expect(
        screen.getByRole('button', { name: /cancel/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /select logo/i }),
      ).toBeInTheDocument();
    });
  });
});
