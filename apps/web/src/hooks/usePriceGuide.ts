/**
 * TanStack Query hooks for price guide management.
 */
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { priceGuideApi } from '../services/price-guide';

import type {
  MsiListParams,
  LibraryListParams,
  CreateMsiRequest,
  UpdateMsiRequest,
} from '@shared/types';

// ============================================================================
// Query Key Factory
// ============================================================================

/** Query key factory for price guide */
export const priceGuideKeys = {
  all: ['price-guide'] as const,

  // Categories
  categories: () => [...priceGuideKeys.all, 'categories'] as const,

  // MSIs
  msis: () => [...priceGuideKeys.all, 'msis'] as const,
  msiLists: () => [...priceGuideKeys.msis(), 'list'] as const,
  msiList: (filters?: MsiListParams) =>
    [...priceGuideKeys.msiLists(), filters] as const,
  msiDetails: () => [...priceGuideKeys.msis(), 'detail'] as const,
  msiDetail: (id: string) => [...priceGuideKeys.msiDetails(), id] as const,

  // Options
  options: () => [...priceGuideKeys.all, 'options'] as const,
  optionLists: () => [...priceGuideKeys.options(), 'list'] as const,
  optionList: (filters?: LibraryListParams) =>
    [...priceGuideKeys.optionLists(), filters] as const,
  optionDetails: () => [...priceGuideKeys.options(), 'detail'] as const,
  optionDetail: (id: string) =>
    [...priceGuideKeys.optionDetails(), id] as const,

  // UpCharges
  upcharges: () => [...priceGuideKeys.all, 'upcharges'] as const,
  upchargeLists: () => [...priceGuideKeys.upcharges(), 'list'] as const,
  upchargeList: (filters?: LibraryListParams) =>
    [...priceGuideKeys.upchargeLists(), filters] as const,
  upchargeDetails: () => [...priceGuideKeys.upcharges(), 'detail'] as const,
  upchargeDetail: (id: string) =>
    [...priceGuideKeys.upchargeDetails(), id] as const,

  // Additional Details
  additionalDetails: () =>
    [...priceGuideKeys.all, 'additional-details'] as const,
  additionalDetailLists: () =>
    [...priceGuideKeys.additionalDetails(), 'list'] as const,
  additionalDetailList: (filters?: LibraryListParams) =>
    [...priceGuideKeys.additionalDetailLists(), filters] as const,

  // Price Types
  priceTypes: () => [...priceGuideKeys.all, 'price-types'] as const,
};

// ============================================================================
// Category Hooks
// ============================================================================

/**
 * Hook to fetch category tree.
 */
export function useCategoryTree() {
  return useQuery({
    queryKey: priceGuideKeys.categories(),
    queryFn: () => priceGuideApi.getCategories(),
  });
}

/**
 * Hook to create a category.
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; parentId?: string | null }) =>
      priceGuideApi.createCategory(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.categories(),
      });
    },
  });
}

/**
 * Hook to update a category.
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: { name?: string; version: number };
    }) => priceGuideApi.updateCategory(categoryId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.categories(),
      });
    },
  });
}

/**
 * Hook to delete a category.
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) =>
      priceGuideApi.deleteCategory(categoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.categories(),
      });
    },
  });
}

// ============================================================================
// MSI Hooks
// ============================================================================

/**
 * Hook to fetch paginated MSI list with infinite scroll support.
 */
export function useMsiList(params?: Omit<MsiListParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: priceGuideKeys.msiList(params),
    queryFn: ({ pageParam }) =>
      priceGuideApi.listMsis({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
  });
}

/**
 * Hook to fetch MSI details.
 */
export function useMsiDetail(msiId: string) {
  return useQuery({
    queryKey: priceGuideKeys.msiDetail(msiId),
    queryFn: () => priceGuideApi.getMsi(msiId),
    enabled: !!msiId,
  });
}

/**
 * Hook to create an MSI.
 */
export function useCreateMsi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMsiRequest) => priceGuideApi.createMsi(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiLists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.categories(),
      });
    },
  });
}

