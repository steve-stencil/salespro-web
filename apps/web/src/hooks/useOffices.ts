/**
 * TanStack Query hooks for office management.
 */
import { useQuery } from '@tanstack/react-query';

import { officesApi } from '../services/offices';

/** Query key factory for offices */
export const officeKeys = {
  all: ['offices'] as const,
  lists: () => [...officeKeys.all, 'list'] as const,
  list: (isActive?: boolean) => [...officeKeys.lists(), { isActive }] as const,
  details: () => [...officeKeys.all, 'detail'] as const,
  detail: (id: string) => [...officeKeys.details(), id] as const,
};

/**
 * Hook to fetch list of all offices.
 *
 * @param isActive - Optional filter for active/inactive offices
 */
export function useOfficesList(isActive?: boolean) {
  return useQuery({
    queryKey: officeKeys.list(isActive),
    queryFn: () => officesApi.list(isActive),
  });
}

/**
 * Hook to fetch a single office's details.
 */
export function useOffice(officeId: string) {
  return useQuery({
    queryKey: officeKeys.detail(officeId),
    queryFn: () => officesApi.get(officeId),
    enabled: !!officeId,
  });
}
