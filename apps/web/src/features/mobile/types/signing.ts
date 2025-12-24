/**
 * Signing flow types for iOS parity.
 * Based on iOS source: ContractObjectManager.swift
 */

/**
 * A signer represents a person who will sign the contract.
 * Used for grouped signing flow.
 */
export type Signer = {
  id: string;
  name: string;
  email?: string;
  /** Order in which this signer should sign. */
  order: number;
};

/**
 * Signature page information for the signing flow.
 * Based on iOS addSignature(withFooterTitle:idNumber:note:pageNumber:).
 */
export type SignaturePage = {
  id: string;
  signerId: string;
  signerName: string;
  footerTitle: string;
  note?: string;
  pageNumber: number;
  isRequired: boolean;
  isCaptured: boolean;
  imageDataUrl?: string;
};

/**
 * Initials requirement information.
 * Based on iOS addInitialsString(_:withId:note:required:).
 */
export type InitialsRequirement = {
  id: string;
  signerId: string;
  note?: string;
  isRequired: boolean;
  isCaptured: boolean;
  imageDataUrl?: string;
};

/**
 * Signing session state machine.
 * Tracks the current state of the multi-step signing process.
 */
export type SigningSessionState =
  | { status: 'idle' }
  | { status: 'collecting_signatures'; currentIndex: number; total: number }
  | { status: 'collecting_initials'; currentIndex: number; total: number }
  | { status: 'completed' }
  | { status: 'cancelled' };

/**
 * Result of checking if signing is complete.
 */
export type SigningCompletionStatus = {
  /** All required signatures have been captured. */
  signaturesComplete: boolean;
  /** All required initials have been captured. */
  initialsComplete: boolean;
  /** Total number of signatures required. */
  totalSignatures: number;
  /** Number of signatures captured. */
  capturedSignatures: number;
  /** Total number of initials required. */
  totalInitials: number;
  /** Number of initials captured. */
  capturedInitials: number;
};

/**
 * Grouped signatures by signer for the signer-grouped signing flow.
 * Based on iOS signaturePagesByGroupedSigner().
 */
export type SignaturesBySignerGroup = {
  signer: Signer;
  signatures: SignaturePage[];
  initials: InitialsRequirement[];
};

/**
 * Signature capture view configuration.
 * Controls the save signature toggle and signer display.
 */
export type SignatureCaptureConfig = {
  /** Whether to show the "save signature" toggle. */
  showSaveSwitch: boolean;
  /** Current value of save signature toggle. */
  saveSignature: boolean;
  /** Signer name to display. */
  signerName: string;
  /** Optional instruction text. */
  instructions?: string;
};

/**
 * DocuSign integration data.
 * Combined objects attached to estimate after signing.
 */
export type DocuSignObject = {
  id: string;
  envelopeId: string;
  recipientId: string;
  status: 'pending' | 'sent' | 'signed' | 'declined';
  signedAt?: string;
};
