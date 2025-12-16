/**
 * Tests for storage utility functions.
 */

import { describe, it, expect } from 'vitest';

import {
  generateStorageKey,
  generateThumbnailKey,
  getFileExtension,
  mimeTypeToExtension,
  isImageMimeType,
  sanitizeFilename,
  parseAllowedFileTypes,
  isFileTypeAllowed,
} from '../../../lib/storage/utils';

describe('Storage Utils', () => {
  describe('generateStorageKey', () => {
    it('should generate a company-scoped storage key', () => {
      const key = generateStorageKey('company-123', 'file-456', 'pdf');
      expect(key).toBe('company-123/files/file-456.pdf');
    });

    it('should strip leading dot from extension', () => {
      const key = generateStorageKey('company-123', 'file-456', '.pdf');
      expect(key).toBe('company-123/files/file-456.pdf');
    });
  });

  describe('generateThumbnailKey', () => {
    it('should generate a company-scoped thumbnail key', () => {
      const key = generateThumbnailKey('company-123', 'file-456', 'jpg');
      expect(key).toBe('company-123/thumbnails/file-456_thumb.jpg');
    });

    it('should strip leading dot from extension', () => {
      const key = generateThumbnailKey('company-123', 'file-456', '.jpg');
      expect(key).toBe('company-123/thumbnails/file-456_thumb.jpg');
    });
  });

  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('image.JPEG')).toBe('jpeg');
      expect(getFileExtension('file.name.with.dots.txt')).toBe('txt');
    });

    it('should fallback to MIME type when no extension', () => {
      expect(getFileExtension('noextension', 'image/jpeg')).toBe('jpg');
      expect(getFileExtension('noextension', 'application/pdf')).toBe('pdf');
    });

    it('should return bin for unknown types', () => {
      expect(getFileExtension('noextension')).toBe('bin');
      expect(getFileExtension('noextension', 'application/unknown')).toBe(
        'bin',
      );
    });
  });

  describe('mimeTypeToExtension', () => {
    it('should convert common MIME types', () => {
      expect(mimeTypeToExtension('image/jpeg')).toBe('jpg');
      expect(mimeTypeToExtension('image/png')).toBe('png');
      expect(mimeTypeToExtension('application/pdf')).toBe('pdf');
      expect(mimeTypeToExtension('text/plain')).toBe('txt');
    });

    it('should return bin for unknown MIME types', () => {
      expect(mimeTypeToExtension('application/unknown')).toBe('bin');
    });
  });

  describe('isImageMimeType', () => {
    it('should return true for image MIME types', () => {
      expect(isImageMimeType('image/jpeg')).toBe(true);
      expect(isImageMimeType('image/png')).toBe(true);
      expect(isImageMimeType('image/gif')).toBe(true);
      expect(isImageMimeType('image/webp')).toBe(true);
    });

    it('should return false for non-image MIME types', () => {
      expect(isImageMimeType('application/pdf')).toBe(false);
      expect(isImageMimeType('text/plain')).toBe(false);
      expect(isImageMimeType('video/mp4')).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove path separators', () => {
      expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
      expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
    });

    it('should remove leading dots', () => {
      expect(sanitizeFilename('.hidden')).toBe('hidden');
      expect(sanitizeFilename('..hidden')).toBe('hidden');
    });

    it('should handle empty result', () => {
      expect(sanitizeFilename('...')).toBe('unnamed');
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });
  });

  describe('parseAllowedFileTypes', () => {
    it('should parse MIME patterns', () => {
      const result = parseAllowedFileTypes('image/*,application/pdf');
      expect(result.mimePatterns).toContain('image/*');
      expect(result.mimePatterns).toContain('application/pdf');
    });

    it('should parse extensions', () => {
      const result = parseAllowedFileTypes('.pdf,.doc,.docx');
      expect(result.extensions).toContain('.pdf');
      expect(result.extensions).toContain('.doc');
      expect(result.extensions).toContain('.docx');
    });

    it('should parse mixed types', () => {
      const result = parseAllowedFileTypes('image/*,.pdf,application/json');
      expect(result.mimePatterns).toContain('image/*');
      expect(result.mimePatterns).toContain('application/json');
      expect(result.extensions).toContain('.pdf');
    });
  });

  describe('isFileTypeAllowed', () => {
    const allowedTypes = 'image/*,application/pdf,.doc,.docx';

    it('should allow matching MIME patterns', () => {
      expect(isFileTypeAllowed('image/jpeg', 'photo.jpg', allowedTypes)).toBe(
        true,
      );
      expect(isFileTypeAllowed('image/png', 'image.png', allowedTypes)).toBe(
        true,
      );
    });

    it('should allow exact MIME matches', () => {
      expect(
        isFileTypeAllowed('application/pdf', 'document.pdf', allowedTypes),
      ).toBe(true);
    });

    it('should allow matching extensions', () => {
      expect(
        isFileTypeAllowed('application/msword', 'document.doc', allowedTypes),
      ).toBe(true);
      expect(
        isFileTypeAllowed(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'document.docx',
          allowedTypes,
        ),
      ).toBe(true);
    });

    it('should reject non-matching types', () => {
      expect(isFileTypeAllowed('video/mp4', 'video.mp4', allowedTypes)).toBe(
        false,
      );
      expect(isFileTypeAllowed('text/plain', 'file.txt', allowedTypes)).toBe(
        false,
      );
    });
  });
});
