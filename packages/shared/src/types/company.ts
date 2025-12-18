/**
 * Company types shared between API and web applications.
 * These types define the contract for company-related API endpoints.
 */

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
