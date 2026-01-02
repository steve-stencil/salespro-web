import { Router } from 'express';
import { z } from 'zod';

import {
  PriceGuideOption,
  OptionPrice,
  PriceObjectType,
  Office,
  User,
} from '../../../entities';
import { getORM } from '../../../lib/db';
import { PERMISSIONS } from '../../../lib/permissions';
import { requireAuth, requirePermission } from '../../../middleware';

import exportImportRoutes from './export-import.routes';

import type { Company } from '../../../entities';
import type { AuthenticatedRequest } from '../../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Export/Import Routes (must be mounted FIRST - static paths before :optionId)
// ============================================================================
router.use('/', exportImportRoutes);

// ============================================================================
// Validation Schemas
// ============================================================================

const priceUpdateSchema = z.object({
  priceTypeId: z.string().uuid(),
  amount: z.coerce.number().min(0),
});

const bulkPriceUpdateSchema = z.object({
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
 * GET /price-guide/pricing/options/:optionId
 * Get all prices for an option across all offices and price types
 */
router.get(
  '/:optionId',
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
      const { optionId } = req.params;
      if (!optionId) {
        res.status(400).json({ error: 'Option ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify option exists and belongs to company
      const option = await em.findOne(PriceGuideOption, {
        id: optionId,
        company: company.id,
      });

      if (!option) {
        res.status(404).json({ error: 'Option not found' });
        return;
      }

      // Get all prices for this option
      const prices = await em.find(
        OptionPrice,
        { option: optionId },
        {
          populate: ['office', 'priceType'],
          orderBy: { office: { name: 'ASC' }, priceType: { sortOrder: 'ASC' } },
        },
      );

      // Get all active price types for this company
      const priceTypes = await em.find(
        PriceObjectType,
        { company: company.id, isActive: true },
        { orderBy: { sortOrder: 'ASC' } },
      );

      // Get company offices
      const offices = await em.find(
        Office,
        { company: company.id, isActive: true },
        { orderBy: { name: 'ASC' } },
      );

      // Organize prices by office
      const pricesByOffice: Record<
        string,
        { office: { id: string; name: string }; prices: Record<string, number> }
      > = {};

      for (const office of offices) {
        const officeData = {
          office: { id: office.id, name: office.name },
          prices: {} as Record<string, number>,
        };
        // Initialize all price types with 0
        for (const pt of priceTypes) {
          officeData.prices[pt.id] = 0;
        }
        pricesByOffice[office.id] = officeData;
      }

      // Fill in actual prices
      for (const price of prices) {
        const officeId = price.office.id;
        const priceTypeId = price.priceType.id;
        if (pricesByOffice[officeId]) {
          pricesByOffice[officeId].prices[priceTypeId] = Number(price.amount);
        }
      }

      res.status(200).json({
        option: {
          id: option.id,
          name: option.name,
          brand: option.brand,
          itemCode: option.itemCode,
          version: option.version,
        },
        priceTypes: priceTypes.map(pt => ({
          id: pt.id,
          code: pt.code,
          name: pt.name,
          sortOrder: pt.sortOrder,
        })),
        byOffice: pricesByOffice,
        // Array format for easier iteration
        pricing: Object.values(pricesByOffice),
      });
    } catch (err) {
      req.log.error({ err }, 'Get option prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/options/:optionId
 * Bulk update prices for an option for a specific office
 */
router.put(
  '/:optionId',
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
      const { optionId } = req.params;
      if (!optionId) {
        res.status(400).json({ error: 'Option ID is required' });
        return;
      }

      const parseResult = bulkPriceUpdateSchema.safeParse(req.body);
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

      // Verify option exists and check version
      const option = await em.findOne(
        PriceGuideOption,
        { id: optionId, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!option) {
        res.status(404).json({ error: 'Option not found' });
        return;
      }

      // Optimistic locking check
      if (option.version !== version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This option was modified by another user.',
          lastModifiedBy: option.lastModifiedBy
            ? {
                id: option.lastModifiedBy.id,
                email: option.lastModifiedBy.email,
                nameFirst: option.lastModifiedBy.nameFirst,
                nameLast: option.lastModifiedBy.nameLast,
              }
            : null,
          lastModifiedAt: option.updatedAt,
          currentVersion: option.version,
        });
        return;
      }

      // Verify office belongs to company
      const office = await em.findOne(Office, {
        id: officeId,
        company: company.id,
      });
      if (!office) {
        res.status(400).json({ error: 'Invalid office' });
        return;
      }

      // Upsert prices
      for (const priceData of prices) {
        let priceRecord = await em.findOne(OptionPrice, {
          option: optionId,
          office: officeId,
          priceType: priceData.priceTypeId,
        });

        if (priceRecord) {
          priceRecord.amount = priceData.amount;
        } else {
          priceRecord = new OptionPrice();
          priceRecord.option = em.getReference(PriceGuideOption, optionId);
          priceRecord.office = em.getReference(Office, officeId);
          priceRecord.priceType = em.getReference(
            PriceObjectType,
            priceData.priceTypeId,
          );
          priceRecord.amount = priceData.amount;
          em.persist(priceRecord);
        }
      }

      // Update option's modified metadata (triggers version increment)
      option.lastModifiedBy = em.getReference(User, context.user.id);

      await em.flush();

      req.log.info(
        { optionId, officeId, userId: context.user.id },
        'Option prices updated',
      );

      res.status(200).json({
        message: 'Prices updated successfully',
        option: {
          id: option.id,
          name: option.name,
          version: option.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update option prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/options/:optionId/bulk
 * Bulk update prices for an option across ALL offices (mass price change)
 */
router.put(
  '/:optionId/bulk',
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
      const { optionId } = req.params;
      if (!optionId) {
        res.status(400).json({ error: 'Option ID is required' });
        return;
      }

      const parseResult = z
        .object({
          prices: z.array(priceUpdateSchema),
          version: z.number().int().min(1),
        })
        .safeParse(req.body);

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

      const { prices, version } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify option
      const option = await em.findOne(
        PriceGuideOption,
        { id: optionId, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!option) {
        res.status(404).json({ error: 'Option not found' });
        return;
      }

      if (option.version !== version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This option was modified by another user.',
          currentVersion: option.version,
        });
        return;
      }

      // Get all company offices
      const offices = await em.find(Office, {
        company: company.id,
        isActive: true,
      });

      let updatedCount = 0;

      // Apply prices to ALL offices
      for (const office of offices) {
        for (const priceData of prices) {
          let priceRecord = await em.findOne(OptionPrice, {
            option: optionId,
            office: office.id,
            priceType: priceData.priceTypeId,
          });

          if (priceRecord) {
            priceRecord.amount = priceData.amount;
          } else {
            priceRecord = new OptionPrice();
            priceRecord.option = em.getReference(PriceGuideOption, optionId);
            priceRecord.office = em.getReference(Office, office.id);
            priceRecord.priceType = em.getReference(
              PriceObjectType,
              priceData.priceTypeId,
            );
            priceRecord.amount = priceData.amount;
            em.persist(priceRecord);
          }
          updatedCount++;
        }
      }

      option.lastModifiedBy = em.getReference(User, context.user.id);
      await em.flush();

      req.log.info(
        { optionId, updatedCount, userId: context.user.id },
        'Bulk option prices updated',
      );

      res.status(200).json({
        message: 'Bulk prices updated successfully',
        updatedCount,
        officesAffected: offices.length,
        option: {
          id: option.id,
          name: option.name,
          version: option.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Bulk update option prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
