/**
 * Signing API service.
 * Handles signature discovery, capture, and grouped signing flows.
 * Based on iOS: ContractObjectManager.swift
 */
import { get, post } from '../lib/api-client';

import type {
  Signer,
  SignaturePage,
  InitialsRequirement,
  SigningCompletionStatus,
  SignaturesBySignerGroup,
  DocuSignObject,
} from '../types/signing';

/**
 * Response from discovering signatures in templates.
 */
type DiscoverSignaturesResponse = {
  signatures: SignaturePage[];
  initials: InitialsRequirement[];
  signers: Signer[];
};

/**
 * Request to save a captured signature.
 */
type SaveSignatureRequest = {
  signatureId: string;
  imageDataUrl: string;
  isDocuSign: boolean;
};

/**
 * Signing API methods.
 */
export const signingApi = {
  /**
   * Discover signatures and initials required in the selected templates.
   * iOS: addSignature(withFooterTitle:), addInitialsString()
   *
   * @param templateIds - IDs of selected templates
   * @returns Required signatures and initials
   */
  discoverSignatures: async (
    templateIds: string[],
  ): Promise<DiscoverSignaturesResponse> => {
    return post<DiscoverSignaturesResponse>('/signing/discover', {
      templateIds,
    });
  },

  /**
   * Check if all required signatures and initials are captured.
   * iOS: needsInitialsCaptured()
   *
   * @param signatures - Current signature states
   * @param initials - Current initials states
   * @returns Completion status
   */
  getCompletionStatus: (
    signatures: SignaturePage[],
    initials: InitialsRequirement[],
  ): SigningCompletionStatus => {
    const requiredSignatures = signatures.filter(s => s.isRequired);
    const capturedSignatures = requiredSignatures.filter(s => s.isCaptured);
    const requiredInitials = initials.filter(i => i.isRequired);
    const capturedInitials = requiredInitials.filter(i => i.isCaptured);

    return {
      signaturesComplete:
        capturedSignatures.length === requiredSignatures.length,
      initialsComplete: capturedInitials.length === requiredInitials.length,
      totalSignatures: requiredSignatures.length,
      capturedSignatures: capturedSignatures.length,
      totalInitials: requiredInitials.length,
      capturedInitials: capturedInitials.length,
    };
  },

  /**
   * Get unique signers from signatures.
   * iOS: uniqueSigners()
   *
   * @param signatures - All signature pages
   * @returns Unique signers in order
   */
  getUniqueSigners: (signatures: SignaturePage[]): Signer[] => {
    const signerMap = new Map<string, Signer>();

    signatures.forEach((sig, index) => {
      if (!signerMap.has(sig.signerId)) {
        signerMap.set(sig.signerId, {
          id: sig.signerId,
          name: sig.signerName,
          order: index,
        });
      }
    });

    return Array.from(signerMap.values()).sort((a, b) => a.order - b.order);
  },

  /**
   * Get signatures grouped by signer for grouped signing flow.
   * iOS: signaturePagesByGroupedSigner()
   *
   * @param signatures - All signature pages
   * @param initials - All initials requirements
   * @returns Signatures and initials grouped by signer
   */
  getSignaturesBySignerGroup: (
    signatures: SignaturePage[],
    initials: InitialsRequirement[],
  ): SignaturesBySignerGroup[] => {
    const signers = signingApi.getUniqueSigners(signatures);

    return signers.map(signer => ({
      signer,
      signatures: signatures.filter(s => s.signerId === signer.id),
      initials: initials.filter(i => i.signerId === signer.id),
    }));
  },

  /**
   * Save a captured signature image.
   * iOS: addCapturedSignature:docuSign:fromSignatureView:
   *
   * @param request - Signature save request
   * @returns Updated signature page
   */
  saveSignature: async (
    request: SaveSignatureRequest,
  ): Promise<SignaturePage> => {
    return post<SignaturePage>('/signing/signatures', request);
  },

  /**
   * Save captured initials image.
   * iOS: didAddCapturedInitials:withId:
   *
   * @param initialsId - ID of the initials requirement
   * @param imageDataUrl - Base64 image data
   * @returns Updated initials requirement
   */
  saveInitials: async (
    initialsId: string,
    imageDataUrl: string,
  ): Promise<InitialsRequirement> => {
    return post<InitialsRequirement>('/signing/initials', {
      initialsId,
      imageDataUrl,
    });
  },

  /**
   * Get all combined DocuSign objects for the estimate.
   * iOS: allCombinedDocuSignObjects()
   *
   * @param estimateId - Estimate ID
   * @returns Combined DocuSign objects
   */
  getDocuSignObjects: async (estimateId: string): Promise<DocuSignObject[]> => {
    return get<DocuSignObject[]>(`/signing/${estimateId}/docusign`);
  },

  /**
   * Attach DocuSign objects to estimate.
   * iOS: addDocuSignObjects
   *
   * @param estimateId - Estimate ID
   * @param docuSignObjects - Objects to attach
   */
  attachDocuSignObjects: async (
    estimateId: string,
    docuSignObjects: DocuSignObject[],
  ): Promise<void> => {
    await post(`/signing/${estimateId}/docusign`, { docuSignObjects });
  },
};
