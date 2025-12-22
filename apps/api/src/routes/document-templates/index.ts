/**
 * Document template routes.
 * Combines all template-related route modules.
 */
import { Router } from 'express';

import ingestRoutes from './ingest.routes';

const router: Router = Router();

// Ingest routes for ETL operations
router.use('/', ingestRoutes);

export default router;
