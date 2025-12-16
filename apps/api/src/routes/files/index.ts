/**
 * File routes index.
 * Combines all file-related routes into a single router.
 */

import { Router } from 'express';

import listRoutes from './list.routes';
import manageRoutes from './manage.routes';
import uploadRoutes from './upload.routes';

const router = Router();

// Upload routes (POST /upload, /presign, /confirm)
router.use('/', uploadRoutes);

// List/retrieve routes (GET /, /:id, /:id/download, /:id/thumbnail)
router.use('/', listRoutes);

// Management routes (PATCH /:id, DELETE /:id)
router.use('/', manageRoutes);

export default router;
