import { Router } from 'express';
import { z } from 'zod';

import {
  AdditionalDetailField,
  AdditionalDetailInputType,
  AdditionalDetailCellType,
  SizePickerPrecision,
  MeasureSheetItemAdditionalDetailField,
  UpChargeAdditionalDetailField,
  Company,
  User,
} from '../../../entities';
import { getORM } from '../../../lib/db';
import { PERMISSIONS } from '../../../lib/permissions';
import { requireAuth, requirePermission } from '../../../middleware';

import type { AuthenticatedRequest } from '../../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
});

const sizePickerConfigSchema = z.object({
  precision: z.nativeEnum(SizePickerPrecision),
  minWidth: z.number().optional(),
  maxWidth: z.number().optional(),
  minHeight: z.number().optional(),
  maxHeight: z.number().optional(),
  minDepth: z.number().optional(),
  maxDepth: z.number().optional(),
});

const createFieldSchema = z.object({
  title: z.string().min(1).max(255),
  inputType: z.nativeEnum(AdditionalDetailInputType),
  cellType: z.nativeEnum(AdditionalDetailCellType).optional(),
  placeholder: z.string().max(255).optional(),
  note: z.string().max(255).optional(),
  defaultValue: z.string().max(255).optional(),
  isRequired: z.boolean().default(false),
  shouldCopy: z.boolean().default(false),
  pickerValues: z.array(z.string()).optional(),
  sizePickerConfig: sizePickerConfigSchema.optional(),
  unitedInchConfig: z.object({ suffix: z.string().optional() }).optional(),
  photoConfig: z
    .object({ disableTemplatePhotoLinking: z.boolean().optional() })
    .optional(),
  allowDecimal: z.boolean().default(false),
  dateDisplayFormat: z.string().max(255).optional(),
  notAddedReplacement: z.string().max(255).optional(),
});

const updateFieldSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  inputType: z.nativeEnum(AdditionalDetailInputType).optional(),
  cellType: z.nativeEnum(AdditionalDetailCellType).optional().nullable(),
  placeholder: z.string().max(255).optional().nullable(),
  note: z.string().max(255).optional().nullable(),
  defaultValue: z.string().max(255).optional().nullable(),
  isRequired: z.boolean().optional(),
  shouldCopy: z.boolean().optional(),
  pickerValues: z.array(z.string()).optional().nullable(),
  sizePickerConfig: sizePickerConfigSchema.optional().nullable(),
  unitedInchConfig: z
    .object({ suffix: z.string().optional() })
    .optional()
    .nullable(),
  photoConfig: z
    .object({ disableTemplatePhotoLinking: z.boolean().optional() })
    .optional()
    .nullable(),
  allowDecimal: z.boolean().optional(),
  dateDisplayFormat: z.string().max(255).optional().nullable(),
  notAddedReplacement: z.string().max(255).optional().nullable(),
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

