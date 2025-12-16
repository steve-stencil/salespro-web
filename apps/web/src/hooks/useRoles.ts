/**
 * TanStack Query hooks for role and permission management.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { rolesApi } from '../services/roles';

import type { CreateRoleRequest, UpdateRoleRequest } from '../types/users';

/** Query key factory for roles */
export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: () => [...roleKeys.lists()] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
  permissions: () => [...roleKeys.all, 'permissions'] as const,
  myRoles: () => [...roleKeys.all, 'me'] as const,
  userRoles: (userId: string) => [...roleKeys.all, 'user', userId] as const,
};

/**
 * Hook to fetch all available permissions.
 */
export function usePermissions() {
  return useQuery({
    queryKey: roleKeys.permissions(),
    queryFn: () => rolesApi.getPermissions(),
    staleTime: 10 * 60 * 1000, // 10 minutes - permissions rarely change
  });
}

/**
 * Hook to fetch current user's roles and permissions.
 */
export function useMyRoles() {
  return useQuery({
    queryKey: roleKeys.myRoles(),
    queryFn: () => rolesApi.getMyRoles(),
  });
}

/**
 * Hook to fetch list of all roles.
 */
export function useRolesList() {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: () => rolesApi.list(),
  });
}

/**
 * Hook to fetch a single role's details.
 */
export function useRole(roleId: string) {
  return useQuery({
    queryKey: roleKeys.detail(roleId),
    queryFn: () => rolesApi.get(roleId),
    enabled: !!roleId,
  });
}

/**
 * Hook to fetch roles assigned to a specific user.
 */
export function useUserRoles(userId: string) {
  return useQuery({
    queryKey: roleKeys.userRoles(userId),
    queryFn: () => rolesApi.getUserRoles(userId),
    enabled: !!userId,
  });
}

/**
 * Hook to create a new role.
 */
export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoleRequest) => rolesApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
    },
  });
}

/**
 * Hook to update an existing role.
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      data,
    }: {
      roleId: string;
      data: UpdateRoleRequest;
    }) => rolesApi.update(roleId, data),
    onSuccess: (_, { roleId }) => {
      void queryClient.invalidateQueries({ queryKey: roleKeys.detail(roleId) });
      void queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
    },
  });
}

/**
 * Hook to delete a role.
 */
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: string) => rolesApi.delete(roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
    },
  });
}

/**
 * Hook to assign a role to a user.
 */
export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesApi.assignRole({ userId, roleId }),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({
        queryKey: roleKeys.userRoles(userId),
      });
    },
  });
}

/**
 * Hook to revoke a role from a user.
 */
export function useRevokeRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesApi.revokeRole({ userId, roleId }),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({
        queryKey: roleKeys.userRoles(userId),
      });
    },
  });
}
