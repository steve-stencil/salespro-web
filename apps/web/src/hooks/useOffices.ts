/**
 * TanStack Query hooks for office management.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { officesApi } from '../services/offices';

import type {
  CreateOfficeRequest,
  UpdateOfficeRequest,
  OfficesListParams,
} from '../types/users';

/** Query key factory for offices */
export const officeKeys = {
  all: ['offices'] as const,
  lists: () => [...officeKeys.all, 'list'] as const,
  list: (filters?: OfficesListParams) =>
    [...officeKeys.lists(), filters] as const,
  details: () => [...officeKeys.all, 'detail'] as const,
  detail: (id: string) => [...officeKeys.details(), id] as const,
};

/**
 * Hook to fetch list of all offices.
 */
export function useOfficesList(params?: OfficesListParams) {
  return useQuery({
    queryKey: officeKeys.list(params),
    queryFn: () => officesApi.list(params),
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

/**
 * Hook to create a new office.
 */
export function useCreateOffice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOfficeRequest) => officesApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: officeKeys.lists() });
    },
  });
}

/**
 * Hook to update an existing office.
 */
export function useUpdateOffice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      officeId,
      data,
    }: {
      officeId: string;
      data: UpdateOfficeRequest;
    }) => officesApi.update(officeId, data),
    onSuccess: (_, { officeId }) => {
      void queryClient.invalidateQueries({
        queryKey: officeKeys.detail(officeId),
      });
      void queryClient.invalidateQueries({ queryKey: officeKeys.lists() });
    },
  });
}

/**
 * Hook to delete an office.
 */
export function useDeleteOffice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      officeId,
      force = false,
    }: {
      officeId: string;
      force?: boolean;
    }) => officesApi.delete(officeId, force),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: officeKeys.lists() });
    },
  });
}
