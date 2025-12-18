/**
 * Office settings types for frontend.
 * Mirrors the API response types for office settings management.
 */

/** Logo information returned from the API */
export type LogoInfo = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  filename: string;
};

/** Office settings response from the API */
export type OfficeSettingsResponse = {
  id: string;
  officeId: string;
  logo: LogoInfo | null;
  createdAt: string;
  updatedAt: string;
};

/** Response wrapper for GET /offices/:id/settings */
export type GetOfficeSettingsResponse = {
  settings: OfficeSettingsResponse;
};

/** Response for POST /offices/:id/settings/logo */
export type UploadLogoResponse = {
  message: string;
  settings: OfficeSettingsResponse;
};

/** Response for DELETE /offices/:id/settings/logo */
export type RemoveLogoResponse = {
  message: string;
  settings: OfficeSettingsResponse;
};

/** Logo upload configuration (matches backend config) */
export const LOGO_CONFIG = {
  /** Maximum file size in bytes (2MB) */
  maxSizeBytes: 2 * 1024 * 1024,
  /** Maximum logo width in pixels */
  maxWidth: 1024,
  /** Maximum logo height in pixels */
  maxHeight: 1024,
  /** Minimum logo width in pixels */
  minWidth: 64,
  /** Minimum logo height in pixels */
  minHeight: 64,
  /** Allowed MIME types for logo upload */
  allowedTypes: ['image/png', 'image/jpeg', 'image/webp'] as const,
  /** Human-readable file extensions */
  allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'] as const,
} as const;

/** Type for allowed logo MIME types */
export type LogoMimeType = (typeof LOGO_CONFIG.allowedTypes)[number];

/**
 * Check if a file type is valid for logo upload.
 */
export function isValidLogoType(mimeType: string): mimeType is LogoMimeType {
  return LOGO_CONFIG.allowedTypes.includes(mimeType as LogoMimeType);
}

/**
 * Get human-readable file size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
