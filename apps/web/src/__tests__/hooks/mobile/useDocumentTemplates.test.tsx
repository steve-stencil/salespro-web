/**
 * Unit tests for useDocumentTemplates hook.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useDocumentTemplates } from '../../../features/mobile/hooks/useDocumentTemplates';
import { documentApi } from '../../../features/mobile/services/document';

import type { ReactNode } from 'react';

// Mock the document API
vi.mock('../../../features/mobile/services/document', () => ({
  documentApi: {
    listTemplates: vi.fn(),
  },
  mockTemplates: [],
  mockCategories: [],
}));

const mockTemplates = [
  {
    id: 'template-1',
    objectId: 'obj_1',
    displayName: 'Standard Contract',
    category: 'Contracts',
    categoryId: 'cat_1',
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
    canAddMultiplePages: true,
    pageCount: 1,
    isRequired: false,
    sortOrder: 1,
    pageId: 'page_2',
    photosPerPage: 4,
  },
];

const mockCategories = [
  { id: 'cat_1', name: 'Contracts', sortOrder: 1, isCollapsed: false },
  { id: 'cat_2', name: 'Photos', sortOrder: 2, isCollapsed: false },
];

function createWrapper(): ({ children }: { children: ReactNode }) => ReactNode {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useDocumentTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(documentApi.listTemplates).mockResolvedValue({
      templates: mockTemplates,
      categories: mockCategories,
    });
  });

  describe('loading', () => {
    it('should return isLoading true while fetching', () => {
      vi.mocked(documentApi.listTemplates).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('should return templates after loading', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.categories).toHaveLength(2);
    });

    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: false }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.templates).toHaveLength(0);
      expect(documentApi.listTemplates).not.toHaveBeenCalled();
    });
  });

  describe('toggleTemplate', () => {
    it('should add template to selections', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.toggleTemplate('template-1');
      });

      expect(result.current.selections.has('template-1')).toBe(true);
      expect(result.current.selectedCount).toBe(1);
    });

    it('should remove template from selections when toggled again', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.toggleTemplate('template-1');
      });
      act(() => {
        result.current.toggleTemplate('template-1');
      });

      expect(result.current.selections.has('template-1')).toBe(false);
      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('setTemplatePageCount', () => {
    it('should set page count for template', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setTemplatePageCount('template-2', 3);
      });

      expect(result.current.selections.get('template-2')?.pageCount).toBe(3);
      expect(result.current.selectedCount).toBe(3);
    });

    it('should remove selection when page count is 0', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setTemplatePageCount('template-2', 3);
      });
      act(() => {
        result.current.setTemplatePageCount('template-2', 0);
      });

      expect(result.current.selections.has('template-2')).toBe(false);
    });
  });

  describe('selectCategory', () => {
    it('should select all templates in category', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.selectCategory('cat_1');
      });

      expect(result.current.selections.has('template-1')).toBe(true);
      expect(result.current.selections.has('template-2')).toBe(false);
    });
  });

  describe('deselectCategory', () => {
    it('should deselect all templates in category', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.toggleTemplate('template-1');
        result.current.toggleTemplate('template-2');
      });
      act(() => {
        result.current.deselectCategory('cat_1');
      });

      expect(result.current.selections.has('template-1')).toBe(false);
      expect(result.current.selections.has('template-2')).toBe(true);
    });
  });

  describe('clearSelection', () => {
    it('should clear all selections', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.toggleTemplate('template-1');
        result.current.toggleTemplate('template-2');
      });
      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selections.size).toBe(0);
      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('toggleCategoryCollapse', () => {
    it('should collapse category', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.toggleCategoryCollapse('cat_1');
      });

      const category = result.current.categories.find(c => c.id === 'cat_1');
      expect(category?.isCollapsed).toBe(true);
    });

    it('should expand collapsed category', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.toggleCategoryCollapse('cat_1');
      });
      act(() => {
        result.current.toggleCategoryCollapse('cat_1');
      });

      const category = result.current.categories.find(c => c.id === 'cat_1');
      expect(category?.isCollapsed).toBe(false);
    });
  });

  describe('selectedTemplateIds', () => {
    it('should return array of selected template IDs', async () => {
      const { result } = renderHook(
        () => useDocumentTemplates({ enabled: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.toggleTemplate('template-1');
        result.current.toggleTemplate('template-2');
      });

      expect(result.current.selectedTemplateIds).toContain('template-1');
      expect(result.current.selectedTemplateIds).toContain('template-2');
      expect(result.current.selectedTemplateIds).toHaveLength(2);
    });
  });
});
