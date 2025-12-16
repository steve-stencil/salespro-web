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
  listPendingInvites,
  InviteServiceError,
} from './invite';
export type {
  CreateInviteResult,
  AcceptInviteResult,
  ValidateInviteResult,
  CreateInviteOptions,
  AcceptInviteOptions,
} from './invite';
