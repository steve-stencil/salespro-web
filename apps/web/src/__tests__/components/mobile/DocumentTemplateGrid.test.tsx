/**
 * Unit tests for DocumentTemplateGrid component.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { DocumentTemplateGrid } from '../../../features/mobile/components/DocumentTemplateGrid';

import type {
  DocumentCategory,
  DocumentTemplate,
  TemplateSelection,
} from '../../../features/mobile/types/document';

const mockCategories: DocumentCategory[] = [
  { id: 'cat_1', name: 'Contracts', sortOrder: 1, isCollapsed: false },
  { id: 'cat_2', name: 'Photos', sortOrder: 2, isCollapsed: false },
];

const mockTemplates: DocumentTemplate[] = [
  {
    id: 'template-1',
    objectId: 'obj_1',
    displayName: 'Standard Contract',
    category: 'Contracts',
    categoryId: 'cat_1',
    thumbnailUrl: undefined,
    iconUrl: undefined,
    canAddMultiplePages: false,
    pageCount: 1,
    isRequired: false,
    sortOrder: 1,
    pageId: 'page_1',
    photosPerPage: 0,
  },
  {
    id: 'template-2',
    objectId: 'obj_2',
    displayName: 'Photo Pages',
    category: 'Photos',
    categoryId: 'cat_2',
    thumbnailUrl: undefined,
    iconUrl: undefined,
    canAddMultiplePages: true,
    pageCount: 1,
    isRequired: false,
    sortOrder: 1,
    pageId: 'page_2',
    photosPerPage: 4,
  },
];

const emptySelections = new Map<string, TemplateSelection>();

describe('DocumentTemplateGrid', () => {
  describe('loading state', () => {
    it('should show skeleton when loading', () => {
      const { container } = render(
        <DocumentTemplateGrid
          categories={[]}
          templates={[]}
          selections={emptySelections}
          isLoading={true}
          error={null}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={vi.fn()}
        />,
      );

      // Should have skeleton elements
      const skeletons = container.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('error state', () => {
    it('should show error message when error occurs', () => {
      render(
        <DocumentTemplateGrid
          categories={[]}
          templates={[]}
          selections={emptySelections}
          isLoading={false}
          error={new Error('Network error')}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={vi.fn()}
        />,
      );

      expect(
        screen.getByText('Failed to load templates: Network error'),
      ).toBeInTheDocument();
    });

    it('should show retry button when error occurs', () => {
      const onRetry = vi.fn();
      render(
        <DocumentTemplateGrid
          categories={[]}
          templates={[]}
          selections={emptySelections}
          isLoading={false}
          error={new Error('Network error')}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={onRetry}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('empty state', () => {
    it('should show empty message when no templates', () => {
      render(
        <DocumentTemplateGrid
          categories={mockCategories}
          templates={[]}
          selections={emptySelections}
          isLoading={false}
          error={null}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={vi.fn()}
        />,
      );

      expect(screen.getByText('No Templates Available')).toBeInTheDocument();
    });

    it('should show refresh button in empty state', () => {
      const onRetry = vi.fn();
      render(
        <DocumentTemplateGrid
          categories={mockCategories}
          templates={[]}
          selections={emptySelections}
          isLoading={false}
          error={null}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={onRetry}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('content rendering', () => {
    it('should show instruction text', () => {
      render(
        <DocumentTemplateGrid
          categories={mockCategories}
          templates={mockTemplates}
          selections={emptySelections}
          isLoading={false}
          error={null}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={vi.fn()}
        />,
      );

      expect(
        screen.getByText(
          'Tap the templates you want to include in your document',
        ),
      ).toBeInTheDocument();
    });

    it('should render categories', () => {
      render(
        <DocumentTemplateGrid
          categories={mockCategories}
          templates={mockTemplates}
          selections={emptySelections}
          isLoading={false}
          error={null}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={vi.fn()}
        />,
      );

      expect(screen.getByText('Contracts')).toBeInTheDocument();
      expect(screen.getByText('Photos')).toBeInTheDocument();
    });

    it('should render templates in correct categories', () => {
      render(
        <DocumentTemplateGrid
          categories={mockCategories}
          templates={mockTemplates}
          selections={emptySelections}
          isLoading={false}
          error={null}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={vi.fn()}
        />,
      );

      expect(screen.getByText('Standard Contract')).toBeInTheDocument();
      expect(screen.getByText('Photo Pages')).toBeInTheDocument();
    });

    it('should not render empty categories', () => {
      const categoriesWithEmpty: DocumentCategory[] = [
        ...mockCategories,
        {
          id: 'cat_3',
          name: 'Empty Category',
          sortOrder: 3,
          isCollapsed: false,
        },
      ];

      render(
        <DocumentTemplateGrid
          categories={categoriesWithEmpty}
          templates={mockTemplates}
          selections={emptySelections}
          isLoading={false}
          error={null}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={vi.fn()}
        />,
      );

      expect(screen.queryByText('Empty Category')).not.toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('should sort categories by sortOrder', () => {
      const reversedCategories: DocumentCategory[] = [
        { id: 'cat_2', name: 'Photos', sortOrder: 2, isCollapsed: false },
        { id: 'cat_1', name: 'Contracts', sortOrder: 1, isCollapsed: false },
      ];

      render(
        <DocumentTemplateGrid
          categories={reversedCategories}
          templates={mockTemplates}
          selections={emptySelections}
          isLoading={false}
          error={null}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={vi.fn()}
        />,
      );

      const headings = screen.getAllByRole('button');
      // First category header should be Contracts (sortOrder: 1)
      expect(headings[0]).toHaveTextContent('Contracts');
    });
  });

  describe('event handlers', () => {
    it('should pass onToggleTemplate to categories', () => {
      const onToggleTemplate = vi.fn();
      render(
        <DocumentTemplateGrid
          categories={mockCategories}
          templates={mockTemplates}
          selections={emptySelections}
          isLoading={false}
          error={null}
          onToggleTemplate={onToggleTemplate}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
          onRetry={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'Standard Contract' }),
      );
      expect(onToggleTemplate).toHaveBeenCalledWith('template-1');
    });

    it('should pass onCollapseToggle to categories', () => {
      const onCollapseToggle = vi.fn();
      render(
        <DocumentTemplateGrid
          categories={mockCategories}
          templates={mockTemplates}
          selections={emptySelections}
          isLoading={false}
          error={null}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={onCollapseToggle}
          onRetry={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText('Contracts'));
      expect(onCollapseToggle).toHaveBeenCalledWith('cat_1');
    });
  });
});
