/**
 * Office settings routes index.
 * Combines settings and integrations routes.
 */

import { Router } from 'express';

import integrationsRoutes from './integrations.routes';
import settingsRoutes from './settings.routes';

const router: Router = Router({ mergeParams: true });

// Office settings routes (GET /settings, POST/DELETE /settings/logo)
router.use('/settings', settingsRoutes);

// Office integrations routes (GET/PUT/DELETE /integrations/:key)
router.use('/integrations', integrationsRoutes);

export default router;
