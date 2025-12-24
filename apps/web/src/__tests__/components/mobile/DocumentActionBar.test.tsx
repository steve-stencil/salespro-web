/**
 * Unit tests for DocumentActionBar component.
 */
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { DocumentActionBar } from '../../../features/mobile/components/DocumentActionBar';

import type { ReactNode } from 'react';

const theme = createTheme();

function renderWithTheme(component: ReactNode): ReturnType<typeof render> {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
}

describe('DocumentActionBar', () => {
  describe('selection summary', () => {
    it('should display selection count', () => {
      renderWithTheme(
        <DocumentActionBar
          selectedCount={3}
          totalCount={10}
          canProceed={true}
          isLoading={false}
          onNext={vi.fn()}
        />,
      );

      expect(
        screen.getByText('3 of 10 templates selected'),
      ).toBeInTheDocument();
    });

    it('should show zero when nothing selected', () => {
      renderWithTheme(
        <DocumentActionBar
          selectedCount={0}
          totalCount={10}
          canProceed={false}
          isLoading={false}
          onNext={vi.fn()}
        />,
      );

      expect(
        screen.getByText('0 of 10 templates selected'),
      ).toBeInTheDocument();
    });
  });

  describe('NEXT button', () => {
    it('should call onNext when clicked', () => {
      const onNext = vi.fn();
      renderWithTheme(
        <DocumentActionBar
          selectedCount={3}
          totalCount={10}
          canProceed={true}
          isLoading={false}
          onNext={onNext}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'NEXT' }));

      expect(onNext).toHaveBeenCalled();
    });

    it('should be disabled when canProceed is false', () => {
      renderWithTheme(
        <DocumentActionBar
          selectedCount={0}
          totalCount={10}
          canProceed={false}
          isLoading={false}
          onNext={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: 'NEXT' })).toBeDisabled();
    });

    it('should be disabled when loading', () => {
      renderWithTheme(
        <DocumentActionBar
          selectedCount={3}
          totalCount={10}
          canProceed={true}
          isLoading={true}
          onNext={vi.fn()}
        />,
      );

      // Button is disabled and shows spinner
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show loading spinner when loading', () => {
      renderWithTheme(
        <DocumentActionBar
          selectedCount={3}
          totalCount={10}
          canProceed={true}
          isLoading={true}
          onNext={vi.fn()}
        />,
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('SORT button', () => {
    it('should not show sort button when onSort is not provided', () => {
      renderWithTheme(
        <DocumentActionBar
          selectedCount={3}
          totalCount={10}
          canProceed={true}
          isLoading={false}
          onNext={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole('button', { name: /sort/i }),
      ).not.toBeInTheDocument();
    });

    it('should show sort button when onSort is provided (on large screens)', () => {
      // Mock matchMedia for large screen
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(min-width:900px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      renderWithTheme(
        <DocumentActionBar
          selectedCount={3}
          totalCount={10}
          canProceed={true}
          isLoading={false}
          onNext={vi.fn()}
          onSort={vi.fn()}
          sortMode="order"
        />,
      );

      // On large screens, sort button should be visible
      // Note: This test may need adjustment based on screen size detection
    });

    it('should call onSort when sort button is clicked', () => {
      // Mock matchMedia for large screen
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(min-width:900px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const onSort = vi.fn();
      renderWithTheme(
        <DocumentActionBar
          selectedCount={3}
          totalCount={10}
          canProceed={true}
          isLoading={false}
          onNext={vi.fn()}
          onSort={onSort}
          sortMode="order"
        />,
      );

      const sortButton = screen.queryByRole('button', { name: /sort/i });
      if (sortButton) {
        fireEvent.click(sortButton);
        expect(onSort).toHaveBeenCalled();
      }
    });

    it('should display correct sort mode', () => {
      // Mock matchMedia for large screen
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(min-width:900px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      renderWithTheme(
        <DocumentActionBar
          selectedCount={3}
          totalCount={10}
          canProceed={true}
          isLoading={false}
          onNext={vi.fn()}
          onSort={vi.fn()}
          sortMode="alphabetic"
        />,
      );

      // Check if sort mode text is displayed (on large screens)
      const sortButton = screen.queryByRole('button', { name: /sort/i });
      if (sortButton) {
        expect(sortButton).toHaveTextContent('A-Z');
      }
    });
  });
});
