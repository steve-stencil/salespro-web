/**
 * Hooks - centralized exports.
 */

// Contract hooks
export {
  useContractTemplates,
  useContractConfig,
  useGeneratePreview,
  useContractPreview,
} from './useContract';

// Document template hooks
export { useDocumentTemplates } from './useDocumentTemplates';

// Signing hooks
export {
  useSignatures,
  useSigningSession,
  useSaveSignature,
  useSaveInitials,
} from './useSigning';

// Payment hooks
export {
  usePaymentPermissions,
  useLeapPaySettings,
  usePaymentCells,
  usePaymentCapture,
  useProcessCreditCard,
  useProcessBankAccount,
} from './usePayment';

// Draft hooks
export {
  useDraftList,
  useDraft,
  useDraftOperations,
  useCreateDraftData,
  useUploadPinnedDrafts,
} from './useDraft';

// Send hooks
export {
  useSendConfig,
  useBrochures,
  useEmailVerification,
  usePreSendValidation,
  useSendContract,
  useGenerateFileName,
} from './useSend';

// Offline hooks
export {
  useOfflineTemplates,
  useTemplateCache,
  useStorageStatus,
  useClearAllCaches,
} from './useOffline';

// Import hooks
export { useImportedDocuments, usePageExtraction } from './useImport';

// Report hooks
export {
  useAvailableReports,
  useReportInsertionConfig,
  useReportSelection,
  useGenerateReport,
  useInsertReports,
} from './useReport';
