/**
 * Send API service.
 * Handles contract sending, upload, and analytics.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m
 */
import { get, post, uploadFile } from '../lib/api-client';

import type {
  BrochureLink,
  SendConfig,
  EmailVerificationState,
  ImageUploadObject,
  ContractSendRequest,
  ContractSendResult,
  PreSendValidation,
} from '../types/send';
import type { SignaturePage, InitialsRequirement } from '../types/signing';

/**
 * Send API methods.
 */
export const sendApi = {
  /**
   * Get send configuration for an estimate.
   *
   * @param estimateId - Estimate ID
   * @returns Send configuration
   */
  getConfig: async (estimateId: string): Promise<SendConfig> => {
    return get<SendConfig>(`/send/${estimateId}/config`);
  },

  /**
   * Get available brochures for selection.
   * iOS: brochureSelectionTableViewController
   *
   * @param estimateId - Estimate ID
   * @returns Available brochures
   */
  getBrochures: async (estimateId: string): Promise<BrochureLink[]> => {
    return get<BrochureLink[]>(`/send/${estimateId}/brochures`);
  },

  /**
   * Verify recipient email before send.
   * iOS: showVerifyEmailAlertOnViewController:block:
   *
   * @param email - Email to verify
   * @returns Verification state
   */
  verifyEmail: async (email: string): Promise<EmailVerificationState> => {
    return post<EmailVerificationState>('/send/verify-email', { email });
  },

  /**
   * Validate contract is ready to send.
   * iOS: contractPreviewViewController:tappedSendButton: validation
   *
   * @param signatures - Current signatures
   * @param initials - Current initials
   * @param hasRemoteSignatures - Whether DocuSign is configured
   * @param promptUserFlag - Feature flag for confirmation prompt
   * @returns Validation result
   */
  validatePreSend: (
    signatures: SignaturePage[],
    initials: InitialsRequirement[],
    hasRemoteSignatures: boolean,
    promptUserFlag: boolean,
  ): PreSendValidation => {
    const missingSignatures = signatures.some(
      s => s.isRequired && !s.isCaptured,
    );
    const missingInitials = initials.some(i => i.isRequired && !i.isCaptured);

    const promptForConfirmation =
      promptUserFlag &&
      !hasRemoteSignatures &&
      !signatures.some(s => s.isCaptured);

    return {
      isValid: !missingSignatures && !missingInitials,
      missingSignatures,
      missingInitials,
      missingRequiredFields: [],
      promptUserForConfirmation: promptForConfirmation,
      confirmationMessage: promptForConfirmation
        ? 'No signatures or remote signing configured. Send anyway?'
        : undefined,
    };
  },

  /**
   * Upload an image attached to the contract.
   * iOS: creates ImageObject per photoObject
   *
   * @param file - Image file to upload
   * @returns Uploaded image object
   */
  uploadImage: async (file: File): Promise<ImageUploadObject> => {
    return uploadFile<ImageUploadObject>('/send/images', file);
  },

  /**
   * Generate final PDF filename.
   * iOS: sendContractWithBrochureDicts filename generation
   *
   * @param estimateId - Estimate ID
   * @param templateCount - Number of templates
   * @returns Generated filename
   */
  generateFileName: (
    estimateId: string,
    templateCount: number,
  ): Promise<string> => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return Promise.resolve(
      `Contract_${estimateId}_${templateCount}pages_${timestamp}.pdf`,
    );
  },

  /**
   * Send the contract with all attachments.
   * iOS: UploadUtility promiseSendFileWithName:...templateIds:
   *
   * @param request - Send request with all data
   * @returns Send result
   */
  send: async (request: ContractSendRequest): Promise<ContractSendResult> => {
    const startTime = Date.now();

    const result = await post<ContractSendResult>('/send/contract', request);

    // Add analytics data
    result.analyticsData = {
      estimateId: request.estimateId,
      templateCount: request.templateIds.length,
      signatureCount: request.docuSignObjects.length,
      initialsCount: 0,
      brochureCount: request.brochureLinks.length,
      hasDocuSign: request.docuSignObjects.length > 0,
      sendDurationMs: Date.now() - startTime,
    };

    return result;
  },

  /**
   * Record contract sent analytics.
   * iOS: sendContractWithBrochureDicts analytics
   *
   * @param data - Analytics event data
   */
  recordAnalytics: async (
    data: ContractSendResult['analyticsData'],
  ): Promise<void> => {
    await post('/analytics/contract-sent', data);
  },
};
