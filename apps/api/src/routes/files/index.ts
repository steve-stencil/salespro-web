/**
 * File routes index.
 * Combines all file-related routes into a single router.
 */

import { Router } from 'express';

import listRoutes from './list.routes';
import manageRoutes from './manage.routes';
import serveRoutes from './serve.routes';
import uploadRoutes from './upload.routes';

const router: Router = Router();

// Upload routes (POST /upload, /presign, /confirm)
router.use('/', uploadRoutes);

// Local file serving routes for development (must be before /:id routes)
// Handles: GET /:companyId/files/:filename, GET /:companyId/thumbnails/:filename
router.use('/', serveRoutes);

// List/retrieve routes (GET /, /:id, /:id/download, /:id/thumbnail)
router.use('/', listRoutes);

// Management routes (PATCH /:id, DELETE /:id)
router.use('/', manageRoutes);

export default router;
