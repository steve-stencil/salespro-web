/**
 * Signing hook for signature and initials capture.
 * Based on iOS: ContractObjectManager.swift
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';

import { useFeatureFlags } from '../context/FeatureFlagContext';
import { signingApi } from '../services/signing';

import type {
  SignaturePage,
  InitialsRequirement,
  SigningSessionState,
  SigningCompletionStatus,
  SignaturesBySignerGroup,
} from '../types/signing';

const QUERY_KEYS = {
  signatures: (templateIds: string[]) =>
    ['signing', 'discover', ...templateIds] as const,
  docuSign: (estimateId: string) =>
    ['signing', 'docusign', estimateId] as const,
};

/**
 * Hook for discovering and managing signatures.
 *
 * @param templateIds - Selected template IDs
 * @returns Signatures, initials, and signing utilities
 */
export function useSignatures(templateIds: string[]) {
  const { flags } = useFeatureFlags();

  // Local state for captured signatures/initials
  const [signatures, setSignatures] = useState<SignaturePage[]>([]);
  const [initials, setInitials] = useState<InitialsRequirement[]>([]);

  // Discover signatures when templates change
  const discoverQuery = useQuery({
    queryKey: QUERY_KEYS.signatures(templateIds),
    queryFn: () => signingApi.discoverSignatures(templateIds),
    enabled: templateIds.length > 0,
  });

  // Initialize local state when discovery completes
  useMemo(() => {
    if (discoverQuery.data) {
      setSignatures(discoverQuery.data.signatures);
      setInitials(discoverQuery.data.initials);
    }
  }, [discoverQuery.data]);

  /**
   * Get completion status.
   */
  const completionStatus: SigningCompletionStatus = useMemo(
    () => signingApi.getCompletionStatus(signatures, initials),
    [signatures, initials],
  );

  /**
   * Get signatures grouped by signer (for grouped signing flow).
   * iOS: signaturePagesByGroupedSigner()
   */
  const signaturesBySignerGroup: SignaturesBySignerGroup[] = useMemo(() => {
    if (!flags.signerGroupedSigning) return [];
    return signingApi.getSignaturesBySignerGroup(signatures, initials);
  }, [signatures, initials, flags.signerGroupedSigning]);

  /**
   * Update a signature with captured image.
   */
  const captureSignature = useCallback(
    (signatureId: string, imageDataUrl: string): void => {
      setSignatures(prev =>
        prev.map(sig =>
          sig.id === signatureId
            ? { ...sig, imageDataUrl, isCaptured: true }
            : sig,
        ),
      );
    },
    [],
  );

  /**
   * Update initials with captured image.
   */
  const captureInitials = useCallback(
    (initialsId: string, imageDataUrl: string): void => {
      setInitials(prev =>
        prev.map(init =>
          init.id === initialsId
            ? { ...init, imageDataUrl, isCaptured: true }
            : init,
        ),
      );
    },
    [],
  );

  /**
   * Clear a captured signature.
   */
  const clearSignature = useCallback((signatureId: string): void => {
    setSignatures(prev =>
      prev.map(sig =>
        sig.id === signatureId
          ? { ...sig, imageDataUrl: undefined, isCaptured: false }
          : sig,
      ),
    );
  }, []);

  /**
   * Clear captured initials.
   */
  const clearInitials = useCallback((initialsId: string): void => {
    setInitials(prev =>
      prev.map(init =>
        init.id === initialsId
          ? { ...init, imageDataUrl: undefined, isCaptured: false }
          : init,
      ),
    );
  }, []);

  return {
    signatures,
    initials,
    signers: discoverQuery.data?.signers ?? [],
    isLoading: discoverQuery.isLoading,
    error: discoverQuery.error,
    completionStatus,
    signaturesBySignerGroup,
    useGroupedSigning: flags.signerGroupedSigning,
    captureSignature,
    captureInitials,
    clearSignature,
    clearInitials,
  };
}

/**
 * Hook for managing signing session state machine.
 * iOS: showSignatureAtCurrentIndexForViewController
 */
export function useSigningSession() {
  const [state, setState] = useState<SigningSessionState>({ status: 'idle' });

  /**
   * Start signature collection flow.
   */
  const startSignatureCollection = useCallback((total: number): void => {
    if (total === 0) {
      setState({ status: 'completed' });
      return;
    }
    setState({ status: 'collecting_signatures', currentIndex: 0, total });
  }, []);

  /**
   * Start initials collection flow.
   */
  const startInitialsCollection = useCallback((total: number): void => {
    if (total === 0) {
      setState({ status: 'completed' });
      return;
    }
    setState({ status: 'collecting_initials', currentIndex: 0, total });
  }, []);

  /**
   * Move to next signature/initials.
   */
  const next = useCallback((): void => {
    setState(prev => {
      if (prev.status === 'collecting_signatures') {
        if (prev.currentIndex + 1 >= prev.total) {
          return { status: 'completed' };
        }
        return { ...prev, currentIndex: prev.currentIndex + 1 };
      }
      if (prev.status === 'collecting_initials') {
        if (prev.currentIndex + 1 >= prev.total) {
          return { status: 'completed' };
        }
        return { ...prev, currentIndex: prev.currentIndex + 1 };
      }
      return prev;
    });
  }, []);

  /**
   * Cancel signing flow.
   */
  const cancel = useCallback((): void => {
    setState({ status: 'cancelled' });
  }, []);

  /**
   * Reset to idle.
   */
  const reset = useCallback((): void => {
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    startSignatureCollection,
    startInitialsCollection,
    next,
    cancel,
    reset,
    isCollecting:
      state.status === 'collecting_signatures' ||
      state.status === 'collecting_initials',
    isComplete: state.status === 'completed',
  };
}

/**
 * Hook for saving signatures to server.
 */
export function useSaveSignature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      signatureId,
      imageDataUrl,
      isDocuSign = false,
    }: {
      signatureId: string;
      imageDataUrl: string;
      isDocuSign?: boolean;
    }) => signingApi.saveSignature({ signatureId, imageDataUrl, isDocuSign }),
    onSuccess: () => {
      // Invalidate signature queries to refresh state
      void queryClient.invalidateQueries({ queryKey: ['signing'] });
    },
  });
}

/**
 * Hook for saving initials to server.
 */
export function useSaveInitials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      initialsId,
      imageDataUrl,
    }: {
      initialsId: string;
      imageDataUrl: string;
    }) => signingApi.saveInitials(initialsId, imageDataUrl),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['signing'] });
    },
  });
}
