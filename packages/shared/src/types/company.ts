/**
 * Company types shared between API and web applications.
 * These types define the contract for company-related API endpoints.
 */

// ============================================================================
// Company Logo Types
// ============================================================================

/** Company logo information */
export type CompanyLogoInfo = {
  /** Logo file ID */
  id: string;
  /** Signed URL for full logo */
  url: string;
  /** Signed URL for thumbnail (may be null) */
  thumbnailUrl: string | null;
  /** Original filename */
  filename: string;
};

// ============================================================================
// Company Settings Types
// ============================================================================

/** Company settings entity */
export type CompanySettings = {
  /** Company unique identifier */
  companyId: string;
  /** Company display name */
  companyName: string;
  /** Whether MFA is required for all users in this company */
  mfaRequired: boolean;
  /** Company logo information (null if no logo set) */
  logo: CompanyLogoInfo | null;
  /** Last update timestamp */
  updatedAt: string;
};

// ============================================================================
// Company API Response Types
// ============================================================================

/** Company settings response */
export type CompanySettingsResponse = {
  settings: CompanySettings;
};

/** Company settings update response */
export type CompanySettingsUpdateResponse = {
  message: string;
  settings: CompanySettings;
};

// ============================================================================
// Company API Request Types
// ============================================================================

/** Company settings update request */
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
