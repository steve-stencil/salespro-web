/**
 * TanStack Query hooks for platform management.
 * Provides hooks for internal user management and platform administration.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { platformApi } from '../services/platform';

import type {
  CreateInternalUserRequest,
  UpdateInternalUserRequest,
} from '../types/platform';

/** Query key factory for platform data */
export const platformKeys = {
  all: ['platform'] as const,
  companies: () => [...platformKeys.all, 'companies'] as const,
  internalUsers: () => [...platformKeys.all, 'internal-users'] as const,
  internalUsersList: () => [...platformKeys.internalUsers(), 'list'] as const,
  internalUserDetail: (userId: string) =>
    [...platformKeys.internalUsers(), userId] as const,
  internalUserCompanies: (userId: string) =>
    [...platformKeys.internalUsers(), userId, 'companies'] as const,
  platformRoles: () => [...platformKeys.all, 'roles'] as const,
};

// ============================================================================
// Platform Companies
// ============================================================================

/**
 * Hook to fetch companies available on the platform.
 * Returns only companies the current internal user has access to.
 */
export function usePlatformCompanies() {
  return useQuery({
    queryKey: platformKeys.companies(),
    queryFn: () => platformApi.getCompanies(),
  });
}

// ============================================================================
// Internal User CRUD Hooks
// ============================================================================

/**
 * Hook to fetch all internal platform users.
 */
export function useInternalUsers() {
  return useQuery({
    queryKey: platformKeys.internalUsersList(),
    queryFn: () => platformApi.getInternalUsers(),
  });
}

/**
 * Hook to fetch a specific internal user's details.
 *
 * @param userId - The internal user's ID
 * @param enabled - Whether to enable the query (default: true)
 */
export function useInternalUser(userId: string, enabled = true) {
  return useQuery({
    queryKey: platformKeys.internalUserDetail(userId),
    queryFn: () => platformApi.getInternalUser(userId),
    enabled: enabled && !!userId,
  });
}

/**
 * Hook to fetch all available platform roles.
 */
export function usePlatformRoles() {
  return useQuery({
    queryKey: platformKeys.platformRoles(),
    queryFn: () => platformApi.getPlatformRoles(),
  });
}

/**
 * Hook to create a new internal platform user.
 */
export function useCreateInternalUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInternalUserRequest) =>
      platformApi.createInternalUser(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: platformKeys.internalUsersList(),
      });
    },
  });
}

/**
 * Hook to update an internal platform user.
 */
export function useUpdateInternalUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: UpdateInternalUserRequest;
    }) => platformApi.updateInternalUser(userId, data),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({
        queryKey: platformKeys.internalUsersList(),
      });
      void queryClient.invalidateQueries({
        queryKey: platformKeys.internalUserDetail(userId),
      });
    },
  });
}

/**
 * Hook to delete an internal platform user.
 */
export function useDeleteInternalUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => platformApi.deleteInternalUser(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: platformKeys.internalUsersList(),
      });
    },
  });
}

// ============================================================================
// Internal User Company Access
// ============================================================================

/**
 * Hook to fetch an internal user's company access restrictions.
 *
 * @param userId - The internal user's ID
 * @param enabled - Whether to enable the query (default: true)
 */
export function useInternalUserCompanies(userId: string, enabled = true) {
  return useQuery({
    queryKey: platformKeys.internalUserCompanies(userId),
    queryFn: () => platformApi.getInternalUserCompanies(userId),
    enabled: enabled && !!userId,
  });
}

/**
 * Hook to add company access for an internal user.
 */
export function useAddInternalUserCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      companyId,
    }: {
      userId: string;
      companyId: string;
    }) => platformApi.addInternalUserCompany(userId, companyId),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({
        queryKey: platformKeys.internalUserCompanies(userId),
      });
    },
  });
}

/**
 * Hook to remove company access from an internal user.
 */
export function useRemoveInternalUserCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      companyId,
    }: {
      userId: string;
      companyId: string;
    }) => platformApi.removeInternalUserCompany(userId, companyId),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({
        queryKey: platformKeys.internalUserCompanies(userId),
      });
    },
  });
}
