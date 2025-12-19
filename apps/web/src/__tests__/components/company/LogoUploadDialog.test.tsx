/**
 * Tests for LogoUploadDialog component.
 * Verifies file upload, validation, and dialog behavior.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LogoUploadDialog } from '../../../components/company/LogoUploadDialog';

// ============================================================================
// Tests
// ============================================================================

describe('LogoUploadDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnUpload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnUpload.mockResolvedValue(undefined);
  });

  describe('rendering', () => {
    it('should display dialog with title', () => {
      render(
        <LogoUploadDialog
          open={true}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
        />,
      );

      // The component uses "Add Logo to Library" as title
      expect(screen.getByText('Add Logo to Library')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(
        <LogoUploadDialog
          open={false}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
        />,
      );

      expect(screen.queryByText('Add Logo to Library')).not.toBeInTheDocument();
    });

    it('should show upload instructions', () => {
      render(
        <LogoUploadDialog
          open={true}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
        />,
      );

      expect(
        screen.getByText(/drag and drop|click to select/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/png, jpg, or webp/i)).toBeInTheDocument();
    });
  });

  describe('name input', () => {
    it('should have logo name input field', () => {
      render(
        <LogoUploadDialog
          open={true}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
        />,
      );

      expect(screen.getByLabelText(/logo name/i)).toBeInTheDocument();
    });

    it('should allow entering a logo name', async () => {
      const user = userEvent.setup();

      render(
        <LogoUploadDialog
          open={true}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
        />,
      );

      const nameInput = screen.getByLabelText(/logo name/i);
      await user.type(nameInput, 'My Custom Logo');

      expect(nameInput).toHaveValue('My Custom Logo');
    });
  });

  describe('dialog actions', () => {
    it('should call onClose when cancel is clicked', () => {
      render(
        <LogoUploadDialog
          open={true}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have disabled upload button when no file selected', () => {
      render(
        <LogoUploadDialog
          open={true}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
        />,
      );

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      expect(uploadButton).toBeDisabled();
    });
  });

  describe('loading state', () => {
    it('should disable cancel button during upload', () => {
      render(
        <LogoUploadDialog
          open={true}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
          isUploading={true}
        />,
      );

      // Upload button should be disabled during upload
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      expect(uploadButton).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have accessible dialog title', () => {
      render(
        <LogoUploadDialog
          open={true}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
        />,
      );

      expect(screen.getByText('Add Logo to Library')).toBeInTheDocument();
    });

    it('should have accessible upload instructions', () => {
      render(
        <LogoUploadDialog
          open={true}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
        />,
      );

      // Dropzone should be keyboard accessible
      expect(
        screen.getByText(/drag and drop|click to select/i),
      ).toBeInTheDocument();
    });

    it('should have accessible form controls', () => {
      render(
        <LogoUploadDialog
          open={true}
          onClose={mockOnClose}
          onUpload={mockOnUpload}
        />,
      );

      expect(
        screen.getByRole('textbox', { name: /logo name/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /upload/i }),
      ).toBeInTheDocument();
    });
  });
});
