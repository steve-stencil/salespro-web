/**
 * Send flow types for iOS parity.
 * Based on iOS source: ContractObjectSelectionCollectionViewController.m
 */

/**
 * Brochure or email link that can be attached to sent contract.
 */
export type BrochureLink = {
  id: string;
  name: string;
  url: string;
  description?: string;
  thumbnailUrl?: string;
  isSelected: boolean;
};

/**
 * Send configuration derived from upload config.
 */
export type SendConfig = {
  /** Whether brochure selection is available. */
  brochuresEnabled: boolean;
  /** Available brochures for selection. */
  availableBrochures: BrochureLink[];
  /** Whether email verification is required before send. */
  emailVerificationRequired: boolean;
  /** Default recipient email. */
  defaultEmail?: string;
};

/**
 * Email verification dialog state.
 */
export type EmailVerificationState = {
  email: string;
  isVerified: boolean;
  errorMessage?: string;
};

/**
 * Image object for upload alongside PDF.
 * Based on iOS ImageObject creation from photoObject.
 */
export type ImageUploadObject = {
  id: string;
  localUri: string;
  fileName: string;
  mimeType: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  remoteUrl?: string;
  errorMessage?: string;
};

/**
 * Contract send request to upload utility.
 * Based on iOS UploadUtility promiseSendFileWithName.
 */
export type ContractSendRequest = {
  estimateId: string;
  fileName: string;
  pdfData: ArrayBuffer;
  templateIds: string[];
  brochureLinks: BrochureLink[];
  sessionId: string;
  images: ImageUploadObject[];
  recipientEmail: string;
  docuSignObjects: DocuSignObjectRef[];
};

/**
 * DocuSign object reference for attachment.
 */
export type DocuSignObjectRef = {
  id: string;
  envelopeId: string;
  recipientId: string;
};

/**
 * Result of send operation.
 */
export type ContractSendResult = {
  success: boolean;
  documentId?: string;
  errorMessage?: string;
  /** Analytics event data. */
  analyticsData?: ContractSentAnalytics;
};

/**
 * Analytics data for contract sent event.
 * Based on iOS sendContractWithBrochureDicts analytics.
 */
export type ContractSentAnalytics = {
  estimateId: string;
  templateCount: number;
  signatureCount: number;
  initialsCount: number;
  brochureCount: number;
  hasDocuSign: boolean;
  sendDurationMs: number;
};

/**
 * Pre-send validation result.
 * Checks if all required fields are complete.
 */
export type PreSendValidation = {
  isValid: boolean;
  missingInitials: boolean;
  missingSignatures: boolean;
  missingRequiredFields: string[];
  promptUserForConfirmation: boolean;
  confirmationMessage?: string;
};
