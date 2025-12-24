/**
 * Unit tests for DocumentCategorySection component.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { DocumentCategorySection } from '../../../features/mobile/components/DocumentCategorySection';

import type {
  DocumentCategory,
  DocumentTemplate,
  TemplateSelection,
} from '../../../features/mobile/types/document';

const mockCategory: DocumentCategory = {
  id: 'cat_1',
  name: 'Contracts',
  sortOrder: 1,
  isCollapsed: false,
};

const mockCollapsedCategory: DocumentCategory = {
  ...mockCategory,
  isCollapsed: true,
};

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
    displayName: 'Warranty Form',
    category: 'Contracts',
    categoryId: 'cat_1',
    thumbnailUrl: undefined,
    iconUrl: undefined,
    canAddMultiplePages: false,
    pageCount: 1,
    isRequired: false,
    sortOrder: 2,
    pageId: 'page_2',
    photosPerPage: 0,
  },
];

const emptySelections = new Map<string, TemplateSelection>();

const oneSelected = new Map<string, TemplateSelection>([
  ['template-1', { templateId: 'template-1', pageCount: 1 }],
]);

describe('DocumentCategorySection', () => {
  describe('rendering', () => {
    it('should render category name', () => {
      render(
        <DocumentCategorySection
          category={mockCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
        />,
      );

      expect(screen.getByText('Contracts')).toBeInTheDocument();
    });

    it('should render template count', () => {
      render(
        <DocumentCategorySection
          category={mockCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
        />,
      );

      expect(screen.getByText('2 templates')).toBeInTheDocument();
    });

    it('should render selected count when templates are selected', () => {
      render(
        <DocumentCategorySection
          category={mockCategory}
          templates={mockTemplates}
          selections={oneSelected}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
        />,
      );

      expect(screen.getByText('1/2 selected')).toBeInTheDocument();
    });

    it('should render all templates', () => {
      render(
        <DocumentCategorySection
          category={mockCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
        />,
      );

      expect(screen.getByText('Standard Contract')).toBeInTheDocument();
      expect(screen.getByText('Warranty Form')).toBeInTheDocument();
    });
  });

  describe('collapse functionality', () => {
    it('should call onCollapseToggle when header is clicked', () => {
      const onCollapseToggle = vi.fn();
      render(
        <DocumentCategorySection
          category={mockCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={onCollapseToggle}
        />,
      );

      fireEvent.click(screen.getByText('Contracts'));

      expect(onCollapseToggle).toHaveBeenCalledWith('cat_1');
    });

    it('should hide templates when collapsed', () => {
      render(
        <DocumentCategorySection
          category={mockCollapsedCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
        />,
      );

      expect(screen.queryByText('Standard Contract')).not.toBeInTheDocument();
    });

    it('should have correct aria-expanded when expanded', () => {
      const { container } = render(
        <DocumentCategorySection
          category={mockCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
        />,
      );

      // Get the header button (div with role="button" and aria-expanded)
      const headerButton = container.querySelector(
        '[role="button"][aria-expanded]',
      );
      expect(headerButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have correct aria-expanded when collapsed', () => {
      const { container } = render(
        <DocumentCategorySection
          category={mockCollapsedCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
        />,
      );

      // Get the header button (div with role="button" and aria-expanded)
      const headerButton = container.querySelector(
        '[role="button"][aria-expanded]',
      );
      expect(headerButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should toggle on Enter key press', () => {
      const onCollapseToggle = vi.fn();
      const { container } = render(
        <DocumentCategorySection
          category={mockCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={onCollapseToggle}
        />,
      );

      // Get the header button (div with role="button" and aria-expanded)
      const headerButton = container.querySelector(
        '[role="button"][aria-expanded]',
      );
      fireEvent.keyDown(headerButton!, { key: 'Enter' });

      expect(onCollapseToggle).toHaveBeenCalledWith('cat_1');
    });

    it('should toggle on Space key press', () => {
      const onCollapseToggle = vi.fn();
      const { container } = render(
        <DocumentCategorySection
          category={mockCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={onCollapseToggle}
        />,
      );

      // Get the header button (div with role="button" and aria-expanded)
      const headerButton = container.querySelector(
        '[role="button"][aria-expanded]',
      );
      fireEvent.keyDown(headerButton!, { key: ' ' });

      expect(onCollapseToggle).toHaveBeenCalledWith('cat_1');
    });
  });

  describe('template selection', () => {
    it('should pass onToggleTemplate to template tiles', () => {
      const onToggleTemplate = vi.fn();
      render(
        <DocumentCategorySection
          category={mockCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={onToggleTemplate}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
        />,
      );

      // Click on a template tile
      fireEvent.click(
        screen.getByRole('button', { name: 'Standard Contract' }),
      );

      expect(onToggleTemplate).toHaveBeenCalledWith('template-1');
    });
  });

  describe('accessibility', () => {
    it('should have section role with aria-label', () => {
      render(
        <DocumentCategorySection
          category={mockCategory}
          templates={mockTemplates}
          selections={emptySelections}
          onToggleTemplate={vi.fn()}
          onPageCountChange={vi.fn()}
          onCollapseToggle={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('region', { name: 'Contracts category' }),
      ).toBeInTheDocument();
    });
  });
});
