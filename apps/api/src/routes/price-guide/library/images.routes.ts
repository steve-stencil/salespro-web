import { Router } from 'express';
import { z } from 'zod';

import {
  PriceGuideImage,
  MeasureSheetItem,
  UpCharge,
  User,
  ItemTag,
  TaggableEntityType,
} from '../../../entities';
import { getORM } from '../../../lib/db';
import { PERMISSIONS } from '../../../lib/permissions';
import { getStorageAdapter } from '../../../lib/storage';
import {
  requireAuth,
  requirePermission,
  uploadSingle,
  handleUploadError,
} from '../../../middleware';
import { FileService } from '../../../services';

import type { Company } from '../../../entities';
import type { AuthenticatedRequest } from '../../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/postgresql';
import type {
  Request,
  Response,
  NextFunction,
  Router as RouterType,
} from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  tags: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return undefined;
      // Parse comma-separated tag UUIDs
      return val.split(',').filter(id => id.trim().length > 0);
    }),
});

const createImageSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

const updateImageSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
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

/** Presigned URL expiration for images (1 hour) */
const IMAGE_URL_EXPIRES_IN = 3600;

/**
 * Type guard to check if a loaded File relation has a valid storageKey.
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
 * GET /price-guide/library/images
 * List images with cursor-based pagination
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
        .createQueryBuilder(PriceGuideImage, 'i')
        .select('*')
        .where({ company: company.id, isActive: true });

      // Full-text search
      if (search) {
        qb.andWhere({
          $or: [
            { name: { $ilike: `%${search}%` } },
            { description: { $ilike: `%${search}%` } },
            { searchVector: { $ilike: `%${search}%` } },
          ],
        });
      }

      // Tag filtering (OR logic - matches any of the provided tags)
      if (tags && tags.length > 0) {
        const knex = em.getKnex();
        const taggedRows = await knex('item_tag')
          .select('entity_id')
          .where('entity_type', TaggableEntityType.PRICE_GUIDE_IMAGE as string)
          .whereIn('tag_id', tags);

        const filteredImageIds = taggedRows.map(
          (row: { entity_id: string }) => row.entity_id,
        );

        if (filteredImageIds.length === 0) {
          res.status(200).json({
            items: [],
            nextCursor: undefined,
            hasMore: false,
            total: 0,
          });
          return;
        }

        qb.andWhere({ id: { $in: filteredImageIds } });
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

      // Load file relationships for presigned URLs
      await em.populate(items, ['file']);

      // Get total count
      const totalCount = await em.count(PriceGuideImage, {
        company: company.id,
        isActive: true,
      });

      // Load tags for all images in one query
      const imageIds = items.map(img => img.id);
      const itemTags =
        imageIds.length > 0
          ? await em.find(
              ItemTag,
              {
                entityType: TaggableEntityType.PRICE_GUIDE_IMAGE,
                entityId: { $in: imageIds },
              },
              { populate: ['tag'] },
            )
          : [];

      // Group tags by image ID
      const tagsByImageId = new Map<
        string,
        Array<{ id: string; name: string; color: string }>
      >();
      for (const itemTag of itemTags) {
        const tags = tagsByImageId.get(itemTag.entityId) ?? [];
        tags.push({
          id: itemTag.tag.id,
          name: itemTag.tag.name,
          color: itemTag.tag.color,
        });
        tagsByImageId.set(itemTag.entityId, tags);
      }

      // Compute linked counts for each image
      const linkedMsiCounts = new Map<string, number>();
      const linkedUpchargeCounts = new Map<string, number>();

      if (imageIds.length > 0) {
        // Count MSIs using each image as thumbnail
        const knex = em.getKnex();
        const msiCounts = await knex('measure_sheet_item')
          .select('thumbnail_image_id')
          .count('* as count')
          .whereIn('thumbnail_image_id', imageIds)
          .where('is_active', true)
          .groupBy('thumbnail_image_id');

        for (const row of msiCounts as Array<Record<string, unknown>>) {
          linkedMsiCounts.set(
            row['thumbnail_image_id'] as string,
            Number(row['count']),
          );
        }

        // Count UpCharges using each image as thumbnail
        const upchargeCounts = await knex('up_charge')
          .select('thumbnail_image_id')
          .count('* as count')
          .whereIn('thumbnail_image_id', imageIds)
          .where('is_active', true)
          .groupBy('thumbnail_image_id');

        for (const row of upchargeCounts as Array<Record<string, unknown>>) {
          linkedUpchargeCounts.set(
            row['thumbnail_image_id'] as string,
            Number(row['count']),
          );
        }
      }

      // Generate presigned URLs for all images
      const formattedItems = await Promise.all(
        items.map(async image => {
          const urls = await getImageUrls(image.file);
          return {
            id: image.id,
            name: image.name,
            description: image.description ?? null,
            linkedMsiCount: linkedMsiCounts.get(image.id) ?? 0,
            linkedUpchargeCount: linkedUpchargeCounts.get(image.id) ?? 0,
            imageUrl: urls.imageUrl,
            thumbnailUrl: urls.thumbnailUrl,
            tags: tagsByImageId.get(image.id) ?? [],
            createdAt: image.createdAt.toISOString(),
            updatedAt: image.updatedAt.toISOString(),
          };
        }),
      );

      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? encodeCursor(lastItem.name, lastItem.id)
          : undefined;

      res.status(200).json({
        items: formattedItems,
        nextCursor,
        hasMore,
        total: totalCount,
      });
    } catch (err) {
      req.log.error({ err }, 'List images error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/library/images/:id
 * Get image detail with linked MSIs and UpCharges
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
        res.status(400).json({ error: 'Image ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const image = await em.findOne(
        PriceGuideImage,
        { id, company: company.id, isActive: true },
        { populate: ['file', 'lastModifiedBy'] },
      );

      if (!image) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      // Find MSIs using this image as thumbnail
      const linkedMsis = await em.find(
        MeasureSheetItem,
        { thumbnailImage: image.id, isActive: true },
        { fields: ['id', 'name'], orderBy: { name: 'ASC' } },
      );

      // Find UpCharges using this image as thumbnail
      const linkedUpcharges = await em.find(
        UpCharge,
        { thumbnailImage: image.id, isActive: true },
        { fields: ['id', 'name'], orderBy: { name: 'ASC' } },
      );

      const urls = await getImageUrls(image.file);

      res.status(200).json({
        item: {
          id: image.id,
          name: image.name,
          description: image.description ?? null,
          linkedMsiCount: linkedMsis.length,
          linkedUpchargeCount: linkedUpcharges.length,
          imageUrl: urls.imageUrl,
          thumbnailUrl: urls.thumbnailUrl,
          version: image.version,
          lastModifiedBy: image.lastModifiedBy
            ? {
                id: image.lastModifiedBy.id,
                name: `${image.lastModifiedBy.nameFirst ?? ''} ${image.lastModifiedBy.nameLast ?? ''}`.trim(),
              }
            : null,
          createdAt: image.createdAt.toISOString(),
          updatedAt: image.updatedAt.toISOString(),
          linkedMsis: linkedMsis.map(msi => ({
            id: msi.id,
            name: msi.name,
          })),
          linkedUpcharges: linkedUpcharges.map(uc => ({
            id: uc.id,
            name: uc.name,
          })),
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get image detail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/library/images
 * Upload a new image to the library (multipart form data)
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  uploadSingle,
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    handleUploadError(err, req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const authReq = req as Request & { file?: Express.Multer.File };
      const uploadedFile = authReq.file;

      if (!uploadedFile) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      // Validate that it's an image
      if (!uploadedFile.mimetype.startsWith('image/')) {
        res.status(400).json({ error: 'File must be an image' });
        return;
      }

      // Parse metadata from body
      const parseResult = createImageSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid request data',
          details: parseResult.error.issues,
        });
        return;
      }

      const { name, description } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;
      const fileService = new FileService(em);

      // Upload file to storage
      const file = await fileService.uploadFile({
        buffer: uploadedFile.buffer,
        filename: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        user,
        company,
      });

      // Create PriceGuideImage record
      const priceGuideImage = em.create(PriceGuideImage, {
        company,
        name,
        description,
        file,
        lastModifiedBy: user,
        searchVector: `${name} ${description ?? ''}`.trim(),
      });

      await em.persistAndFlush(priceGuideImage);

      const urls = await getImageUrls(file);

      req.log.info(
        {
          imageId: priceGuideImage.id,
          imageName: name,
          fileId: file.id,
          userId: user.id,
        },
        'Price guide image created',
      );

      res.status(201).json({
        item: {
          id: priceGuideImage.id,
          name: priceGuideImage.name,
          description: priceGuideImage.description ?? null,
          linkedMsiCount: 0,
          linkedUpchargeCount: 0,
          imageUrl: urls.imageUrl,
          thumbnailUrl: urls.thumbnailUrl,
          version: priceGuideImage.version,
          createdAt: priceGuideImage.createdAt.toISOString(),
          updatedAt: priceGuideImage.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create image error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/library/images/:id
 * Update image metadata (name, description)
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
        res.status(400).json({ error: 'Image ID is required' });
        return;
      }

      const parseResult = updateImageSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid request data',
          details: parseResult.error.issues,
        });
        return;
      }

      const { name, description, version } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const image = await em.findOne(
        PriceGuideImage,
        { id, company: company.id, isActive: true },
        { populate: ['file'] },
      );

      if (!image) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      // Optimistic locking check
      if (image.version !== version) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Image was modified by another user',
          currentVersion: image.version,
        });
        return;
      }

      // Update fields
      if (name !== undefined) {
        image.name = name;
      }
      if (description !== undefined) {
        image.description = description ?? undefined;
      }

      // Update search vector
      image.searchVector = `${image.name} ${image.description ?? ''}`.trim();
      image.lastModifiedBy = em.getReference(User, user.id);

      await em.flush();

      const urls = await getImageUrls(image.file);

      req.log.info(
        {
          imageId: id,
          imageName: image.name,
          userId: user.id,
        },
        'Price guide image updated',
      );

      // Compute linked counts
      const linkedMsiCount = await em.count(MeasureSheetItem, {
        thumbnailImage: image.id,
        isActive: true,
      });
      const linkedUpchargeCount = await em.count(UpCharge, {
        thumbnailImage: image.id,
        isActive: true,
      });

      res.status(200).json({
        item: {
          id: image.id,
          name: image.name,
          description: image.description ?? null,
          linkedMsiCount,
          linkedUpchargeCount,
          imageUrl: urls.imageUrl,
          thumbnailUrl: urls.thumbnailUrl,
          version: image.version,
          createdAt: image.createdAt.toISOString(),
          updatedAt: image.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update image error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/library/images/:id
 * Hard delete an image - removes from database AND storage (with force option if linked)
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
      const force = req.query['force'] === 'true';

      if (!id) {
        res.status(400).json({ error: 'Image ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const image = await em.findOne(
        PriceGuideImage,
        {
          id,
          company: company.id,
          isActive: true,
        },
        { populate: ['file'] },
      );

      if (!image) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      // Compute linked counts
      const linkedMsiCount = await em.count(MeasureSheetItem, {
        thumbnailImage: image.id,
        isActive: true,
      });
      const linkedUpchargeCount = await em.count(UpCharge, {
        thumbnailImage: image.id,
        isActive: true,
      });
      const totalLinked = linkedMsiCount + linkedUpchargeCount;

      // Check if linked and not forcing
      if (totalLinked > 0 && !force) {
        res.status(400).json({
          error: 'Cannot delete image that is linked to items',
          linkedMsiCount,
          linkedUpchargeCount,
          message: `This image is linked to ${linkedMsiCount} MSI(s) and ${linkedUpchargeCount} UpCharge(s). Use force=true to delete anyway.`,
        });
        return;
      }

      // If force deleting, remove all links first (set thumbnailImage to null)
      if (totalLinked > 0 && force) {
        await em.nativeUpdate(
          MeasureSheetItem,
          { thumbnailImage: id },
          { thumbnailImage: null },
        );
        await em.nativeUpdate(
          UpCharge,
          { thumbnailImage: id },
          { thumbnailImage: null },
        );
      }

      // Get the file ID before deleting the image
      const fileId = image.file.id;
      const imageName = image.name;

      // Soft delete the PriceGuideImage first
      image.isActive = false;
      image.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      // Now delete the underlying File entity and storage files
      const fileService = new FileService(em);
      try {
        await fileService.deleteFile(fileId, company.id);
      } catch (fileErr) {
        // Log but don't fail - the PriceGuideImage is already soft deleted
        req.log.warn(
          { err: fileErr, fileId, imageId: id },
          'Failed to delete underlying file, PriceGuideImage already soft deleted',
        );
      }

      req.log.info(
        {
          imageId: id,
          imageName,
          fileId,
          userId: user.id,
          forced: force,
          unlinkedMsis: force ? linkedMsiCount : 0,
          unlinkedUpcharges: force ? linkedUpchargeCount : 0,
        },
        'Price guide image and file deleted',
      );

      res.status(200).json({
        message: 'Image deleted successfully',
      });
    } catch (err) {
      req.log.error({ err }, 'Delete image error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/library/images/:id/where-used
 * Get detailed list of where the image is used
 */
router.get(
  '/:id/where-used',
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
        res.status(400).json({ error: 'Image ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const image = await em.findOne(PriceGuideImage, {
        id,
        company: company.id,
        isActive: true,
      });

      if (!image) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      // Find MSIs using this image as thumbnail
      const linkedMsis = await em.find(
        MeasureSheetItem,
        { thumbnailImage: image.id, isActive: true },
        { populate: ['category'], orderBy: { name: 'ASC' } },
      );

      // Find UpCharges using this image as thumbnail
      const linkedUpcharges = await em.find(
        UpCharge,
        { thumbnailImage: image.id, isActive: true },
        { orderBy: { name: 'ASC' } },
      );

      res.status(200).json({
        msis: linkedMsis.map(msi => ({
          id: msi.id,
          name: msi.name,
          category: {
            id: msi.category.id,
            name: msi.category.name,
          },
        })),
        upcharges: linkedUpcharges.map(uc => ({
          id: uc.id,
          name: uc.name,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Get image where-used error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
