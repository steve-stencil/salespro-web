/**
 * User, role, and office types.
 * Re-exports shared types and adds any web-specific extensions.
 */

// Re-export all shared user types
export type {
  // Office types
  Office,
  UserOfficeAccess,

  // Role types
  RoleType,
  RoleBasic,
  Role,
  PermissionMeta,
  PermissionsByCategory,

  // User types
  UserListItem,
  UserDetail,

  // User API responses
  UsersListResponse,
  UserDetailResponse,
  UserUpdateResponse,
  UserActivateResponse,
  UserOfficesResponse,
  AddOfficeAccessResponse,
  SetCurrentOfficeResponse,

  // Office API responses
  OfficesListResponse,
  OfficeDetailResponse,
  OfficeMutationResponse,
  OfficeDeleteResponse,

  // Role API responses
  RolesListResponse,
  RoleDetailResponse,
  RoleMutationResponse,
  PermissionsResponse,
  MyRolesResponse,

  // User API requests
  UpdateUserRequest,
  UsersListParams,

  // Office API requests
  CreateOfficeRequest,
  UpdateOfficeRequest,
  OfficesListParams,

  // Role API requests
  CreateRoleRequest,
  UpdateRoleRequest,
  AssignRoleRequest,

  // Invite types
  InviteListItem,
  InvitesListResponse,
  CreateInviteRequest,
  CreateInviteResponse,
  ResendInviteResponse,
  UpdateInviteRequest,
  UpdateInviteResponse,
  ValidateInviteResponse,
  AcceptInviteRequest,
  AcceptInviteResponse,
  InvitesListParams,

  // Pagination
  Pagination,
} from '@shared/core';
