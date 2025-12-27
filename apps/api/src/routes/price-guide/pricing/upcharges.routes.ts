import { Router } from 'express';
import { z } from 'zod';

import {
  UpCharge,
  UpChargePrice,
  UpChargePricePercentageBase,
  PriceGuideOption,
  PriceObjectType,
  Office,
  User,
} from '../../../entities';
import { getORM } from '../../../lib/db';
import { PERMISSIONS } from '../../../lib/permissions';
import { requireAuth, requirePermission } from '../../../middleware';

import type { Company } from '../../../entities';
import type { AuthenticatedRequest } from '../../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const priceUpdateSchema = z.object({
  priceTypeId: z.string().uuid(),
  amount: z.coerce.number().min(0),
  isPercentage: z.boolean().optional().default(false),
  percentageBaseTypeIds: z.array(z.string().uuid()).optional(),
});

const updateDefaultPricesSchema = z.object({
  officeId: z.string().uuid(),
  prices: z.array(priceUpdateSchema),
  version: z.number().int().min(1),
});

const updateOverridePricesSchema = z.object({
  optionId: z.string().uuid(),
  officeId: z.string().uuid(),
  prices: z.array(priceUpdateSchema),
  version: z.number().int().min(1),
});

// ============================================================================
// Helper Functions
// ============================================================================

