import { Router } from 'express';

import authorizeRoutes from './authorize.routes';
import tokenRoutes from './token.routes';

import type { Router as RouterType } from 'express';

/**
 * OAuth routes module
 * Implements OAuth 2.0 Authorization Code flow with PKCE
 */
const router: RouterType = Router();

// Mount sub-routers
router.use(authorizeRoutes);
router.use(tokenRoutes);

export default router;
