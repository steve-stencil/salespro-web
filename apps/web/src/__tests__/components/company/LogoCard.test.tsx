/**
 * Tests for LogoCard component.
 * Verifies logo display, actions, and interaction states.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LogoCard } from '../../../components/company/LogoCard';

import type { CompanyLogoLibraryItem } from '../../../types/company';

// ============================================================================
// Test Data
// ============================================================================

const mockLogo: CompanyLogoLibraryItem = {
  id: 'logo-123',
  name: 'Test Logo',
  url: 'https://example.com/logo.png',
  thumbnailUrl: 'https://example.com/logo-thumb.png',
  filename: 'logo.png',
  isDefault: false,
  usedByOfficeCount: 0,
  createdAt: '2024-01-01T00:00:00Z',
};

const defaultLogo: CompanyLogoLibraryItem = {
  ...mockLogo,
  id: 'default-logo',
  name: 'Default Logo',
  isDefault: true,
};

const usedLogo: CompanyLogoLibraryItem = {
  ...mockLogo,
  id: 'used-logo',
  name: 'Used Logo',
  usedByOfficeCount: 3,
};

// ============================================================================
// Tests
// ============================================================================

describe('LogoCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should display logo image', () => {
      render(<LogoCard logo={mockLogo} />);

      const image = screen.getByRole('img', { name: mockLogo.name });
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', mockLogo.thumbnailUrl);
    });

    it('should display logo name', () => {
      render(<LogoCard logo={mockLogo} />);

      expect(screen.getByText('Test Logo')).toBeInTheDocument();
    });

    it('should show default badge for default logo', () => {
      render(<LogoCard logo={defaultLogo} />);

      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('should not show default badge for non-default logo', () => {
      render(<LogoCard logo={mockLogo} />);

      expect(screen.queryByText('Default')).not.toBeInTheDocument();
    });

    it('should show office usage count', () => {
      render(<LogoCard logo={usedLogo} />);

      expect(screen.getByText('Used by 3 offices')).toBeInTheDocument();
    });

    it('should show singular office text for single office', () => {
      const singleUseLogo = { ...mockLogo, usedByOfficeCount: 1 };
      render(<LogoCard logo={singleUseLogo} />);

      expect(screen.getByText('Used by 1 office')).toBeInTheDocument();
    });

    it('should not show usage count when not used', () => {
      render(<LogoCard logo={mockLogo} />);

      expect(screen.queryByText(/used by/i)).not.toBeInTheDocument();
    });

    it('should fall back to full URL if no thumbnail', () => {
      const noThumbLogo = { ...mockLogo, thumbnailUrl: null };
      render(<LogoCard logo={noThumbLogo} />);

      const image = screen.getByRole('img', { name: noThumbLogo.name });
      expect(image).toHaveAttribute('src', noThumbLogo.url);
    });
  });

  describe('selection mode', () => {
    it('should be clickable when onSelect is provided', () => {
      const onSelect = vi.fn();
      render(<LogoCard logo={mockLogo} onSelect={onSelect} />);

      const card = screen.getByTestId(`logo-card-${mockLogo.id}`);
      expect(card).toHaveStyle({ cursor: 'pointer' });
    });

    it('should call onSelect when clicked', () => {
      const onSelect = vi.fn();
      render(<LogoCard logo={mockLogo} onSelect={onSelect} />);

      const card = screen.getByTestId(`logo-card-${mockLogo.id}`);
      fireEvent.click(card);

      expect(onSelect).toHaveBeenCalledWith(mockLogo);
    });

    it('should not call onSelect when disabled', () => {
      const onSelect = vi.fn();
      render(<LogoCard logo={mockLogo} onSelect={onSelect} disabled />);

      const card = screen.getByTestId(`logo-card-${mockLogo.id}`);
      fireEvent.click(card);

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should show selected indicator when selected', () => {
      render(<LogoCard logo={mockLogo} onSelect={vi.fn()} isSelected />);

      // Check for selected visual state (CheckCircleIcon)
      expect(screen.getByTestId(`logo-card-${mockLogo.id}`)).toHaveStyle({
        borderWidth: '2px',
      });
    });
  });

  describe('management mode actions', () => {
    it('should show edit button when onEdit is provided', () => {
      render(<LogoCard logo={mockLogo} onEdit={vi.fn()} />);

      expect(
        screen.getByTestId(`edit-logo-${mockLogo.id}`),
      ).toBeInTheDocument();
    });

    it('should call onEdit when edit button is clicked', () => {
      const onEdit = vi.fn();
      render(<LogoCard logo={mockLogo} onEdit={onEdit} />);

      fireEvent.click(screen.getByTestId(`edit-logo-${mockLogo.id}`));

      expect(onEdit).toHaveBeenCalledWith(mockLogo);
    });

    it('should show set default button when onSetDefault is provided', () => {
      render(<LogoCard logo={mockLogo} onSetDefault={vi.fn()} />);

      expect(
        screen.getByTestId(`set-default-logo-${mockLogo.id}`),
      ).toBeInTheDocument();
    });

    it('should not show set default button for already default logo', () => {
      render(<LogoCard logo={defaultLogo} onSetDefault={vi.fn()} />);

      expect(
        screen.queryByTestId(`set-default-logo-${defaultLogo.id}`),
      ).not.toBeInTheDocument();
    });

    it('should call onSetDefault when set default button is clicked', () => {
      const onSetDefault = vi.fn();
      render(<LogoCard logo={mockLogo} onSetDefault={onSetDefault} />);

      fireEvent.click(screen.getByTestId(`set-default-logo-${mockLogo.id}`));

      expect(onSetDefault).toHaveBeenCalledWith(mockLogo);
    });

    it('should show delete button when onDelete is provided', () => {
      render(<LogoCard logo={mockLogo} onDelete={vi.fn()} />);

      expect(
        screen.getByTestId(`delete-logo-${mockLogo.id}`),
      ).toBeInTheDocument();
    });

    it('should call onDelete when delete button is clicked', () => {
      const onDelete = vi.fn();
      render(<LogoCard logo={mockLogo} onDelete={onDelete} />);

      fireEvent.click(screen.getByTestId(`delete-logo-${mockLogo.id}`));

      expect(onDelete).toHaveBeenCalledWith(mockLogo);
    });

    it('should disable delete button for default logo', () => {
      render(<LogoCard logo={defaultLogo} onDelete={vi.fn()} />);

      const deleteButton = screen.getByTestId(`delete-logo-${defaultLogo.id}`);
      expect(deleteButton).toBeDisabled();
    });

    it('should disable delete button for logo used by offices', () => {
      render(<LogoCard logo={usedLogo} onDelete={vi.fn()} />);

      const deleteButton = screen.getByTestId(`delete-logo-${usedLogo.id}`);
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('action buttons in picker mode', () => {
    it('should not show action buttons when onSelect is provided', () => {
      render(
        <LogoCard
          logo={mockLogo}
          onSelect={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );

      expect(
        screen.queryByTestId(`edit-logo-${mockLogo.id}`),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId(`delete-logo-${mockLogo.id}`),
      ).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should disable edit button when disabled', () => {
      render(<LogoCard logo={mockLogo} onEdit={vi.fn()} disabled />);

      const editButton = screen.getByTestId(`edit-logo-${mockLogo.id}`);
      expect(editButton).toBeDisabled();
    });

    it('should disable set default button when disabled', () => {
      render(<LogoCard logo={mockLogo} onSetDefault={vi.fn()} disabled />);

      const setDefaultButton = screen.getByTestId(
        `set-default-logo-${mockLogo.id}`,
      );
      expect(setDefaultButton).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have accessible image alt text', () => {
      render(<LogoCard logo={mockLogo} />);

      expect(
        screen.getByRole('img', { name: mockLogo.name }),
      ).toBeInTheDocument();
    });

    it('should have edit button', () => {
      render(<LogoCard logo={mockLogo} onEdit={vi.fn()} />);

      const editButton = screen.getByTestId(`edit-logo-${mockLogo.id}`);
      expect(editButton).toBeInTheDocument();
    });

    it('should have delete button', () => {
      render(<LogoCard logo={mockLogo} onDelete={vi.fn()} />);

      const deleteButton = screen.getByTestId(`delete-logo-${mockLogo.id}`);
      expect(deleteButton).toBeInTheDocument();
    });
  });
});