function getCompanyContext(
  req: Request,
): { user: User; company: Company } | null {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  const company = authReq.companyContext;
  return user && company ? { user, company } : null;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /price-guide/pricing/upcharges/:upchargeId
 * Get all prices for an upcharge (defaults and overrides)
 */
router.get(
  '/:upchargeId',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { upchargeId } = req.params;
      if (!upchargeId) {
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify upcharge exists
      const upcharge = await em.findOne(UpCharge, {
        id: upchargeId,
        company: company.id,
      });

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Get all prices (defaults and overrides)
      const prices = await em.find(
        UpChargePrice,
        { upCharge: upchargeId },
        {
          populate: ['office', 'priceType', 'option', 'percentageBase'],
          orderBy: { office: { name: 'ASC' }, priceType: { sortOrder: 'ASC' } },
        },
      );

      // Get price types
      const priceTypes = await em.find(
        PriceObjectType,
        { $or: [{ company: null }, { company: company.id }], isActive: true },
        { orderBy: { sortOrder: 'ASC' } },
      );

      // Get offices
      const offices = await em.find(
        Office,
        { company: company.id, isActive: true },
        { orderBy: { name: 'ASC' } },
      );

      // Separate defaults from overrides
      const defaultPrices: Record<
        string,
        {
          office: { id: string; name: string };
          prices: Record<
            string,
            {
              amount: number;
              isPercentage: boolean;
              percentageBaseTypeIds: string[];
            }
          >;
        }
      > = {};

      const overridePrices: Record<
        string,
        {
          option: { id: string; name: string };
          byOffice: Record<
            string,
            {
              office: { id: string; name: string };
              prices: Record<
                string,
                {
                  amount: number;
                  isPercentage: boolean;
                  percentageBaseTypeIds: string[];
                }
              >;
            }
          >;
        }
      > = {};

      // Initialize default prices for all offices
      for (const office of offices) {
        const officeData = {
          office: { id: office.id, name: office.name },
          prices: {} as Record<
            string,
            {
              amount: number;
              isPercentage: boolean;
              percentageBaseTypeIds: string[];
            }
          >,
        };
        for (const pt of priceTypes) {
          officeData.prices[pt.id] = {
            amount: 0,
            isPercentage: false,
            percentageBaseTypeIds: [],
          };
        }
        defaultPrices[office.id] = officeData;
      }

      // Fill in prices
      for (const price of prices) {
        const officeId = price.office.id;
        const priceTypeId = price.priceType.id;
        const percentageBaseIds = price.percentageBase
          .getItems()
          .map(pb => pb.priceType.id);

        const priceData = {
          amount: Number(price.amount),
          isPercentage: price.isPercentage,
          percentageBaseTypeIds: percentageBaseIds,
        };

        if (!price.option) {
          // Default price
          if (defaultPrices[officeId]) {
            defaultPrices[officeId].prices[priceTypeId] = priceData;
          }
        } else {
          // Override price
          const optionId = price.option.id;
          overridePrices[optionId] ??= {
            option: { id: price.option.id, name: price.option.name },
            byOffice: {},
          };
          overridePrices[optionId].byOffice[officeId] ??= {
            office: { id: officeId, name: price.office.name },
            prices: {},
          };
          overridePrices[optionId].byOffice[officeId].prices[priceTypeId] =
            priceData;
        }
      }

      res.status(200).json({
        upcharge: {
          id: upcharge.id,
          name: upcharge.name,
          note: upcharge.note,
          measurementType: upcharge.measurementType,
          version: upcharge.version,
        },
        priceTypes: priceTypes.map(pt => ({
          id: pt.id,
          code: pt.code,
          name: pt.name,
          sortOrder: pt.sortOrder,
        })),
        defaultPricing: Object.values(defaultPrices),
        overridePricing: Object.values(overridePrices),
      });
    } catch (err) {
      req.log.error({ err }, 'Get upcharge prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/upcharges/:upchargeId/defaults
 * Update default prices for an upcharge for a specific office
 */
router.put(
  '/:upchargeId/defaults',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { upchargeId } = req.params;
      if (!upchargeId) {
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const parseResult = updateDefaultPricesSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const { officeId, prices, version } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify upcharge
      const upcharge = await em.findOne(
        UpCharge,
        { id: upchargeId, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      if (upcharge.version !== version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This upcharge was modified by another user.',
          currentVersion: upcharge.version,
        });
        return;
      }

      // Verify office
      const office = await em.findOne(Office, {
        id: officeId,
        company: company.id,
      });
      if (!office) {
        res.status(400).json({ error: 'Invalid office' });
        return;
      }

      // Upsert default prices (option=null)
      for (const priceData of prices) {
        const existingPrice = await em.findOne(
          UpChargePrice,
          {
            upCharge: upchargeId,
            option: null,
            office: officeId,
            priceType: priceData.priceTypeId,
          },
          { populate: ['percentageBase'] },
        );

        if (existingPrice) {
          existingPrice.amount = priceData.amount;
          existingPrice.isPercentage = priceData.isPercentage;

          // Update percentage base if changed
          if (priceData.isPercentage && priceData.percentageBaseTypeIds) {
            // Remove old bases
            for (const oldBase of existingPrice.percentageBase.getItems()) {
              em.remove(oldBase);
            }
            existingPrice.percentageBase.removeAll();

            // Add new bases
            for (const typeId of priceData.percentageBaseTypeIds) {
              const base = new UpChargePricePercentageBase();
              base.upChargePrice = existingPrice;
              base.priceType = em.getReference(PriceObjectType, typeId);
              em.persist(base);
            }
          }
        } else {
          const newPrice = new UpChargePrice();
          newPrice.upCharge = em.getReference(UpCharge, upchargeId);
          newPrice.office = em.getReference(Office, officeId);
          newPrice.priceType = em.getReference(
            PriceObjectType,
            priceData.priceTypeId,
          );
          newPrice.amount = priceData.amount;
          newPrice.isPercentage = priceData.isPercentage;
          em.persist(newPrice);

          // Add percentage bases if applicable
          if (priceData.isPercentage && priceData.percentageBaseTypeIds) {
            await em.flush(); // Need the newPrice.id
            for (const typeId of priceData.percentageBaseTypeIds) {
              const base = new UpChargePricePercentageBase();
              base.upChargePrice = newPrice;
              base.priceType = em.getReference(PriceObjectType, typeId);
              em.persist(base);
            }
          }
        }
      }

      upcharge.lastModifiedBy = em.getReference(User, context.user.id);
      await em.flush();

      req.log.info(
        { upchargeId, officeId, userId: context.user.id },
        'Upcharge default prices updated',
      );

      res.status(200).json({
        message: 'Default prices updated successfully',
        upcharge: {
          id: upcharge.id,
          name: upcharge.name,
          version: upcharge.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update upcharge default prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/upcharges/:upchargeId/overrides
 * Update override prices for an upcharge for a specific option and office
 */
router.put(
  '/:upchargeId/overrides',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { upchargeId } = req.params;
      if (!upchargeId) {
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const parseResult = updateOverridePricesSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const { optionId, officeId, prices, version } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify upcharge
      const upcharge = await em.findOne(
        UpCharge,
        { id: upchargeId, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      if (upcharge.version !== version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This upcharge was modified by another user.',
          currentVersion: upcharge.version,
        });
        return;
      }

      // Verify option
      const option = await em.findOne(PriceGuideOption, {
        id: optionId,
        company: company.id,
      });
      if (!option) {
        res.status(400).json({ error: 'Invalid option' });
        return;
      }

      // Verify office
      const office = await em.findOne(Office, {
        id: officeId,
        company: company.id,
      });
      if (!office) {
        res.status(400).json({ error: 'Invalid office' });
        return;
      }

      // Upsert override prices
      for (const priceData of prices) {
        const existingPrice = await em.findOne(
          UpChargePrice,
          {
            upCharge: upchargeId,
            option: optionId,
            office: officeId,
            priceType: priceData.priceTypeId,
          },
          { populate: ['percentageBase'] },
        );

        if (existingPrice) {
          existingPrice.amount = priceData.amount;
          existingPrice.isPercentage = priceData.isPercentage;

          // Update percentage base if changed
          if (priceData.isPercentage && priceData.percentageBaseTypeIds) {
            for (const oldBase of existingPrice.percentageBase.getItems()) {
              em.remove(oldBase);
            }
            existingPrice.percentageBase.removeAll();

            for (const typeId of priceData.percentageBaseTypeIds) {
              const base = new UpChargePricePercentageBase();
              base.upChargePrice = existingPrice;
              base.priceType = em.getReference(PriceObjectType, typeId);
              em.persist(base);
            }
          }
        } else {
          const newPrice = new UpChargePrice();
          newPrice.upCharge = em.getReference(UpCharge, upchargeId);
          newPrice.option = em.getReference(PriceGuideOption, optionId);
          newPrice.office = em.getReference(Office, officeId);
          newPrice.priceType = em.getReference(
            PriceObjectType,
            priceData.priceTypeId,
          );
          newPrice.amount = priceData.amount;
          newPrice.isPercentage = priceData.isPercentage;
          em.persist(newPrice);

          if (priceData.isPercentage && priceData.percentageBaseTypeIds) {
            await em.flush();
            for (const typeId of priceData.percentageBaseTypeIds) {
              const base = new UpChargePricePercentageBase();
              base.upChargePrice = newPrice;
              base.priceType = em.getReference(PriceObjectType, typeId);
              em.persist(base);
            }
          }
        }
      }

      upcharge.lastModifiedBy = em.getReference(User, context.user.id);
      await em.flush();

      req.log.info(
        { upchargeId, optionId, officeId, userId: context.user.id },
        'Upcharge override prices updated',
      );

      res.status(200).json({
        message: 'Override prices updated successfully',
        upcharge: {
          id: upcharge.id,
          name: upcharge.name,
          version: upcharge.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update upcharge override prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/pricing/upcharges/:upchargeId/overrides
 * Delete override prices for an upcharge for a specific option and office
 */
router.delete(
  '/:upchargeId/overrides',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { upchargeId } = req.params;
      const { optionId, officeId } = req.query;

      if (!upchargeId || !optionId || !officeId) {
        res.status(400).json({
          error: 'Upcharge ID, option ID, and office ID are required',
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify upcharge belongs to company
      const upcharge = await em.findOne(UpCharge, {
        id: upchargeId,
        company: company.id,
      });

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Find and delete override prices
      const overridePrices = await em.find(
        UpChargePrice,
        {
          upCharge: upchargeId,
          option: optionId as string,
          office: officeId as string,
        },
        { populate: ['percentageBase'] },
      );

      if (overridePrices.length === 0) {
        res.status(404).json({ error: 'No override prices found' });
        return;
      }

      // Remove percentage bases and prices
      for (const price of overridePrices) {
        for (const base of price.percentageBase.getItems()) {
          em.remove(base);
        }
        em.remove(price);
      }

      await em.flush();

      req.log.info(
        { upchargeId, optionId, officeId, userId: context.user.id },
        'Upcharge override prices deleted',
      );

      res.status(200).json({
        message: 'Override prices deleted successfully',
        deletedCount: overridePrices.length,
      });
    } catch (err) {
      req.log.error({ err }, 'Delete upcharge override prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
