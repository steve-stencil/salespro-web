/**
 * Tests for OfficeLogoUpload component.
 * Verifies file upload, validation, and drag & drop functionality.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OfficeLogoUpload } from '../../../components/offices/OfficeLogoUpload';
import { LOGO_CONFIG } from '../../../types/office-settings';

import type { LogoInfo } from '../../../types/office-settings';

// ============================================================================
// Test Data
// ============================================================================

const mockLogo: LogoInfo = {
  id: 'logo-123',
  url: 'https://example.com/logo.png',
  thumbnailUrl: 'https://example.com/logo-thumb.png',
  filename: 'company-logo.png',
};

/**
 * Create a mock file for testing.
 */
function createMockFile(name: string, type: string, size: number = 1024): File {
  const content = new Array(size).fill('x').join('');
  return new File([content], name, { type });
}

// ============================================================================
// Tests
// ============================================================================

describe('OfficeLogoUpload', () => {
  const mockOnFileSelect = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should display drop zone with instructions', () => {
      render(
        <OfficeLogoUpload
          logo={null}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      expect(
        screen.getByText(/drag & drop your logo here/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/browse files/i)).toBeInTheDocument();
      expect(screen.getByText(/supported formats/i)).toBeInTheDocument();
    });

    it('should display current logo when logo is provided', () => {
      render(
        <OfficeLogoUpload
          logo={mockLogo}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      expect(screen.getByText(/current logo/i)).toBeInTheDocument();
      expect(screen.getByText(mockLogo.filename)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /remove logo/i }),
      ).toBeInTheDocument();
    });

    it('should display file requirements', () => {
      render(
        <OfficeLogoUpload
          logo={null}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      expect(screen.getByText(/maximum size/i)).toBeInTheDocument();
      expect(screen.getByText(/dimensions/i)).toBeInTheDocument();
    });
  });

  describe('file selection', () => {
    it('should call onFileSelect when valid file is selected', async () => {
      render(
        <OfficeLogoUpload
          logo={null}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      const file = createMockFile('logo.png', 'image/png');
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnFileSelect).toHaveBeenCalledWith(file);
      });
    });

    it('should show error for invalid file type', async () => {
      render(
        <OfficeLogoUpload
          logo={null}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      const file = createMockFile('document.pdf', 'application/pdf');
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
      });
      expect(mockOnFileSelect).not.toHaveBeenCalled();
    });

    it('should show error for file that is too large', async () => {
      render(
        <OfficeLogoUpload
          logo={null}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      // Create a file larger than the max size
      const file = createMockFile(
        'large-logo.png',
        'image/png',
        LOGO_CONFIG.maxSizeBytes + 1,
      );
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/file too large/i)).toBeInTheDocument();
      });
      expect(mockOnFileSelect).not.toHaveBeenCalled();
    });
  });

  describe('drag and drop', () => {
    it('should highlight drop zone on drag enter', () => {
      render(
        <OfficeLogoUpload
          logo={null}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      const dropZone = screen.getByRole('button', {
        name: /drop zone for logo upload/i,
      });

      fireEvent.dragEnter(dropZone);

      expect(screen.getByText(/drop your logo here/i)).toBeInTheDocument();
    });

    it('should handle file drop', async () => {
      render(
        <OfficeLogoUpload
          logo={null}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      const dropZone = screen.getByRole('button', {
        name: /drop zone for logo upload/i,
      });
      const file = createMockFile('logo.png', 'image/png');

      const dataTransfer = {
        files: [file],
        types: ['Files'],
      };

      fireEvent.drop(dropZone, { dataTransfer });

      await waitFor(() => {
        expect(mockOnFileSelect).toHaveBeenCalledWith(file);
      });
    });
  });

  describe('remove logo', () => {
    it('should call onRemove when remove button is clicked', () => {
      render(
        <OfficeLogoUpload
          logo={mockLogo}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      const removeButton = screen.getByRole('button', { name: /remove logo/i });
      fireEvent.click(removeButton);

      expect(mockOnRemove).toHaveBeenCalled();
    });
  });

  describe('loading states', () => {
    it('should show uploading state', () => {
      render(
        <OfficeLogoUpload
          logo={null}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
          isUploading
        />,
      );

      expect(screen.getByText(/uploading logo/i)).toBeInTheDocument();
    });

    it('should disable interactions when uploading', () => {
      render(
        <OfficeLogoUpload
          logo={mockLogo}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
          isUploading
        />,
      );

      // The current logo section should not be shown during upload
      expect(screen.queryByText(/current logo/i)).not.toBeInTheDocument();
    });

    it('should show loading spinner on remove button when removing', () => {
      render(
        <OfficeLogoUpload
          logo={mockLogo}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
          isRemoving
        />,
      );

      const removeButton = screen.getByRole('button', { name: /remove logo/i });
      expect(removeButton).toBeDisabled();
    });
  });

  describe('disabled state', () => {
    it('should disable interactions when disabled', () => {
      render(
        <OfficeLogoUpload
          logo={mockLogo}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
          disabled
        />,
      );

      const removeButton = screen.getByRole('button', { name: /remove logo/i });
      expect(removeButton).toBeDisabled();

      const browseButton = screen.getByRole('button', {
        name: /browse files/i,
      });
      expect(browseButton).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have accessible file input', () => {
      render(
        <OfficeLogoUpload
          logo={null}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('aria-label', 'Upload office logo');
    });

    it('should support keyboard navigation on drop zone', () => {
      render(
        <OfficeLogoUpload
          logo={null}
          officeName="Test Office"
          onFileSelect={mockOnFileSelect}
          onRemove={mockOnRemove}
        />,
      );

      const dropZone = screen.getByRole('button', {
        name: /drop zone for logo upload/i,
      });
      expect(dropZone).toHaveAttribute('tabIndex', '0');
    });
  });
});
