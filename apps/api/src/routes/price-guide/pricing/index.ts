import { Router } from 'express';

import optionPricingRoutes from './options.routes';
import priceTypesRoutes from './price-types.routes';
import upchargePricingRoutes from './upcharges.routes';

import type { Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

// Option pricing management (includes export/import routes)
// Note: All MSI pricing flows through options. See ADR-003.
router.use('/options', optionPricingRoutes);

// Upcharge pricing management (defaults and overrides)
router.use('/upcharges', upchargePricingRoutes);

// Price type management (global + company-specific)
router.use('/price-types', priceTypesRoutes);

export default router;
