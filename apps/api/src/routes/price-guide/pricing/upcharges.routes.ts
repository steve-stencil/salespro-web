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
  MeasureSheetItem,
  MeasureSheetItemUpCharge,
  MeasureSheetItemOption,
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
  officeId: z.string().uuid().optional(), // Optional - if not provided, applies to all offices
  prices: z.array(priceUpdateSchema),
  version: z.number().int().min(1),
});

const updateOverridePricesSchema = z.object({
  optionId: z.string().uuid(),
  officeId: z.string().uuid().optional(), // Optional - if not provided, applies to all offices
  prices: z.array(priceUpdateSchema),
  version: z.number().int().min(1),
});

const updateMsiOverridePricesSchema = z.object({
  msiId: z.string().uuid(),
  optionId: z.string().uuid(),
  officeId: z.string().uuid().optional(), // Optional - if not provided, applies to all offices
  prices: z.array(priceUpdateSchema),
  version: z.number().int().min(1),
});

const deleteMsiOverrideSchema = z.object({
  msiId: z.string().uuid(),
  optionId: z.string().uuid(),
  officeId: z.string().uuid().optional(),
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
 * Get all prices for an upcharge (defaults, global option overrides, and MSI-specific overrides)
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

      // Get all prices (defaults, global overrides, and MSI-specific overrides)
      const prices = await em.find(
        UpChargePrice,
        { upCharge: upchargeId },
        {
          populate: [
            'office',
            'priceType',
            'option',
            'measureSheetItem',
            'percentageBase',
          ],
          orderBy: { priceType: { sortOrder: 'ASC' } },
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

      // Get linked MSIs and their options
      const msiUpChargeLinks = await em.find(
        MeasureSheetItemUpCharge,
        { upCharge: upchargeId },
        { populate: ['measureSheetItem'] },
      );

      const msiIds = [
        ...new Set(msiUpChargeLinks.map(link => link.measureSheetItem.id)),
      ];

      // Build linked MSIs with their options
      type LinkedMsi = {
        id: string;
        name: string;
        options: Array<{ id: string; name: string }>;
      };

      const linkedMsisMap = new Map<string, LinkedMsi>();
      const linkedOptionsMap = new Map<string, { id: string; name: string }>();

      if (msiIds.length > 0) {
        // Get MSI details
        const msis = await em.find(MeasureSheetItem, { id: { $in: msiIds } });
        for (const msi of msis) {
          linkedMsisMap.set(msi.id, {
            id: msi.id,
            name: msi.name,
            options: [],
          });
        }

        // Get options for each MSI
        const msiOptionLinks = await em.find(
          MeasureSheetItemOption,
          { measureSheetItem: { $in: msiIds } },
          { populate: ['option', 'measureSheetItem'] },
        );

        for (const link of msiOptionLinks) {
          const msiData = linkedMsisMap.get(link.measureSheetItem.id);
          if (msiData) {
            // Check if option is already added to this MSI
            if (!msiData.options.some(o => o.id === link.option.id)) {
              msiData.options.push({
                id: link.option.id,
                name: link.option.name,
              });
            }
          }
          // Also track all unique options
          if (!linkedOptionsMap.has(link.option.id)) {
            linkedOptionsMap.set(link.option.id, {
              id: link.option.id,
              name: link.option.name,
            });
          }
        }

        // Sort options within each MSI
        for (const msi of linkedMsisMap.values()) {
          msi.options.sort((a, b) => a.name.localeCompare(b.name));
        }
      }

      const linkedOptions = [...linkedOptionsMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      const linkedMsis = [...linkedMsisMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      // Build price data structures
      type PriceData = {
        amount: number;
        isPercentage: boolean;
        percentageBaseTypeIds: string[];
      };

      type OfficePricing = {
        office: { id: string; name: string };
        prices: Record<string, PriceData>;
      };

      type GlobalOptionOverride = {
        option: { id: string; name: string };
        byOffice: Record<string, OfficePricing>;
      };

      type MsiOptionOverride = {
        msi: { id: string; name: string };
        option: { id: string; name: string };
        byOffice: Record<string, OfficePricing>;
      };

      const defaultPrices: Record<string, OfficePricing> = {};
      const globalOptionOverrides: Record<string, GlobalOptionOverride> = {};
      const msiOptionOverrides: MsiOptionOverride[] = [];
      const msiOptionOverridesMap = new Map<string, MsiOptionOverride>();

      // Initialize default prices for all offices
      for (const office of offices) {
        const officeData: OfficePricing = {
          office: { id: office.id, name: office.name },
          prices: {},
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

      // Fill in prices from database
      for (const price of prices) {
        const priceTypeId = price.priceType.id;
        const percentageBaseIds = price.percentageBase
          .getItems()
          .map(pb => pb.priceType.id);

        const priceData: PriceData = {
          amount: Number(price.amount),
          isPercentage: price.isPercentage,
          percentageBaseTypeIds: percentageBaseIds,
        };

        // Determine which category this price belongs to
        if (!price.option) {
          // Default price (no option)
          if (price.office && defaultPrices[price.office.id]) {
            defaultPrices[price.office.id].prices[priceTypeId] = priceData;
          }
          // Note: office=null (default for all offices) not yet implemented in UI
        } else if (!price.measureSheetItem) {
          // Global option override (option set, no MSI)
          const optionId = price.option.id;
          globalOptionOverrides[optionId] ??= {
            option: { id: price.option.id, name: price.option.name },
            byOffice: {},
          };
          if (price.office) {
            const officeId = price.office.id;
            globalOptionOverrides[optionId].byOffice[officeId] ??= {
              office: { id: officeId, name: price.office.name },
              prices: {},
            };
            globalOptionOverrides[optionId].byOffice[officeId].prices[
              priceTypeId
            ] = priceData;
          }
        } else {
          // MSI+Option override
          const key = `${price.measureSheetItem.id}:${price.option.id}`;
          let msiOverride = msiOptionOverridesMap.get(key);
          if (!msiOverride) {
            msiOverride = {
              msi: {
                id: price.measureSheetItem.id,
                name: price.measureSheetItem.name,
              },
              option: { id: price.option.id, name: price.option.name },
              byOffice: {},
            };
            msiOptionOverridesMap.set(key, msiOverride);
          }
          if (price.office) {
            const officeId = price.office.id;
            msiOverride.byOffice[officeId] ??= {
              office: { id: officeId, name: price.office.name },
              prices: {},
            };
            msiOverride.byOffice[officeId].prices[priceTypeId] = priceData;
          }
        }
      }

      // Convert map to array
      for (const override of msiOptionOverridesMap.values()) {
        msiOptionOverrides.push(override);
      }

      // Sort MSI overrides by MSI name then option name
      msiOptionOverrides.sort((a, b) => {
        const msiCompare = a.msi.name.localeCompare(b.msi.name);
        if (msiCompare !== 0) return msiCompare;
        return a.option.name.localeCompare(b.option.name);
      });

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
        globalOptionOverrides: Object.values(globalOptionOverrides),
        msiOptionOverrides,
        linkedOptions,
        linkedMsis,
      });
    } catch (err) {
      req.log.error({ err }, 'Get upcharge prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/upcharges/:upchargeId/defaults
 * Update default prices for an upcharge (optionally for a specific office)
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

      // Verify office if provided
      let office: Office | null = null;
      if (officeId) {
        office = await em.findOne(Office, {
          id: officeId,
          company: company.id,
        });
        if (!office) {
          res.status(400).json({ error: 'Invalid office' });
          return;
        }
      }

      // Upsert default prices (option=null, measureSheetItem=null)
      for (const priceData of prices) {
        const existingPrice = await em.findOne(
          UpChargePrice,
          {
            upCharge: upchargeId,
            option: null,
            measureSheetItem: null,
            office: officeId ?? null,
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
          if (officeId) {
            newPrice.office = em.getReference(Office, officeId);
          }
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
 * Update global option override prices (applies across all MSIs)
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

      // Verify office if provided
      if (officeId) {
        const office = await em.findOne(Office, {
          id: officeId,
          company: company.id,
        });
        if (!office) {
          res.status(400).json({ error: 'Invalid office' });
          return;
        }
      }

      // Upsert global option override prices (measureSheetItem=null)
      for (const priceData of prices) {
        const existingPrice = await em.findOne(
          UpChargePrice,
          {
            upCharge: upchargeId,
            option: optionId,
            measureSheetItem: null,
            office: officeId ?? null,
            priceType: priceData.priceTypeId,
          },
          { populate: ['percentageBase'] },
        );

        if (existingPrice) {
          existingPrice.amount = priceData.amount;
          existingPrice.isPercentage = priceData.isPercentage;

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
          if (officeId) {
            newPrice.office = em.getReference(Office, officeId);
          }
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
        'Upcharge global option override prices updated',
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
 * Delete global option override prices
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

      if (!upchargeId || !optionId) {
        res.status(400).json({
          error: 'Upcharge ID and option ID are required',
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

      // Build filter for deletion
      const filter: Record<string, unknown> = {
        upCharge: upchargeId,
        option: optionId as string,
        measureSheetItem: null, // Only global overrides
      };

      if (officeId) {
        filter['office'] = officeId as string;
      }

      // Find and delete override prices
      const overridePrices = await em.find(UpChargePrice, filter, {
        populate: ['percentageBase'],
      });

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
        'Upcharge global override prices deleted',
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

/**
 * PUT /price-guide/pricing/upcharges/:upchargeId/msi-overrides
 * Update MSI+Option specific override prices
 */
router.put(
  '/:upchargeId/msi-overrides',
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

      const parseResult = updateMsiOverridePricesSchema.safeParse(req.body);
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

      const { msiId, optionId, officeId, prices, version } = parseResult.data;
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

      // Verify MSI
      const msi = await em.findOne(MeasureSheetItem, {
        id: msiId,
        company: company.id,
      });
      if (!msi) {
        res.status(400).json({ error: 'Invalid MSI' });
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

      // Verify office if provided
      if (officeId) {
        const office = await em.findOne(Office, {
          id: officeId,
          company: company.id,
        });
        if (!office) {
          res.status(400).json({ error: 'Invalid office' });
          return;
        }
      }

      // Upsert MSI+Option override prices
      for (const priceData of prices) {
        const existingPrice = await em.findOne(
          UpChargePrice,
          {
            upCharge: upchargeId,
            option: optionId,
            measureSheetItem: msiId,
            office: officeId ?? null,
            priceType: priceData.priceTypeId,
          },
          { populate: ['percentageBase'] },
        );

        if (existingPrice) {
          existingPrice.amount = priceData.amount;
          existingPrice.isPercentage = priceData.isPercentage;

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
          newPrice.measureSheetItem = em.getReference(MeasureSheetItem, msiId);
          if (officeId) {
            newPrice.office = em.getReference(Office, officeId);
          }
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
        { upchargeId, msiId, optionId, officeId, userId: context.user.id },
        'Upcharge MSI+Option override prices updated',
      );

      res.status(200).json({
        message: 'MSI override prices updated successfully',
        upcharge: {
          id: upcharge.id,
          name: upcharge.name,
          version: upcharge.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update upcharge MSI override prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/pricing/upcharges/:upchargeId/msi-overrides
 * Delete MSI+Option specific override prices
 */
router.delete(
  '/:upchargeId/msi-overrides',
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

      const parseResult = deleteMsiOverrideSchema.safeParse(req.query);
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

      const { msiId, optionId, officeId } = parseResult.data;

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

      // Build filter for deletion
      const filter: Record<string, unknown> = {
        upCharge: upchargeId,
        option: optionId,
        measureSheetItem: msiId,
      };

      if (officeId) {
        filter['office'] = officeId;
      }

      // Find and delete override prices
      const overridePrices = await em.find(UpChargePrice, filter, {
        populate: ['percentageBase'],
      });

      if (overridePrices.length === 0) {
        res.status(404).json({ error: 'No MSI override prices found' });
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
        { upchargeId, msiId, optionId, officeId, userId: context.user.id },
        'Upcharge MSI+Option override prices deleted',
      );

      res.status(200).json({
        message: 'MSI override prices deleted successfully',
        deletedCount: overridePrices.length,
      });
    } catch (err) {
      req.log.error({ err }, 'Delete upcharge MSI override prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
