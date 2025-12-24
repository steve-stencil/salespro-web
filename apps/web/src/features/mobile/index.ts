/**
 * Mobile app exports.
 * Exposes components for integration into the main web app.
 */

// Main page component
export { ContractPreviewPage } from './pages/ContractPreviewPage';

// Context providers
export {
  FeatureFlagProvider,
  useFeatureFlags,
} from './context/FeatureFlagContext';
export { OfflineProvider, useOffline } from './context/OfflineContext';

// Hooks
export {
  useContractTemplates,
  useGeneratePreview,
  useContractConfig,
} from './hooks/useContract';
export {
  useSignatures,
  useSigningSession,
  useSaveSignature,
  useSaveInitials,
} from './hooks/useSigning';
export {
  usePaymentPermissions,
  useLeapPaySettings,
  usePaymentCapture,
} from './hooks/usePayment';
export {
  useDraftOperations,
  useDraftList,
  useUploadPinnedDrafts,
} from './hooks/useDraft';
export {
  useBrochures,
  useSendContract,
  usePreSendValidation,
} from './hooks/useSend';
export { useOfflineTemplates, useStorageStatus } from './hooks/useOffline';
export { useImportedDocuments, usePageExtraction } from './hooks/useImport';
export {
  useReportSelection,
  useReportInsertionConfig,
} from './hooks/useReport';

// Types
export type * from './types';
