/**
 * Roles API service.
 * Provides methods for role management and permissions.
 */
import { apiClient } from '../lib/api-client';

import type {
  RolesListResponse,
  RoleDetailResponse,
  RoleMutationResponse,
  PermissionsResponse,
  MyRolesResponse,
  CreateRoleRequest,
  UpdateRoleRequest,
  AssignRoleRequest,
} from '../types/users';

/**
 * Roles API methods.
 */
export const rolesApi = {
  /**
   * Get all available permissions with metadata.
   */
  getPermissions: async (): Promise<PermissionsResponse> => {
    return apiClient.get<PermissionsResponse>('/roles/permissions');
  },

  /**
   * Get current user's roles and permissions.
   */
  getMyRoles: async (): Promise<MyRolesResponse> => {
    return apiClient.get<MyRolesResponse>('/roles/me');
  },

  /**
   * Get list of all roles available to the company.
   */
  list: async (): Promise<RolesListResponse> => {
    return apiClient.get<RolesListResponse>('/roles');
  },

  /**
   * Get a specific role by ID.
   */
  get: async (roleId: string): Promise<RoleDetailResponse> => {
    return apiClient.get<RoleDetailResponse>(`/roles/${roleId}`);
  },

  /**
   * Create a new company role.
   */
  create: async (data: CreateRoleRequest): Promise<RoleMutationResponse> => {
    return apiClient.post<RoleMutationResponse>('/roles', data);
  },

  /**
   * Update an existing role.
   */
  update: async (
    roleId: string,
    data: UpdateRoleRequest,
  ): Promise<RoleMutationResponse> => {
    return apiClient.patch<RoleMutationResponse>(`/roles/${roleId}`, data);
  },

  /**
   * Delete a role.
   */
  delete: async (roleId: string): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/roles/${roleId}`);
  },

  /**
   * Get roles assigned to a specific user.
   */
  getUserRoles: async (
    userId: string,
  ): Promise<{
    roles: Array<{
      id: string;
      name: string;
      displayName: string;
      type: string;
      permissions: string[];
    }>;
    effectivePermissions: string[];
  }> => {
    return apiClient.get(`/roles/users/${userId}`);
  },

  /**
   * Assign a role to a user.
   */
  assignRole: async (
    data: AssignRoleRequest,
  ): Promise<{
    message: string;
    assignment: {
      userId: string;
      roleId: string;
      roleName: string;
      roleDisplayName: string;
      assignedAt: string;
    };
  }> => {
    return apiClient.post('/roles/assign', data);
  },

  /**
   * Revoke a role from a user.
   */
  revokeRole: async (data: AssignRoleRequest): Promise<{ message: string }> => {
    return apiClient.post('/roles/revoke', data);
  },
};
