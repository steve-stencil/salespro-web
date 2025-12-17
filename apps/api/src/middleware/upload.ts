/**
 * File upload middleware using Multer.
 * Handles multipart/form-data uploads with validation.
 */

import multer from 'multer';

import { env } from '../config/env';
import { isFileTypeAllowed } from '../lib/storage/utils';

import type { Request, Response, RequestHandler } from 'express';
import type { FileFilterCallback } from 'multer';

/** Maximum file size in bytes (from env variable in MB) */
const MAX_FILE_SIZE = env.MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Custom error class for upload validation errors.
 */
export class UploadValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

/**
 * File filter function that validates file types.
 */
function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
): void {
  const isAllowed = isFileTypeAllowed(
    file.mimetype,
    file.originalname,
    env.ALLOWED_FILE_TYPES,
  );

  if (!isAllowed) {
    callback(
      new UploadValidationError(
        `File type not allowed: ${file.mimetype}`,
        'INVALID_FILE_TYPE',
      ),
    );
    return;
  }

  callback(null, true);
}

/**
 * Multer storage configuration using memory storage.
 * Files are stored in memory as buffers for processing before
 * uploading to S3 or local storage.
 */
const storage = multer.memoryStorage();

/**
 * Base multer configuration.
 */
const multerConfig: multer.Options = {
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Single file uploads by default
  },
};

/**
 * Single file upload middleware.
 * Expects a file in the 'file' field.
 */
export const uploadSingle: RequestHandler = multer(multerConfig).single('file');

/**
 * Multiple files upload middleware (up to 10 files).
 * Expects files in the 'files' field.
 */
export const uploadMultiple: RequestHandler = multer({
  ...multerConfig,
  limits: {
    ...multerConfig.limits,
    files: 10,
  },
}).array('files', 10);

/**
 * Create a custom upload middleware with specific field name.
 *
 * @param fieldName - The form field name for the file
 * @returns Multer middleware
 */
export function createUploadMiddleware(
  fieldName: string,
): ReturnType<multer.Multer['single']> {
  return multer({
    ...multerConfig,
  }).single(fieldName);
}

/**
 * Error handler middleware for multer errors.
 * Should be used after upload middleware.
 */
export function handleUploadError(
  err: Error,
  _req: Request,
  res: Response,
  next: () => void,
): void {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(413).json({
          error: `File too large. Maximum size is ${env.MAX_FILE_SIZE_MB}MB.`,
          code: 'FILE_TOO_LARGE',
        });
        return;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          error: 'Too many files.',
          code: 'TOO_MANY_FILES',
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          error: `Unexpected field: ${err.field}`,
          code: 'UNEXPECTED_FIELD',
        });
        return;
      default:
        res.status(400).json({
          error: err.message,
          code: 'UPLOAD_ERROR',
        });
        return;
    }
  }

  if (err instanceof UploadValidationError) {
    res.status(400).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Pass other errors to the next error handler
  next();
}
