/**
 * File listing and retrieval routes.
 * Handles listing files, getting metadata, and download URLs.
 */

import { Router } from 'express';

import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';
import { FileService, FileServiceError } from '../../services/file';

import { listFilesSchema } from './schemas';
import { handleFileServiceError, formatFileResponse } from './utils';

import type { AuthenticatedFileRequest } from './utils';
import type { Request, Response } from 'express';

const router: Router = Router();

/**
 * GET /files
 * List files for the company with pagination and filters.
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.FILE_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as Request & AuthenticatedFileRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = listFilesSchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { page, limit, uploadedBy, mimeType, visibility } =
        parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const fileService = new FileService(em);

      const result = await fileService.listFiles(user.company.id, {
        ...(page !== undefined && { page }),
        ...(limit !== undefined && { limit }),
        ...(uploadedBy && { uploadedBy }),
        ...(mimeType && { mimeType }),
        ...(visibility && { visibility }),
      });

      res.status(200).json({
        files: result.files.map(formatFileResponse),
        pagination: {
          page: result.page,
          limit: limit ?? 20,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'List files error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /files/:id
 * Get file metadata by ID.
 */
router.get(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.FILE_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as Request & AuthenticatedFileRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'File ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const fileService = new FileService(em);

      const file = await fileService.getFile(id, user.company.id, user.id);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      res.status(200).json({ file: formatFileResponse(file) });
    } catch (err) {
      req.log.error({ err }, 'Get file error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /files/:id/download
 * Get a download URL for a file.
 */
router.get(
  '/:id/download',
  requireAuth(),
  requirePermission(PERMISSIONS.FILE_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as Request & AuthenticatedFileRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'File ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const fileService = new FileService(em);

      const downloadUrl = await fileService.getDownloadUrl(
        id,
        user.company.id,
        user.id,
      );

      res.status(200).json({ downloadUrl });
    } catch (err) {
      if (err instanceof FileServiceError) {
        handleFileServiceError(err, res);
        return;
      }
      req.log.error({ err }, 'Get download URL error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /files/:id/thumbnail
 * Get a download URL for a file's thumbnail.
 */
router.get(
  '/:id/thumbnail',
  requireAuth(),
  requirePermission(PERMISSIONS.FILE_READ),
  async (req: Request, res: Response) => {
    try {
      const user = (req as Request & AuthenticatedFileRequest).user;
      if (!user?.company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'File ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const fileService = new FileService(em);

      const thumbnailUrl = await fileService.getThumbnailUrl(
        id,
        user.company.id,
        user.id,
      );

      if (!thumbnailUrl) {
        res.status(404).json({ error: 'Thumbnail not available' });
        return;
      }

      res.status(200).json({ thumbnailUrl });
    } catch (err) {
      req.log.error({ err }, 'Get thumbnail URL error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
