/**
 * File upload routes.
 * Handles server-side uploads and presigned URL generation.
 */

import { Router } from 'express';

import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { getStorageAdapter, isS3Configured } from '../../lib/storage';
import {
  requireAuth,
  requirePermission,
  uploadSingle,
  handleUploadError,
} from '../../middleware';
import { FileService, FileServiceError } from '../../services/file';

import {
  uploadOptionsSchema,
  presignRequestSchema,
  confirmUploadSchema,
} from './schemas';
import { handleFileServiceError, formatFileResponse } from './utils';

import type { AuthenticatedFileRequest } from './utils';
import type { Request, Response, NextFunction } from 'express';

const router: Router = Router();

/**
 * POST /files/upload
 * Upload a file through the server (multipart form data).
 */
router.post(
  '/upload',
  requireAuth(),
  requirePermission(PERMISSIONS.FILE_CREATE),
  uploadSingle,
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    handleUploadError(err, req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const authReq = req as Request & AuthenticatedFileRequest;
      const user = authReq.user;
      const company = authReq.companyContext;
      const file = authReq.file;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const parseResult = uploadOptionsSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { visibility, description } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const fileService = new FileService(em);

      const uploadedFile = await fileService.uploadFile({
        buffer: file.buffer,
        filename: file.originalname,
        mimeType: file.mimetype,
        user,
        company,
        ...(visibility && { visibility }),
        ...(description && { description }),
      });

      // Generate presigned URLs for the response
      const storage = getStorageAdapter();
      const url = await storage.getSignedDownloadUrl({
        key: uploadedFile.storageKey,
        expiresIn: 3600,
      });
      const thumbnailUrl = uploadedFile.thumbnailKey
        ? await storage.getSignedDownloadUrl({
            key: uploadedFile.thumbnailKey,
            expiresIn: 3600,
          })
        : null;

      res.status(201).json({
        message: 'File uploaded successfully',
        file: {
          ...formatFileResponse(uploadedFile),
          url,
          thumbnailUrl,
          isImage: uploadedFile.mimeType.startsWith('image/'),
        },
      });
    } catch (err) {
      if (err instanceof FileServiceError) {
        handleFileServiceError(err, res);
        return;
      }
      req.log.error({ err }, 'Upload file error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /files/presign
 * Request a presigned URL for direct S3 upload.
 */
router.post(
  '/presign',
  requireAuth(),
  requirePermission(PERMISSIONS.FILE_CREATE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as Request & AuthenticatedFileRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      if (!isS3Configured()) {
        res.status(501).json({
          error: 'Presigned uploads require S3 storage configuration',
          code: 'PRESIGN_NOT_SUPPORTED',
        });
        return;
      }

      const parseResult = presignRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { filename, mimeType, size, visibility, description } =
        parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const fileService = new FileService(em);

      const result = await fileService.requestPresignedUpload({
        filename,
        mimeType,
        size,
        user,
        company,
        ...(visibility && { visibility }),
        ...(description && { description }),
      });

      res.status(200).json({
        fileId: result.fileId,
        uploadUrl: result.uploadUrl,
        method: result.method,
        headers: result.headers,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      if (err instanceof FileServiceError) {
        handleFileServiceError(err, res);
        return;
      }
      req.log.error({ err }, 'Presign upload error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /files/confirm
 * Confirm a presigned upload has completed.
 */
router.post(
  '/confirm',
  requireAuth(),
  requirePermission(PERMISSIONS.FILE_CREATE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as Request & AuthenticatedFileRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = confirmUploadSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { fileId } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const fileService = new FileService(em);

      const file = await fileService.confirmPresignedUpload(fileId, user.id);

      res.status(200).json({
        message: 'Upload confirmed',
        file: formatFileResponse(file),
      });
    } catch (err) {
      if (err instanceof FileServiceError) {
        handleFileServiceError(err, res);
        return;
      }
      req.log.error({ err }, 'Confirm upload error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
