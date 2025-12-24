/**
 * Mobile routes.
 * Combines all mobile app-related route modules.
 */
import { Router } from 'express';

import templatesRoutes from './templates.routes';

const router: Router = Router();

// Template routes for template selection workflow
router.use('/templates', templatesRoutes);

export default router;
