/**
 * Types for platform management (internal users and admin functions).
 */

// ============================================================================
// Internal User Types
// ============================================================================

/** Platform role info */
export type PlatformRole = {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  companyAccessLevel?: 'full' | 'restricted' | 'readonly';
  permissions?: string[];
};

/** Internal user in list view */
export type InternalUserListItem = {
  id: string;
  email: string;
  nameFirst?: string;
  nameLast?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginDate?: string;
  platformRole: PlatformRole | null;
};

/** Full internal user details */
export type InternalUserDetail = {
  id: string;
  email: string;
  nameFirst?: string;
  nameLast?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginDate?: string;
  platformRole: PlatformRole | null;
};

// ============================================================================
// Internal User API Request/Response Types
// ============================================================================

/** Response from GET /internal-users */
export type InternalUsersListResponse = {
  users: InternalUserListItem[];
  total: number;
};

/** Response from GET /internal-users/:id */
export type InternalUserDetailResponse = InternalUserDetail;

/** Response from GET /internal-users/roles */
export type PlatformRolesResponse = {
  roles: PlatformRole[];
};

/** Request body for POST /internal-users */
export type CreateInternalUserRequest = {
  email: string;
  password: string;
  nameFirst?: string;
  nameLast?: string;
  platformRoleId: string;
};

/** Response from POST /internal-users */
export type CreateInternalUserResponse = {
  id: string;
  email: string;
  nameFirst?: string;
  nameLast?: string;
  isActive: boolean;
  platformRole: PlatformRole;
};

/** Request body for PATCH /internal-users/:id */
export type UpdateInternalUserRequest = {
  email?: string;
  nameFirst?: string;
  nameLast?: string;
  isActive?: boolean;
  platformRoleId?: string;
};

/** Response from PATCH /internal-users/:id */
export type UpdateInternalUserResponse = {
  id: string;
  email: string;
  nameFirst?: string;
  nameLast?: string;
  isActive: boolean;
  platformRole: PlatformRole | null;
};

// ============================================================================
// Internal User Company Access Types
// ============================================================================

/** Company access record for an internal user */
export type InternalUserCompanyAccess = {
  id: string;
  name: string;
  isActive: boolean;
  isPinned: boolean;
  grantedAt: string;
  lastAccessedAt?: string;
  grantedBy?: {
    id: string;
    email: string;
    nameFirst?: string;
    nameLast?: string;
  } | null;
};

/** Response from GET /internal-users/:id/companies */
export type InternalUserCompaniesResponse = {
  /** Whether the user has any company restrictions */
  hasRestrictions: boolean;
  /** List of companies the user has access to (empty if unrestricted) */
  companies: InternalUserCompanyAccess[];
  /** Total number of company access records */
  total: number;
};

/** Response from POST /internal-users/:id/companies */
export type AddInternalUserCompanyResponse = {
  message: string;
  access: {
    companyId: string;
    companyName: string;
    grantedAt: string;
  };
};

/** Response from DELETE /internal-users/:id/companies/:companyId */
export type RemoveInternalUserCompanyResponse = {
  message: string;
};

// ============================================================================
// Platform Companies Types
// ============================================================================

/** Company info for platform views */
export type PlatformCompany = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

/** Response from GET /platform/companies */
export type PlatformCompaniesResponse = {
  companies: PlatformCompany[];
  total: number;
};
