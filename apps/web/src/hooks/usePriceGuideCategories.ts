/**
 * TanStack Query hooks for price guide category management.
 * Includes optimistic updates for better UX.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { priceGuideCategoriesApi } from '../services/price-guide-categories';

import type { CategoriesListParams } from '../services/price-guide-categories';
import type {
  CreatePriceGuideCategoryRequest,
  UpdatePriceGuideCategoryRequest,
  MovePriceGuideCategoryRequest,
  ReorderCategoriesRequest,
  AssignCategoryOfficesRequest,
  PriceGuideCategoryListItem,
  PriceGuideCategoryTreeNode,
  PriceGuideCategoryListResponse,
  PriceGuideCategoryTreeResponse,
} from '@shared/core';

/** Query key factory for price guide categories */
export const priceGuideCategoryKeys = {
  all: ['priceGuideCategories'] as const,
  lists: () => [...priceGuideCategoryKeys.all, 'list'] as const,
  list: (filters?: CategoriesListParams) =>
    [...priceGuideCategoryKeys.lists(), filters] as const,
  trees: () => [...priceGuideCategoryKeys.all, 'tree'] as const,
  tree: (filters?: { isActive?: boolean }) =>
    [...priceGuideCategoryKeys.trees(), filters] as const,
  details: () => [...priceGuideCategoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...priceGuideCategoryKeys.details(), id] as const,
  children: (id: string) =>
    [...priceGuideCategoryKeys.all, 'children', id] as const,
  breadcrumb: (id: string) =>
    [...priceGuideCategoryKeys.all, 'breadcrumb', id] as const,
};

/**
 * Hook to fetch list of all categories (flat list).
 */
export function usePriceGuideCategoriesList(params?: CategoriesListParams) {
  return useQuery({
    queryKey: priceGuideCategoryKeys.list(params),
    queryFn: () => priceGuideCategoriesApi.list(params),
  });
}

/**
 * Hook to fetch categories as a tree structure.
 */
export function usePriceGuideCategoriesTree(params?: { isActive?: boolean }) {
  return useQuery({
    queryKey: priceGuideCategoryKeys.tree(params),
    queryFn: () => priceGuideCategoriesApi.tree(params),
  });
}

/**
 * Hook to fetch a single category's details.
 */
export function usePriceGuideCategory(categoryId: string | undefined) {
  return useQuery({
    queryKey: priceGuideCategoryKeys.detail(categoryId ?? ''),
    queryFn: () => priceGuideCategoriesApi.get(categoryId!),
    enabled: !!categoryId,
  });
}

/**
 * Hook to fetch children of a category.
 */
export function usePriceGuideCategoryChildren(categoryId: string | undefined) {
  return useQuery({
    queryKey: priceGuideCategoryKeys.children(categoryId ?? ''),
    queryFn: () => priceGuideCategoriesApi.getChildren(categoryId!),
    enabled: !!categoryId,
  });
}

/**
 * Hook to fetch breadcrumb path for a category.
 */
export function usePriceGuideCategoryBreadcrumb(
  categoryId: string | undefined,
) {
  return useQuery({
    queryKey: priceGuideCategoryKeys.breadcrumb(categoryId ?? ''),
    queryFn: () => priceGuideCategoriesApi.getBreadcrumb(categoryId!),
    enabled: !!categoryId,
  });
}

/**
 * Hook to create a new category with optimistic update.
 */
