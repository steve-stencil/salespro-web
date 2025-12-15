import { Router } from 'express';

import loginRoutes from './login.routes';
import mfaRoutes from './mfa.routes';
import passwordRoutes from './password.routes';
import sessionRoutes from './session.routes';

import type { Router as RouterType } from 'express';

/**
 * Auth routes module
 * Combines login, session, MFA, and password management routes
 */
const router: RouterType = Router();

// Mount sub-routers
router.use(loginRoutes);
router.use(mfaRoutes);
router.use(sessionRoutes);
router.use(passwordRoutes);

export default router;
