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
  UpdateUpChargeDefaultPricesRequest,
  UpdateUpChargeOverridePricesRequest,
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
  additionalDetailDetails: () =>
    [...priceGuideKeys.additionalDetails(), 'detail'] as const,
  additionalDetailDetail: (id: string) =>
    [...priceGuideKeys.additionalDetailDetails(), id] as const,

  // Images
  images: () => [...priceGuideKeys.all, 'images'] as const,
  imageLists: () => [...priceGuideKeys.images(), 'list'] as const,
  imageList: (filters?: LibraryListParams) =>
    [...priceGuideKeys.imageLists(), filters] as const,
  imageDetails: () => [...priceGuideKeys.images(), 'detail'] as const,
  imageDetail: (id: string) => [...priceGuideKeys.imageDetails(), id] as const,
  imageWhereUsed: (id: string) =>
    [...priceGuideKeys.images(), 'where-used', id] as const,

  // Price Types
  priceTypes: () => [...priceGuideKeys.all, 'price-types'] as const,

  // UpCharge Pricing
  upchargePricing: () => [...priceGuideKeys.all, 'upcharge-pricing'] as const,
  upchargePricingDetail: (upchargeId: string) =>
    [...priceGuideKeys.upchargePricing(), upchargeId] as const,
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

/**
 * Hook to move a category to a new parent and/or reorder it.
 */
export function useMoveCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: { newParentId?: string | null; sortOrder: number };
    }) => priceGuideApi.moveCategory(categoryId, data),
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
      // Also invalidate list to update counts
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiLists(),
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
      // Also invalidate list to update counts
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiLists(),
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
      // Also invalidate list to update counts
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiLists(),
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
      // Also invalidate list to update counts
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiLists(),
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
      // Also invalidate list to update counts
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiLists(),
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
      // Also invalidate list to update counts
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiLists(),
      });
    },
  });
}

/**
 * Hook to sync images for an MSI.
 * Replaces all linked images with the provided image IDs.
 */
export function useSyncMsiImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      msiId,
      imageIds,
      version,
    }: {
      msiId: string;
      imageIds: string[];
      version: number;
    }) => priceGuideApi.syncMsiImages(msiId, imageIds, version),
    onSuccess: (_, { msiId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.msiDetail(msiId),
      });
      // Also invalidate image lists to update linked counts
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.imageLists(),
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
 * Hook to fetch additional detail field details.
 */
export function useAdditionalDetailDetail(fieldId: string) {
  return useQuery({
    queryKey: priceGuideKeys.additionalDetailDetail(fieldId),
    queryFn: () => priceGuideApi.getAdditionalDetail(fieldId),
    enabled: !!fieldId,
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
// Image Hooks
// ============================================================================

/**
 * Hook to fetch paginated list of images from the library.
 */
export function useImageList(params?: Omit<LibraryListParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: priceGuideKeys.imageList(params),
    queryFn: ({ pageParam }) =>
      priceGuideApi.listImages({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
  });
}

/**
 * Hook to fetch image details.
 */
export function useImageDetail(imageId: string) {
  return useQuery({
    queryKey: priceGuideKeys.imageDetail(imageId),
    queryFn: () => priceGuideApi.getImage(imageId),
    enabled: !!imageId,
  });
}

/**
 * Hook to fetch where an image is used.
 */
export function useImageWhereUsed(imageId: string) {
  return useQuery({
    queryKey: priceGuideKeys.imageWhereUsed(imageId),
    queryFn: () => priceGuideApi.getImageWhereUsed(imageId),
    enabled: !!imageId,
  });
}

/**
 * Hook to upload a new image to the library.
 */
export function useUploadImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      data,
    }: {
      file: File;
      data: { name: string; description?: string };
    }) => priceGuideApi.uploadImage(file, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.imageLists(),
      });
    },
  });
}

/**
 * Hook to update image metadata.
 */
export function useUpdateImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      imageId,
      data,
    }: {
      imageId: string;
      data: { name?: string; description?: string | null; version: number };
    }) => priceGuideApi.updateImage(imageId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.imageLists(),
      });
    },
  });
}

/**
 * Hook to delete an image from the library.
 */
export function useDeleteImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ imageId, force }: { imageId: string; force?: boolean }) =>
      priceGuideApi.deleteImage(imageId, force),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.imageLists(),
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

// ============================================================================
// UpCharge Pricing Hooks
// ============================================================================