export function useCreatePriceGuideCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePriceGuideCategoryRequest) =>
      priceGuideCategoriesApi.create(data),
    onMutate: async newCategory => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      await queryClient.cancelQueries({
        queryKey: priceGuideCategoryKeys.trees(),
      });

      // Snapshot previous value for rollback
      const previousLists = queryClient.getQueriesData({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      const previousTrees = queryClient.getQueriesData({
        queryKey: priceGuideCategoryKeys.trees(),
      });

      // Optimistically add to list
      const optimisticCategory: PriceGuideCategoryListItem = {
        id: `temp-${Date.now()}`,
        name: newCategory.name,
        parentId: newCategory.parentId ?? null,
        sortOrder: newCategory.sortOrder ?? 0,
        isActive: newCategory.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        childCount: 0,
        itemCount: 0,
      };

      queryClient.setQueriesData(
        { queryKey: priceGuideCategoryKeys.lists() },
        (old: PriceGuideCategoryListResponse | undefined) => {
          if (!old) return { categories: [optimisticCategory] };
          return { categories: [...old.categories, optimisticCategory] };
        },
      );

      return { previousLists, previousTrees };
    },
    onError: (_err, _newCategory, context) => {
      // Rollback on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousTrees) {
        context.previousTrees.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.trees(),
      });
    },
  });
}

/**
 * Hook to update a category with optimistic update.
 */
export function useUpdatePriceGuideCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: UpdatePriceGuideCategoryRequest;
    }) => priceGuideCategoriesApi.update(categoryId, data),
    onMutate: async ({ categoryId, data }) => {
      await queryClient.cancelQueries({
        queryKey: priceGuideCategoryKeys.detail(categoryId),
      });
      await queryClient.cancelQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });

      const previousDetail = queryClient.getQueryData(
        priceGuideCategoryKeys.detail(categoryId),
      );
      const previousLists = queryClient.getQueriesData({
        queryKey: priceGuideCategoryKeys.lists(),
      });

      // Optimistically update in list
      queryClient.setQueriesData(
        { queryKey: priceGuideCategoryKeys.lists() },
        (old: PriceGuideCategoryListResponse | undefined) => {
          if (!old) return old;
          return {
            categories: old.categories.map(cat =>
              cat.id === categoryId ? { ...cat, ...data } : cat,
            ),
          };
        },
      );

      return { previousDetail, previousLists };
    },
    onError: (_err, { categoryId }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          priceGuideCategoryKeys.detail(categoryId),
          context.previousDetail,
        );
      }
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: (_, __, { categoryId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.detail(categoryId),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.trees(),
      });
    },
  });
}

/**
 * Hook to move a category with optimistic update.
 */
export function useMovePriceGuideCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: MovePriceGuideCategoryRequest;
    }) => priceGuideCategoriesApi.move(categoryId, data),
    onMutate: async ({ categoryId, data }) => {
      await queryClient.cancelQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      await queryClient.cancelQueries({
        queryKey: priceGuideCategoryKeys.trees(),
      });

      const previousLists = queryClient.getQueriesData({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      const previousTrees = queryClient.getQueriesData({
        queryKey: priceGuideCategoryKeys.trees(),
      });

      // Optimistically update parent
      queryClient.setQueriesData(
        { queryKey: priceGuideCategoryKeys.lists() },
        (old: PriceGuideCategoryListResponse | undefined) => {
          if (!old) return old;
          return {
            categories: old.categories.map(cat =>
              cat.id === categoryId ? { ...cat, parentId: data.parentId } : cat,
            ),
          };
        },
      );

      return { previousLists, previousTrees };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousTrees) {
        context.previousTrees.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.trees(),
      });
    },
  });
}

/**
 * Hook to reorder categories with optimistic update.
 */
export function useReorderPriceGuideCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReorderCategoriesRequest) =>
      priceGuideCategoriesApi.reorder(data),
    onMutate: async ({ items }) => {
      await queryClient.cancelQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });

      const previousLists = queryClient.getQueriesData({
        queryKey: priceGuideCategoryKeys.lists(),
      });

      // Create a map of id -> sortOrder for quick lookup
      const sortOrderMap = new Map(
        items.map(item => [item.id, item.sortOrder]),
      );

      // Optimistically update sort orders
      queryClient.setQueriesData(
        { queryKey: priceGuideCategoryKeys.lists() },
        (old: PriceGuideCategoryListResponse | undefined) => {
          if (!old) return old;
          return {
            categories: old.categories
              .map(cat => ({
                ...cat,
                sortOrder: sortOrderMap.get(cat.id) ?? cat.sortOrder,
              }))
              .sort((a, b) => a.sortOrder - b.sortOrder),
          };
        },
      );

      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.trees(),
      });
    },
  });
}

