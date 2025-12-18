/**
 * TanStack Query hooks for platform management.
 * Provides hooks for internal user company access and platform administration.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { platformApi } from '../services/platform';

/** Query key factory for platform data */
export const platformKeys = {
  all: ['platform'] as const,
  companies: () => [...platformKeys.all, 'companies'] as const,
  internalUsers: () => [...platformKeys.all, 'internal-users'] as const,
  internalUserCompanies: (userId: string) =>
    [...platformKeys.internalUsers(), userId, 'companies'] as const,
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
