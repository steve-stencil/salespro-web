/**
 * File management routes.
 * Handles updating and deleting files.
 */

import { Router } from 'express';

import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';
import { FileService, FileServiceError } from '../../services/file';

import { updateFileSchema } from './schemas';
import { handleFileServiceError, formatFileResponse } from './utils';

import type { AuthenticatedFileRequest } from './utils';
import type { FileVisibility } from '../../entities';
import type { Request, Response } from 'express';

const router: Router = Router();

/**
 * PATCH /files/:id
 * Update file metadata.
 */
router.patch(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.FILE_UPDATE),
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

      const parseResult = updateFileSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const updates = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const fileService = new FileService(em);

      // Build update object conditionally to avoid undefined values
      const updateParams: {
        filename?: string;
        visibility?: FileVisibility;
        description?: string;
      } = {};

      if (updates.filename) {
        updateParams.filename = updates.filename;
      }
      if (updates.visibility) {
        updateParams.visibility = updates.visibility;
      }
      if (updates.description !== undefined) {
        updateParams.description = updates.description ?? '';
      }

      const file = await fileService.updateFile(
        id,
        user.company.id,
        updateParams,
      );

      res.status(200).json({
        message: 'File updated',
        file: formatFileResponse(file),
      });
    } catch (err) {
      if (err instanceof FileServiceError) {
        handleFileServiceError(err, res);
        return;
      }
      req.log.error({ err }, 'Update file error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /files/:id
 * Soft delete a file.
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.FILE_DELETE),
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

      await fileService.deleteFile(id, user.company.id);

      res.status(200).json({ message: 'File deleted' });
    } catch (err) {
      if (err instanceof FileServiceError) {
        handleFileServiceError(err, res);
        return;
      }
      req.log.error({ err }, 'Delete file error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
