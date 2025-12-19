/**
 * Tests for LogoLibrarySection component.
 * Verifies logo library display, upload, edit, delete, and set default functionality.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LogoLibrarySection } from '../../../components/company/LogoLibrarySection';
import { companyApi } from '../../../services/company';

import type { CompanyLogoLibraryItem } from '../../../types/company';

// Mock the company API
vi.mock('../../../services/company', () => ({
  companyApi: {
    getLogoLibrary: vi.fn(),
    addLogoToLibrary: vi.fn(),
    updateLogo: vi.fn(),
    deleteLogo: vi.fn(),
    setDefaultLogo: vi.fn(),
    removeDefaultLogo: vi.fn(),
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

describe('LogoLibrarySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(companyApi.getLogoLibrary).mockResolvedValue({
      logos: mockLogos,
      defaultLogoId: 'logo-1',
    });
  });

  describe('rendering', () => {
    it('should display section title', () => {
      render(<LogoLibrarySection />);

      expect(
        screen.getByRole('heading', { name: /logo library/i }),
      ).toBeInTheDocument();
    });

    it('should display section description', () => {
      render(<LogoLibrarySection />);

      expect(
        screen.getByText(/manage logos for your company and offices/i),
      ).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      render(<LogoLibrarySection />);

      // Skeleton should be visible during loading
      expect(screen.getByTestId('logo-library-section')).toBeInTheDocument();
    });

    it('should display logos after loading', async () => {
      render(<LogoLibrarySection />);

      await waitFor(() => {
        // Main Logo appears twice (default section + grid), so use getAllByText
        expect(screen.getAllByText('Main Logo').length).toBeGreaterThan(0);
      });

      expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      expect(screen.getByText('Office Logo')).toBeInTheDocument();
    });

    it('should display Add Logo button', () => {
      render(<LogoLibrarySection />);

      expect(
        screen.getByRole('button', { name: /add logo/i }),
      ).toBeInTheDocument();
    });

    it('should display refresh button', () => {
      render(<LogoLibrarySection />);

      expect(
        screen.getByRole('button', { name: /refresh/i }),
      ).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should display empty state when no logos exist', async () => {
      vi.mocked(companyApi.getLogoLibrary).mockResolvedValue({
        logos: [],
        defaultLogoId: null,
      });

      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(
          screen.getByText(/no logos in your library yet/i),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole('button', { name: /add your first logo/i }),
      ).toBeInTheDocument();
    });
  });

  describe('default logo section', () => {
    it('should display default logo section', async () => {
      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(
          screen.getByText(/default logo.*inherited by offices/i),
        ).toBeInTheDocument();
      });
    });

    it('should show usage count for default logo', async () => {
      render(<LogoLibrarySection />);

      await waitFor(() => {
        // Usage count appears in both default section and logo card
        expect(
          screen.getAllByText(/used by 2 offices/i).length,
        ).toBeGreaterThan(0);
      });
    });
  });

  describe('logo count display', () => {
    it('should display total logo count', async () => {
      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText(/all logos \(3\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('add logo functionality', () => {
    it('should open upload dialog when Add Logo is clicked', async () => {
      const user = userEvent.setup();
      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getAllByText('Main Logo').length).toBeGreaterThan(0);
      });

      await user.click(screen.getByRole('button', { name: /add logo/i }));

      expect(screen.getByText('Add Logo to Library')).toBeInTheDocument();
    });
  });

  describe('edit logo functionality', () => {
    it('should open edit dialog when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      // Click edit button on Secondary Logo
      await user.click(screen.getByTestId('edit-logo-logo-2'));

      expect(
        screen.getByRole('heading', { name: /edit logo name/i }),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('Secondary Logo')).toBeInTheDocument();
    });

    it('should call update API when saving edit', async () => {
      const user = userEvent.setup();
      const secondaryLogo = mockLogos[1]!;
      vi.mocked(companyApi.updateLogo).mockResolvedValue({
        message: 'Logo updated',
        logo: { ...secondaryLogo, name: 'Updated Name' },
      });

      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      // Click edit button
      await user.click(screen.getByTestId('edit-logo-logo-2'));

      // Clear and type new name
      const input = screen.getByDisplayValue('Secondary Logo');
      await user.clear(input);
      await user.type(input, 'Updated Name');

      // Click save
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(companyApi.updateLogo).toHaveBeenCalledWith(
          'logo-2',
          'Updated Name',
        );
      });
    });
  });

  describe('delete logo functionality', () => {
    it('should open delete confirmation dialog', async () => {
      const user = userEvent.setup();
      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      // Click delete button on Secondary Logo (the only one that can be deleted)
      await user.click(screen.getByTestId('delete-logo-logo-2'));

      expect(
        screen.getByRole('heading', { name: /delete logo/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/are you sure you want to delete "Secondary Logo"/i),
      ).toBeInTheDocument();
    });

    it('should call delete API when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(companyApi.deleteLogo).mockResolvedValue({
        message: 'Logo deleted',
      });

      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      // Click delete button
      await user.click(screen.getByTestId('delete-logo-logo-2'));

      // Confirm delete
      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      await waitFor(() => {
        expect(companyApi.deleteLogo).toHaveBeenCalledWith('logo-2');
      });
    });

    it('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      // Click delete button
      await user.click(screen.getByTestId('delete-logo-logo-2'));

      // Click cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /delete logo/i }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('set default functionality', () => {
    it('should call set default API', async () => {
      const user = userEvent.setup();
      const secondaryLogo = mockLogos[1]!;
      vi.mocked(companyApi.setDefaultLogo).mockResolvedValue({
        message: 'Default logo updated',
        logo: { ...secondaryLogo, isDefault: true },
      });

      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      // Click set default button
      await user.click(screen.getByTestId('set-default-logo-logo-2'));

      await waitFor(() => {
        expect(companyApi.setDefaultLogo).toHaveBeenCalledWith('logo-2');
      });
    });

    it('should show success message after setting default', async () => {
      const user = userEvent.setup();
      const secondaryLogo = mockLogos[1]!;
      vi.mocked(companyApi.setDefaultLogo).mockResolvedValue({
        message: 'Default logo updated',
        logo: { ...secondaryLogo, isDefault: true },
      });

      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('set-default-logo-logo-2'));

      await waitFor(() => {
        expect(
          screen.getByText(/"Secondary Logo" set as default logo/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('refresh functionality', () => {
    it('should refetch logos when refresh is clicked', async () => {
      const user = userEvent.setup();
      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getAllByText('Main Logo').length).toBeGreaterThan(0);
      });

      expect(companyApi.getLogoLibrary).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: /refresh/i }));

      await waitFor(() => {
        expect(companyApi.getLogoLibrary).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('error handling', () => {
    it('should display error when fetch fails', async () => {
      vi.mocked(companyApi.getLogoLibrary).mockRejectedValue(
        new Error('Failed to load logos'),
      );

      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load logos/i)).toBeInTheDocument();
      });
    });

    it('should display error when delete fails', async () => {
      const user = userEvent.setup();
      vi.mocked(companyApi.deleteLogo).mockRejectedValue(
        new Error('Cannot delete logo'),
      );

      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('delete-logo-logo-2'));
      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      await waitFor(() => {
        expect(screen.getByText(/cannot delete logo/i)).toBeInTheDocument();
      });
    });

    it('should allow dismissing error message', async () => {
      const user = userEvent.setup();
      vi.mocked(companyApi.getLogoLibrary).mockRejectedValue(
        new Error('Network error'),
      );

      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Find and click the close button on the alert
      const alert = screen.getByRole('alert');
      const closeButton = within(alert).getByRole('button');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(/network error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('success messages', () => {
    it('should allow dismissing success message', async () => {
      const user = userEvent.setup();
      const secondaryLogo = mockLogos[1]!;
      vi.mocked(companyApi.setDefaultLogo).mockResolvedValue({
        message: 'Default logo updated',
        logo: { ...secondaryLogo, isDefault: true },
      });

      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getByText('Secondary Logo')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('set-default-logo-logo-2'));

      await waitFor(() => {
        expect(
          screen.getByText(/"Secondary Logo" set as default logo/i),
        ).toBeInTheDocument();
      });

      // Find and click the close button on the success alert
      const alert = screen.getByRole('alert');
      const closeButton = within(alert).getByRole('button');
      await user.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText(/"Secondary Logo" set as default logo/i),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible section heading', () => {
      render(<LogoLibrarySection />);

      expect(
        screen.getByRole('heading', { name: /logo library/i }),
      ).toBeInTheDocument();
    });

    it('should have accessible button labels', async () => {
      render(<LogoLibrarySection />);

      await waitFor(() => {
        expect(screen.getAllByText('Main Logo').length).toBeGreaterThan(0);
      });

      expect(
        screen.getByRole('button', { name: /add logo/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /refresh/i }),
      ).toBeInTheDocument();
    });
  });
});
