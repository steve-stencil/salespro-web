/**
 * Types for platform management (internal users and admin functions).
 */

// ============================================================================
// Internal User Types
// ============================================================================

/** Internal user in list view */
export type InternalUserListItem = {
  id: string;
  email: string;
  nameFirst?: string;
  nameLast?: string;
  isActive: boolean;
  mfaEnabled: boolean;
  emailVerified: boolean;
  accessLevel: 'full' | 'restricted' | 'readonly';
  lastLoginDate?: string;
  createdAt: string;
};

/** Full internal user details */
export type InternalUserDetail = {
  needsResetPassword: boolean;
  updatedAt: string;
  roles: {
    id: string;
    name: string;
    displayName: string;
  }[];
} & InternalUserListItem;

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
