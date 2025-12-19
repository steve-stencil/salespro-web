import { Router } from 'express';

import categoriesRoutes from './categories.routes';
import itemsRoutes from './items.routes';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// Price guide category routes
router.use('/categories', categoriesRoutes);

// Measure sheet item routes
router.use('/items', itemsRoutes);

export default router;