/**
 * Hook to update an MSI.
 */
export function useUpdateMsi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ msiId, data }: { msiId: string; data: UpdateMsiRequest }) =>
      priceGuideApi.updateMsi(msiId, data),
    onSuccess: (_, { msiId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiDetail(msiId),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiLists(),
      });
    },
  });
}

/**
 * Hook to delete an MSI.
 */
export function useDeleteMsi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (msiId: string) => priceGuideApi.deleteMsi(msiId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiLists(),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.categories(),
      });
    },
  });
}

/**
 * Hook to link options to an MSI.
 */
export function useLinkOptions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      msiId,
      optionIds,
    }: {
      msiId: string;
      optionIds: string[];
    }) => priceGuideApi.linkOptions(msiId, optionIds),
    onSuccess: (_, { msiId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiDetail(msiId),
      });
    },
  });
}

/**
 * Hook to unlink an option from an MSI.
 */
export function useUnlinkOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ msiId, optionId }: { msiId: string; optionId: string }) =>
      priceGuideApi.unlinkOption(msiId, optionId),
    onSuccess: (_, { msiId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiDetail(msiId),
      });
    },
  });
}

/**
 * Hook to link upcharges to an MSI.
 */
export function useLinkUpcharges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      msiId,
      upchargeIds,
    }: {
      msiId: string;
      upchargeIds: string[];
    }) => priceGuideApi.linkUpcharges(msiId, upchargeIds),
    onSuccess: (_, { msiId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiDetail(msiId),
      });
    },
  });
}

/**
 * Hook to unlink an upcharge from an MSI.
 */
export function useUnlinkUpcharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      msiId,
      upchargeId,
    }: {
      msiId: string;
      upchargeId: string;
    }) => priceGuideApi.unlinkUpcharge(msiId, upchargeId),
    onSuccess: (_, { msiId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiDetail(msiId),
      });
    },
  });
}

/**
 * Hook to sync offices for an MSI.
 */
export function useSyncOffices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      msiId,
      officeIds,
      version,
    }: {
      msiId: string;
      officeIds: string[];
      version: number;
    }) => priceGuideApi.syncOffices(msiId, officeIds, version),
    onSuccess: (_, { msiId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiDetail(msiId),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiLists(),
      });
    },
  });
}

/**
 * Hook to link additional detail fields to an MSI.
 */
export function useLinkAdditionalDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ msiId, fieldIds }: { msiId: string; fieldIds: string[] }) =>
      priceGuideApi.linkAdditionalDetails(msiId, fieldIds),
    onSuccess: (_, { msiId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiDetail(msiId),
      });
    },
  });
}

/**
 * Hook to unlink an additional detail field from an MSI.
 */
export function useUnlinkAdditionalDetail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ msiId, fieldId }: { msiId: string; fieldId: string }) =>
      priceGuideApi.unlinkAdditionalDetail(msiId, fieldId),
    onSuccess: (_, { msiId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiDetail(msiId),
      });
    },
  });
}

// ============================================================================
// Library Hooks
// ============================================================================

/**
 * Hook to fetch paginated options list with infinite scroll support.
 */
export function useOptionList(params?: Omit<LibraryListParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: priceGuideKeys.optionList(params),
    queryFn: ({ pageParam }) =>
      priceGuideApi.listOptions({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
  });
}

/**
 * Hook to fetch option details.
 */
export function useOptionDetail(optionId: string) {
  return useQuery({
    queryKey: priceGuideKeys.optionDetail(optionId),
    queryFn: () => priceGuideApi.getOption(optionId),
    enabled: !!optionId,
  });
}

/**
 * Hook to create an option.
 */
export function useCreateOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      brand?: string;
      itemCode?: string;
      measurementType?: string;
    }) => priceGuideApi.createOption(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.optionLists(),
      });
    },
  });
}

/**
 * Hook to update an option.
 */
