import { Router } from 'express';

import msiPricingRoutes from './msi.routes';
import optionPricingRoutes from './options.routes';
import priceTypesRoutes from './price-types.routes';
import upchargePricingRoutes from './upcharges.routes';

import type { Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

// MSI base pricing management
router.use('/msi', msiPricingRoutes);

// Option pricing management
router.use('/options', optionPricingRoutes);

// Upcharge pricing management (defaults and overrides)
router.use('/upcharges', upchargePricingRoutes);

// Price type management (global + company-specific)
router.use('/price-types', priceTypesRoutes);

export default router;
