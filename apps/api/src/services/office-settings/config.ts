/**
 * Configuration constants for office settings.
 */

/** Logo upload validation configuration */
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
} as const;

/** Type for allowed logo MIME types */
export type LogoMimeType = (typeof LOGO_CONFIG.allowedTypes)[number];

/**
 * Check if a MIME type is valid for logo upload.
 */
export function isValidLogoMimeType(
  mimeType: string,
): mimeType is LogoMimeType {
  return LOGO_CONFIG.allowedTypes.includes(mimeType as LogoMimeType);
}
