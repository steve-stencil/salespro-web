/**
 * TanStack Query hooks for user management.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { usersApi } from '../services/users';

import type { UsersListParams, UpdateUserRequest } from '../types/users';

/** Query key factory for users */
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params?: UsersListParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  offices: (id: string) => [...userKeys.all, id, 'offices'] as const,
};

/**
 * Hook to fetch paginated list of users.
 */
export function useUsersList(params?: UsersListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersApi.list(params),
  });
}

/**
 * Hook to fetch a single user's details.
 */
export function useUser(userId: string) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => usersApi.get(userId),
    enabled: !!userId,
  });
}

/**
 * Hook to fetch a user's allowed offices.
 */
export function useUserOffices(userId: string) {
  return useQuery({
    queryKey: userKeys.offices(userId),
    queryFn: () => usersApi.getOffices(userId),
    enabled: !!userId,
  });
}

/**
 * Hook to update a user's profile.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: UpdateUserRequest;
    }) => usersApi.update(userId, data),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * Hook to activate/deactivate a user.
 */
export function useSetUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      usersApi.setActive(userId, isActive),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * Hook to add office access for a user.
 */
export function useAddOfficeAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, officeId }: { userId: string; officeId: string }) =>
      usersApi.addOfficeAccess(userId, officeId),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
      void queryClient.invalidateQueries({
        queryKey: userKeys.offices(userId),
      });
    },
  });
}

/**
 * Hook to remove office access from a user.
 */
export function useRemoveOfficeAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, officeId }: { userId: string; officeId: string }) =>
      usersApi.removeOfficeAccess(userId, officeId),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
      void queryClient.invalidateQueries({
        queryKey: userKeys.offices(userId),
      });
    },
  });
}

/**
 * Hook to set a user's current office.
 */
export function useSetCurrentOffice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      officeId,
    }: {
      userId: string;
      officeId: string | null;
    }) => usersApi.setCurrentOffice(userId, officeId),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
