/**
 * Company settings API service.
 * Provides methods for fetching and updating company-wide settings,
 * logo library management, and multi-company access functionality.
 */
import { apiClient, axiosInstance } from '../lib/api-client';

import type {
  CompanySettingsResponse,
  CompanySettingsUpdate,
  CompanySettingsUpdateResponse,
  UploadCompanyLogoResponse,
  RemoveCompanyLogoResponse,
  UserCompaniesResponse,
  SwitchCompanyResponse,
  PinCompanyResponse,
  CompanyLogoLibraryResponse,
  AddLogoToLibraryResponse,
  UpdateLogoResponse,
  DeleteLogoResponse,
  SetDefaultLogoResponse,
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
  // Company Logo Methods
  // ============================================================================

  /**
   * Upload or update company logo.
   * Requires company:update permission.
   *
   * @param file - Logo image file to upload
   * @returns Updated company settings with logo info
   */
  uploadLogo: async (file: File): Promise<UploadCompanyLogoResponse> => {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await axiosInstance.post<UploadCompanyLogoResponse>(
      '/companies/settings/logo',
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
   * Remove company logo.
   * @deprecated Use logo library methods instead.
   */
  removeLogo: async (): Promise<RemoveCompanyLogoResponse> => {
    return apiClient.delete<RemoveCompanyLogoResponse>(
      '/companies/settings/logo',
    );
  },

  // ============================================================================
  // Logo Library Methods
  // ============================================================================

  /**
   * Get all logos in the company's logo library.
   * Requires company:read permission.
   *
   * @returns Logo library with all logos and default logo ID
   */
  getLogoLibrary: async (): Promise<CompanyLogoLibraryResponse> => {
    return apiClient.get<CompanyLogoLibraryResponse>('/companies/logos');
  },

  /**
   * Upload a new logo to the company's logo library.
   * Requires company:update permission.
   *
   * @param file - Logo image file to upload
   * @param name - Optional name for the logo
   * @returns The newly created logo library item
   */
  addLogoToLibrary: async (
    file: File,
    name?: string,
  ): Promise<AddLogoToLibraryResponse> => {
    const formData = new FormData();
    formData.append('logo', file);
    if (name) {
      formData.append('name', name);
    }

    const response = await axiosInstance.post<AddLogoToLibraryResponse>(
      '/companies/logos',
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
   * Update a logo's name in the library.
   * Requires company:update permission.
   *
   * @param logoId - ID of the logo to update
   * @param name - New name for the logo
   * @returns Updated logo library item
   */
  updateLogo: async (
    logoId: string,
    name: string,
  ): Promise<UpdateLogoResponse> => {
    return apiClient.patch<UpdateLogoResponse>(`/companies/logos/${logoId}`, {
      name,
    });
  },

  /**
   * Delete a logo from the library.
   * Cannot delete logos that are set as default or used by offices.
   * Requires company:update permission.
   *
   * @param logoId - ID of the logo to delete
   * @returns Success message
   */
  deleteLogo: async (logoId: string): Promise<DeleteLogoResponse> => {
    return apiClient.delete<DeleteLogoResponse>(`/companies/logos/${logoId}`);
  },

  /**
   * Set a logo as the company's default.
   * Requires company:update permission.
   *
   * @param logoId - ID of the logo to set as default
   * @returns Updated logo library item
   */
  setDefaultLogo: async (logoId: string): Promise<SetDefaultLogoResponse> => {
    return apiClient.post<SetDefaultLogoResponse>(
      `/companies/logos/${logoId}/set-default`,
    );
  },

  /**
   * Remove the default logo setting.
   * Requires company:update permission.
   *
   * @returns Success message
   */
  removeDefaultLogo: async (): Promise<DeleteLogoResponse> => {
    return apiClient.delete<DeleteLogoResponse>('/companies/logos/default');
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
