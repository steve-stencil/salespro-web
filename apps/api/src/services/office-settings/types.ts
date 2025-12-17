/**
 * Types for office settings service.
 */

import type { File } from '../../entities';

/** Error codes for office settings operations */
export enum OfficeSettingsErrorCode {
  OFFICE_NOT_FOUND = 'OFFICE_NOT_FOUND',
  SETTINGS_NOT_FOUND = 'SETTINGS_NOT_FOUND',
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
  id: string;
  url: string;
  thumbnailUrl: string | null;
  filename: string;
};

/** Office settings API response */
export type OfficeSettingsResponse = {
  id: string;
  officeId: string;
  logo: LogoInfo | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Parameters for uploading a logo */
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
