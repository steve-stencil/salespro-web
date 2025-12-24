/**
 * Feature flag types for iOS parity.
 * Based on iOS LaunchDarkly flag usage patterns.
 */

/**
 * Feature flags used in the mobile contract flow.
 * Mirrors iOS LaunchDarkly flag keys.
 */
export type ContractFeatureFlags = {
  /**
   * Enable signer-grouped signing flow.
   * iOS: LaunchDarklyFlagSignerGroupedSigning
   */
  signerGroupedSigning: boolean;

  /**
   * Prompt user whether to send contract when no remote signatures detected.
   * iOS: LaunchDarklyFlagPromptUserWhetherToSendContractOrNot
   */
  promptUserWhetherToSendContract: boolean;

  /**
   * Enable offline template caching.
   */
  offlineTemplateCache: boolean;

  /**
   * Enable PDF import from device.
   */
  pdfImportEnabled: boolean;

  /**
   * Enable measurement report insertion.
   */
  reportInsertionEnabled: boolean;

  /**
   * Enable payment capture in contracts.
   */
  paymentCaptureEnabled: boolean;

  /**
   * Enable draft saving and loading.
   */
  draftSavingEnabled: boolean;

  /**
   * Enable DocuSign integration.
   */
  docuSignEnabled: boolean;
};

/**
 * Default feature flag values for offline/fallback scenarios.
 */
export const DEFAULT_FEATURE_FLAGS: ContractFeatureFlags = {
  signerGroupedSigning: false,
  promptUserWhetherToSendContract: true,
  offlineTemplateCache: true,
  pdfImportEnabled: true,
  reportInsertionEnabled: false,
  paymentCaptureEnabled: true,
  draftSavingEnabled: true,
  docuSignEnabled: false,
};

/**
 * LaunchDarkly user context for flag evaluation.
 */
export type LaunchDarklyContext = {
  kind: 'user';
  key: string;
  email?: string;
  name?: string;
  custom?: {
    companyId?: string;
    officeId?: string;
    platform?: 'web' | 'mobile';
  };
};
