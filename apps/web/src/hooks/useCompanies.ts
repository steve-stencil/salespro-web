/**
 * Custom hooks for multi-company access functionality.
 * Provides company switching, pinning, and listing capabilities.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { companyApi } from '../services/company';

import type { UserCompaniesResponse, CompanyInfo } from '../types/company';

/** Query key for user companies */
const USER_COMPANIES_KEY = ['userCompanies'] as const;

/**
 * Hook to fetch the current user's companies.
 * Returns recent, pinned, and search results.
 *
 * @param search - Optional search term to filter companies
 * @param enabled - Whether to enable the query (default: true)
 */
export function useUserCompanies(
  search?: string,
  enabled = true,
): {
  data: UserCompaniesResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...USER_COMPANIES_KEY, search],
    queryFn: () => companyApi.getUserCompanies(search),
    enabled,
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

/**
 * Hook to switch the current user's active company.
 * Invalidates relevant queries on success.
 */
export function useSwitchCompany(): {
  switchCompany: (companyId: string) => Promise<CompanyInfo>;
  isPending: boolean;
  error: Error | null;
} {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (companyId: string) => companyApi.switchCompany(companyId),
    onSuccess: () => {
      // Invalidate all queries to refresh data with new company context
      void queryClient.invalidateQueries();
    },
  });

  return {
    switchCompany: async (companyId: string) => {
      const result = await mutation.mutateAsync(companyId);
      return result.activeCompany;
    },
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to pin or unpin a company.
 * Updates cache optimistically for better UX.
 */
export function usePinCompany(): {
  pinCompany: (companyId: string, isPinned: boolean) => Promise<void>;
  isPending: boolean;
  error: Error | null;
} {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      companyId,
      isPinned,
    }: {
      companyId: string;
      isPinned: boolean;
    }) => companyApi.pinCompany(companyId, isPinned),
    onSuccess: () => {
      // Invalidate user companies to refresh the list
      void queryClient.invalidateQueries({ queryKey: USER_COMPANIES_KEY });
    },
  });

  return {
    pinCompany: async (companyId: string, isPinned: boolean) => {
      await mutation.mutateAsync({ companyId, isPinned });
    },
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
