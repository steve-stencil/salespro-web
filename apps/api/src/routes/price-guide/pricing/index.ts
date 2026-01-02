import { Router } from 'express';

import exportImportRoutes from './export-import.routes';
import optionPricingRoutes from './options.routes';
import priceTypesRoutes from './price-types.routes';
import upchargePricingRoutes from './upcharges.routes';

import type { Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

// Option pricing management
// Note: All MSI pricing flows through options. See ADR-003.
router.use('/options', optionPricingRoutes);

// Option pricing export/import (Excel spreadsheet)
router.use('/options', exportImportRoutes);

// Upcharge pricing management (defaults and overrides)
router.use('/upcharges', upchargePricingRoutes);

// Price type management (global + company-specific)
router.use('/price-types', priceTypesRoutes);

export default router;
