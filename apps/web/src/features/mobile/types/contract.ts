/**
 * Contract and template types for iOS parity.
 * Based on iOS source: ContractObjectSelectionCollectionViewController.m
 */

/**
 * A contract template that can be selected for inclusion in the final document.
 * Corresponds to iOS ContractObject.
 */
export type ContractTemplate = {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  categoryName: string;
  thumbnailUrl?: string;
  pageCount: number;
  isSelected: boolean;
  sortOrder: number;
  /** Whether this is an imported PDF (vs. a server template). */
  isImported: boolean;
  /** Whether this is a measurement report template. */
  isReport: boolean;
  /** Original file URL for imported PDFs. */
  fileUrl?: string;
};

/**
 * Category grouping for contract templates.
 */
export type ContractCategory = {
  id: string;
  name: string;
  sortOrder: number;
  templates: ContractTemplate[];
};

/**
 * Configuration for contract preview/send behavior.
 * Based on iOS uploadConfig lookup.
 */
export type ContractConfig = {
  /** Whether the review button should be disabled. */
  disableReviewButton: boolean;
  /** Whether the print button should be disabled. */
  disablePrintButton: boolean;
  /** Email verification required before send. */
  requireEmailVerification: boolean;
  /** Whether brochure selection is enabled. */
  enableBrochureSelection: boolean;
};

/**
 * Photo object attached to a contract session.
 * Photos are uploaded alongside the PDF.
 */
export type PhotoObject = {
  id: string;
  localUri: string;
  remoteUrl?: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
};

/**
 * Contract generation request sent to the engine.
 */
export type ContractGenerateRequest = {
  estimateId: string;
  templateIds: string[];
  formValues: Record<string, unknown>;
  signatures: SignatureData[];
  initials: InitialsData[];
  photos: PhotoObject[];
};

/**
 * Contract generation response from the engine.
 */
export type ContractGenerateResponse = {
  pdfUrl: string;
  pdfBytes?: ArrayBuffer;
  missingImages: MissingImage[];
  pageCount: number;
};

/**
 * Missing image information for user notification.
 */
export type MissingImage = {
  url: string;
  reason: 'network_error' | 'not_found' | 'timeout';
};

/**
 * Signature data captured locally or via DocuSign.
 */
export type SignatureData = {
  id: string;
  signerId: string;
  signerName: string;
  footerTitle: string;
  note?: string;
  pageNumber: number;
  imageDataUrl?: string;
  isDocuSign: boolean;
  isRequired: boolean;
  isCaptured: boolean;
};

/**
 * Initials data captured locally.
 */
export type InitialsData = {
  id: string;
  signerId: string;
  signerName: string;
  note?: string;
  imageDataUrl?: string;
  isRequired: boolean;
  isCaptured: boolean;
};
