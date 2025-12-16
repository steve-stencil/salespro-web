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
