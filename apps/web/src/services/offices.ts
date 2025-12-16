/**
 * Offices API service.
 * Provides methods for listing and viewing offices.
 */
import { apiClient } from '../lib/api-client';

import type { OfficesListResponse, OfficeDetailResponse } from '../types/users';

/**
 * Offices API methods.
 */
export const officesApi = {
  /**
   * Get list of all offices for the company.
   *
   * @param isActive - Optional filter for active/inactive offices
   */
  list: async (isActive?: boolean): Promise<OfficesListResponse> => {
    const params = new URLSearchParams();
    if (isActive !== undefined) {
      params.set('isActive', String(isActive));
    }
    const query = params.toString();
    const endpoint = query ? `/offices?${query}` : '/offices';
    return apiClient.get<OfficesListResponse>(endpoint);
  },

  /**
   * Get a specific office by ID.
   */
  get: async (officeId: string): Promise<OfficeDetailResponse> => {
    return apiClient.get<OfficeDetailResponse>(`/offices/${officeId}`);
  },
};
