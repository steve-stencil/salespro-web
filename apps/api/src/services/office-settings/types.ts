/**
 * Types for office settings service.
 */

import type { File } from '../../entities';

/** Error codes for office settings operations */
export enum OfficeSettingsErrorCode {
  OFFICE_NOT_FOUND = 'OFFICE_NOT_FOUND',
  SETTINGS_NOT_FOUND = 'SETTINGS_NOT_FOUND',
  LOGO_NOT_FOUND = 'LOGO_NOT_FOUND',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_DIMENSIONS = 'INVALID_DIMENSIONS',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  CROSS_COMPANY_ACCESS = 'CROSS_COMPANY_ACCESS',
}

/** Error thrown by office settings operations */
export class OfficeSettingsError extends Error {
  constructor(
    message: string,
    public readonly code: OfficeSettingsErrorCode,
  ) {
    super(message);
    this.name = 'OfficeSettingsError';
  }
}

/** Logo information in API response */
export type LogoInfo = {
  /** CompanyLogo ID */
  id: string;
  /** Logo name in the library */
  name: string;
  /** Signed URL for full logo */
  url: string;
  /** Signed URL for thumbnail (may be null) */
  thumbnailUrl: string | null;
  /** Original filename */
  filename: string;
};

/** Source of the logo being displayed */
export type LogoSource = 'office' | 'company' | 'none';

/** Office settings API response */
export type OfficeSettingsResponse = {
  id: string;
  officeId: string;
  /** Selected logo from company library (null if using inheritance or no logo) */
  logo: LogoInfo | null;
  /** Company's default logo (for fallback display) */
  companyDefaultLogo: LogoInfo | null;
  /** Where the displayed logo comes from */
  logoSource: LogoSource;
  createdAt: Date;
  updatedAt: Date;
};

/** Parameters for selecting a logo from the library */
export type SelectLogoParams = {
  officeId: string;
  companyId: string;
  /** CompanyLogo ID from the library */
  logoId: string;
};

/** Parameters for uploading a new logo (adds to library and assigns) */
export type UploadLogoParams = {
  officeId: string;
  companyId: string;
  file: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
  user: {
    id: string;
    company: { id: string };
  };
  /** Optional name for the logo in the library */
  logoName?: string;
};

/** Result of logo validation */
export type LogoValidationResult = {
  valid: boolean;
  error?: string;
  code?: OfficeSettingsErrorCode;
  dimensions?: {
    width: number;
    height: number;
  };
};

/** Internal file reference type */
export type FileRef = Pick<
  File,
  'id' | 'storageKey' | 'thumbnailKey' | 'filename'
>;
