/**
 * Storage utility functions for key generation and file handling.
 */

import path from 'path';

/**
 * Generate a company-scoped storage key for a file.
 * Format: {companyId}/files/{fileId}.{ext}
 *
 * @param companyId - The company's UUID
 * @param fileId - The file's UUID
 * @param ext - File extension (without leading dot)
 * @returns The full storage key
 */
export function generateStorageKey(
  companyId: string,
  fileId: string,
  ext: string,
): string {
  const cleanExt = ext.replace(/^\./, '');
  return `${companyId}/files/${fileId}.${cleanExt}`;
}

/**
 * Generate a company-scoped storage key for a thumbnail.
 * Format: {companyId}/thumbnails/{fileId}_thumb.{ext}
 *
 * @param companyId - The company's UUID
 * @param fileId - The file's UUID
 * @param ext - File extension (without leading dot)
 * @returns The full storage key for the thumbnail
 */
export function generateThumbnailKey(
  companyId: string,
  fileId: string,
  ext: string,
): string {
  const cleanExt = ext.replace(/^\./, '');
  return `${companyId}/thumbnails/${fileId}_thumb.${cleanExt}`;
}

/**
 * Extract file extension from a filename or MIME type.
 *
 * @param filename - Original filename
 * @param mimeType - MIME type of the file
 * @returns File extension without the leading dot
 */
export function getFileExtension(filename: string, mimeType?: string): string {
  // Try to get extension from filename first
  const ext = path.extname(filename).toLowerCase().replace(/^\./, '');
  if (ext) {
    return ext;
  }

  // Fall back to MIME type mapping
  if (mimeType) {
    return mimeTypeToExtension(mimeType);
  }

  return 'bin';
}

/**
 * Map common MIME types to file extensions.
 */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/json': 'json',
};

/**
 * Convert a MIME type to a file extension.
 *
 * @param mimeType - The MIME type to convert
 * @returns The file extension without leading dot
 */
export function mimeTypeToExtension(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? 'bin';
}

/**
 * Check if a MIME type represents an image.
 *
 * @param mimeType - The MIME type to check
 * @returns True if the MIME type is an image type
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Sanitize a filename by removing path traversal characters and special chars.
 *
 * @param filename - The original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let safe = filename.replace(/[/\\:\0]/g, '_');

  // Remove leading dots (hidden files)
  safe = safe.replace(/^\.+/, '');

  // Limit length
  if (safe.length > 255) {
    const ext = path.extname(safe);
    const name = path.basename(safe, ext);
    safe = name.substring(0, 255 - ext.length) + ext;
  }

  return safe || 'unnamed';
}

/**
 * Parse allowed file types from environment variable format.
 * Supports MIME types (image/*) and extensions (.pdf, .doc)
 *
 * @param allowedTypes - Comma-separated list of allowed types
 * @returns Object with mimePatterns and extensions arrays
 */
export function parseAllowedFileTypes(allowedTypes: string): {
  mimePatterns: string[];
  extensions: string[];
} {
  const parts = allowedTypes.split(',').map(s => s.trim());
  const mimePatterns: string[] = [];
  const extensions: string[] = [];

  for (const part of parts) {
    if (part.startsWith('.')) {
      extensions.push(part.toLowerCase());
    } else if (part.includes('/')) {
      mimePatterns.push(part.toLowerCase());
    }
  }

  return { mimePatterns, extensions };
}

/**
 * Check if a file is allowed based on MIME type and extension.
 *
 * @param mimeType - The file's MIME type
 * @param filename - The file's name
 * @param allowedTypes - Comma-separated list of allowed types
 * @returns True if the file is allowed
 */
export function isFileTypeAllowed(
  mimeType: string,
  filename: string,
  allowedTypes: string,
): boolean {
  const { mimePatterns, extensions } = parseAllowedFileTypes(allowedTypes);
  const ext = path.extname(filename).toLowerCase();
  const mime = mimeType.toLowerCase();

  // Check extension allowlist
  if (extensions.includes(ext)) {
    return true;
  }

  // Check MIME patterns (supports wildcards like image/*)
  for (const pattern of mimePatterns) {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1);
      if (mime.startsWith(prefix)) {
        return true;
      }
    } else if (mime === pattern) {
      return true;
    }
  }

  return false;
}
