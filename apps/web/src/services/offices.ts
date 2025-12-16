/**
 * Offices API service.
 * Provides methods for office management.
 */
import { apiClient } from '../lib/api-client';

import type {
  OfficesListResponse,
  OfficeDetailResponse,
  OfficeMutationResponse,
  OfficeDeleteResponse,
  CreateOfficeRequest,
  UpdateOfficeRequest,
  OfficesListParams,
} from '../types/users';

/**
 * Offices API methods.
 */
export const officesApi = {
  /**
   * Get list of all offices for the company.
   */
  list: async (params?: OfficesListParams): Promise<OfficesListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.isActive !== undefined) {
      searchParams.set('isActive', String(params.isActive));
    }
    const queryString = searchParams.toString();
    const url = queryString ? `/offices?${queryString}` : '/offices';
    return apiClient.get<OfficesListResponse>(url);
  },

  /**
   * Get a specific office by ID.
   */
  get: async (officeId: string): Promise<OfficeDetailResponse> => {
    return apiClient.get<OfficeDetailResponse>(`/offices/${officeId}`);
  },

  /**
   * Create a new office.
   */
  create: async (
    data: CreateOfficeRequest,
  ): Promise<OfficeMutationResponse> => {
    return apiClient.post<OfficeMutationResponse>('/offices', data);
  },

  /**
   * Update an existing office.
   */
  update: async (
    officeId: string,
    data: UpdateOfficeRequest,
  ): Promise<OfficeMutationResponse> => {
    return apiClient.patch<OfficeMutationResponse>(
      `/offices/${officeId}`,
      data,
    );
  },

  /**
   * Delete an office.
   * @param officeId - The office ID to delete
   * @param force - If true, delete even if users are assigned
   */
  delete: async (
    officeId: string,
    force = false,
  ): Promise<OfficeDeleteResponse> => {
    const url = force
      ? `/offices/${officeId}?force=true`
      : `/offices/${officeId}`;
    return apiClient.delete<OfficeDeleteResponse>(url);
  },
};
