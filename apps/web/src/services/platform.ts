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
  InternalUsersListResponse,
  InternalUserDetailResponse,
  PlatformRolesResponse,
  CreateInternalUserRequest,
  CreateInternalUserResponse,
  UpdateInternalUserRequest,
  UpdateInternalUserResponse,
  PlatformCompanyDetailResponse,
  CreateCompanyRequest,
  CreateCompanyResponse,
  UpdateCompanyRequest,
  UpdateCompanyResponse,
} from '../types/platform';

/**
 * Platform API methods.
 */
export const platformApi = {
  // ============================================================================
  // Internal User CRUD Methods
  // ============================================================================

  /**
   * Lists all internal platform users.
   *
   * @returns List of internal users with their platform roles
   */
  getInternalUsers: async (): Promise<InternalUsersListResponse> => {
    return apiClient.get<InternalUsersListResponse>('/internal-users');
  },

  /**
   * Gets details of a specific internal user.
   *
   * @param userId - The internal user's ID
   * @returns Internal user details
   */
  getInternalUser: async (
    userId: string,
  ): Promise<InternalUserDetailResponse> => {
    return apiClient.get<InternalUserDetailResponse>(
      `/internal-users/${userId}`,
    );
  },

  /**
   * Lists all available platform roles.
   *
   * @returns List of platform roles
   */
  getPlatformRoles: async (): Promise<PlatformRolesResponse> => {
    return apiClient.get<PlatformRolesResponse>('/internal-users/roles');
  },

  /**
   * Creates a new internal platform user.
   *
   * @param data - User creation data
   * @returns Created user details
   */
  createInternalUser: async (
    data: CreateInternalUserRequest,
  ): Promise<CreateInternalUserResponse> => {
    return apiClient.post<CreateInternalUserResponse>('/internal-users', data);
  },

  /**
   * Updates an internal platform user.
   *
   * @param userId - The internal user's ID
   * @param data - User update data
   * @returns Updated user details
   */
  updateInternalUser: async (
    userId: string,
    data: UpdateInternalUserRequest,
  ): Promise<UpdateInternalUserResponse> => {
    return apiClient.patch<UpdateInternalUserResponse>(
      `/internal-users/${userId}`,
      data,
    );
  },

  /**
   * Soft deletes an internal platform user.
   *
   * @param userId - The internal user's ID
   */
  deleteInternalUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/internal-users/${userId}`);
  },

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

  /**
   * Gets details of a specific company.
   *
   * @param companyId - The company's ID
   * @returns Company details
   */
  getCompany: async (
    companyId: string,
  ): Promise<PlatformCompanyDetailResponse> => {
    return apiClient.get<PlatformCompanyDetailResponse>(
      `/platform/companies/${companyId}`,
    );
  },

  /**
   * Creates a new company.
   *
   * @param data - Company creation data
   * @returns Created company details
   */
  createCompany: async (
    data: CreateCompanyRequest,
  ): Promise<CreateCompanyResponse> => {
    return apiClient.post<CreateCompanyResponse>('/platform/companies', data);
  },

  /**
   * Updates a company.
   *
   * @param companyId - The company's ID
   * @param data - Company update data
   * @returns Updated company details
   */
  updateCompany: async (
    companyId: string,
    data: UpdateCompanyRequest,
  ): Promise<UpdateCompanyResponse> => {
    return apiClient.patch<UpdateCompanyResponse>(
      `/platform/companies/${companyId}`,
      data,
    );
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
