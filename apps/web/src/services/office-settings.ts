/**
 * Office settings API service.
 * Provides methods for managing office settings including logo upload/removal.
 */
import { axiosInstance } from '../lib/api-client';

import type {
  GetOfficeSettingsResponse,
  UploadLogoResponse,
  RemoveLogoResponse,
} from '../types/office-settings';

/**
 * Office settings API methods.
 */
export const officeSettingsApi = {
  /**
   * Get settings for a specific office.
   */
  getSettings: async (officeId: string): Promise<GetOfficeSettingsResponse> => {
    const response = await axiosInstance.get<GetOfficeSettingsResponse>(
      `/offices/${officeId}/settings`,
    );
    return response.data;
  },

  /**
   * Upload or update office logo.
   * Uses FormData for file upload.
   */
  uploadLogo: async (
    officeId: string,
    file: File,
  ): Promise<UploadLogoResponse> => {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await axiosInstance.post<UploadLogoResponse>(
      `/offices/${officeId}/settings/logo`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  /**
   * Remove office logo.
   */
  removeLogo: async (officeId: string): Promise<RemoveLogoResponse> => {
    const response = await axiosInstance.delete<RemoveLogoResponse>(
      `/offices/${officeId}/settings/logo`,
    );
    return response.data;
  },
};
