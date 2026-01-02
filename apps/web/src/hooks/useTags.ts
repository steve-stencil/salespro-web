/**
 * TanStack Query hooks for tag management.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { priceGuideApi } from '../services/price-guide';

import { priceGuideKeys } from './usePriceGuide';

import type {
  TaggableEntityType,
  CreateTagRequest,
  UpdateTagRequest,
} from '@shared/types';

// ============================================================================
// Query Key Factory
// ============================================================================

/** Query key factory for tags */
export const tagKeys = {
  all: ['tags'] as const,

  // Tag lists
  lists: () => [...tagKeys.all, 'list'] as const,
  list: (search?: string) => [...tagKeys.lists(), { search }] as const,

  // Tag details
  details: () => [...tagKeys.all, 'detail'] as const,
  detail: (id: string) => [...tagKeys.details(), id] as const,

  // Item tags (tags assigned to specific items)
  itemTags: () => [...tagKeys.all, 'item-tags'] as const,
  itemTag: (entityType: TaggableEntityType, entityId: string) =>
    [...tagKeys.itemTags(), entityType, entityId] as const,
};

// ============================================================================
// Tag List & Detail Hooks
// ============================================================================

/**
 * Hook to fetch tag list with optional search.
 */
export function useTagList(search?: string) {
  return useQuery({
    queryKey: tagKeys.list(search),
    queryFn: () => priceGuideApi.listTags(search),
  });
}

/**
 * Hook to fetch tag details.
 */
export function useTagDetail(tagId: string | undefined) {
  return useQuery({
    queryKey: tagKeys.detail(tagId ?? ''),
    queryFn: () => priceGuideApi.getTag(tagId!),
    enabled: !!tagId,
  });
}

// ============================================================================
// Tag CRUD Hooks
// ============================================================================

/**
 * Hook to create a tag.
 */
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagRequest) => priceGuideApi.createTag(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: tagKeys.lists(),
      });
    },
  });
}

/**
 * Hook to update a tag.
 */
export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tagId, data }: { tagId: string; data: UpdateTagRequest }) =>
      priceGuideApi.updateTag(tagId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: tagKeys.lists(),
      });
      void queryClient.invalidateQueries({
        queryKey: tagKeys.detail(variables.tagId),
      });
    },
  });
}

/**
 * Hook to delete a tag.
 */
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tagId: string) => priceGuideApi.deleteTag(tagId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: tagKeys.lists(),
      });
      // Also invalidate library lists since tag filter may have changed
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.optionLists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.upchargeLists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.additionalDetailLists(),
      });
    },
  });
}

// ============================================================================
// Item Tag Hooks
// ============================================================================

/**
 * Hook to fetch tags for a specific item.
 */
export function useItemTags(
  entityType: TaggableEntityType | undefined,
  entityId: string | undefined,
) {
  return useQuery({
    queryKey: tagKeys.itemTag(entityType ?? 'OPTION', entityId ?? ''),
    queryFn: () => priceGuideApi.getItemTags(entityType!, entityId!),
    enabled: !!entityType && !!entityId,
  });
}

/**
 * Hook to set tags for a specific item.
 */
export function useSetItemTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      tagIds,
    }: {
      entityType: TaggableEntityType;
      entityId: string;
      tagIds: string[];
    }) => priceGuideApi.setItemTags(entityType, entityId, { tagIds }),
    onSuccess: (_data, variables) => {
      // Invalidate the specific item's tags
      void queryClient.invalidateQueries({
        queryKey: tagKeys.itemTag(variables.entityType, variables.entityId),
      });

      // Invalidate the appropriate library list to update displayed tags
      switch (variables.entityType) {
        case 'OPTION':
          void queryClient.invalidateQueries({
            queryKey: priceGuideKeys.optionLists(),
          });
          break;
        case 'UPCHARGE':
          void queryClient.invalidateQueries({
            queryKey: priceGuideKeys.upchargeLists(),
          });
          break;
        case 'ADDITIONAL_DETAIL':
          void queryClient.invalidateQueries({
            queryKey: priceGuideKeys.additionalDetailLists(),
          });
          break;
        case 'MEASURE_SHEET_ITEM':
          void queryClient.invalidateQueries({
            queryKey: priceGuideKeys.msiLists(),
          });
          // Also invalidate the specific MSI detail
          void queryClient.invalidateQueries({
            queryKey: priceGuideKeys.msiDetail(variables.entityId),
          });
          break;
        case 'PRICE_GUIDE_IMAGE':
          void queryClient.invalidateQueries({
            queryKey: priceGuideKeys.imageLists(),
          });
          // Also invalidate the specific image detail
          void queryClient.invalidateQueries({
            queryKey: priceGuideKeys.imageDetail(variables.entityId),
          });
          break;
      }
    },
  });
}

// ============================================================================
// Helper: Create Tag and Assign
// ============================================================================

/**
 * Combined mutation to create a tag and immediately assign it to an item.
 * Useful for the "create on type" autocomplete feature.
 */
export function useCreateTagAndAssign() {
  const createTagMutation = useCreateTag();
  const setItemTagsMutation = useSetItemTags();

  return {
    /** Creates a new tag with a random color from the default palette */
    createAndAssign: async ({
      name,
      color,
      entityType,
      entityId,
      existingTagIds,
    }: {
      name: string;
      color: string;
      entityType: TaggableEntityType;
      entityId: string;
      existingTagIds: string[];
    }) => {
      // Create the tag
      const result = await createTagMutation.mutateAsync({ name, color });

      // Assign the new tag along with existing tags
      await setItemTagsMutation.mutateAsync({
        entityType,
        entityId,
        tagIds: [...existingTagIds, result.tag.id],
      });

      return result.tag;
    },
    isLoading: createTagMutation.isPending || setItemTagsMutation.isPending,
    error: createTagMutation.error ?? setItemTagsMutation.error,
  };
}
