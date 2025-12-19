/**
 * TanStack Query hooks for office settings management.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { officeSettingsApi } from '../services/office-settings';

import { officeKeys } from './useOffices';

/** Query key factory for office settings */
export const officeSettingsKeys = {
  all: ['officeSettings'] as const,
  settings: () => [...officeSettingsKeys.all, 'settings'] as const,
  setting: (officeId: string) =>
    [...officeSettingsKeys.settings(), officeId] as const,
};

/**
 * Hook to fetch office settings.
 */
export function useOfficeSettings(officeId: string | null) {
  return useQuery({
    queryKey: officeSettingsKeys.setting(officeId ?? ''),
    queryFn: () => officeSettingsApi.getSettings(officeId!),
    enabled: !!officeId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to select a logo from the company library.
 */
export function useSelectLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ officeId, logoId }: { officeId: string; logoId: string }) =>
      officeSettingsApi.selectLogo(officeId, logoId),
    onSuccess: (_, { officeId }) => {
      // Invalidate both settings and office list queries
      void queryClient.invalidateQueries({
        queryKey: officeSettingsKeys.setting(officeId),
      });
      void queryClient.invalidateQueries({
        queryKey: officeKeys.lists(),
      });
    },
  });
}

/**
 * Hook to upload a new logo (added to library and assigned).
 */
export function useUploadLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      officeId,
      file,
      name,
    }: {
      officeId: string;
      file: File;
      name?: string;
    }) => officeSettingsApi.uploadLogo(officeId, file, name),
    onSuccess: (_, { officeId }) => {
      // Invalidate both settings and office list queries
      void queryClient.invalidateQueries({
        queryKey: officeSettingsKeys.setting(officeId),
      });
      void queryClient.invalidateQueries({
        queryKey: officeKeys.lists(),
      });
      // Also invalidate the company logo library
      void queryClient.invalidateQueries({
        queryKey: ['companyLogos'],
      });
    },
  });
}

/**
 * Hook to remove office logo (revert to company default).
 */
export function useRemoveLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (officeId: string) => officeSettingsApi.removeLogo(officeId),
    onSuccess: (_, officeId) => {
      // Invalidate both settings and office list queries
      void queryClient.invalidateQueries({
        queryKey: officeSettingsKeys.setting(officeId),
      });
      void queryClient.invalidateQueries({
        queryKey: officeKeys.lists(),
      });
    },
  });
}
