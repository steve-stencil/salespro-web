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

// ETL services
export {
  OfficeEtlService,
  closeSourceConnection,
  isSourceConfigured,
  getSourceCompanyIdByEmail,
  EtlServiceError,
  EtlErrorCode,
} from './etl';
export type {
  BaseEtlService,
  FetchSourceResult,
  SourceItem,
  LegacySourceOffice,
  RawSourceOffice,
  TransformedOfficeData,
  BatchImportOptions,
  BatchImportResult,
} from './etl';
