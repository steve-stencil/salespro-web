/**
 * Document Templates hook for template loading and selection.
 * Based on iOS: ContractObjectSelectionCollectionViewController, ContractObjectManager
 */
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';

import { documentApi } from '../services/document';

import type { ListTemplatesParams } from '../services/document';
import type {
  DocumentTemplate,
  DocumentCategory,
  TemplateSelection,
} from '../types/document';

const QUERY_KEYS = {
  templates: (params?: ListTemplatesParams) =>
    ['mobile', 'templates', params] as const,
};

/**
 * Return type for the useDocumentTemplates hook.
 */
export type UseDocumentTemplatesReturn = {
  /** All available templates */
  templates: DocumentTemplate[];
  /** All categories */
  categories: DocumentCategory[];
  /** Whether templates are loading */
  isLoading: boolean;
  /** Error if loading failed */
  error: Error | null;
  /** Map of template ID to selection state */
  selections: Map<string, TemplateSelection>;
  /** Total count of selected templates (accounting for multi-page) */
  selectedCount: number;
  /** Array of selected template IDs */
  selectedTemplateIds: string[];
  /** Toggle a template's selection */
  toggleTemplate: (templateId: string) => void;
  /** Set page count for a multi-page template */
  setTemplatePageCount: (templateId: string, count: number) => void;
  /** Select all templates in a category */
  selectCategory: (categoryId: string) => void;
  /** Deselect all templates in a category */
  deselectCategory: (categoryId: string) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Toggle category collapse state */
  toggleCategoryCollapse: (categoryId: string) => void;
  /** Refetch templates */
  refetch: () => void;
};

/**
 * Options for the useDocumentTemplates hook.
 */
export type UseDocumentTemplatesOptions = {
  /** Filter by customer state (2-letter code) */
  state?: string;
  /** Filter by office ID */
  officeId?: string;
  /** Filter by template type */
  type?: string;
  /** Sort mode */
  sort?: 'order' | 'alphabetic';
  /** Whether to enable the query */
  enabled?: boolean;
};

/**
 * Hook for loading and managing document template selection.
 * Handles single-page and multi-page template selection with page counts.
 *
 * @param options - Filter and configuration options
 * @returns Templates, categories, selection state, and handlers
 */
export function useDocumentTemplates(
  options: UseDocumentTemplatesOptions = {},
): UseDocumentTemplatesReturn {
  const { state, officeId, type, sort, enabled = true } = options;

  // Selection state: Map<templateId, TemplateSelection>
  const [selections, setSelections] = useState<Map<string, TemplateSelection>>(
    new Map(),
  );

  // Category collapse state
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );

  // Build query params
  const queryParams: ListTemplatesParams = useMemo(
    () => ({
      state,
      officeId,
      type,
      sort,
    }),
    [state, officeId, type, sort],
  );

  // Fetch templates from API
  const templatesQuery = useQuery({
    queryKey: QUERY_KEYS.templates(queryParams),
    queryFn: async () => {
      return await documentApi.listTemplates(queryParams);
    },
    enabled,
  });

  // Get templates and categories from query
  const templates = templatesQuery.data?.templates ?? [];
  const rawCategories = templatesQuery.data?.categories ?? [];

  // Merge collapse state with categories
  const categories = useMemo<DocumentCategory[]>(() => {
    return rawCategories.map(cat => ({
      ...cat,
      isCollapsed: collapsedCategories.has(cat.id),
    }));
  }, [rawCategories, collapsedCategories]);

  /**
   * Toggle a template's selection.
   * For single-page templates: toggle on/off
   * For multi-page templates: toggle on with count 1, or toggle off
   */
  const toggleTemplate = useCallback(
    (templateId: string): void => {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      setSelections(prev => {
        const next = new Map(prev);
        const existing = next.get(templateId);

        if (existing) {
          // Remove selection
          next.delete(templateId);
        } else {
          // Add selection
          next.set(templateId, {
            templateId,
            pageCount: 1,
          });
        }

        return next;
      });
    },
    [templates],
  );

  /**
   * Set page count for a multi-page template.
   * If count is 0, removes the selection.
   */
  const setTemplatePageCount = useCallback(
    (templateId: string, count: number): void => {
      setSelections(prev => {
        const next = new Map(prev);

        if (count <= 0) {
          next.delete(templateId);
        } else {
          next.set(templateId, {
            templateId,
            pageCount: count,
          });
        }

        return next;
      });
    },
    [],
  );

  /**
   * Select all templates in a category.
   */
  const selectCategory = useCallback(
    (categoryId: string): void => {
      const categoryTemplates = templates.filter(
        t => t.categoryId === categoryId,
      );

      setSelections(prev => {
        const next = new Map(prev);
        for (const template of categoryTemplates) {
          if (!next.has(template.id)) {
            next.set(template.id, {
              templateId: template.id,
              pageCount: 1,
            });
          }
        }
        return next;
      });
    },
    [templates],
  );

  /**
   * Deselect all templates in a category.
   */
  const deselectCategory = useCallback(
    (categoryId: string): void => {
      const categoryTemplates = templates.filter(
        t => t.categoryId === categoryId,
      );

      setSelections(prev => {
        const next = new Map(prev);
        for (const template of categoryTemplates) {
          next.delete(template.id);
        }
        return next;
      });
    },
    [templates],
  );

  /**
   * Clear all selections.
   */
  const clearSelection = useCallback((): void => {
    setSelections(new Map());
  }, []);

  /**
   * Toggle category collapse state.
   */
  const toggleCategoryCollapse = useCallback((categoryId: string): void => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Compute selected count (sum of page counts)
  const selectedCount = useMemo((): number => {
    let count = 0;
    for (const selection of selections.values()) {
      count += selection.pageCount;
    }
    return count;
  }, [selections]);

  // Compute selected template IDs
  const selectedTemplateIds = useMemo(
    (): string[] => Array.from(selections.keys()),
    [selections],
  );

  return {
    templates,
    categories,
    isLoading: templatesQuery.isLoading,
    error: templatesQuery.error,
    selections,
    selectedCount,
    selectedTemplateIds,
    toggleTemplate,
    setTemplatePageCount,
    selectCategory,
    deselectCategory,
    clearSelection,
    toggleCategoryCollapse,
    refetch: (): void => {
      void templatesQuery.refetch();
    },
  };
}
