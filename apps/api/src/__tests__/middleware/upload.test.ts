/**
 * Tests for upload middleware.
 */

import { MulterError } from 'multer';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  UploadValidationError,
  handleUploadError,
} from '../../middleware/upload';

import type { Request, Response, NextFunction } from 'express';

// Mock env
vi.mock('../../config/env', () => ({
  env: {
    MAX_FILE_SIZE_MB: 10,
    ALLOWED_FILE_TYPES: 'image/*,application/pdf,.doc,.docx',
  },
}));

// Mock storage utils
vi.mock('../../lib/storage/utils', () => ({
  isFileTypeAllowed: vi.fn((mimeType: string) => {
    return (
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType === 'application/msword'
    );
  }),
}));

describe('Upload Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      log: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as unknown as Request['log'],
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('UploadValidationError', () => {
    it('should create error with message and code', () => {
      const error = new UploadValidationError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('UploadValidationError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('handleUploadError', () => {
    it('should handle MulterError for file size limit with 413 status', () => {
      const error = new MulterError('LIMIT_FILE_SIZE');

      handleUploadError(
        error,
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FILE_TOO_LARGE',
        }),
      );
    });

    it('should handle MulterError for unexpected field', () => {
      const error = new MulterError('LIMIT_UNEXPECTED_FILE');

      handleUploadError(
        error,
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNEXPECTED_FIELD',
        }),
      );
    });

    it('should handle MulterError for too many files', () => {
      const error = new MulterError('LIMIT_FILE_COUNT');

      handleUploadError(
        error,
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TOO_MANY_FILES',
        }),
      );
    });

    it('should handle UploadValidationError', () => {
      const error = new UploadValidationError(
        'Invalid file type',
        'INVALID_FILE_TYPE',
      );

      handleUploadError(
        error,
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid file type',
          code: 'INVALID_FILE_TYPE',
        }),
      );
    });

    it('should pass through non-multer/non-upload errors to next', () => {
      const error = new Error('Some other error');

      handleUploadError(
        error,
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      // Non-multer errors should be passed to next()
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without error when no error provided', () => {
      handleUploadError(
        null as unknown as Error,
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
