/**
 * Types for user, role, and office management.
 */

// ============================================================================
// Office Types
// ============================================================================

/** Office with all fields (simplified model - just name and status) */
export interface Office {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Number of users assigned to this office (optional) */
  userCount?: number;
}

/** Office access record for a user */
export interface UserOfficeAccess {
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
}

// ============================================================================
// Role Types
// ============================================================================

/** Role basic info for lists */
export interface RoleBasic {
  id: string;
  name: string;
  displayName: string;
}

/** Full role details */
export interface Role extends RoleBasic {
  description?: string;
  type: 'system' | 'company';
  permissions: string[];
  isDefault: boolean;
  isSystemRole: boolean;
  createdAt: string;
  updatedAt?: string;
  /** Number of users assigned to this role (optional) */
  userCount?: number;
}

/** Permission metadata from API */
export interface PermissionMeta {
  name: string;
  label: string;
  category: string;
  description: string;
}

/** Permissions grouped by category */
export type PermissionsByCategory = Record<string, string[]>;

// ============================================================================
// User Types
// ============================================================================

/** User in list view */
export interface UserListItem {
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
}

/** Full user details */
export interface UserDetail extends UserListItem {
  needsResetPassword: boolean;
  allowedOffices: UserOfficeAccess[];
  updatedAt: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/** Pagination info */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Users list response */
export interface UsersListResponse {
  users: UserListItem[];
  pagination: Pagination;
}

/** User detail response */
export interface UserDetailResponse {
  user: UserDetail;
}

/** User update response */
export interface UserUpdateResponse {
  message: string;
  user: {
    id: string;
    email: string;
    nameFirst?: string;
    nameLast?: string;
  };
}

/** User activate response */
export interface UserActivateResponse {
  message: string;
  user: {
    id: string;
    isActive: boolean;
  };
}

/** User offices response */
export interface UserOfficesResponse {
  offices: UserOfficeAccess[];
}

/** Add office access response */
export interface AddOfficeAccessResponse {
  message: string;
  officeAccess: {
    id: string;
    officeId: string;
    officeName: string;
    assignedAt: string;
  };
}

/** Set current office response */
export interface SetCurrentOfficeResponse {
  message: string;
  user: {
    id: string;
    currentOffice: { id: string; name: string } | null;
  };
}

/** Offices list response */
export interface OfficesListResponse {
  offices: Office[];
}

/** Office detail response */
export interface OfficeDetailResponse {
  office: Office;
}

/** Office create/update response */
export interface OfficeMutationResponse {
  message: string;
  office: Office;
}

/** Office delete response */
export interface OfficeDeleteResponse {
  message: string;
  removedAssignments: number;
  clearedCurrentOffice: number;
}

/** Roles list response */
export interface RolesListResponse {
  roles: Role[];
}

/** Role detail response */
export interface RoleDetailResponse {
  role: Role;
}

/** Role create/update response */
export interface RoleMutationResponse {
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
}

/** Permissions response */
export interface PermissionsResponse {
  permissions: PermissionMeta[];
  byCategory: PermissionsByCategory;
}

/** My roles response */
export interface MyRolesResponse {
  roles: RoleBasic[];
  permissions: string[];
}

// ============================================================================
// Request Types
// ============================================================================

/** Update user request */
export interface UpdateUserRequest {
  nameFirst?: string;
  nameLast?: string;
}

/** Create role request */
export interface CreateRoleRequest {
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  isDefault?: boolean;
}

/** Update role request */
export interface UpdateRoleRequest {
  displayName?: string;
  description?: string;
  permissions?: string[];
  isDefault?: boolean;
}

/** Assign role request */
export interface AssignRoleRequest {
  userId: string;
  roleId: string;
}

/** Users list query params */
export interface UsersListParams {
  page?: number;
  limit?: number;
  officeId?: string;
  search?: string;
  isActive?: boolean;
}

// ============================================================================
// Office Request Types
// ============================================================================

/** Create office request */
export interface CreateOfficeRequest {
  name: string;
  isActive?: boolean;
}

/** Update office request */
export interface UpdateOfficeRequest {
  name?: string;
  isActive?: boolean;
}

/** Offices list query params */
export interface OfficesListParams {
  isActive?: boolean;
}

// ============================================================================
// Invite Types
// ============================================================================

/** Pending invite in list view */
export interface InviteListItem {
  id: string;
  email: string;
  roles: string[];
  currentOffice: {
    id: string;
    name: string;
  };
  allowedOffices: string[];
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    email: string;
    nameFirst?: string;
    nameLast?: string;
  };
}

/** Invites list response */
export interface InvitesListResponse {
  invites: InviteListItem[];
  pagination: Pagination;
}

/** Create invite request */
export interface CreateInviteRequest {
  email: string;
  roles: string[];
  /** The office to set as the user's current/active office (required) */
  currentOfficeId: string;
  /** Array of office IDs the user will have access to (required, non-empty) */
  allowedOfficeIds: string[];
}

/** Create invite response */
export interface CreateInviteResponse {
  message: string;
  invite: {
    id: string;
    email: string;
    expiresAt: string;
    currentOffice: {
      id: string;
      name: string;
    };
    allowedOffices: string[];
  };
  /** Token returned only in development mode */
  token?: string;
}

/** Resend invite response */
export interface ResendInviteResponse {
  message: string;
  invite: {
    id: string;
    email: string;
    expiresAt: string;
  };
  /** Token returned only in development mode */
  token?: string;
}

/** Validate invite token response */
export interface ValidateInviteResponse {
  valid: boolean;
  email: string;
  companyName: string;
}

/** Accept invite request */
export interface AcceptInviteRequest {
  token: string;
  password: string;
  nameFirst?: string;
  nameLast?: string;
}

/** Accept invite response */
export interface AcceptInviteResponse {
  message: string;
  user: {
    id: string;
    email: string;
    nameFirst?: string;
    nameLast?: string;
  };
}

/** Invites list query params */
export interface InvitesListParams {
  page?: number;
  limit?: number;
}
