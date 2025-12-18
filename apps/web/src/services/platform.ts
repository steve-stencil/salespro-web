/**
 * Platform API service for internal user and admin functions.
 * Provides methods for managing internal users and their company access.
 */
import { apiClient } from '../lib/api-client';

import type {
  InternalUserCompaniesResponse,
  AddInternalUserCompanyResponse,
  RemoveInternalUserCompanyResponse,
  PlatformCompaniesResponse,
} from '../types/platform';

/**
 * Platform API methods.
 */
export const platformApi = {
  // ============================================================================
  // Company Access Methods (for internal users)
  // ============================================================================

  /**
   * Lists companies available on the platform.
   * Returns only companies the current internal user has access to.
   *
   * @returns List of companies
   */
  getCompanies: async (): Promise<PlatformCompaniesResponse> => {
    return apiClient.get<PlatformCompaniesResponse>('/platform/companies');
  },

  // ============================================================================
  // Internal User Company Access Methods
  // ============================================================================

  /**
   * Lists companies an internal user has restricted access to.
   * If empty, the user has unrestricted access to all companies.
   *
   * @param userId - The internal user's ID
   * @returns Company access records
   */
  getInternalUserCompanies: async (
    userId: string,
  ): Promise<InternalUserCompaniesResponse> => {
    return apiClient.get<InternalUserCompaniesResponse>(
      `/internal-users/${userId}/companies`,
    );
  },

  /**
   * Grants company access to an internal user.
   * Adding the first restriction converts an unrestricted user to restricted.
   *
   * @param userId - The internal user's ID
   * @param companyId - The company to grant access to
   * @returns Success message and access details
   */
  addInternalUserCompany: async (
    userId: string,
    companyId: string,
  ): Promise<AddInternalUserCompanyResponse> => {
    return apiClient.post<AddInternalUserCompanyResponse>(
      `/internal-users/${userId}/companies`,
      { companyId },
    );
  },

  /**
   * Removes company access from an internal user.
   * If this is the last restriction, user becomes unrestricted.
   *
   * @param userId - The internal user's ID
   * @param companyId - The company to remove access from
   * @returns Success message
   */
  removeInternalUserCompany: async (
    userId: string,
    companyId: string,
  ): Promise<RemoveInternalUserCompanyResponse> => {
    return apiClient.delete<RemoveInternalUserCompanyResponse>(
      `/internal-users/${userId}/companies/${companyId}`,
    );
  },
};
