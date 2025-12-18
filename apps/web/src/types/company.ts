/**
 * Company settings types.
 * Used for company-wide configuration managed from the admin dashboard.
 */

/** Company settings returned from the API */
export type CompanySettings = {
  /** Company unique identifier */
  companyId: string;
  /** Company display name */
  companyName: string;
  /** Whether MFA is required for all users in this company */
  mfaRequired: boolean;
  /** Last update timestamp */
  updatedAt: string;
};

/** API response wrapper for company settings */
export type CompanySettingsResponse = {
  /** Company settings data */
  settings: CompanySettings;
};

/** API response for update operations */
export type CompanySettingsUpdateResponse = {
  /** Success message */
  message: string;
  /** Updated company settings */
  settings: CompanySettings;
};

/** Partial settings for update requests */
export type CompanySettingsUpdate = {
  /** Set to true to require MFA for all company users */
  mfaRequired?: boolean;
};

// ============================================================================
// Multi-Company Access Types
// ============================================================================

/** Basic company info for company switching */
export type CompanyInfo = {
  /** Company unique identifier */
  id: string;
  /** Company display name */
  name: string;
  /** Whether membership is active */
  isActive?: boolean;
  /** Whether company is pinned by user */
  isPinned?: boolean;
  /** Last time user accessed this company */
  lastAccessedAt?: string;
};

/** Response from GET /users/me/companies */
export type UserCompaniesResponse = {
  /** Last 5 recently accessed companies */
  recent: CompanyInfo[];
  /** User's pinned companies */
  pinned: CompanyInfo[];
  /** Paginated search/browse results */
  results: CompanyInfo[];
  /** Total matching companies */
  total: number;
  /** Whether more results are available */
  hasMore: boolean;
};

/** Response from POST /users/me/switch-company */
export type SwitchCompanyResponse = {
  /** Success message */
  message: string;
  /** The new active company */
  activeCompany: CompanyInfo;
};

/** Response from PATCH /users/me/companies/:id (pin/unpin) */
export type PinCompanyResponse = {
  /** Success message */
  message: string;
  /** Updated pin status */
  isPinned: boolean;
};
