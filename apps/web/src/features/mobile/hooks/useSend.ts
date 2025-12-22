/**
 * Send hook for contract sending flow.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';

import { useFeatureFlags } from '../context/FeatureFlagContext';
import { sendApi } from '../services/send';

import type {
  BrochureLink,
  EmailVerificationState,
  ContractSendRequest,
  PreSendValidation,
} from '../types/send';
import type { SignaturePage, InitialsRequirement } from '../types/signing';

const QUERY_KEYS = {
  config: (estimateId: string) => ['send', 'config', estimateId] as const,
  brochures: (estimateId: string) => ['send', 'brochures', estimateId] as const,
};

/**
 * Hook for send configuration.
 *
 * @param estimateId - Estimate ID
 * @returns Send configuration
 */
export function useSendConfig(estimateId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.config(estimateId ?? ''),
    queryFn: () => sendApi.getConfig(estimateId!),
    enabled: !!estimateId,
  });
}

/**
 * Hook for brochure selection.
 * iOS: brochureSelectionTableViewController
 *
 * @param estimateId - Estimate ID
 * @returns Brochures and selection handlers
 */
export function useBrochures(estimateId: string | undefined) {
  const [selectedBrochures, setSelectedBrochures] = useState<Set<string>>(
    new Set(),
  );

  const brochuresQuery = useQuery({
    queryKey: QUERY_KEYS.brochures(estimateId ?? ''),
    queryFn: () => sendApi.getBrochures(estimateId!),
    enabled: !!estimateId,
  });

  /**
   * Toggle brochure selection.
   */
  const toggleBrochure = useCallback((brochureId: string): void => {
    setSelectedBrochures(prev => {
      const next = new Set(prev);
      if (next.has(brochureId)) {
        next.delete(brochureId);
      } else {
        next.add(brochureId);
      }
      return next;
    });
  }, []);

  /**
   * Get selected brochures as list.
   */
  const selectedBrochuresList: BrochureLink[] = useMemo(() => {
    return (brochuresQuery.data ?? []).filter(b => selectedBrochures.has(b.id));
  }, [brochuresQuery.data, selectedBrochures]);

  return {
    brochures: brochuresQuery.data ?? [],
    isLoading: brochuresQuery.isLoading,
    error: brochuresQuery.error,
    selectedBrochures: selectedBrochuresList,
    toggleBrochure,
  };
}

/**
 * Hook for email verification.
 * iOS: showVerifyEmailAlertOnViewController
 */
export function useEmailVerification() {
  const [verificationState, setVerificationState] =
    useState<EmailVerificationState | null>(null);

  const verifyMutation = useMutation({
    mutationFn: (email: string) => sendApi.verifyEmail(email),
    onSuccess: result => {
      setVerificationState(result);
    },
  });

  /**
   * Clear verification state.
   */
  const clearVerification = useCallback((): void => {
    setVerificationState(null);
  }, []);

  return {
    verificationState,
    verify: verifyMutation.mutateAsync,
    isVerifying: verifyMutation.isPending,
    clearVerification,
  };
}

/**
 * Hook for pre-send validation.
 * iOS: contractPreviewViewController:tappedSendButton: validation
 *
 * @param signatures - Current signatures
 * @param initials - Current initials
 * @param hasDocuSign - Whether DocuSign is configured
 * @returns Validation result
 */
export function usePreSendValidation(
  signatures: SignaturePage[],
  initials: InitialsRequirement[],
  hasDocuSign: boolean,
) {
  const { flags } = useFeatureFlags();

  const validation: PreSendValidation = useMemo(() => {
    return sendApi.validatePreSend(
      signatures,
      initials,
      hasDocuSign,
      flags.promptUserWhetherToSendContract,
    );
  }, [
    signatures,
    initials,
    hasDocuSign,
    flags.promptUserWhetherToSendContract,
  ]);

  return validation;
}

/**
 * Hook for sending contract.
 * iOS: UploadUtility promiseSendFileWithName
 */
export function useSendContract() {
  const queryClient = useQueryClient();
  const [sendProgress, setSendProgress] = useState<{
    stage: 'idle' | 'uploading_images' | 'sending' | 'complete' | 'error';
    progress: number;
    message: string;
  }>({
    stage: 'idle',
    progress: 0,
    message: '',
  });

  const sendMutation = useMutation({
    mutationFn: async (request: ContractSendRequest) => {
      setSendProgress({
        stage: 'uploading_images',
        progress: 0,
        message: 'Uploading images...',
      });

      // Upload images first
      const uploadedImages = await Promise.all(
        request.images.map(async (img, index) => {
          const file = await fetch(img.localUri).then(r => r.blob());
          const result = await sendApi.uploadImage(
            new File([file], img.fileName),
          );
          setSendProgress({
            stage: 'uploading_images',
            progress: ((index + 1) / request.images.length) * 50,
            message: `Uploading image ${index + 1} of ${request.images.length}...`,
          });
          return result;
        }),
      );

      setSendProgress({
        stage: 'sending',
        progress: 60,
        message: 'Sending contract...',
      });

      // Send the contract
      const result = await sendApi.send({
        ...request,
        images: uploadedImages,
      });

      setSendProgress({
        stage: 'complete',
        progress: 100,
        message: 'Contract sent!',
      });

      return result;
    },
    onSuccess: result => {
      // Record analytics
      if (result.analyticsData) {
        void sendApi.recordAnalytics(result.analyticsData);
      }
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
    onError: error => {
      setSendProgress({
        stage: 'error',
        progress: 0,
        message:
          error instanceof Error ? error.message : 'Failed to send contract',
      });
    },
  });

  /**
   * Reset send progress.
   */
  const resetProgress = useCallback((): void => {
    setSendProgress({ stage: 'idle', progress: 0, message: '' });
  }, []);

  return {
    send: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
    sendError: sendMutation.error,
    sendProgress,
    resetProgress,
  };
}

/**
 * Hook for generating PDF filename.
 * iOS: sendContractWithBrochureDicts filename generation
 *
 * @param estimateId - Estimate ID
 * @param templateCount - Number of templates
 * @returns Generated filename
 */
export function useGenerateFileName(estimateId: string, templateCount: number) {
  return useMemo(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `Contract_${estimateId}_${templateCount}pages_${timestamp}.pdf`;
  }, [estimateId, templateCount]);
}
