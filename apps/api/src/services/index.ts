/**
 * Service exports
 */
export { AuthService, LoginErrorCode } from './AuthService';
export type {
  LoginParams,
  LoginResult,
  PasswordResetRequestResult,
  PasswordResetResult,
} from './AuthService';

export { PermissionService } from './PermissionService';
export type { RoleAssignmentResult } from './PermissionService';

export { FileService, FileServiceError, FileErrorCode } from './file';
export type {
  UploadFileParams,
  PresignUploadParams,
  PresignUploadResult,
  UpdateFileParams,
} from './file';

// Invite service
export {
  createInvite,
  validateInviteToken,
  acceptInvite,
  revokeInvite,
  resendInvite,
  updateInvite,
  listPendingInvites,
  InviteServiceError,
} from './invite';
export type {
  CreateInviteResult,
  AcceptInviteResult,
  ValidateInviteResult,
  CreateInviteOptions,
  AcceptInviteOptions,
  UpdateInviteOptions,
} from './invite';

// Office settings service
export {
  OfficeSettingsService,
  OfficeSettingsError,
  OfficeSettingsErrorCode,
  LOGO_CONFIG,
  isValidLogoMimeType,
} from './office-settings';
export type {
  OfficeSettingsResponse,
  LogoInfo,
  UploadLogoParams,
  LogoValidationResult,
} from './office-settings';

// Office integration service
export {
  OfficeIntegrationService,
  OfficeIntegrationError,
  OfficeIntegrationErrorCode,
} from './office-integration';
export type {
  OfficeIntegrationResponse,
  OfficeIntegrationWithCredentials,
  UpsertIntegrationParams,
  ListIntegrationsOptions,
  IntegrationCredentials,
  IntegrationConfig,
} from './office-integration';

// ETL service
export {
  DocumentTemplateEtlService,
  EtlServiceError,
  EtlErrorCode,
  createParseClient,
  ParseClient,
} from './etl';
export {
  parsePageSize,
  hasUserInputRequired,
  countSignatureFields,
  transformToTemplate,
} from './etl';
export type {
  RawDocumentObject,
  TransformedTemplateData,
  ParseSourceOffice,
  BatchImportOptions,
  BatchImportResult,
} from './etl';
