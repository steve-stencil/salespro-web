/**
 * Unit tests for DocumentTemplateTile component.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  DocumentTemplateTile,
  DocumentTemplateTileSkeleton,
} from '../../../features/mobile/components/DocumentTemplateTile';

import type { DocumentTemplate } from '../../../features/mobile/types/document';

const mockTemplate: DocumentTemplate = {
  id: 'template-1',
  objectId: 'obj_1',
  displayName: 'Standard Contract',
  category: 'Contracts',
  categoryId: 'cat_1',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  iconUrl: undefined,
  canAddMultiplePages: false,
  pageCount: 1,
  isRequired: false,
  sortOrder: 1,
  pageId: 'page_1',
  photosPerPage: 0,
};

const mockMultiPageTemplate: DocumentTemplate = {
  ...mockTemplate,
  id: 'template-2',
  displayName: 'Photo Pages',
  canAddMultiplePages: true,
};

describe('DocumentTemplateTile', () => {
  describe('rendering', () => {
    it('should render template name', () => {
      render(
        <DocumentTemplateTile
          template={mockTemplate}
          isSelected={false}
          addedCount={0}
          onToggle={vi.fn()}
          onPageCountChange={vi.fn()}
        />,
      );

      expect(screen.getByText('Standard Contract')).toBeInTheDocument();
    });

    it('should render thumbnail image when available', () => {
      const { container } = render(
        <DocumentTemplateTile
          template={mockTemplate}
          isSelected={false}
          addedCount={0}
          onToggle={vi.fn()}
          onPageCountChange={vi.fn()}
        />,
      );

      // Image is initially hidden while loading, so we use getByAltText
      const img = container.querySelector('img[alt="Standard Contract"]');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
    });

    it('should have correct aria-label', () => {
      render(
        <DocumentTemplateTile
          template={mockTemplate}
          isSelected={false}
          addedCount={0}
          onToggle={vi.fn()}
          onPageCountChange={vi.fn()}
        />,
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Standard Contract',
      );
    });
  });

  describe('selection state', () => {
    it('should show checkmark when selected', () => {
      const { container } = render(
        <DocumentTemplateTile
          template={mockTemplate}
          isSelected={true}
          addedCount={1}
          onToggle={vi.fn()}
          onPageCountChange={vi.fn()}
        />,
      );

      // Check for the checkmark icon
      const checkmark = container.querySelector(
        '[data-testid="CheckCircleIcon"]',
      );
      expect(checkmark).toBeInTheDocument();
    });

    it('should have aria-pressed true when selected', () => {
      render(
        <DocumentTemplateTile
          template={mockTemplate}
          isSelected={true}
          addedCount={1}
          onToggle={vi.fn()}
          onPageCountChange={vi.fn()}
        />,
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('should include selected in aria-label when selected', () => {
      render(
        <DocumentTemplateTile
          template={mockTemplate}
          isSelected={true}
          addedCount={1}
          onToggle={vi.fn()}
          onPageCountChange={vi.fn()}
        />,
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Standard Contract, selected',
      );
    });
  });

  describe('click handling', () => {
    it('should call onToggle when clicked', () => {
      const onToggle = vi.fn();
      render(
        <DocumentTemplateTile
          template={mockTemplate}
          isSelected={false}
          addedCount={0}
          onToggle={onToggle}
          onPageCountChange={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button'));

      expect(onToggle).toHaveBeenCalledWith('template-1');
    });

    it('should not call onToggle when loading', () => {
      const onToggle = vi.fn();
      render(
        <DocumentTemplateTile
          template={mockTemplate}
          isSelected={false}
          addedCount={0}
          onToggle={onToggle}
          onPageCountChange={vi.fn()}
          isLoading
        />,
      );

      fireEvent.click(screen.getByRole('button'));

      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  describe('multi-page templates', () => {
    it('should show stepper when selected and canAddMultiplePages is true', () => {
      render(
        <DocumentTemplateTile
          template={mockMultiPageTemplate}
          isSelected={true}
          addedCount={2}
          onToggle={vi.fn()}
          onPageCountChange={vi.fn()}
        />,
      );

      expect(screen.getByLabelText('Increase count')).toBeInTheDocument();
      expect(screen.getByLabelText('Decrease count')).toBeInTheDocument();
    });

    it('should show added count badge', () => {
      render(
        <DocumentTemplateTile
          template={mockMultiPageTemplate}
          isSelected={true}
          addedCount={3}
          onToggle={vi.fn()}
          onPageCountChange={vi.fn()}
        />,
      );

      expect(screen.getByText('3 Added')).toBeInTheDocument();
    });

    it('should not show stepper when not selected', () => {
      render(
        <DocumentTemplateTile
          template={mockMultiPageTemplate}
          isSelected={false}
          addedCount={0}
          onToggle={vi.fn()}
          onPageCountChange={vi.fn()}
        />,
      );

      expect(screen.queryByLabelText('Increase count')).not.toBeInTheDocument();
    });

    it('should call onPageCountChange when stepper changes', async () => {
      const onPageCountChange = vi.fn();
      render(
        <DocumentTemplateTile
          template={mockMultiPageTemplate}
          isSelected={true}
          addedCount={2}
          onToggle={vi.fn()}
          onPageCountChange={onPageCountChange}
        />,
      );

      fireEvent.click(screen.getByLabelText('Increase count'));

      await waitFor(() => {
        expect(onPageCountChange).toHaveBeenCalledWith('template-2', 3);
      });
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when isLoading is true', () => {
      render(
        <DocumentTemplateTile
          template={mockTemplate}
          isSelected={false}
          addedCount={0}
          onToggle={vi.fn()}
          onPageCountChange={vi.fn()}
          isLoading
        />,
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
});

describe('DocumentTemplateTileSkeleton', () => {
  it('should render skeleton placeholder', () => {
    const { container } = render(<DocumentTemplateTileSkeleton />);

    // Should have skeleton elements
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
