/**
 * Company settings API service.
 * Provides methods for fetching and updating company-wide settings.
 */
import { apiClient } from '../lib/api-client';

import type {
  CompanySettingsResponse,
  CompanySettingsUpdate,
  CompanySettingsUpdateResponse,
} from '../types/company';

/**
 * Company settings API methods.
 */
export const companyApi = {
  /**
   * Retrieves the current company settings.
   * Requires company:read permission.
   *
   * @returns Company settings including MFA requirement status
   */
  getSettings: async (): Promise<CompanySettingsResponse> => {
    return apiClient.get<CompanySettingsResponse>('/companies/settings');
  },

  /**
   * Updates company settings.
   * Requires company:update permission.
   *
   * @param settings - Settings to update (partial)
   * @returns Updated company settings with success message
   */
  updateSettings: async (
    settings: CompanySettingsUpdate,
  ): Promise<CompanySettingsUpdateResponse> => {
    return apiClient.patch<CompanySettingsUpdateResponse>(
      '/companies/settings',
      settings,
    );
  },
};