function decodeCursor(cursor: string): { title: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const separatorIndex = decoded.lastIndexOf(':');
    if (separatorIndex === -1) return null;
    return {
      title: decoded.substring(0, separatorIndex),
      id: decoded.substring(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function encodeCursor(title: string, id: string): string {
  return Buffer.from(`${title}:${id}`).toString('base64');
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /price-guide/library/additional-details
 * List additional detail fields with cursor-based pagination
 */
router.get(
  '/',
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
      const parseResult = listQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.issues,
        });
        return;
      }

      const { cursor, limit, search } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const qb = em
        .createQueryBuilder(AdditionalDetailField, 'f')
        .select('*')
        .where({ company: company.id, isActive: true });

      // Full-text search
      if (search) {
        qb.andWhere({
          $or: [
            { title: { $ilike: `%${search}%` } },
            { note: { $ilike: `%${search}%` } },
          ],
        });
      }

      // Cursor pagination
      if (cursor) {
        const decoded = decodeCursor(cursor);
        if (decoded) {
          qb.andWhere({
            $or: [
              { title: { $gt: decoded.title } },
              { title: decoded.title, id: { $gt: decoded.id } },
            ],
          });
        }
      }

      qb.orderBy({ title: 'ASC', id: 'ASC' }).limit(limit + 1);

      const items = await qb.getResultList();
      const hasMore = items.length > limit;
      if (hasMore) items.pop();

      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? encodeCursor(lastItem.title, lastItem.id)
          : undefined;

      res.status(200).json({
        items: items.map(f => ({
          id: f.id,
          title: f.title,
          inputType: f.inputType,
          isRequired: f.isRequired,
          linkedMsiCount: f.linkedMsiCount,
          isActive: f.isActive,
        })),
        nextCursor,
        hasMore,
        total: items.length,
      });
    } catch (err) {
      req.log.error({ err }, 'List additional details error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/library/additional-details/:id
 * Get additional detail field detail
 */
router.get(
  '/:id',
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
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Field ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const field = await em.findOne(
        AdditionalDetailField,
        { id, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!field) {
        res.status(404).json({ error: 'Additional detail field not found' });
        return;
      }

      // Get MSIs using this field
      const msiLinks = await em.find(
        MeasureSheetItemAdditionalDetailField,
        { additionalDetailField: field.id },
        {
          populate: ['measureSheetItem', 'measureSheetItem.category'],
          limit: 20,
        },
      );

      // Get upcharges using this field
      const upchargeLinks = await em.find(
        UpChargeAdditionalDetailField,
        { additionalDetailField: field.id },
        { populate: ['upCharge'], limit: 20 },
      );

      res.status(200).json({
        field: {
          id: field.id,
          title: field.title,
          inputType: field.inputType,
          cellType: field.cellType,
          placeholder: field.placeholder,
          note: field.note,
          defaultValue: field.defaultValue,
          isRequired: field.isRequired,
          shouldCopy: field.shouldCopy,
          pickerValues: field.pickerValues,
          sizePickerConfig: field.sizePickerConfig,
          unitedInchConfig: field.unitedInchConfig,
          photoConfig: field.photoConfig,
          allowDecimal: field.allowDecimal,
          dateDisplayFormat: field.dateDisplayFormat,
          notAddedReplacement: field.notAddedReplacement,
          msiUsageCount: field.linkedMsiCount,
          upchargeUsageCount: field.linkedUpChargeCount,
          usedByMSIs: msiLinks.map(l => ({
            id: l.measureSheetItem.id,
            name: l.measureSheetItem.name,
            category: l.measureSheetItem.category.name,
          })),
          usedByUpcharges: upchargeLinks.map(l => ({
            id: l.upCharge.id,
            name: l.upCharge.name,
          })),
          version: field.version,
          updatedAt: field.updatedAt,
          lastModifiedBy: field.lastModifiedBy
            ? {
                id: field.lastModifiedBy.id,
                email: field.lastModifiedBy.email,
                nameFirst: field.lastModifiedBy.nameFirst,
                nameLast: field.lastModifiedBy.nameLast,
              }
            : null,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get additional detail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/library/additional-details
 * Create a new additional detail field
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const parseResult = createFieldSchema.safeParse(req.body);
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

      const data = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const field = new AdditionalDetailField();
      field.title = data.title;
      field.inputType = data.inputType;
      field.cellType = data.cellType;
      field.placeholder = data.placeholder;
      field.note = data.note;
      field.defaultValue = data.defaultValue;
      field.isRequired = data.isRequired;
      field.shouldCopy = data.shouldCopy;
      field.pickerValues = data.pickerValues;
      field.sizePickerConfig = data.sizePickerConfig;
      field.unitedInchConfig = data.unitedInchConfig;
      field.photoConfig = data.photoConfig;
      field.allowDecimal = data.allowDecimal;
      field.dateDisplayFormat = data.dateDisplayFormat;
      field.notAddedReplacement = data.notAddedReplacement;
      field.company = em.getReference(Company, company.id);
      field.lastModifiedBy = em.getReference(User, user.id);

      await em.persistAndFlush(field);

      req.log.info(
        { fieldId: field.id, fieldTitle: field.title, userId: user.id },
        'Additional detail field created',
      );

      res.status(201).json({
        message: 'Additional detail field created successfully',
        field: {
          id: field.id,
          title: field.title,
          inputType: field.inputType,
          version: field.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create additional detail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/library/additional-details/:id
 * Update an additional detail field
 */
router.put(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Field ID is required' });
        return;
      }

      const parseResult = updateFieldSchema.safeParse(req.body);
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

      const data = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const field = await em.findOne(
        AdditionalDetailField,
        { id, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!field) {
        res.status(404).json({ error: 'Additional detail field not found' });
        return;
      }

      // Check optimistic locking
      if (field.version !== data.version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This field was modified by another user.',
          lastModifiedBy: field.lastModifiedBy
            ? {
                id: field.lastModifiedBy.id,
                email: field.lastModifiedBy.email,
                nameFirst: field.lastModifiedBy.nameFirst,
                nameLast: field.lastModifiedBy.nameLast,
              }
            : null,
          lastModifiedAt: field.updatedAt,
          currentVersion: field.version,
        });
        return;
      }

      // Update fields
      if (data.title !== undefined) field.title = data.title;
      if (data.inputType !== undefined) field.inputType = data.inputType;
      if (data.cellType !== undefined)
        field.cellType = data.cellType ?? undefined;
      if (data.placeholder !== undefined)
        field.placeholder = data.placeholder ?? undefined;
      if (data.note !== undefined) field.note = data.note ?? undefined;
      if (data.defaultValue !== undefined)
        field.defaultValue = data.defaultValue ?? undefined;
      if (data.isRequired !== undefined) field.isRequired = data.isRequired;
      if (data.shouldCopy !== undefined) field.shouldCopy = data.shouldCopy;
      if (data.pickerValues !== undefined)
        field.pickerValues = data.pickerValues ?? undefined;
      if (data.sizePickerConfig !== undefined)
        field.sizePickerConfig = data.sizePickerConfig ?? undefined;
      if (data.unitedInchConfig !== undefined)
        field.unitedInchConfig = data.unitedInchConfig ?? undefined;
      if (data.photoConfig !== undefined)
        field.photoConfig = data.photoConfig ?? undefined;
      if (data.allowDecimal !== undefined)
        field.allowDecimal = data.allowDecimal;
      if (data.dateDisplayFormat !== undefined)
        field.dateDisplayFormat = data.dateDisplayFormat ?? undefined;
      if (data.notAddedReplacement !== undefined)
        field.notAddedReplacement = data.notAddedReplacement ?? undefined;

      field.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { fieldId: field.id, userId: user.id },
        'Additional detail field updated',
      );

      res.status(200).json({
        message: 'Additional detail field updated successfully',
        field: {
          id: field.id,
          title: field.title,
          inputType: field.inputType,
          version: field.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update additional detail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/library/additional-details/:id
 * Soft delete an additional detail field
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Field ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const field = await em.findOne(AdditionalDetailField, {
        id,
        company: company.id,
      });

      if (!field) {
        res.status(404).json({ error: 'Additional detail field not found' });
        return;
      }

      // Warn if in use
      const totalUsage = field.linkedMsiCount + field.linkedUpChargeCount;
      if (totalUsage > 0) {
        const force = req.query['force'] === 'true';
        if (!force) {
          res.status(409).json({
            error: 'Field is in use',
            message: `This field is used by ${field.linkedMsiCount} MSI(s) and ${field.linkedUpChargeCount} upcharge(s). Use ?force=true to delete anyway.`,
            msiUsageCount: field.linkedMsiCount,
            upchargeUsageCount: field.linkedUpChargeCount,
          });
          return;
        }
      }

      // Soft delete
      field.isActive = false;
      field.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { fieldId: field.id, fieldTitle: field.title, userId: user.id },
        'Additional detail field deleted',
      );

      res
        .status(200)
        .json({ message: 'Additional detail field deleted successfully' });
    } catch (err) {
      req.log.error({ err }, 'Delete additional detail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
