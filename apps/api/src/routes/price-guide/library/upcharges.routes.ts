import { Router } from 'express';
import { z } from 'zod';

import {
  UpCharge,
  PriceGuideOption,
  AdditionalDetailField,
  MeasureSheetItemUpCharge,
  UpChargeDisabledOption,
  UpChargeAdditionalDetailField,
  PriceGuideImage,
  Company,
  User,
} from '../../../entities';
import { getORM } from '../../../lib/db';
import { PERMISSIONS } from '../../../lib/permissions';
import { getStorageAdapter } from '../../../lib/storage';
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
  /** Comma-separated tag IDs to filter by (OR logic) */
  tags: z
    .string()
    .optional()
    .transform(val => (val ? val.split(',').filter(Boolean) : undefined)),
});

const createUpchargeSchema = z.object({
  name: z.string().min(1).max(255),
  note: z.string().max(2000).optional(),
  measurementType: z.string().max(50).optional(),
  identifier: z.string().max(255).optional(),
  /** Thumbnail image ID from shared library */
  thumbnailImageId: z.string().uuid().optional(),
});

const updateUpchargeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  note: z.string().max(2000).optional().nullable(),
  measurementType: z.string().max(50).optional().nullable(),
  identifier: z.string().max(255).optional().nullable(),
  version: z.number().int().min(1),
});

const setThumbnailSchema = z.object({
  /** Image ID to set as thumbnail (null to clear) */
  imageId: z.string().uuid().nullable(),
  version: z.number().int().min(1),
});

const setDisabledOptionsSchema = z.object({
  optionIds: z.array(z.string().uuid()),
});

const linkAdditionalDetailsSchema = z.object({
  fieldIds: z.array(z.string().uuid()).min(1),
});

const reorderAdditionalDetailsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
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

