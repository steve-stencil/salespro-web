/**
 * Types for office integration service.
 */

/** Error codes for office integration operations */
export enum OfficeIntegrationErrorCode {
  OFFICE_NOT_FOUND = 'OFFICE_NOT_FOUND',
  INTEGRATION_NOT_FOUND = 'INTEGRATION_NOT_FOUND',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  MISSING_ENCRYPTION_KEY = 'MISSING_ENCRYPTION_KEY',
  CROSS_COMPANY_ACCESS = 'CROSS_COMPANY_ACCESS',
  DUPLICATE_INTEGRATION = 'DUPLICATE_INTEGRATION',
}

/** Error thrown by office integration operations */
export class OfficeIntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: OfficeIntegrationErrorCode,
  ) {
    super(message);
    this.name = 'OfficeIntegrationError';
  }
}

/** Integration credentials (arbitrary JSON structure) */
export type IntegrationCredentials = Record<string, unknown>;

/** Integration configuration (non-sensitive) */
export type IntegrationConfig = Record<string, unknown>;

/** Integration API response (without decrypted credentials) */
export type OfficeIntegrationResponse = {
  id: string;
  officeId: string;
  integrationKey: string;
  displayName: string;
  hasCredentials: boolean;
  config: IntegrationConfig | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Integration response with decrypted credentials */
export type OfficeIntegrationWithCredentials = OfficeIntegrationResponse & {
  credentials: IntegrationCredentials | null;
};

/** Parameters for creating/updating an integration */
export type UpsertIntegrationParams = {
  officeId: string;
  companyId: string;
  integrationKey: string;
  displayName: string;
  credentials?: IntegrationCredentials;
  config?: IntegrationConfig;
  isEnabled?: boolean;
};

/** List integrations options */
export type ListIntegrationsOptions = {
  enabledOnly?: boolean;
};