export function useUpdateOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      optionId,
      data,
    }: {
      optionId: string;
      data: {
        name?: string;
        brand?: string | null;
        itemCode?: string | null;
        measurementType?: string | null;
        version: number;
      };
    }) => priceGuideApi.updateOption(optionId, data),
    onSuccess: (_, { optionId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.optionDetail(optionId),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.optionLists(),
      });
    },
  });
}

/**
 * Hook to delete an option.
 */
export function useDeleteOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ optionId, force }: { optionId: string; force?: boolean }) =>
      priceGuideApi.deleteOption(optionId, force),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.optionLists(),
      });
    },
  });
}

/**
 * Hook to fetch paginated upcharges list with infinite scroll support.
 */
export function useUpchargeList(params?: Omit<LibraryListParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: priceGuideKeys.upchargeList(params),
    queryFn: ({ pageParam }) =>
      priceGuideApi.listUpcharges({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
  });
}

/**
 * Hook to fetch upcharge details.
 */
export function useUpchargeDetail(upchargeId: string) {
  return useQuery({
    queryKey: priceGuideKeys.upchargeDetail(upchargeId),
    queryFn: () => priceGuideApi.getUpcharge(upchargeId),
    enabled: !!upchargeId,
  });
}

/**
 * Hook to create an upcharge.
 */
export function useCreateUpcharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      note?: string;
      measurementType?: string;
      identifier?: string;
    }) => priceGuideApi.createUpcharge(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.upchargeLists(),
      });
    },
  });
}

/**
 * Hook to update an upcharge.
 */
export function useUpdateUpcharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      upchargeId,
      data,
    }: {
      upchargeId: string;
      data: {
        name?: string;
        note?: string | null;
        measurementType?: string | null;
        identifier?: string | null;
        version: number;
      };
    }) => priceGuideApi.updateUpcharge(upchargeId, data),
    onSuccess: (_, { upchargeId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.upchargeDetail(upchargeId),
      });
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.upchargeLists(),
      });
    },
  });
}

/**
 * Hook to delete an upcharge.
 */
export function useDeleteUpcharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      upchargeId,
      force,
    }: {
      upchargeId: string;
      force?: boolean;
    }) => priceGuideApi.deleteUpcharge(upchargeId, force),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.upchargeLists(),
      });
    },
  });
}

/**
 * Hook to fetch paginated additional details list.
 */
export function useAdditionalDetailList(
  params?: Omit<LibraryListParams, 'cursor'>,
) {
  return useInfiniteQuery({
    queryKey: priceGuideKeys.additionalDetailList(params),
    queryFn: ({ pageParam }) =>
      priceGuideApi.listAdditionalDetails({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
  });
}

/**
 * Hook to create an additional detail field.
 */
export function useCreateAdditionalDetail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      inputType: string;
      isRequired?: boolean;
      placeholder?: string;
      note?: string;
      defaultValue?: string;
      pickerValues?: string[];
    }) => priceGuideApi.createAdditionalDetail(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.additionalDetailLists(),
      });
    },
  });
}

/**
 * Hook to update an additional detail field.
 */
export function useUpdateAdditionalDetail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fieldId,
      data,
    }: {
      fieldId: string;
      data: {
        title?: string;
        inputType?: string;
        isRequired?: boolean;
        placeholder?: string | null;
        note?: string | null;
        defaultValue?: string | null;
        pickerValues?: string[] | null;
        version: number;
      };
    }) => priceGuideApi.updateAdditionalDetail(fieldId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.additionalDetailLists(),
      });
    },
  });
}

/**
 * Hook to delete an additional detail field.
 */
export function useDeleteAdditionalDetail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fieldId, force }: { fieldId: string; force?: boolean }) =>
      priceGuideApi.deleteAdditionalDetail(fieldId, force),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.additionalDetailLists(),
      });
    },
  });
}

// ============================================================================
// Price Types Hook
// ============================================================================

/**
 * Hook to fetch price types.
 */
export function usePriceTypes() {
  return useQuery({
    queryKey: priceGuideKeys.priceTypes(),
    queryFn: () => priceGuideApi.getPriceTypes(),
  });
}

// Note: All MSI pricing flows through OptionPrice entities.
// MSIs require at least one option; see ADR-003.
