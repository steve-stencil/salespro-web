/**
 * Local file serving routes.
 * Serves files directly from local storage for development.
 * In production with S3, files are served via signed URLs directly from S3.
 */

import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { Router } from 'express';

import { isS3Configured } from '../../lib/storage';

import type { Request, Response } from 'express';

const router: Router = Router();

/** Base path for local uploads */
const UPLOADS_BASE = path.resolve('./uploads');

/** Map extensions to MIME types */
const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

/**
 * GET /files/:companyId/files/:filename
 * Serve a file from local storage.
 * Only available when S3 is not configured (local development).
 */
router.get(
  '/:companyId/files/:filename',
  async (req: Request, res: Response) => {
    // Only serve files locally when S3 is not configured
    if (isS3Configured()) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    try {
      const { companyId, filename } = req.params;
      if (!companyId || !filename) {
        res.status(400).json({ error: 'Invalid request' });
        return;
      }

      // Sanitize and validate path components
      const safeCompanyId = companyId.replace(/[^a-zA-Z0-9-]/g, '');
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');

      // Construct file path
      const filePath = path.join(
        UPLOADS_BASE,
        safeCompanyId,
        'files',
        safeFilename,
      );

      // Verify the path is within uploads directory (prevent traversal)
      const realPath = await fs.realpath(filePath).catch(() => null);
      if (!realPath?.startsWith(UPLOADS_BASE)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Check file exists
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat?.isFile()) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Determine MIME type
      const ext = path.extname(safeFilename).toLowerCase();
      const mimeType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

      // Set headers and stream file
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=3600');

      createReadStream(filePath).pipe(res);
    } catch (err) {
      req.log.error({ err }, 'Serve file error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /files/:companyId/thumbnails/:filename
 * Serve a thumbnail from local storage.
 * Only available when S3 is not configured (local development).
 */
router.get(
  '/:companyId/thumbnails/:filename',
  async (req: Request, res: Response) => {
    // Only serve files locally when S3 is not configured
    if (isS3Configured()) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    try {
      const { companyId, filename } = req.params;
      if (!companyId || !filename) {
        res.status(400).json({ error: 'Invalid request' });
        return;
      }

      // Sanitize and validate path components
      const safeCompanyId = companyId.replace(/[^a-zA-Z0-9-]/g, '');
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');

      // Construct file path
      const filePath = path.join(
        UPLOADS_BASE,
        safeCompanyId,
        'thumbnails',
        safeFilename,
      );

      // Verify the path is within uploads directory (prevent traversal)
      const realPath = await fs.realpath(filePath).catch(() => null);
      if (!realPath?.startsWith(UPLOADS_BASE)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Check file exists
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat?.isFile()) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Determine MIME type
      const ext = path.extname(safeFilename).toLowerCase();
      const mimeType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

      // Set headers and stream file
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=3600');

      createReadStream(filePath).pipe(res);
    } catch (err) {
      req.log.error({ err }, 'Serve thumbnail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