/**
 * Hook to fetch option pricing (all offices and price types).
 */
export function useOptionPricing(optionId: string) {
  return useQuery({
    queryKey: [...priceGuideKeys.optionDetail(optionId), 'pricing'],
    queryFn: () => priceGuideApi.getOptionPricing(optionId),
    enabled: !!optionId,
  });
}

/**
 * Hook to update option pricing for a specific office.
 */
export function useUpdateOptionPricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      optionId,
      data,
    }: {
      optionId: string;
      data: {
        officeId: string;
        prices: Array<{ priceTypeId: string; amount: number }>;
        version: number;
      };
    }) => priceGuideApi.updateOptionPricing(optionId, data),
    onSuccess: (_, { optionId }) => {
      void queryClient.invalidateQueries({
        queryKey: [...priceGuideKeys.optionDetail(optionId), 'pricing'],
      });
    },
  });
}

/**
 * Hook to bulk update option pricing across all offices for a price type.
 */
export function useUpdateOptionPricingBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      optionId,
      data,
    }: {
      optionId: string;
      data: {
        priceTypeId: string;
        amount: number;
        version: number;
      };
    }) => priceGuideApi.updateOptionPricingBulk(optionId, data),
    onSuccess: (_, { optionId }) => {
      void queryClient.invalidateQueries({
        queryKey: [...priceGuideKeys.optionDetail(optionId), 'pricing'],
      });
    },
  });
}

/**
 * Hook to fetch upcharge pricing details (defaults and overrides).
 */
export function useUpchargePricing(upchargeId: string) {
  return useQuery({
    queryKey: priceGuideKeys.upchargePricingDetail(upchargeId),
    queryFn: () => priceGuideApi.getUpchargePricing(upchargeId),
    enabled: !!upchargeId,
  });
}

/**
 * Hook to update default prices for an upcharge.
 */
export function useUpdateUpchargeDefaultPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      upchargeId,
      data,
    }: {
      upchargeId: string;
      data: UpdateUpChargeDefaultPricesRequest;
    }) => priceGuideApi.updateUpchargeDefaultPrices(upchargeId, data),
    onSuccess: (_, { upchargeId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.upchargePricingDetail(upchargeId),
      });
    },
  });
}

/**
 * Hook to update override prices for an upcharge.
 */
export function useUpdateUpchargeOverridePrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      upchargeId,
      data,
    }: {
      upchargeId: string;
      data: UpdateUpChargeOverridePricesRequest;
    }) => priceGuideApi.updateUpchargeOverridePrices(upchargeId, data),
    onSuccess: (_, { upchargeId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.upchargePricingDetail(upchargeId),
      });
    },
  });
}

/**
 * Hook to delete global option override prices for an upcharge.
 */
export function useDeleteUpchargeOverridePrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      upchargeId,
      optionId,
      officeId,
    }: {
      upchargeId: string;
      optionId: string;
      officeId?: string;
    }) =>
      priceGuideApi.deleteUpchargeOverridePrices(
        upchargeId,
        optionId,
        officeId,
      ),
    onSuccess: (_, { upchargeId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.upchargePricingDetail(upchargeId),
      });
    },
  });
}

/**
 * Hook to update MSI+Option specific override prices.
 */
export function useUpdateUpchargeMsiOverridePrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      upchargeId,
      data,
    }: {
      upchargeId: string;
      data: Parameters<typeof priceGuideApi.updateUpchargeMsiOverridePrices>[1];
    }) => priceGuideApi.updateUpchargeMsiOverridePrices(upchargeId, data),
    onSuccess: (_, { upchargeId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.upchargePricingDetail(upchargeId),
      });
    },
  });
}

/**
 * Hook to delete MSI+Option specific override prices.
 */
export function useDeleteUpchargeMsiOverridePrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      upchargeId,
      msiId,
      optionId,
      officeId,
    }: {
      upchargeId: string;
      msiId: string;
      optionId: string;
      officeId?: string;
    }) =>
      priceGuideApi.deleteUpchargeMsiOverridePrices(
        upchargeId,
        msiId,
        optionId,
        officeId,
      ),
    onSuccess: (_, { upchargeId }) => {
      void queryClient.invalidateQueries({
        queryKey: priceGuideKeys.upchargePricingDetail(upchargeId),
      });
    },
  });
}

// Note: All MSI pricing flows through OptionPrice entities.
// MSIs require at least one option; see ADR-003.
