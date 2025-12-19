/**
 * Tests for OfficeLogo component.
 * Verifies logo display with fallback behavior.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OfficeLogo } from '../../../components/offices/OfficeLogo';

import type { LogoInfo } from '../../../types/office-settings';

// ============================================================================
// Test Data
// ============================================================================

const mockLogo: LogoInfo = {
  id: 'logo-123',
  url: 'https://example.com/logo.png',
  thumbnailUrl: 'https://example.com/logo-thumb.png',
  filename: 'logo.png',
};

// ============================================================================
// Tests
// ============================================================================

describe('OfficeLogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should display logo image when logo is provided', () => {
      render(<OfficeLogo logo={mockLogo} officeName="Test Office" />);

      const avatar = screen.getByRole('img', { name: /test office logo/i });
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', mockLogo.url);
    });

    it('should use thumbnail URL when useThumbnail is true', () => {
      render(
        <OfficeLogo logo={mockLogo} officeName="Test Office" useThumbnail />,
      );

      const avatar = screen.getByRole('img', { name: /test office logo/i });
      expect(avatar).toHaveAttribute('src', mockLogo.thumbnailUrl);
    });

    it('should fall back to full URL when thumbnail is not available', () => {
      const logoWithoutThumbnail = { ...mockLogo, thumbnailUrl: null };
      render(
        <OfficeLogo
          logo={logoWithoutThumbnail}
          officeName="Test Office"
          useThumbnail
        />,
      );

      const avatar = screen.getByRole('img', { name: /test office logo/i });
      expect(avatar).toHaveAttribute('src', logoWithoutThumbnail.url);
    });

    it('should display initials when no logo is provided', () => {
      render(<OfficeLogo logo={null} officeName="Test Office" />);

      expect(screen.getByText('TO')).toBeInTheDocument();
    });

    it('should display single initial for single word name', () => {
      render(<OfficeLogo logo={null} officeName="Headquarters" />);

      expect(screen.getByText('H')).toBeInTheDocument();
    });

    it('should limit initials to two characters', () => {
      render(
        <OfficeLogo logo={null} officeName="North East Regional Office" />,
      );

      expect(screen.getByText('NE')).toBeInTheDocument();
    });

    it('should show loading skeleton when isLoading is true', () => {
      render(
        <OfficeLogo logo={null} officeName="Test Office" isLoading={true} />,
      );

      // Skeleton should be rendered (it won't have the initials or image)
      expect(screen.queryByText('TO')).not.toBeInTheDocument();
    });
  });

  describe('sizing', () => {
    it('should use default size of 48', () => {
      render(<OfficeLogo logo={null} officeName="Test" />);

      const avatar = screen.getByText('T').closest('.MuiAvatar-root');
      expect(avatar).toHaveStyle({ width: '48px', height: '48px' });
    });

    it('should apply custom size', () => {
      render(<OfficeLogo logo={null} officeName="Test" size={64} />);

      const avatar = screen.getByText('T').closest('.MuiAvatar-root');
      expect(avatar).toHaveStyle({ width: '64px', height: '64px' });
    });
  });

  describe('accessibility', () => {
    it('should have appropriate alt text for logo image', () => {
      render(<OfficeLogo logo={mockLogo} officeName="Test Office" />);

      const avatar = screen.getByRole('img', { name: /test office logo/i });
      expect(avatar).toHaveAttribute('alt', 'Test Office logo');
    });

    it('should have aria-label for fallback display', () => {
      render(<OfficeLogo logo={null} officeName="Test Office" />);

      const avatar = screen.getByLabelText(/test office \(no logo\)/i);
      expect(avatar).toBeInTheDocument();
    });
  });
});
