/**
 * Company types.
 * Re-exports shared types for company configuration and multi-company access.
 */

import type { CompanySettings as SharedCompanySettings } from '@shared/core';

export type {
  CompanySettings,
  CompanySettingsResponse,
  CompanySettingsUpdateResponse,
  CompanySettingsUpdate,
  CompanyLogoInfo,
  CompanyInfo,
  UserCompaniesResponse,
  SwitchCompanyResponse,
  PinCompanyResponse,
  // Logo library types
  CompanyLogoLibraryItem,
  CompanyLogoLibraryResponse,
  AddLogoToLibraryResponse,
  UpdateLogoResponse,
  DeleteLogoResponse,
  SetDefaultLogoResponse,
} from '@shared/core';

/** Response for company logo upload (deprecated - use logo library) */
export type UploadCompanyLogoResponse = {
  message: string;
  settings: SharedCompanySettings;
};

/** Response for company logo removal (deprecated - use logo library) */
export type RemoveCompanyLogoResponse = {
  message: string;
  settings: SharedCompanySettings;
};
