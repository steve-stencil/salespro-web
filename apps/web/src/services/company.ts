/**
 * Company settings API service.
 * Provides methods for fetching and updating company-wide settings,
 * and multi-company access functionality.
 */
import { apiClient } from '../lib/api-client';

import type {
  CompanySettingsResponse,
  CompanySettingsUpdate,
  CompanySettingsUpdateResponse,
  UserCompaniesResponse,
  SwitchCompanyResponse,
  PinCompanyResponse,
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

  // ============================================================================
  // Multi-Company Access Methods
  // ============================================================================

  /**
   * Lists companies the current user has access to.
   * Returns recent, pinned, and paginated results.
   *
   * @param search - Optional search term to filter companies
   * @param limit - Number of results to return (default: 20)
   * @param offset - Offset for pagination (default: 0)
   * @returns User's companies grouped by recent, pinned, and search results
   */
  getUserCompanies: async (
    search?: string,
    limit = 20,
    offset = 0,
  ): Promise<UserCompaniesResponse> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('limit', String(limit));
    params.append('offset', String(offset));

    const queryString = params.toString();
    const url = queryString
      ? `/users/me/companies?${queryString}`
      : '/users/me/companies';

    return apiClient.get<UserCompaniesResponse>(url);
  },

  /**
   * Switches the current user's active company.
   * Updates the session and returns the new active company.
   *
   * @param companyId - ID of the company to switch to
   * @returns The new active company info
   */
  switchCompany: async (companyId: string): Promise<SwitchCompanyResponse> => {
    return apiClient.post<SwitchCompanyResponse>('/users/me/switch-company', {
      companyId,
    });
  },

  /**
   * Pins or unpins a company for the current user.
   * Pinned companies appear in a dedicated section in the company switcher.
   *
   * @param companyId - ID of the company to pin/unpin
   * @param isPinned - Whether to pin (true) or unpin (false)
   * @returns Updated pin status
   */
  pinCompany: async (
    companyId: string,
    isPinned: boolean,
  ): Promise<PinCompanyResponse> => {
    return apiClient.patch<PinCompanyResponse>(
      `/users/me/companies/${companyId}`,
      { isPinned },
    );
  },
};
