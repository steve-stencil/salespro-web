/**
 * Office settings API service.
 * Provides methods for managing office settings including logo selection from library.
 */
import { axiosInstance } from '../lib/api-client';

import type {
  GetOfficeSettingsResponse,
  SelectLogoResponse,
  UploadLogoResponse,
  RemoveLogoResponse,
} from '../types/office-settings';

/**
 * Office settings API methods.
 */
export const officeSettingsApi = {
  /**
   * Get settings for a specific office.
   * Includes company default logo for inheritance display.
   */
  getSettings: async (officeId: string): Promise<GetOfficeSettingsResponse> => {
    const response = await axiosInstance.get<GetOfficeSettingsResponse>(
      `/offices/${officeId}/settings`,
    );
    return response.data;
  },

  /**
   * Select a logo from the company's logo library for an office.
   *
   * @param officeId - Office to update
   * @param logoId - CompanyLogo ID to select
   */
  selectLogo: async (
    officeId: string,
    logoId: string,
  ): Promise<SelectLogoResponse> => {
    const response = await axiosInstance.put<SelectLogoResponse>(
      `/offices/${officeId}/settings/logo`,
      { logoId },
    );
    return response.data;
  },

  /**
   * Upload a new logo (added to company library and assigned to office).
   * Uses FormData for file upload.
   *
   * @param officeId - Office to assign the logo to
   * @param file - Logo file to upload
   * @param name - Optional name for the logo in the library
   */
  uploadLogo: async (
    officeId: string,
    file: File,
    name?: string,
  ): Promise<UploadLogoResponse> => {
    const formData = new FormData();
    formData.append('logo', file);
    if (name) {
      formData.append('name', name);
    }

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
   * Remove office logo (revert to company default).
   * Note: This does not delete the logo from the company library.
   */
  removeLogo: async (officeId: string): Promise<RemoveLogoResponse> => {
    const response = await axiosInstance.delete<RemoveLogoResponse>(
      `/offices/${officeId}/settings/logo`,
    );
    return response.data;
  },
};
