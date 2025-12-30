/**
 * Price Guide API service.
 * Provides methods for price guide management.
 */
import { apiClient } from '../lib/api-client';

import type {
  MsiListResponse,
  MsiDetailResponse,
  MsiListParams,
  CategoryTreeResponse,
  OptionListResponse,
  OptionDetailResponse,
  UpChargeListResponse,
  UpChargeDetailResponse,
  AdditionalDetailFieldListResponse,
  AdditionalDetailFieldDetailResponse,
  LibraryListParams,
  CreateMsiRequest,
  UpdateMsiRequest,
  LinkResult,
  SuccessResponse,
  PriceTypesResponse,
  UpChargePricingDetail,
  UpdateUpChargeDefaultPricesRequest,
  UpdateUpChargeOverridePricesRequest,
  UpdateUpChargeMsiOverridePricesRequest,
} from '@shared/types';

/**
 * Price Guide API methods.
 */
export const priceGuideApi = {
  // ==========================================================================
  // Categories
  // ==========================================================================

  /**
   * Get category tree for the company.
   */
  getCategories: async (): Promise<CategoryTreeResponse> => {
    return apiClient.get<CategoryTreeResponse>('/price-guide/categories');
  },

  /**
   * Create a new category.
   */
  createCategory: async (data: {
    name: string;
    parentId?: string | null;
  }): Promise<{
    message: string;
    category: { id: string; name: string; version: number };
  }> => {
    return apiClient.post('/price-guide/categories', data);
  },

  /**
   * Update a category.
   */
  updateCategory: async (
    categoryId: string,
    data: { name?: string; version: number },
  ): Promise<SuccessResponse> => {
    return apiClient.put(`/price-guide/categories/${categoryId}`, data);
  },

  /**
   * Delete a category.
   */
  deleteCategory: async (categoryId: string): Promise<SuccessResponse> => {
    return apiClient.delete(`/price-guide/categories/${categoryId}`);
  },

  /**
   * Move a category to a new parent and/or reorder it.
   */
  moveCategory: async (
    categoryId: string,
    data: { newParentId?: string | null; sortOrder: number },
  ): Promise<{
    message: string;
    category: {
      id: string;
      name: string;
      depth: number;
      sortOrder: number;
      parentId: string | null;
      version: number;
    };
  }> => {
    return apiClient.put(`/price-guide/categories/${categoryId}/move`, data);
  },

  // ==========================================================================
  // Measure Sheet Items
  // ==========================================================================

  /**
   * Get paginated list of MSIs.
   */
  listMsis: async (params?: MsiListParams): Promise<MsiListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.categoryIds && params.categoryIds.length > 0) {
      const categoryIdsStr = params.categoryIds.join(',');
      searchParams.set('categoryIds', categoryIdsStr);
    }
    if (params?.officeIds && params.officeIds.length > 0) {
      const officeIdsStr = params.officeIds.join(',');
      searchParams.set('officeIds', officeIdsStr);
    }

    const queryString = searchParams.toString();
    const url = queryString
      ? `/price-guide/measure-sheet-items?${queryString}`
      : '/price-guide/measure-sheet-items';
    return apiClient.get<MsiListResponse>(url);
  },

  /**
   * Get MSI details by ID.
   */
  getMsi: async (msiId: string): Promise<MsiDetailResponse> => {
    return apiClient.get<MsiDetailResponse>(
      `/price-guide/measure-sheet-items/${msiId}`,
    );
  },

  /**
   * Create a new MSI.
   */
  createMsi: async (
    data: CreateMsiRequest,
  ): Promise<{
    message: string;
    item: { id: string; name: string; version: number };
  }> => {
    return apiClient.post('/price-guide/measure-sheet-items', data);
  },

  /**
   * Update an MSI.
   */
  updateMsi: async (
    msiId: string,
    data: UpdateMsiRequest,
  ): Promise<{
    message: string;
    item: { id: string; name: string; version: number };
  }> => {
    return apiClient.put(`/price-guide/measure-sheet-items/${msiId}`, data);
  },

  /**
   * Update only the thumbnail for an MSI.
   * This is a lightweight update that doesn't require version and won't
   * conflict with other users editing the MSI.
   * The old thumbnail is automatically deleted when replaced.
   */
  updateMsiThumbnail: async (
    msiId: string,
    imageId: string | null,
  ): Promise<{
    message: string;
    thumbnailUrl: string | null;
    imageUrl: string | null;
  }> => {
    return apiClient.put(
      `/price-guide/measure-sheet-items/${msiId}/thumbnail`,
      {
        imageId,
      },
    );
  },

  /**
   * Delete an MSI.
   */
  deleteMsi: async (msiId: string): Promise<SuccessResponse> => {
    return apiClient.delete(`/price-guide/measure-sheet-items/${msiId}`);
  },

  /**
   * Link options to an MSI.
   */
  linkOptions: async (
    msiId: string,
    optionIds: string[],
  ): Promise<LinkResult> => {
    return apiClient.post(`/price-guide/measure-sheet-items/${msiId}/options`, {
      optionIds,
    });
  },

  /**
   * Unlink an option from an MSI.
   */
  unlinkOption: async (
    msiId: string,
    optionId: string,
  ): Promise<SuccessResponse> => {
    return apiClient.delete(
      `/price-guide/measure-sheet-items/${msiId}/options/${optionId}`,
    );
  },

  /**
   * Link upcharges to an MSI.
   */
  linkUpcharges: async (
    msiId: string,
    upchargeIds: string[],
  ): Promise<LinkResult> => {
    return apiClient.post(
      `/price-guide/measure-sheet-items/${msiId}/upcharges`,
      { upchargeIds },
    );
  },

  /**
   * Unlink an upcharge from an MSI.
   */
  unlinkUpcharge: async (
    msiId: string,
    upchargeId: string,
  ): Promise<SuccessResponse> => {
    return apiClient.delete(
      `/price-guide/measure-sheet-items/${msiId}/upcharges/${upchargeId}`,
    );
  },

  /**
   * Sync offices for an MSI (replaces all office links).
   */
  syncOffices: async (
    msiId: string,
    officeIds: string[],
    version: number,
  ): Promise<{
    message: string;
    item: { id: string; name: string; version: number };
  }> => {
    return apiClient.put(`/price-guide/measure-sheet-items/${msiId}/offices`, {
      officeIds,
      version,
    });
  },

  /**
   * Link additional detail fields to an MSI.
   */
  linkAdditionalDetails: async (
    msiId: string,
    fieldIds: string[],
  ): Promise<{ success: boolean; linked: number; warnings: string[] }> => {
    return apiClient.post(
      `/price-guide/measure-sheet-items/${msiId}/additional-details`,
      { fieldIds },
    );
  },

  /**
   * Unlink an additional detail field from an MSI.
   */
  unlinkAdditionalDetail: async (
    msiId: string,
    fieldId: string,
  ): Promise<SuccessResponse> => {
    return apiClient.delete(
      `/price-guide/measure-sheet-items/${msiId}/additional-details/${fieldId}`,
    );
  },

  // ==========================================================================
  // Library - Options
  // ==========================================================================

  /**
   * Get paginated list of options.
   */
  listOptions: async (
    params?: LibraryListParams,
  ): Promise<OptionListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);

    const queryString = searchParams.toString();
    const url = queryString
      ? `/price-guide/library/options?${queryString}`
      : '/price-guide/library/options';
    return apiClient.get<OptionListResponse>(url);
  },

  /**
   * Get option details by ID.
   */
  getOption: async (optionId: string): Promise<OptionDetailResponse> => {
    return apiClient.get<OptionDetailResponse>(
      `/price-guide/library/options/${optionId}`,
    );
  },

  /**
   * Create a new option.
   */
  createOption: async (data: {
    name: string;
    brand?: string;
    itemCode?: string;
    measurementType?: string;
  }): Promise<{
    message: string;
    option: { id: string; name: string; version: number };
  }> => {
    return apiClient.post('/price-guide/library/options', data);
  },

  /**
   * Update an option.
   */
  updateOption: async (
    optionId: string,
    data: {
      name?: string;
      brand?: string | null;
      itemCode?: string | null;
      measurementType?: string | null;
      version: number;
    },
  ): Promise<{
    message: string;
    option: { id: string; name: string; version: number };
  }> => {
    return apiClient.put(`/price-guide/library/options/${optionId}`, data);
  },

  /**
   * Delete an option.
   */
  deleteOption: async (
    optionId: string,
    force = false,
  ): Promise<SuccessResponse> => {
    const url = force
      ? `/price-guide/library/options/${optionId}?force=true`
      : `/price-guide/library/options/${optionId}`;
    return apiClient.delete(url);
  },

  // ==========================================================================
  // Library - UpCharges
  // ==========================================================================

  /**
   * Get paginated list of upcharges.
   */
  listUpcharges: async (
    params?: LibraryListParams,
  ): Promise<UpChargeListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);

    const queryString = searchParams.toString();
    const url = queryString
      ? `/price-guide/library/upcharges?${queryString}`
      : '/price-guide/library/upcharges';
    return apiClient.get<UpChargeListResponse>(url);
  },

  /**
   * Get upcharge details by ID.
   */
  getUpcharge: async (upchargeId: string): Promise<UpChargeDetailResponse> => {
    return apiClient.get<UpChargeDetailResponse>(
      `/price-guide/library/upcharges/${upchargeId}`,
    );
  },

  /**
   * Create a new upcharge.
   */
  createUpcharge: async (data: {
    name: string;
    note?: string;
    measurementType?: string;
    identifier?: string;
    /** File ID for product thumbnail image */
    imageId?: string;
  }): Promise<{
    message: string;
    upcharge: { id: string; name: string; version: number };
  }> => {
    return apiClient.post('/price-guide/library/upcharges', data);
  },

  /**
   * Update an upcharge.
   */
  updateUpcharge: async (
    upchargeId: string,
    data: {
      name?: string;
      note?: string | null;
      measurementType?: string | null;
      identifier?: string | null;
      /** File ID for product thumbnail image (null to remove) */
      imageId?: string | null;
      version: number;
    },
  ): Promise<{
    message: string;
    upcharge: { id: string; name: string; version: number };
  }> => {
    return apiClient.put(`/price-guide/library/upcharges/${upchargeId}`, data);
  },

  /**
   * Update only the thumbnail for an upcharge.
   * This is a lightweight update that doesn't require version and won't
   * conflict with other users editing the upcharge.
   * The old thumbnail is automatically deleted when replaced.
   */
  updateUpchargeThumbnail: async (
    upchargeId: string,
    imageId: string | null,
  ): Promise<{
    message: string;
    thumbnailUrl: string | null;
    imageUrl: string | null;
  }> => {
    return apiClient.put(
      `/price-guide/library/upcharges/${upchargeId}/thumbnail`,
      { imageId },
    );
  },

  /**
   * Delete an upcharge.
   */
  deleteUpcharge: async (
    upchargeId: string,
    force = false,
  ): Promise<SuccessResponse> => {
    const url = force
      ? `/price-guide/library/upcharges/${upchargeId}?force=true`
      : `/price-guide/library/upcharges/${upchargeId}`;
    return apiClient.delete(url);
  },

  // ==========================================================================
  // Library - Additional Details
  // ==========================================================================

  /**
   * Get paginated list of additional detail fields.
   */
  listAdditionalDetails: async (
    params?: LibraryListParams,
  ): Promise<AdditionalDetailFieldListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);

    const queryString = searchParams.toString();
    const url = queryString
      ? `/price-guide/library/additional-details?${queryString}`
      : '/price-guide/library/additional-details';
    return apiClient.get<AdditionalDetailFieldListResponse>(url);
  },

  /**
   * Get additional detail field details by ID.
   */
  getAdditionalDetail: async (
    fieldId: string,
  ): Promise<AdditionalDetailFieldDetailResponse> => {
    return apiClient.get<AdditionalDetailFieldDetailResponse>(
      `/price-guide/library/additional-details/${fieldId}`,
    );
  },

  // ==========================================================================
  // Library - Additional Details
  // ==========================================================================

  /**
   * Create a new additional detail field.
   */
  createAdditionalDetail: async (data: {
    title: string;
    inputType: string;
    isRequired?: boolean;
    placeholder?: string;
    note?: string;
    defaultValue?: string;
    pickerValues?: string[];
  }): Promise<{
    message: string;
    field: { id: string; title: string; version: number };
  }> => {
    return apiClient.post('/price-guide/library/additional-details', data);
  },

  /**
   * Update an additional detail field.
   */
  updateAdditionalDetail: async (
    fieldId: string,
    data: {
      title?: string;
      inputType?: string;
      isRequired?: boolean;
      placeholder?: string | null;
      note?: string | null;
      defaultValue?: string | null;
      pickerValues?: string[] | null;
      version: number;
    },
  ): Promise<{
    message: string;
    field: { id: string; title: string; version: number };
  }> => {
    return apiClient.put(
      `/price-guide/library/additional-details/${fieldId}`,
      data,
    );
  },

  /**
   * Delete an additional detail field.
   */
  deleteAdditionalDetail: async (
    fieldId: string,
    force = false,
  ): Promise<SuccessResponse> => {
    const url = force
      ? `/price-guide/library/additional-details/${fieldId}?force=true`
      : `/price-guide/library/additional-details/${fieldId}`;
    return apiClient.delete(url);
  },

  // ==========================================================================
  // Pricing
  // ==========================================================================

  /**
   * Get price types for the company.
   */
  getPriceTypes: async (): Promise<PriceTypesResponse> => {
    return apiClient.get<PriceTypesResponse>(
      '/price-guide/pricing/price-types',
    );
  },

  // ==========================================================================
  // Option Pricing
  // ==========================================================================

  /**
   * Get all pricing for an option across all offices and price types.
   */
  getOptionPricing: async (
    optionId: string,
  ): Promise<{
    option: {
      id: string;
      name: string;
      brand: string | null;
      itemCode: string | null;
      version: number;
    };
    priceTypes: Array<{
      id: string;
      code: string;
      name: string;
      sortOrder: number;
    }>;
    byOffice: Record<
      string,
      { office: { id: string; name: string }; prices: Record<string, number> }
    >;
  }> => {
    return apiClient.get(`/price-guide/pricing/options/${optionId}`);
  },

  /**
   * Update prices for an option for a specific office.
   */
  updateOptionPricing: async (
    optionId: string,
    data: {
      officeId: string;
      prices: Array<{ priceTypeId: string; amount: number }>;
      version: number;
    },
  ): Promise<{
    message: string;
    option: { id: string; name: string; version: number };
  }> => {
    return apiClient.put(`/price-guide/pricing/options/${optionId}`, data);
  },

  /**
   * Bulk update prices for an option across all offices for a specific price type.
   */
  updateOptionPricingBulk: async (
    optionId: string,
    data: {
      priceTypeId: string;
      amount: number;
      version: number;
    },
  ): Promise<{
    message: string;
    option: { id: string; name: string; version: number };
    updatedCount: number;
  }> => {
    return apiClient.put(`/price-guide/pricing/options/${optionId}/bulk`, data);
  },

  // ==========================================================================
  // UpCharge Pricing
  // ==========================================================================

  /**
   * Get all pricing for an upcharge (defaults and option overrides).
   */
  getUpchargePricing: async (
    upchargeId: string,
  ): Promise<UpChargePricingDetail> => {
    return apiClient.get<UpChargePricingDetail>(
      `/price-guide/pricing/upcharges/${upchargeId}`,
    );
  },

  /**
   * Update default prices for an upcharge for a specific office.
   */
  updateUpchargeDefaultPrices: async (
    upchargeId: string,
    data: UpdateUpChargeDefaultPricesRequest,
  ): Promise<{
    message: string;
    upcharge: { id: string; name: string; version: number };
  }> => {
    return apiClient.put(
      `/price-guide/pricing/upcharges/${upchargeId}/defaults`,
      data,
    );
  },

  /**
   * Update override prices for an upcharge for a specific option and office.
   */
  updateUpchargeOverridePrices: async (
    upchargeId: string,
    data: UpdateUpChargeOverridePricesRequest,
  ): Promise<{
    message: string;
    upcharge: { id: string; name: string; version: number };
  }> => {
    return apiClient.put(
      `/price-guide/pricing/upcharges/${upchargeId}/overrides`,
      data,
    );
  },

  /**
   * Delete global option override prices for an upcharge.
   */
  deleteUpchargeOverridePrices: async (
    upchargeId: string,
    optionId: string,
    officeId?: string,
  ): Promise<{ message: string; deletedCount: number }> => {
    const params = new URLSearchParams({ optionId });
    if (officeId) params.set('officeId', officeId);
    return apiClient.delete(
      `/price-guide/pricing/upcharges/${upchargeId}/overrides?${params.toString()}`,
    );
  },

  /**
   * Update MSI+Option specific override prices.
   */
  updateUpchargeMsiOverridePrices: async (
    upchargeId: string,
    data: UpdateUpChargeMsiOverridePricesRequest,
  ): Promise<{
    message: string;
    upcharge: { id: string; name: string; version: number };
  }> => {
    return apiClient.put(
      `/price-guide/pricing/upcharges/${upchargeId}/msi-overrides`,
      data,
    );
  },

  /**
   * Delete MSI+Option specific override prices.
   */
  deleteUpchargeMsiOverridePrices: async (
    upchargeId: string,
    msiId: string,
    optionId: string,
    officeId?: string,
  ): Promise<{ message: string; deletedCount: number }> => {
    const params = new URLSearchParams({ msiId, optionId });
    if (officeId) params.set('officeId', officeId);
    return apiClient.delete(
      `/price-guide/pricing/upcharges/${upchargeId}/msi-overrides?${params.toString()}`,
    );
  },

  // Note: All MSI pricing flows through OptionPrice entities.
  // MSIs require at least one option; see ADR-003.
};
