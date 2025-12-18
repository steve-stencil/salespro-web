/**
 * User, role, and office types shared between API and web applications.
 * These types define the contract for user management API endpoints.
 */

import type { Pagination, PaginationParams } from './api/pagination';

// ============================================================================
// Office Types
// ============================================================================

/** Office entity with all fields */
export type Office = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Number of users assigned to this office (optional, included in some responses) */
  userCount?: number;
};

/** Office access record for a user */
export type UserOfficeAccess = {
  id: string;
  name: string;
  isActive: boolean;
  assignedAt: string;
  assignedBy?: {
    id: string;
    email: string;
    nameFirst?: string;
    nameLast?: string;
  } | null;
};

// ============================================================================
// Role Types
// ============================================================================

/** Role type enum values */
export type RoleType = 'system' | 'company' | 'platform';

/** Role basic info for lists and references */
export type RoleBasic = {
  id: string;
  name: string;
  displayName: string;
};

/** Full role details */
export type Role = RoleBasic & {
  description?: string;
  type: RoleType;
  permissions: string[];
  isDefault: boolean;
  isSystemRole: boolean;
  /** Whether this is a platform role (for internal users) */
  isPlatformRole?: boolean;
  createdAt: string;
  updatedAt?: string;
  /** Number of users assigned to this role (optional, included in some responses) */
  userCount?: number;
};

/** Permission metadata from API */
export type PermissionMeta = {
  name: string;
  label: string;
  category: string;
  description: string;
};

/** Permissions grouped by category */
export type PermissionsByCategory = Record<string, string[]>;

// ============================================================================
// User Types
// ============================================================================

/** User in list view (minimal fields for performance) */
export type UserListItem = {
  id: string;
  email: string;
  nameFirst?: string;
  nameLast?: string;
  isActive: boolean;
  mfaEnabled: boolean;
  emailVerified: boolean;
  currentOffice: { id: string; name: string } | null;
  roles: RoleBasic[];
  lastLoginDate?: string;
  createdAt: string;
};

/** Full user details (extended fields) */
export type UserDetail = UserListItem & {
  needsResetPassword: boolean;
  allowedOffices: UserOfficeAccess[];
  updatedAt: string;
};

// ============================================================================
// User API Response Types
// ============================================================================

/** Users list response */
export type UsersListResponse = {
  users: UserListItem[];
  pagination: Pagination;
};

/** User detail response */
export type UserDetailResponse = {
  user: UserDetail;
};

/** User update response */
export type UserUpdateResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    nameFirst?: string;
    nameLast?: string;
  };
};

/** User activate/deactivate response */
export type UserActivateResponse = {
  message: string;
  user: {
    id: string;
    isActive: boolean;
  };
};

/** User offices response */
export type UserOfficesResponse = {
  offices: UserOfficeAccess[];
};

/** Add office access response */
export type AddOfficeAccessResponse = {
  message: string;
  officeAccess: {
    id: string;
    officeId: string;
    officeName: string;
    assignedAt: string;
  };
};

/** Set current office response */
export type SetCurrentOfficeResponse = {
  message: string;
  user: {
    id: string;
    currentOffice: { id: string; name: string } | null;
  };
};

// ============================================================================
// Office API Response Types
// ============================================================================

/** Offices list response */
export type OfficesListResponse = {
  offices: Office[];
};

/** Office detail response */
export type OfficeDetailResponse = {
  office: Office;
};

/** Office create/update response */
export type OfficeMutationResponse = {
  message: string;
  office: Office;
};

/** Office delete response */
export type OfficeDeleteResponse = {
  message: string;
  removedAssignments: number;
  clearedCurrentOffice: number;
};

// ============================================================================
// Role API Response Types
// ============================================================================

/** Roles list response */
export type RolesListResponse = {
  roles: Role[];
};

/** Role detail response */
export type RoleDetailResponse = {
  role: Role;
};

/** Role create/update response */
export type RoleMutationResponse = {
  message: string;
  role: {
    id: string;
    name: string;
    displayName: string;
    description?: string;
    type: string;
    permissions: string[];
    isDefault: boolean;
  };
};

/** Permissions response */
export type PermissionsResponse = {
  permissions: PermissionMeta[];
  byCategory: PermissionsByCategory;
};

/** My roles response (current user's roles and permissions) */
export type MyRolesResponse = {
  roles: RoleBasic[];
  permissions: string[];
};

// ============================================================================
// User API Request Types
// ============================================================================

/** Update user request */
export type UpdateUserRequest = {
  nameFirst?: string;
  nameLast?: string;
};

/** Users list query params */
export type UsersListParams = PaginationParams & {
  officeId?: string;
  search?: string;
  isActive?: boolean;
};

// ============================================================================
// Office API Request Types
// ============================================================================

/** Create office request */
export type CreateOfficeRequest = {
  name: string;
  isActive?: boolean;
};

/** Update office request */
export type UpdateOfficeRequest = {
  name?: string;
  isActive?: boolean;
};

/** Offices list query params */
export type OfficesListParams = {
  isActive?: boolean;
};

// ============================================================================
// Role API Request Types
// ============================================================================

/** Create role request */
export type CreateRoleRequest = {
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  isDefault?: boolean;
};

/** Update role request */
export type UpdateRoleRequest = {
  displayName?: string;
  description?: string;
  permissions?: string[];
  isDefault?: boolean;
};

/** Assign role request */
export type AssignRoleRequest = {
  userId: string;
  roleId: string;
};
