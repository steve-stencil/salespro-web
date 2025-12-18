/**
 * User invitation types shared between API and web applications.
 * These types define the contract for user invitation API endpoints.
 */

import type { Pagination, PaginationParams } from './api/pagination';

// ============================================================================
// Invite Entity Types
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

// ============================================================================
// Invite API Response Types
// ============================================================================

/** Invites list response */
export type InvitesListResponse = {
  invites: InviteListItem[];
  pagination: Pagination;
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
    /** True if the invite is for an existing user (adding to another company) */
    isExistingUserInvite?: boolean;
  };
  /** Token returned only in development mode for testing */
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
  /** Token returned only in development mode for testing */
  token?: string;
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

/** Validate invite token response (public endpoint) */
export type ValidateInviteResponse = {
  valid: boolean;
  email: string;
  companyName: string;
  /** True if the invite is for an existing user (adding to another company) */
  isExistingUserInvite?: boolean;
};

/** Accept invite response (public endpoint) */
export type AcceptInviteResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    nameFirst?: string;
    nameLast?: string;
  };
};

// ============================================================================
// Invite API Request Types
// ============================================================================

/** Create invite request */
export type CreateInviteRequest = {
  email: string;
  roles: string[];
  /** The office to set as the user's current/active office (required) */
  currentOfficeId: string;
  /** Array of office IDs the user will have access to (required, non-empty) */
  allowedOfficeIds: string[];
};

/** Update invite request */
export type UpdateInviteRequest = {
  roles?: string[];
  currentOfficeId?: string;
  allowedOfficeIds?: string[];
};

/** Accept invite request (public endpoint) */
export type AcceptInviteRequest = {
  token: string;
  /** Password is required for new users, optional for existing users */
  password?: string;
  nameFirst?: string;
  nameLast?: string;
};

/** Invites list query params */
export type InvitesListParams = PaginationParams;