/**
 * Hook to delete a category with optimistic update.
 */
export function useDeletePriceGuideCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      force = false,
    }: {
      categoryId: string;
      force?: boolean;
    }) => priceGuideCategoriesApi.delete(categoryId, force),
    onMutate: async ({ categoryId }) => {
      await queryClient.cancelQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      await queryClient.cancelQueries({
        queryKey: priceGuideCategoryKeys.trees(),
      });

      const previousLists = queryClient.getQueriesData({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      const previousTrees = queryClient.getQueriesData({
        queryKey: priceGuideCategoryKeys.trees(),
      });

      // Optimistically remove from list
      queryClient.setQueriesData(
        { queryKey: priceGuideCategoryKeys.lists() },
        (old: PriceGuideCategoryListResponse | undefined) => {
          if (!old) return old;
          return {
            categories: old.categories.filter(cat => cat.id !== categoryId),
          };
        },
      );

      // Optimistically remove from tree (recursive)
      const removeFromTree = (
        nodes: PriceGuideCategoryTreeNode[],
      ): PriceGuideCategoryTreeNode[] => {
        return nodes
          .filter(node => node.id !== categoryId)
          .map(node => ({
            ...node,
            children: removeFromTree(node.children),
          }));
      };

      queryClient.setQueriesData(
        { queryKey: priceGuideCategoryKeys.trees() },
        (old: PriceGuideCategoryTreeResponse | undefined) => {
          if (!old) return old;
          return { categories: removeFromTree(old.categories) };
        },
      );

      return { previousLists, previousTrees };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousTrees) {
        context.previousTrees.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.trees(),
      });
    },
  });
}

/**
 * Hook to assign offices to a category.
 */
export function useAssignCategoryOffices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: AssignCategoryOfficesRequest;
    }) => priceGuideCategoriesApi.assignOffices(categoryId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.trees(),
      });
    },
  });
}

/**
 * Hook to remove an office from a category.
 */
export function useRemoveCategoryOffice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      officeId,
    }: {
      categoryId: string;
      officeId: string;
    }) => priceGuideCategoriesApi.removeOffice(categoryId, officeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.lists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideCategoryKeys.trees(),
      });
    },
  });
}

/**
 * Custom hook that provides all category operations with prefetching.
 */
export function usePriceGuideCategories(params?: CategoriesListParams) {
  const queryClient = useQueryClient();
  const listQuery = usePriceGuideCategoriesList(params);
  const treeQuery = usePriceGuideCategoriesTree({ isActive: params?.isActive });

  const prefetchCategory = useCallback(
    (categoryId: string) => {
      void queryClient.prefetchQuery({
        queryKey: priceGuideCategoryKeys.detail(categoryId),
        queryFn: () => priceGuideCategoriesApi.get(categoryId),
      });
    },
    [queryClient],
  );

  const prefetchChildren = useCallback(
    (categoryId: string) => {
      void queryClient.prefetchQuery({
        queryKey: priceGuideCategoryKeys.children(categoryId),
        queryFn: () => priceGuideCategoriesApi.getChildren(categoryId),
      });
    },
    [queryClient],
  );

  return {
    categories: listQuery.data?.categories ?? [],
    tree: treeQuery.data?.categories ?? [],
    isLoading: listQuery.isLoading || treeQuery.isLoading,
    isError: listQuery.isError || treeQuery.isError,
    error: listQuery.error ?? treeQuery.error,
    prefetchCategory,
    prefetchChildren,
  };
}
