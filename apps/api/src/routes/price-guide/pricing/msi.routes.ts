import { Router } from 'express';
import { z } from 'zod';

import {
  MeasureSheetItem,
  MeasureSheetItemPrice,
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
});

const bulkPriceUpdateSchema = z.object({
  officeId: z.string().uuid(),
  prices: z.array(priceUpdateSchema),
});

const batchPriceUpdateSchema = z.object({
  pricing: z.record(
    z.string().uuid(), // officeId
    z.record(
      z.string().uuid(), // priceTypeId
      z.number().min(0),
    ),
  ),
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
 * GET /price-guide/pricing/msi/:msiId
 * Get all base prices for a measure sheet item across all offices and price types
 */
router.get(
  '/:msiId',
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
      const { msiId } = req.params;
      if (!msiId) {
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify MSI exists and belongs to company
      const msi = await em.findOne(MeasureSheetItem, {
        id: msiId,
        company: company.id,
      });

      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      // Get all prices for this MSI
      const prices = await em.find(
        MeasureSheetItemPrice,
        { measureSheetItem: msiId },
        {
          populate: ['office', 'priceType'],
          orderBy: { office: { name: 'ASC' }, priceType: { sortOrder: 'ASC' } },
        },
      );

      // Get all price types (global + company-specific)
      const priceTypes = await em.find(
        PriceObjectType,
        { $or: [{ company: null }, { company: company.id }], isActive: true },
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
        msi: {
          id: msi.id,
          name: msi.name,
          version: msi.version,
        },
        priceTypes: priceTypes.map(pt => ({
          id: pt.id,
          code: pt.code,
          name: pt.name,
          sortOrder: pt.sortOrder,
        })),
        pricing: Object.values(pricesByOffice),
      });
    } catch (err) {
      req.log.error({ err }, 'Get MSI prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/msi/:msiId
 * Bulk update prices for an MSI for a specific office
 */
router.put(
  '/:msiId',
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
      const { msiId } = req.params;
      if (!msiId) {
        res.status(400).json({ error: 'MSI ID is required' });
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

      const { officeId, prices } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify MSI exists
      const msi = await em.findOne(
        MeasureSheetItem,
        { id: msiId, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
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
        let priceRecord = await em.findOne(MeasureSheetItemPrice, {
          measureSheetItem: msiId,
          office: officeId,
          priceType: priceData.priceTypeId,
        });

        if (priceRecord) {
          priceRecord.amount = priceData.amount;
        } else {
          priceRecord = new MeasureSheetItemPrice();
          priceRecord.measureSheetItem = em.getReference(
            MeasureSheetItem,
            msiId,
          );
          priceRecord.office = em.getReference(Office, officeId);
          priceRecord.priceType = em.getReference(
            PriceObjectType,
            priceData.priceTypeId,
          );
          priceRecord.amount = priceData.amount;
          em.persist(priceRecord);
        }
      }

      // Update MSI's modified metadata (triggers version increment)
      msi.lastModifiedBy = em.getReference(User, context.user.id);

      await em.flush();

      req.log.info(
        { msiId, officeId, userId: context.user.id },
        'MSI prices updated',
      );

      res.status(200).json({
        message: 'Prices updated successfully',
        msi: {
          id: msi.id,
          name: msi.name,
          version: msi.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update MSI prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/msi/:msiId/batch
 * Batch update prices for an MSI across multiple offices at once
 * Used by the wizard to save all pricing in one call
 */
router.put(
  '/:msiId/batch',
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
      const { msiId } = req.params;
      if (!msiId) {
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      const parseResult = batchPriceUpdateSchema.safeParse(req.body);
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

      const { pricing } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify MSI exists
      const msi = await em.findOne(
        MeasureSheetItem,
        { id: msiId, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      // Validate all offices belong to company
      const officeIds = Object.keys(pricing);
      if (officeIds.length > 0) {
        const offices = await em.find(Office, {
          id: { $in: officeIds },
          company: company.id,
        });
        if (offices.length !== officeIds.length) {
          res.status(400).json({ error: 'One or more invalid offices' });
          return;
        }
      }

      let updatedCount = 0;

      // Upsert all prices
      for (const [officeId, pricesByType] of Object.entries(pricing)) {
        for (const [priceTypeId, amount] of Object.entries(pricesByType)) {
          // Skip zero/empty values
          if (amount === 0) continue;

          let priceRecord = await em.findOne(MeasureSheetItemPrice, {
            measureSheetItem: msiId,
            office: officeId,
            priceType: priceTypeId,
          });

          if (priceRecord) {
            priceRecord.amount = amount;
          } else {
            priceRecord = new MeasureSheetItemPrice();
            priceRecord.measureSheetItem = em.getReference(
              MeasureSheetItem,
              msiId,
            );
            priceRecord.office = em.getReference(Office, officeId);
            priceRecord.priceType = em.getReference(
              PriceObjectType,
              priceTypeId,
            );
            priceRecord.amount = amount;
            em.persist(priceRecord);
          }
          updatedCount++;
        }
      }

      // Update MSI's modified metadata
      msi.lastModifiedBy = em.getReference(User, context.user.id);

      await em.flush();

      req.log.info(
        { msiId, updatedCount, userId: context.user.id },
        'MSI batch prices updated',
      );

      res.status(200).json({
        message: 'Batch prices updated successfully',
        updatedCount,
        msi: {
          id: msi.id,
          name: msi.name,
          version: msi.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Batch update MSI prices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
