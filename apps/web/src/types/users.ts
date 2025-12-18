/**
 * Types for user, role, and office management.
 */

// ============================================================================
// Office Types
// ============================================================================

/** Office with all fields (simplified model - just name and status) */
export type Office = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Number of users assigned to this office (optional) */
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

/** Role basic info for lists */
export type RoleBasic = {
  id: string;
  name: string;
  displayName: string;
};

/** Role type enum values */
export type RoleType = 'system' | 'company' | 'platform';

/** Full role details */
export type Role = {
  description?: string;
  type: RoleType;
  permissions: string[];
  isDefault: boolean;
  isSystemRole: boolean;
  /** Whether this is a platform role (for internal users) */
  isPlatformRole?: boolean;
  createdAt: string;
  updatedAt?: string;
  /** Number of users assigned to this role (optional) */
  userCount?: number;
} & RoleBasic;

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

/** User in list view */
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

/** Full user details */
export type UserDetail = {
  needsResetPassword: boolean;
  allowedOffices: UserOfficeAccess[];
  updatedAt: string;
} & UserListItem;

// ============================================================================
// API Response Types
// ============================================================================

/** Pagination info */
export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

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

/** User activate response */
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

/** My roles response */
export type MyRolesResponse = {
  roles: RoleBasic[];
  permissions: string[];
};

// ============================================================================
// Request Types
// ============================================================================

/** Update user request */
export type UpdateUserRequest = {
  nameFirst?: string;
  nameLast?: string;
};

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

/** Users list query params */
export type UsersListParams = {
  page?: number;
  limit?: number;
  officeId?: string;
  search?: string;
  isActive?: boolean;
};

// ============================================================================
// Office Request Types
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
// Invite Types
// ============================================================================

/** Pending invite in list view */
export type InviteListItem = {
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
};

/** Invites list response */
export type InvitesListResponse = {
  invites: InviteListItem[];
  pagination: Pagination;
};

/** Create invite request */
export type CreateInviteRequest = {
  email: string;
  roles: string[];
  /** The office to set as the user's current/active office (required) */
  currentOfficeId: string;
  /** Array of office IDs the user will have access to (required, non-empty) */
  allowedOfficeIds: string[];
};

/** Create invite response */
export type CreateInviteResponse = {
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
    /** True if this is an invite for an existing user to join another company */
    isExistingUserInvite?: boolean;
  };
  /** Token returned only in development mode */
  token?: string;
};

/** Resend invite response */
export type ResendInviteResponse = {
  message: string;
  invite: {
    id: string;
    email: string;
    expiresAt: string;
  };
  /** Token returned only in development mode */
  token?: string;
};

/** Validate invite token response */
export type ValidateInviteResponse = {
  valid: boolean;
  email: string;
  companyName: string;
  /** True if this is an invite for an existing user to join another company */
  isExistingUserInvite?: boolean;
};

/** Accept invite request */
export type AcceptInviteRequest = {
  token: string;
  /** Password is required for new users, optional for existing users */
  password?: string;
  nameFirst?: string;
  nameLast?: string;
};

/** Accept invite response */
export type AcceptInviteResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    nameFirst?: string;
    nameLast?: string;
  };
  /** True if this was an existing user joining a company */
  isExistingUserInvite?: boolean;
};

/** Invites list query params */
export type InvitesListParams = {
  page?: number;
  limit?: number;
};

/** Update invite request */
export type UpdateInviteRequest = {
  roles?: string[];
  currentOfficeId?: string;
  allowedOfficeIds?: string[];
};

/** Update invite response */
export type UpdateInviteResponse = {
  message: string;
  invite: {
    id: string;
    email: string;
    roles: string[];
    currentOffice: {
      id: string;
      name: string;
    };
    allowedOffices: string[];
    expiresAt: string;
  };
};
