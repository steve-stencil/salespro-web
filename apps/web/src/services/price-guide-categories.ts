/**
 * Price Guide Categories API service.
 * Provides methods for category management.
 */
import { apiClient } from '../lib/api-client';

import type {
  PriceGuideCategoryListResponse,
  PriceGuideCategoryTreeResponse,
  PriceGuideCategoryResponse,
  PriceGuideCategoryMutationResponse,
  PriceGuideCategoryBreadcrumbResponse,
  CreatePriceGuideCategoryRequest,
  UpdatePriceGuideCategoryRequest,
  MovePriceGuideCategoryRequest,
  ReorderCategoriesRequest,
  ReorderCategoriesResponse,
  AssignCategoryOfficesRequest,
  AssignOfficesResponse,
  DeleteCategoryResponse,
} from '@shared/core';

/** Query parameters for listing categories. */
export type CategoriesListParams = {
  isActive?: boolean;
  parentId?: string | null;
};

/**
 * Price Guide Categories API methods.
 */
export const priceGuideCategoriesApi = {
  /**
   * Get list of all categories (flat list).
   */
  list: async (
    params?: CategoriesListParams,
  ): Promise<PriceGuideCategoryListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.isActive !== undefined) {
      searchParams.set('isActive', String(params.isActive));
    }
    if (params?.parentId !== undefined) {
      searchParams.set('parentId', params.parentId ?? 'null');
    }
    const queryString = searchParams.toString();
    const url = queryString
      ? `/price-guide/categories?${queryString}`
      : '/price-guide/categories';
    return apiClient.get<PriceGuideCategoryListResponse>(url);
  },

  /**
   * Get categories as a nested tree structure.
   */
  tree: async (params?: {
    isActive?: boolean;
  }): Promise<PriceGuideCategoryTreeResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.isActive !== undefined) {
      searchParams.set('isActive', String(params.isActive));
    }
    const queryString = searchParams.toString();
    const url = queryString
      ? `/price-guide/categories/tree?${queryString}`
      : '/price-guide/categories/tree';
    return apiClient.get<PriceGuideCategoryTreeResponse>(url);
  },

  /**
   * Get a specific category by ID.
   */
  get: async (categoryId: string): Promise<PriceGuideCategoryResponse> => {
    return apiClient.get<PriceGuideCategoryResponse>(
      `/price-guide/categories/${categoryId}`,
    );
  },

  /**
   * Get children of a category.
   */
  getChildren: async (
    categoryId: string,
  ): Promise<PriceGuideCategoryListResponse> => {
    return apiClient.get<PriceGuideCategoryListResponse>(
      `/price-guide/categories/${categoryId}/children`,
    );
  },

  /**
   * Get breadcrumb path from root to category.
   */
  getBreadcrumb: async (
    categoryId: string,
  ): Promise<PriceGuideCategoryBreadcrumbResponse> => {
    return apiClient.get<PriceGuideCategoryBreadcrumbResponse>(
      `/price-guide/categories/${categoryId}/breadcrumb`,
    );
  },

  /**
   * Create a new category.
   */
  create: async (
    data: CreatePriceGuideCategoryRequest,
  ): Promise<PriceGuideCategoryMutationResponse> => {
    return apiClient.post<PriceGuideCategoryMutationResponse>(
      '/price-guide/categories',
      data,
    );
  },

  /**
   * Update an existing category.
   */
  update: async (
    categoryId: string,
    data: UpdatePriceGuideCategoryRequest,
  ): Promise<PriceGuideCategoryMutationResponse> => {
    return apiClient.patch<PriceGuideCategoryMutationResponse>(
      `/price-guide/categories/${categoryId}`,
      data,
    );
  },

  /**
   * Move a category to a new parent.
   */
  move: async (
    categoryId: string,
    data: MovePriceGuideCategoryRequest,
  ): Promise<PriceGuideCategoryMutationResponse> => {
    return apiClient.patch<PriceGuideCategoryMutationResponse>(
      `/price-guide/categories/${categoryId}/move`,
      data,
    );
  },

  /**
   * Batch update sortOrder for categories.
   */
  reorder: async (
    data: ReorderCategoriesRequest,
  ): Promise<ReorderCategoriesResponse> => {
    return apiClient.patch<ReorderCategoriesResponse>(
      '/price-guide/categories/reorder',
      data,
    );
  },

  /**
   * Delete a category.
   * @param categoryId - The category ID to delete
   * @param force - If true, cascade delete children and items
   */
  delete: async (
    categoryId: string,
    force = false,
  ): Promise<DeleteCategoryResponse> => {
    const url = force
      ? `/price-guide/categories/${categoryId}?force=true`
      : `/price-guide/categories/${categoryId}`;
    return apiClient.delete<DeleteCategoryResponse>(url);
  },

  /**
   * Assign offices to a root category.
   */
  assignOffices: async (
    categoryId: string,
    data: AssignCategoryOfficesRequest,
  ): Promise<AssignOfficesResponse> => {
    return apiClient.post<AssignOfficesResponse>(
      `/price-guide/categories/${categoryId}/offices`,
      data,
    );
  },

  /**
   * Remove an office assignment from a category.
   */
  removeOffice: async (
    categoryId: string,
    officeId: string,
  ): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(
      `/price-guide/categories/${categoryId}/offices/${officeId}`,
    );
  },
};