function decodeCursor(cursor: string): { name: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const separatorIndex = decoded.lastIndexOf(':');
    if (separatorIndex === -1) return null;
    return {
      name: decoded.substring(0, separatorIndex),
      id: decoded.substring(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function encodeCursor(name: string, id: string): string {
  return Buffer.from(`${name}:${id}`).toString('base64');
}

/** Presigned URL expiration for image thumbnails (1 hour) */
const IMAGE_URL_EXPIRES_IN = 3600;

/**
 * Type guard to check if a loaded relation has a valid storageKey.
 * Handles MikroORM's lazy-loaded relations which may not be fully loaded.
 */
function isLoadedFile(
  file: unknown,
): file is { storageKey: string; thumbnailKey?: string } {
  return (
    file !== null &&
    file !== undefined &&
    typeof file === 'object' &&
    'storageKey' in file &&
    typeof (file as { storageKey: unknown }).storageKey === 'string'
  );
}

/**
 * Generate signed URLs for a File entity's image and thumbnail.
 */
async function getImageUrls(
  file: unknown,
): Promise<{ imageUrl: string | null; thumbnailUrl: string | null }> {
  if (!isLoadedFile(file)) {
    return { imageUrl: null, thumbnailUrl: null };
  }

  const storage = getStorageAdapter();

  const imageUrl = await storage.getSignedDownloadUrl({
    key: file.storageKey,
    expiresIn: IMAGE_URL_EXPIRES_IN,
  });

  const thumbnailUrl = file.thumbnailKey
    ? await storage.getSignedDownloadUrl({
        key: file.thumbnailKey,
        expiresIn: IMAGE_URL_EXPIRES_IN,
      })
    : null;

  return { imageUrl, thumbnailUrl };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /price-guide/library/upcharges
 * List upcharges with cursor-based pagination and optional tag filtering
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

      const { cursor, limit, search, tags } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const qb = em
        .createQueryBuilder(UpCharge, 'u')
        .select('*')
        .where({ company: company.id, isActive: true });

      // Full-text search
      if (search) {
        qb.andWhere({
          $or: [
            { name: { $ilike: `%${search}%` } },
            { note: { $ilike: `%${search}%` } },
            { identifier: { $ilike: `%${search}%` } },
          ],
        });
      }

      // Tag filtering (OR logic - matches any of the provided tags)
      if (tags && tags.length > 0) {
        const knex = em.getKnex();
        const taggedRows = await knex('item_tag')
          .select('entity_id')
          .where('entity_type', 'UPCHARGE')
          .whereIn('tag_id', tags);

        const filteredUpchargeIds = taggedRows.map(
          (row: { entity_id: string }) => row.entity_id,
        );

        if (filteredUpchargeIds.length === 0) {
          res.status(200).json({
            items: [],
            nextCursor: undefined,
            hasMore: false,
            total: 0,
          });
          return;
        }

        qb.andWhere({ id: { $in: filteredUpchargeIds } });
      }

      // Cursor pagination
      if (cursor) {
        const decoded = decodeCursor(cursor);
        if (decoded) {
          qb.andWhere({
            $or: [
              { name: { $gt: decoded.name } },
              { name: decoded.name, id: { $gt: decoded.id } },
            ],
          });
        }
      }

      qb.orderBy({ name: 'ASC', id: 'ASC' }).limit(limit + 1);

      const items = await qb.getResultList();
      const hasMore = items.length > limit;
      if (hasMore) items.pop();

      // Load thumbnail image for presigned URLs
      await em.populate(items, ['thumbnailImage.file']);

      // Fetch tags for all returned upcharges
      const resultUpchargeIds = items.map(u => u.id);
      const tagsByUpchargeId = new Map<
        string,
        Array<{ id: string; name: string; color: string }>
      >();

      if (resultUpchargeIds.length > 0) {
        const knex = em.getKnex();
        const tagRows = await knex('item_tag as it')
          .join('tag as t', 't.id', 'it.tag_id')
          .select('it.entity_id', 't.id as tag_id', 't.name', 't.color')
          .where('it.entity_type', 'UPCHARGE')
          .whereIn('it.entity_id', resultUpchargeIds)
          .where('t.is_active', true);

        for (const row of tagRows as Array<{
          entity_id: string;
          tag_id: string;
          name: string;
          color: string;
        }>) {
          const existing = tagsByUpchargeId.get(row.entity_id) ?? [];
          existing.push({
            id: row.tag_id,
            name: row.name,
            color: row.color,
          });
          tagsByUpchargeId.set(row.entity_id, existing);
        }
      }

      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? encodeCursor(lastItem.name, lastItem.id)
          : undefined;

      // Build response with presigned URLs and tags
      const responseItems = await Promise.all(
        items.map(async u => {
          // Get thumbnail image if set
          let thumbnailImage = null;
          if (u.thumbnailImage) {
            const { imageUrl, thumbnailUrl } = await getImageUrls(
              u.thumbnailImage.file,
            );
            thumbnailImage = {
              id: u.thumbnailImage.id,
              name: u.thumbnailImage.name,
              description: u.thumbnailImage.description ?? null,
              imageUrl,
              thumbnailUrl,
            };
          }

          return {
            id: u.id,
            name: u.name,
            note: u.note,
            measurementType: u.measurementType,
            identifier: u.identifier,
            linkedMsiCount: u.linkedMsiCount,
            thumbnailImage,
            isActive: u.isActive,
            tags: tagsByUpchargeId.get(u.id) ?? [],
          };
        }),
      );

      res.status(200).json({
        items: responseItems,
        nextCursor,
        hasMore,
        total: items.length,
      });
    } catch (err) {
      req.log.error({ err }, 'List upcharges error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/library/upcharges/:id
 * Get upcharge detail
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(
        UpCharge,
        { id, company: company.id },
        { populate: ['lastModifiedBy', 'thumbnailImage.file'] },
      );

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Get MSIs using this upcharge
      const msiLinks = await em.find(
        MeasureSheetItemUpCharge,
        { upCharge: upcharge.id },
        {
          populate: ['measureSheetItem', 'measureSheetItem.category'],
          limit: 20,
        },
      );

      // Get disabled options
      const disabledOptions = await em.find(
        UpChargeDisabledOption,
        { upCharge: upcharge.id },
        { populate: ['option'] },
      );

      // Get additional details
      const additionalDetailLinks = await em.find(
        UpChargeAdditionalDetailField,
        { upCharge: upcharge.id },
        {
          populate: ['additionalDetailField'],
          orderBy: { sortOrder: 'ASC' },
        },
      );

      // Build thumbnail image data
      let thumbnailImage = null;
      if (upcharge.thumbnailImage) {
        const { imageUrl, thumbnailUrl } = await getImageUrls(
          upcharge.thumbnailImage.file,
        );
        thumbnailImage = {
          id: upcharge.thumbnailImage.id,
          name: upcharge.thumbnailImage.name,
          description: upcharge.thumbnailImage.description ?? null,
          imageUrl,
          thumbnailUrl,
        };
      }

      res.status(200).json({
        upcharge: {
          id: upcharge.id,
          name: upcharge.name,
          note: upcharge.note,
          measurementType: upcharge.measurementType,
          identifier: upcharge.identifier,
          thumbnailImage,
          linkedMsiCount: upcharge.linkedMsiCount,
          hasAllOfficePricing: true, // TODO: Calculate
          disabledOptions: disabledOptions.map(d => ({
            id: d.option.id,
            name: d.option.name,
          })),
          additionalDetails: additionalDetailLinks.map(a => ({
            junctionId: a.id,
            fieldId: a.additionalDetailField.id,
            title: a.additionalDetailField.title,
            inputType: a.additionalDetailField.inputType,
            cellType: a.additionalDetailField.cellType,
            isRequired: a.additionalDetailField.isRequired,
            sortOrder: a.sortOrder,
          })),
          usedByMSIs: msiLinks.map(l => ({
            id: l.measureSheetItem.id,
            name: l.measureSheetItem.name,
            categoryName: l.measureSheetItem.category.name,
          })),
          version: upcharge.version,
          updatedAt: upcharge.updatedAt,
          lastModifiedBy: upcharge.lastModifiedBy
            ? {
                id: upcharge.lastModifiedBy.id,
                name: `${upcharge.lastModifiedBy.nameFirst ?? ''} ${upcharge.lastModifiedBy.nameLast ?? ''}`.trim(),
              }
            : null,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get upcharge error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/library/upcharges
 * Create a new upcharge
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
      const parseResult = createUpchargeSchema.safeParse(req.body);
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

      // Validate thumbnail image if provided
      if (data.thumbnailImageId) {
        const image = await em.findOne(PriceGuideImage, {
          id: data.thumbnailImageId,
          company: company.id,
          isActive: true,
        });

        if (!image) {
          res.status(400).json({ error: 'Thumbnail image not found' });
          return;
        }
      }

      const upcharge = new UpCharge();
      upcharge.name = data.name;
      upcharge.note = data.note;
      upcharge.measurementType = data.measurementType;
      upcharge.identifier = data.identifier;
      upcharge.company = em.getReference(Company, company.id);
      upcharge.lastModifiedBy = em.getReference(User, user.id);
      if (data.thumbnailImageId) {
        upcharge.thumbnailImage = em.getReference(
          PriceGuideImage,
          data.thumbnailImageId,
        );
      }

      await em.persistAndFlush(upcharge);

      req.log.info(
        {
          upchargeId: upcharge.id,
          upchargeName: upcharge.name,
          userId: user.id,
        },
        'Upcharge created',
      );

      res.status(201).json({
        message: 'Upcharge created successfully',
        upcharge: {
          id: upcharge.id,
          name: upcharge.name,
          version: upcharge.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create upcharge error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/library/upcharges/:id
 * Update an upcharge
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const parseResult = updateUpchargeSchema.safeParse(req.body);
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

      const upcharge = await em.findOne(
        UpCharge,
        { id, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Check optimistic locking
      if (upcharge.version !== data.version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This upcharge was modified by another user.',
          lastModifiedBy: upcharge.lastModifiedBy
            ? {
                id: upcharge.lastModifiedBy.id,
                email: upcharge.lastModifiedBy.email,
                nameFirst: upcharge.lastModifiedBy.nameFirst,
                nameLast: upcharge.lastModifiedBy.nameLast,
              }
            : null,
          lastModifiedAt: upcharge.updatedAt,
          currentVersion: upcharge.version,
        });
        return;
      }

      // Update fields
      if (data.name !== undefined) upcharge.name = data.name;
      if (data.note !== undefined) upcharge.note = data.note ?? undefined;
      if (data.measurementType !== undefined)
        upcharge.measurementType = data.measurementType ?? undefined;
      if (data.identifier !== undefined)
        upcharge.identifier = data.identifier ?? undefined;

      upcharge.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { upchargeId: upcharge.id, userId: user.id },
        'Upcharge updated',
      );

      res.status(200).json({
        message: 'Upcharge updated successfully',
        upcharge: {
          id: upcharge.id,
          name: upcharge.name,
          version: upcharge.version,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update upcharge error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/library/upcharges/:id/thumbnail
 * Set thumbnail image for an upcharge
 */
router.put(
  '/:id/thumbnail',
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const parseResult = setThumbnailSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { imageId, version } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
        isActive: true,
      });

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Optimistic locking check
      if (upcharge.version !== version) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Upcharge was modified by another user',
          currentVersion: upcharge.version,
        });
        return;
      }

      // Validate image exists and belongs to the company (if setting one)
      if (imageId) {
        const image = await em.findOne(PriceGuideImage, {
          id: imageId,
          company: company.id,
          isActive: true,
        });

        if (!image) {
          res.status(400).json({ error: 'Image not found or inactive' });
          return;
        }

        upcharge.thumbnailImage = em.getReference(PriceGuideImage, imageId);
      } else {
        // Clear thumbnail
        upcharge.thumbnailImage = undefined;
      }

      upcharge.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        {
          upchargeId: id,
          imageId: imageId ?? null,
          userId: user.id,
        },
        'Upcharge thumbnail updated',
      );

      res.status(200).json({
        message: imageId ? 'Thumbnail set successfully' : 'Thumbnail cleared',
        imageId: imageId ?? null,
      });
    } catch (err) {
      req.log.error({ err }, 'Set thumbnail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/library/upcharges/:id
 * Soft delete an upcharge
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
      });

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Warn if in use
      if (upcharge.linkedMsiCount > 0) {
        const force = req.query['force'] === 'true';
        if (!force) {
          res.status(409).json({
            error: 'Upcharge is in use',
            message: `This upcharge is used by ${upcharge.linkedMsiCount} measure sheet item(s). Use ?force=true to delete anyway.`,
            usageCount: upcharge.linkedMsiCount,
          });
          return;
        }
      }

      // Soft delete
      upcharge.isActive = false;
      upcharge.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        {
          upchargeId: upcharge.id,
          upchargeName: upcharge.name,
          userId: user.id,
        },
        'Upcharge deleted',
      );

      res.status(200).json({ message: 'Upcharge deleted successfully' });
    } catch (err) {
      req.log.error({ err }, 'Delete upcharge error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/library/upcharges/:id/disabled-options
 * Get disabled options for an upcharge
 */
router.get(
  '/:id/disabled-options',
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
      });

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      const disabledOptions = await em.find(
        UpChargeDisabledOption,
        { upCharge: upcharge.id },
        { populate: ['option'] },
      );

      res.status(200).json({
        disabledOptions: disabledOptions.map(d => ({
          id: d.option.id,
          name: d.option.name,
          brand: d.option.brand,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Get disabled options error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/library/upcharges/:id/disabled-options
 * Set disabled options for an upcharge
 */
router.put(
  '/:id/disabled-options',
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const parseResult = setDisabledOptionsSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { optionIds } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
      });

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Validate options
      const options = await em.find(PriceGuideOption, {
        id: { $in: optionIds },
        company: company.id,
      });
      const validOptionIds = new Set(options.map(o => o.id));

      // Remove existing disabled options
      await em.nativeDelete(UpChargeDisabledOption, { upCharge: upcharge.id });

      // Create new disabled options
      for (const optionId of optionIds) {
        if (!validOptionIds.has(optionId)) continue;

        const disabled = new UpChargeDisabledOption();
        disabled.upCharge = upcharge;
        disabled.option = em.getReference(PriceGuideOption, optionId);
        em.persist(disabled);
      }

      upcharge.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        {
          upchargeId: upcharge.id,
          disabledCount: optionIds.length,
          userId: user.id,
        },
        'Disabled options updated',
      );

      res.status(200).json({
        message: 'Disabled options updated successfully',
        disabledCount: optionIds.length,
      });
    } catch (err) {
      req.log.error({ err }, 'Set disabled options error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// Additional Details Routes
// ============================================================================

/**
 * GET /price-guide/library/upcharges/:id/additional-details
 * List additional detail fields linked to an upcharge
 */
router.get(
  '/:id/additional-details',
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
      });

      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      const links = await em.find(
        UpChargeAdditionalDetailField,
        { upCharge: upcharge.id },
        {
          populate: ['additionalDetailField'],
          orderBy: { sortOrder: 'ASC' },
        },
      );

      res.status(200).json({
        additionalDetails: links.map(l => ({
          junctionId: l.id,
          fieldId: l.additionalDetailField.id,
          title: l.additionalDetailField.title,
          inputType: l.additionalDetailField.inputType,
          cellType: l.additionalDetailField.cellType,
          isRequired: l.additionalDetailField.isRequired,
          placeholder: l.additionalDetailField.placeholder,
          note: l.additionalDetailField.note,
          defaultValue: l.additionalDetailField.defaultValue,
          sortOrder: l.sortOrder,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Get upcharge additional details error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/library/upcharges/:id/additional-details
 * Link additional detail fields to an upcharge
 */
router.post(
  '/:id/additional-details',
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const parseResult = linkAdditionalDetailsSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { fieldIds } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
      });
      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      // Get existing links
      const existingLinks = await em.find(UpChargeAdditionalDetailField, {
        upCharge: upcharge.id,
      });
      const existingFieldIds = new Set(
        existingLinks.map(l => l.additionalDetailField.id),
      );

      // Get max sort order
      const maxSortOrder = Math.max(0, ...existingLinks.map(l => l.sortOrder));

      // Validate and create new links
      const fields = await em.find(AdditionalDetailField, {
        id: { $in: fieldIds },
        company: company.id,
        isActive: true,
      });

      let linked = 0;
      let sortOrder = maxSortOrder + 1;

      for (const fieldId of fieldIds) {
        if (existingFieldIds.has(fieldId)) continue;

        const field = fields.find(f => f.id === fieldId);
        if (!field) continue;

        const link = new UpChargeAdditionalDetailField();
        link.upCharge = upcharge;
        link.additionalDetailField = em.getReference(
          AdditionalDetailField,
          fieldId,
        );
        link.sortOrder = sortOrder++;
        em.persist(link);
        linked++;
      }

      upcharge.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { upchargeId: upcharge.id, linkedFields: linked, userId: user.id },
        'Additional details linked to upcharge',
      );

      res.status(200).json({
        success: true,
        linked,
        warnings: [],
      });
    } catch (err) {
      req.log.error({ err }, 'Link upcharge additional details error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/library/upcharges/:id/additional-details/:fieldId
 * Unlink an additional detail field from an upcharge
 */
router.delete(
  '/:id/additional-details/:fieldId',
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
      const { id, fieldId } = req.params;
      if (!id || !fieldId) {
        res
          .status(400)
          .json({ error: 'Upcharge ID and field ID are required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
      });
      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      const link = await em.findOne(UpChargeAdditionalDetailField, {
        upCharge: upcharge.id,
        additionalDetailField: fieldId,
      });
      if (!link) {
        res.status(404).json({ error: 'Additional detail link not found' });
        return;
      }

      em.remove(link);
      upcharge.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { upchargeId: upcharge.id, fieldId, userId: user.id },
        'Additional detail unlinked from upcharge',
      );

      res
        .status(200)
        .json({ message: 'Additional detail unlinked successfully' });
    } catch (err) {
      req.log.error({ err }, 'Unlink upcharge additional detail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/library/upcharges/:id/additional-details/order
 * Reorder additional detail fields for an upcharge
 */
router.put(
  '/:id/additional-details/order',
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
        res.status(400).json({ error: 'Upcharge ID is required' });
        return;
      }

      const parseResult = reorderAdditionalDetailsSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { orderedIds } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const upcharge = await em.findOne(UpCharge, {
        id,
        company: company.id,
      });
      if (!upcharge) {
        res.status(404).json({ error: 'Upcharge not found' });
        return;
      }

      const links = await em.find(UpChargeAdditionalDetailField, {
        upCharge: upcharge.id,
      });
      const linkMap = new Map(links.map(l => [l.id, l]));

      for (let i = 0; i < orderedIds.length; i++) {
        const link = linkMap.get(orderedIds[i]!);
        if (link) {
          link.sortOrder = i;
        }
      }

      upcharge.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { upchargeId: upcharge.id, userId: user.id },
        'Upcharge additional details reordered',
      );

      res
        .status(200)
        .json({ message: 'Additional details reordered successfully' });
    } catch (err) {
      req.log.error({ err }, 'Reorder upcharge additional details error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
