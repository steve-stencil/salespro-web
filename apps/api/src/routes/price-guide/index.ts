import { Router } from 'express';

import categoryRoutes from './categories.routes';
import additionalDetailsLibraryRoutes from './library/additional-details.routes';
import optionsLibraryRoutes from './library/options.routes';
import upchargesLibraryRoutes from './library/upcharges.routes';
import measureSheetItemRoutes from './measure-sheet-items.routes';
import pricingRoutes from './pricing';

import type { Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

// Category management
router.use('/categories', categoryRoutes);

// Measure sheet items
router.use('/measure-sheet-items', measureSheetItemRoutes);

// Library routes
router.use('/library/options', optionsLibraryRoutes);
router.use('/library/upcharges', upchargesLibraryRoutes);
router.use('/library/additional-details', additionalDetailsLibraryRoutes);

// Pricing routes
router.use('/pricing', pricingRoutes);

export default router;
