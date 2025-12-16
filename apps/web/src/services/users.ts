/**
 * Users API service.
 * Provides methods for user management including office access.
 */
import { apiClient } from '../lib/api-client';

import type {
  UsersListResponse,
  UserDetailResponse,
  UserUpdateResponse,
  UserActivateResponse,
  UserOfficesResponse,
  AddOfficeAccessResponse,
  SetCurrentOfficeResponse,
  UpdateUserRequest,
  UsersListParams,
} from '../types/users';

/**
 * Users API methods.
 */
export const usersApi = {
  /**
   * Get paginated list of users in the company.
   */
  list: async (params?: UsersListParams): Promise<UsersListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.officeId) searchParams.set('officeId', params.officeId);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.isActive !== undefined) {
      searchParams.set('isActive', String(params.isActive));
    }

    const query = searchParams.toString();
    const endpoint = query ? `/users?${query}` : '/users';
    return apiClient.get<UsersListResponse>(endpoint);
  },

  /**
   * Get a specific user by ID with full details.
   */
  get: async (userId: string): Promise<UserDetailResponse> => {
    return apiClient.get<UserDetailResponse>(`/users/${userId}`);
  },

  /**
   * Update a user's profile.
   */
  update: async (
    userId: string,
    data: UpdateUserRequest,
  ): Promise<UserUpdateResponse> => {
    return apiClient.patch<UserUpdateResponse>(`/users/${userId}`, data);
  },

  /**
   * Activate or deactivate a user.
   */
  setActive: async (
    userId: string,
    isActive: boolean,
  ): Promise<UserActivateResponse> => {
    return apiClient.post<UserActivateResponse>(`/users/${userId}/activate`, {
      isActive,
    });
  },

  /**
   * Get the list of offices a user has access to.
   */
  getOffices: async (userId: string): Promise<UserOfficesResponse> => {
    return apiClient.get<UserOfficesResponse>(`/users/${userId}/offices`);
  },

  /**
   * Add office access for a user.
   */
  addOfficeAccess: async (
    userId: string,
    officeId: string,
  ): Promise<AddOfficeAccessResponse> => {
    return apiClient.post<AddOfficeAccessResponse>(`/users/${userId}/offices`, {
      officeId,
    });
  },

  /**
   * Remove office access from a user.
   */
  removeOfficeAccess: async (
    userId: string,
    officeId: string,
  ): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(
      `/users/${userId}/offices/${officeId}`,
    );
  },

  /**
   * Set a user's current office.
   */
  setCurrentOffice: async (
    userId: string,
    officeId: string | null,
  ): Promise<SetCurrentOfficeResponse> => {
    return apiClient.patch<SetCurrentOfficeResponse>(
      `/users/${userId}/current-office`,
      { officeId },
    );
  },
};
