import { raw } from '@mikro-orm/postgresql';
import { Router } from 'express';
import { z } from 'zod';

import {
  MeasureSheetItem,
  PriceGuideCategory,
  PriceGuideOption,
  UpCharge,
  AdditionalDetailField,
  MeasureSheetItemOffice,
  MeasureSheetItemOption,
  MeasureSheetItemUpCharge,
  MeasureSheetItemAdditionalDetailField,
  Office,
  Company,
  User,
  File,
} from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { getStorageAdapter } from '../../lib/storage';
import { requireAuth, requirePermission } from '../../middleware';
import { FileService } from '../../services';

import type { AuthenticatedRequest } from '../../middleware/requireAuth';
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
  categoryIds: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return undefined;
      // Parse comma-separated UUIDs
      return val.split(',').filter(id => id.trim().length > 0);
    }),
  officeIds: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return undefined;
      // Parse comma-separated UUIDs
      return val.split(',').filter(id => id.trim().length > 0);
    }),
});

/**
 * Create MSI validation schema.
 * Note: MSIs require at least one option for pricing. See ADR-003.
 */
const createMsiSchema = z.object({
  name: z.string().min(1).max(255),
  categoryId: z.string().uuid(),
  measurementType: z.string().min(1).max(50),
  note: z.string().max(2000).optional(),
  defaultQty: z.number().min(0).default(1),
  showSwitch: z.boolean().default(false),
  formulaId: z.string().max(255).optional(),
  qtyFormula: z.string().max(255).optional(),
  tagTitle: z.string().max(255).optional(),
  tagRequired: z.boolean().default(false),
  tagPickerOptions: z.array(z.unknown()).optional(),
  tagParams: z.record(z.string(), z.unknown()).optional(),
  /** File ID for product thumbnail image */
  imageId: z.string().uuid().optional(),
  officeIds: z
    .array(z.string().uuid())
    .min(1, 'At least one office is required'),
  // At least one option is required for pricing. See ADR-003.
  optionIds: z
    .array(z.string().uuid())
    .min(1, 'At least one option is required for pricing'),
  upchargeIds: z.array(z.string().uuid()).optional(),
  additionalDetailFieldIds: z.array(z.string().uuid()).optional(),
});

const updateMsiSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  categoryId: z.string().uuid().optional(),
  measurementType: z.string().min(1).max(50).optional(),
  note: z.string().max(2000).optional().nullable(),
  defaultQty: z.number().min(0).optional(),
  showSwitch: z.boolean().optional(),
  formulaId: z.string().max(255).optional().nullable(),
  qtyFormula: z.string().max(255).optional().nullable(),
  tagTitle: z.string().max(255).optional().nullable(),
  tagRequired: z.boolean().optional(),
  tagPickerOptions: z.array(z.unknown()).optional().nullable(),
  tagParams: z.record(z.string(), z.unknown()).optional().nullable(),
  /** File ID for product thumbnail image (null to remove) */
  imageId: z.string().uuid().optional().nullable(),
  version: z.number().int().min(1),
});

const linkOptionsSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1),
});

const linkUpchargesSchema = z.object({
  upchargeIds: z.array(z.string().uuid()).min(1),
});

const linkAdditionalDetailsSchema = z.object({
  fieldIds: z.array(z.string().uuid()).min(1),
});

const syncOfficesSchema = z.object({
  officeIds: z
    .array(z.string().uuid())
    .min(1, 'At least one office is required'),
  version: z.number().int().min(1),
});

const reorderSchema = z.object({
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

/**
 * Decode cursor for pagination.
 */
function decodeCursor(
  cursor: string,
): { sortOrder: number; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [sortOrder, id] = decoded.split(':');
    return { sortOrder: parseFloat(sortOrder!), id: id! };
  } catch {
    return null;
  }
}

/**
 * Encode cursor for pagination.
 */
function encodeCursor(sortOrder: number, id: string): string {
  return Buffer.from(`${sortOrder}:${id}`).toString('base64');
}

/**
 * Build category full path.
 */
async function getCategoryPath(
  em: ReturnType<ReturnType<typeof getORM>['em']['fork']>,
  category: PriceGuideCategory,
): Promise<string> {
  const pathParts: string[] = [category.name];
  let current = category;

  while (current.parent) {
    await em.populate(current, ['parent']);
    pathParts.unshift(current.parent.name);
    current = current.parent;
  }

  return pathParts.join(' > ');
}

/**
 * Get all descendant category IDs for a given category (including the category itself).
 * This enables filtering items by a parent category to include all items in subcategories.
 */
async function getDescendantCategoryIds(
  em: EntityManager,
  categoryId: string,
  companyId: string,
): Promise<string[]> {
  // Use a recursive CTE to get all descendants efficiently
  const result = await em.getConnection().execute<{ id: string }[]>(
    `WITH RECURSIVE category_tree AS (
      -- Base case: the selected category
      SELECT id FROM price_guide_category 
      WHERE id = ? AND company_id = ? AND is_active = true
      
      UNION ALL
      
      -- Recursive case: all children
      SELECT c.id FROM price_guide_category c
      INNER JOIN category_tree ct ON c.parent_id = ct.id
      WHERE c.company_id = ? AND c.is_active = true
    )
    SELECT id FROM category_tree`,
    [categoryId, companyId, companyId],
  );

  return result.map(r => r.id);
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
 * GET /price-guide/measure-sheet-items
 * List MSIs with cursor-based pagination
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

      const { cursor, limit, search, categoryIds, officeIds } =
        parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Build query
      const qb = em
        .createQueryBuilder(MeasureSheetItem, 'msi')
        .select('*')
        .where({ company: company.id, isActive: true });

      // Category filter - include items in subcategories (supports multiple categories)
      let allCategoryIds: string[] = [];
      if (categoryIds && categoryIds.length > 0) {
        // Get descendants for each selected category
        for (const catId of categoryIds) {
          const descendants = await getDescendantCategoryIds(
            em,
            catId,
            company.id,
          );
          if (descendants.length > 0) {
            allCategoryIds.push(...descendants);
          } else {
            // Category not found or has no descendants, include original ID
            allCategoryIds.push(catId);
          }
        }
        // Remove duplicates
        allCategoryIds = [...new Set(allCategoryIds)];
        if (allCategoryIds.length > 0) {
          qb.andWhere({ category: { $in: allCategoryIds } });
        }
      }

      // Office filter via junction table (supports multiple offices)
      if (officeIds && officeIds.length > 0) {
        qb.andWhere({
          id: {
            $in: em
              .createQueryBuilder(MeasureSheetItemOffice, 'msio')
              .select('msio.measure_sheet_item_id')
              .where({ office: { $in: officeIds } })
              .getKnexQuery(),
          },
        });
      }

      // Full-text search
      if (search) {
        qb.andWhere({
          $or: [
            { name: { $ilike: `%${search}%` } },
            { searchVector: { $ilike: `%${search}%` } },
          ],
        });
      }

      // Cursor pagination
      if (cursor) {
        const decoded = decodeCursor(cursor);
        if (decoded) {
          qb.andWhere({
            $or: [
              { sortOrder: { $gt: decoded.sortOrder } },
              {
                sortOrder: decoded.sortOrder,
                id: { $gt: decoded.id },
              },
            ],
          });
        }
      }

      // Order and limit
      qb.orderBy({ sortOrder: 'ASC', id: 'ASC' }).limit(limit + 1);

      const items = await qb.getResultList();
      const hasMore = items.length > limit;
      if (hasMore) items.pop();

      // Load relationships (including image file for presigned URLs)
      await em.populate(items, ['category', 'image']);

      // Get counts and names for each MSI
      const msiIds = items.map(i => i.id);
      const knex = em.getKnex();
      const [officeData, optionData, upchargeData] = await Promise.all([
        // Office counts and names
        knex.raw<{
          rows: { msi_id: string; count: number; names: string[] }[];
        }>(
          `SELECT 
            msi_o.measure_sheet_item_id as msi_id, 
            count(*)::int as count,
            array_agg(o.name ORDER BY o.name) as names
          FROM measure_sheet_item_office msi_o
          JOIN office o ON o.id = msi_o.office_id
          WHERE msi_o.measure_sheet_item_id = ANY(?)
          GROUP BY msi_o.measure_sheet_item_id`,
          [msiIds],
        ),
        // Option counts and names
        knex.raw<{
          rows: { msi_id: string; count: number; names: string[] }[];
        }>(
          `SELECT 
            msi_o.measure_sheet_item_id as msi_id, 
            count(*)::int as count,
            array_agg(opt.name ORDER BY opt.name) as names
          FROM measure_sheet_item_option msi_o
          JOIN price_guide_option opt ON opt.id = msi_o.option_id
          WHERE msi_o.measure_sheet_item_id = ANY(?)
          GROUP BY msi_o.measure_sheet_item_id`,
          [msiIds],
        ),
        // Upcharge counts and names
        knex.raw<{
          rows: { msi_id: string; count: number; names: string[] }[];
        }>(
          `SELECT 
            msi_u.measure_sheet_item_id as msi_id, 
            count(*)::int as count,
            array_agg(uc.name ORDER BY uc.name) as names
          FROM measure_sheet_item_up_charge msi_u
          JOIN up_charge uc ON uc.id = msi_u.up_charge_id
          WHERE msi_u.measure_sheet_item_id = ANY(?)
          GROUP BY msi_u.measure_sheet_item_id`,
          [msiIds],
        ),
      ]);

      const officeMap = new Map(
        officeData.rows.map(r => [
          r.msi_id,
          { count: r.count, names: r.names },
        ]),
      );
      const optionMap = new Map(
        optionData.rows.map(r => [
          r.msi_id,
          { count: r.count, names: r.names },
        ]),
      );
      const upchargeMap = new Map(
        upchargeData.rows.map(r => [
          r.msi_id,
          { count: r.count, names: r.names },
        ]),
      );

      // Build response
      const responseItems = await Promise.all(
        items.map(async msi => {
          const office = officeMap.get(msi.id);
          const option = optionMap.get(msi.id);
          const upcharge = upchargeMap.get(msi.id);
          const { imageUrl, thumbnailUrl } = await getImageUrls(msi.image);
          return {
            id: msi.id,
            name: msi.name,
            category: {
              id: msi.category.id,
              name: msi.category.name,
              fullPath: await getCategoryPath(em, msi.category),
            },
            measurementType: msi.measurementType,
            officeCount: office?.count ?? 0,
            optionCount: option?.count ?? 0,
            upchargeCount: upcharge?.count ?? 0,
            officeNames: office?.names ?? [],
            optionNames: option?.names ?? [],
            upchargeNames: upcharge?.names ?? [],
            imageUrl,
            thumbnailUrl,
            sortOrder: msi.sortOrder,
          };
        }),
      );

      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? encodeCursor(lastItem.sortOrder, lastItem.id)
          : undefined;

      // Get total count (without pagination)
      const totalQb = em
        .createQueryBuilder(MeasureSheetItem, 'msi')
        .count()
        .where({ company: company.id, isActive: true });
      // Use the same allCategoryIds for total count (includes subcategories)
      if (allCategoryIds.length > 0) {
        totalQb.andWhere({ category: { $in: allCategoryIds } });
      }
      // Office filter for total count
      if (officeIds && officeIds.length > 0) {
        totalQb.andWhere({
          id: {
            $in: em
              .createQueryBuilder(MeasureSheetItemOffice, 'msio')
              .select('msio.measure_sheet_item_id')
              .where({ office: { $in: officeIds } })
              .getKnexQuery(),
          },
        });
      }
      if (search) {
        totalQb.andWhere({
          $or: [
            { name: { $ilike: `%${search}%` } },
            { searchVector: { $ilike: `%${search}%` } },
          ],
        });
      }
      const total = await totalQb.execute<{ count: string }[]>();

      res.status(200).json({
        items: responseItems,
        nextCursor,
        hasMore,
        total: parseInt(total[0]?.count ?? '0', 10),
      });
    } catch (err) {
      req.log.error({ err }, 'List MSIs error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/measure-sheet-items/:id
 * Get MSI detail
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
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const msi = await em.findOne(
        MeasureSheetItem,
        { id, company: company.id },
        { populate: ['category', 'lastModifiedBy', 'image'] },
      );

      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      // Load linked entities
      const [offices, options, upcharges, additionalDetails] =
        await Promise.all([
          em.find(
            MeasureSheetItemOffice,
            { measureSheetItem: msi.id },
            { populate: ['office'] },
          ),
          em.find(
            MeasureSheetItemOption,
            { measureSheetItem: msi.id },
            { populate: ['option'], orderBy: { sortOrder: 'ASC' } },
          ),
          em.find(
            MeasureSheetItemUpCharge,
            { measureSheetItem: msi.id },
            { populate: ['upCharge'], orderBy: { sortOrder: 'ASC' } },
          ),
          em.find(
            MeasureSheetItemAdditionalDetailField,
            { measureSheetItem: msi.id },
            {
              populate: ['additionalDetailField'],
              orderBy: { sortOrder: 'ASC' },
            },
          ),
        ]);

      // Generate presigned URLs for image
      const { imageUrl, thumbnailUrl } = await getImageUrls(msi.image);

      res.status(200).json({
        item: {
          id: msi.id,
          name: msi.name,
          category: {
            id: msi.category.id,
            name: msi.category.name,
            fullPath: await getCategoryPath(em, msi.category),
          },
          measurementType: msi.measurementType,
          note: msi.note,
          defaultQty: msi.defaultQty,
          showSwitch: msi.showSwitch,
          formulaId: msi.formulaId,
          qtyFormula: msi.qtyFormula,
          tagTitle: msi.tagTitle,
          tagRequired: msi.tagRequired,
          tagPickerOptions: msi.tagPickerOptions,
          tagParams: msi.tagParams,
          imageId: msi.image?.id ?? null,
          imageUrl,
          thumbnailUrl,
          sortOrder: msi.sortOrder,
          offices: offices.map(o => ({
            id: o.office.id,
            name: o.office.name,
          })),
          options: options.map(o => ({
            junctionId: o.id,
            optionId: o.option.id,
            name: o.option.name,
            brand: o.option.brand,
            itemCode: o.option.itemCode,
            sortOrder: o.sortOrder,
            usageCount: o.option.linkedMsiCount,
          })),
          upcharges: upcharges.map(u => ({
            junctionId: u.id,
            upchargeId: u.upCharge.id,
            name: u.upCharge.name,
            note: u.upCharge.note,
            sortOrder: u.sortOrder,
            usageCount: u.upCharge.linkedMsiCount,
          })),
          additionalDetails: additionalDetails.map(a => ({
            junctionId: a.id,
            fieldId: a.additionalDetailField.id,
            title: a.additionalDetailField.title,
            inputType: a.additionalDetailField.inputType,
            cellType: a.additionalDetailField.cellType,
            isRequired: a.additionalDetailField.isRequired,
            sortOrder: a.sortOrder,
          })),
          isActive: msi.isActive,
          version: msi.version,
          updatedAt: msi.updatedAt,
          lastModifiedAt: msi.updatedAt.toISOString(),
          lastModifiedBy: msi.lastModifiedBy
            ? {
                id: msi.lastModifiedBy.id,
                name:
                  `${msi.lastModifiedBy.nameFirst ?? ''} ${msi.lastModifiedBy.nameLast ?? ''}`.trim() ||
                  msi.lastModifiedBy.email,
              }
            : null,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get MSI detail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/measure-sheet-items
 * Create a new MSI
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
      const parseResult = createMsiSchema.safeParse(req.body);
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

      // Validate category
      const category = await em.findOne(PriceGuideCategory, {
        id: data.categoryId,
        company: company.id,
      });
      if (!category) {
        res.status(400).json({ error: 'Category not found' });
        return;
      }

      // Validate offices
      const offices = await em.find(Office, {
        id: { $in: data.officeIds },
        company: company.id,
      });
      if (offices.length !== data.officeIds.length) {
        res.status(400).json({ error: 'One or more offices not found' });
        return;
      }

      // Validate image file if provided
      let imageFile: File | undefined;
      if (data.imageId) {
        const file = await em.findOne(File, {
          id: data.imageId,
          company: company.id,
        });
        if (!file) {
          res.status(400).json({ error: 'Image file not found' });
          return;
        }
        if (!file.isImage) {
          res.status(400).json({ error: 'File is not an image' });
          return;
        }
        imageFile = file;
      }

      // Get next sort order
      const maxSortOrder = await em
        .createQueryBuilder(MeasureSheetItem, 'm')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- raw() returns RawQueryFragment which isn't assignable to Field<T>
        .select(raw('max(m.sort_order) as max'))
        .where({ company: company.id })
        .execute<{ max: number | null }[]>();
      const sortOrder = (maxSortOrder[0]?.max ?? -1) + 1;

      // Create MSI
      const msi = new MeasureSheetItem();
      msi.name = data.name;
      msi.company = em.getReference(Company, company.id);
      msi.category = em.getReference(PriceGuideCategory, data.categoryId);
      msi.measurementType = data.measurementType;
      msi.note = data.note;
      msi.defaultQty = data.defaultQty;
      msi.showSwitch = data.showSwitch;
      msi.formulaId = data.formulaId;
      msi.qtyFormula = data.qtyFormula;
      msi.tagTitle = data.tagTitle;
      msi.tagRequired = data.tagRequired;
      msi.tagPickerOptions = data.tagPickerOptions;
      msi.tagParams = data.tagParams;
      msi.image = imageFile;
      msi.sortOrder = sortOrder;
      msi.searchVector = `${data.name} ${data.note ?? ''}`.trim();
      msi.lastModifiedBy = em.getReference(User, user.id);

      em.persist(msi);

      // Create office links
      for (const officeId of data.officeIds) {
        const link = new MeasureSheetItemOffice();
        link.measureSheetItem = msi;
        link.office = em.getReference(Office, officeId);
        em.persist(link);
      }

      // Create option links (required - at least one option needed)
      if (data.optionIds.length > 0) {
        const options = await em.find(PriceGuideOption, {
          id: { $in: data.optionIds },
          company: company.id,
        });
        for (let i = 0; i < data.optionIds.length; i++) {
          const optionId = data.optionIds[i]!;
          if (options.some(o => o.id === optionId)) {
            const link = new MeasureSheetItemOption();
            link.measureSheetItem = msi;
            link.option = em.getReference(PriceGuideOption, optionId);
            link.sortOrder = i;
            em.persist(link);
          }
        }
      }

      // Create upcharge links
      if (data.upchargeIds?.length) {
        const upcharges = await em.find(UpCharge, {
          id: { $in: data.upchargeIds },
          company: company.id,
        });
        for (let i = 0; i < data.upchargeIds.length; i++) {
          const upchargeId = data.upchargeIds[i]!;
          if (upcharges.some(u => u.id === upchargeId)) {
            const link = new MeasureSheetItemUpCharge();
            link.measureSheetItem = msi;
            link.upCharge = em.getReference(UpCharge, upchargeId);
            link.sortOrder = i;
            em.persist(link);
          }
        }
      }

      // Create additional detail field links
      if (data.additionalDetailFieldIds?.length) {
        const fields = await em.find(AdditionalDetailField, {
          id: { $in: data.additionalDetailFieldIds },
          company: company.id,
        });
        for (let i = 0; i < data.additionalDetailFieldIds.length; i++) {
          const fieldId = data.additionalDetailFieldIds[i]!;
          if (fields.some(f => f.id === fieldId)) {
            const link = new MeasureSheetItemAdditionalDetailField();
            link.measureSheetItem = msi;
            link.additionalDetailField = em.getReference(
              AdditionalDetailField,
              fieldId,
            );
            link.sortOrder = i;
            em.persist(link);
          }
        }
      }

      await em.flush();

      req.log.info(
        { msiId: msi.id, msiName: msi.name, userId: user.id },
        'MSI created',
      );

      res.status(201).json({
        message: 'Measure sheet item created successfully',
        item: { id: msi.id, name: msi.name, version: msi.version },
      });
    } catch (err) {
      req.log.error({ err }, 'Create MSI error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/measure-sheet-items/:id
 * Update an MSI
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
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      const parseResult = updateMsiSchema.safeParse(req.body);
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

      const msi = await em.findOne(
        MeasureSheetItem,
        { id, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      // Check optimistic locking
      if (msi.version !== data.version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This item was modified by another user.',
          lastModifiedBy: msi.lastModifiedBy
            ? {
                id: msi.lastModifiedBy.id,
                email: msi.lastModifiedBy.email,
                nameFirst: msi.lastModifiedBy.nameFirst,
                nameLast: msi.lastModifiedBy.nameLast,
              }
            : null,
          lastModifiedAt: msi.updatedAt,
          currentVersion: msi.version,
        });
        return;
      }

      // Validate category if changing
      if (data.categoryId && data.categoryId !== msi.category.id) {
        const category = await em.findOne(PriceGuideCategory, {
          id: data.categoryId,
          company: company.id,
        });
        if (!category) {
          res.status(400).json({ error: 'Category not found' });
          return;
        }
        msi.category = em.getReference(PriceGuideCategory, data.categoryId);
      }

      // Update fields
      if (data.name !== undefined) msi.name = data.name;
      if (data.measurementType !== undefined)
        msi.measurementType = data.measurementType;
      if (data.note !== undefined) msi.note = data.note ?? undefined;
      if (data.defaultQty !== undefined) msi.defaultQty = data.defaultQty;
      if (data.showSwitch !== undefined) msi.showSwitch = data.showSwitch;
      if (data.formulaId !== undefined)
        msi.formulaId = data.formulaId ?? undefined;
      if (data.qtyFormula !== undefined)
        msi.qtyFormula = data.qtyFormula ?? undefined;
      if (data.tagTitle !== undefined)
        msi.tagTitle = data.tagTitle ?? undefined;
      if (data.tagRequired !== undefined) msi.tagRequired = data.tagRequired;
      if (data.tagPickerOptions !== undefined)
        msi.tagPickerOptions = data.tagPickerOptions ?? undefined;
      if (data.tagParams !== undefined)
        msi.tagParams = data.tagParams ?? undefined;

      // Update image (can be set to new file or removed with null)
      if (data.imageId !== undefined) {
        if (data.imageId === null) {
          msi.image = undefined;
        } else {
          const file = await em.findOne(File, {
            id: data.imageId,
            company: company.id,
          });
          if (!file) {
            res.status(400).json({ error: 'Image file not found' });
            return;
          }
          if (!file.isImage) {
            res.status(400).json({ error: 'File is not an image' });
            return;
          }
          msi.image = file;
        }
      }

      // Update search vector
      msi.searchVector = `${msi.name} ${msi.note ?? ''}`.trim();
      msi.lastModifiedBy = em.getReference(User, user.id);

      await em.flush();

      req.log.info({ msiId: msi.id, userId: user.id }, 'MSI updated');

      res.status(200).json({
        message: 'Measure sheet item updated successfully',
        item: { id: msi.id, name: msi.name, version: msi.version },
      });
    } catch (err) {
      req.log.error({ err }, 'Update MSI error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/measure-sheet-items/:id/thumbnail
 * Update only the thumbnail for an MSI (quick inline update).
 *
 * This endpoint:
 * - Does NOT bump the version (won't disrupt other users editing the MSI)
 * - Deletes the old thumbnail when replaced
 * - Uses raw SQL to avoid MikroORM's automatic version increment
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
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      // Simple validation - only imageId is expected
      const { imageId } = req.body as { imageId?: string | null };

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Get current MSI with its image to capture old image ID
      const msi = await em.findOne(
        MeasureSheetItem,
        { id, company: company.id },
        { populate: ['image'] },
      );

      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      // Capture old image ID for deletion
      const oldImageId = msi.image?.id;

      // Validate new image exists and belongs to company (if provided)
      if (imageId) {
        const file = await em.findOne(File, {
          id: imageId,
          company: company.id,
        });
        if (!file) {
          res.status(400).json({ error: 'Image file not found' });
          return;
        }
      }

      // Use raw SQL to update only image_id and last_modified_by
      // This bypasses MikroORM's automatic version increment
      const knex = em.getKnex();
      await knex('measure_sheet_item')
        .where({ id, company_id: company.id })
        .update({
          image_id: imageId ?? null,
          last_modified_by_id: user.id,
          updated_at: new Date(),
        });

      // Delete old image if it was replaced (not just cleared)
      if (oldImageId && imageId && oldImageId !== imageId) {
        try {
          const fileService = new FileService(em);
          await fileService.deleteFile(oldImageId, company.id);
          req.log.info({ oldImageId, msiId: id }, 'Deleted old MSI thumbnail');
        } catch (deleteErr) {
          // Log but don't fail the request - the image is orphaned but not critical
          req.log.warn(
            { err: deleteErr, oldImageId },
            'Failed to delete old MSI thumbnail',
          );
        }
      }

      // Clear the entity manager cache and refetch for response
      em.clear();
      const updatedMsi = await em.findOne(
        MeasureSheetItem,
        { id, company: company.id },
        { populate: ['image'] },
      );

      const imageUrls = await getImageUrls(updatedMsi?.image);

      req.log.info(
        { msiId: id, msiName: msi.name, imageId, oldImageId, userId: user.id },
        'MSI thumbnail updated',
      );

      res.status(200).json({
        message: 'Thumbnail updated',
        thumbnailUrl: imageUrls.thumbnailUrl,
        imageUrl: imageUrls.imageUrl,
      });
    } catch (err) {
      req.log.error({ err }, 'Update MSI thumbnail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/measure-sheet-items/:id
 * Soft delete an MSI
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
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const msi = await em.findOne(MeasureSheetItem, {
        id,
        company: company.id,
      });

      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      // Soft delete
      msi.isActive = false;
      msi.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { msiId: msi.id, msiName: msi.name, userId: user.id },
        'MSI deleted',
      );

      res
        .status(200)
        .json({ message: 'Measure sheet item deleted successfully' });
    } catch (err) {
      req.log.error({ err }, 'Delete MSI error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/measure-sheet-items/:id/options
 * Link options to an MSI
 */
router.post(
  '/:id/options',
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
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      const parseResult = linkOptionsSchema.safeParse(req.body);
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

      const msi = await em.findOne(MeasureSheetItem, {
        id,
        company: company.id,
      });
      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      // Get existing links
      const existingLinks = await em.find(MeasureSheetItemOption, {
        measureSheetItem: msi.id,
      });
      const existingOptionIds = new Set(existingLinks.map(l => l.option.id));

      // Get max sort order
      const maxSortOrder = Math.max(0, ...existingLinks.map(l => l.sortOrder));

      // Validate and create new links
      const options = await em.find(PriceGuideOption, {
        id: { $in: optionIds },
        company: company.id,
      });

      let linked = 0;
      let sortOrder = maxSortOrder + 1;

      for (const optionId of optionIds) {
        if (existingOptionIds.has(optionId)) continue;

        const option = options.find(o => o.id === optionId);
        if (!option) continue;

        const link = new MeasureSheetItemOption();
        link.measureSheetItem = msi;
        link.option = em.getReference(PriceGuideOption, optionId);
        link.sortOrder = sortOrder++;
        em.persist(link);
        linked++;
      }

      msi.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { msiId: msi.id, linkedOptions: linked, userId: user.id },
        'Options linked to MSI',
      );

      res.status(200).json({
        success: true,
        linked,
        warnings: [],
      });
    } catch (err) {
      req.log.error({ err }, 'Link options error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/measure-sheet-items/:id/options/:optionId
 * Unlink an option from an MSI
 *
 * Note: MSIs require at least one option. Cannot remove the last option.
 * See ADR-003.
 */
router.delete(
  '/:id/options/:optionId',
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
      const { id, optionId } = req.params;
      if (!id || !optionId) {
        res.status(400).json({ error: 'MSI ID and option ID are required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const msi = await em.findOne(MeasureSheetItem, {
        id,
        company: company.id,
      });
      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      const link = await em.findOne(MeasureSheetItemOption, {
        measureSheetItem: msi.id,
        option: optionId,
      });
      if (!link) {
        res.status(404).json({ error: 'Option link not found' });
        return;
      }

      // MSIs require at least one option. See ADR-003.
      const optionCount = await em.count(MeasureSheetItemOption, {
        measureSheetItem: msi.id,
      });
      if (optionCount <= 1) {
        res.status(400).json({
          error: 'CANNOT_REMOVE_LAST_OPTION',
          message:
            'Cannot remove the last option. Items require at least one option for pricing.',
        });
        return;
      }

      em.remove(link);
      msi.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { msiId: msi.id, optionId, userId: user.id },
        'Option unlinked from MSI',
      );

      res.status(200).json({ message: 'Option unlinked successfully' });
    } catch (err) {
      req.log.error({ err }, 'Unlink option error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/measure-sheet-items/:id/upcharges
 * Link upcharges to an MSI
 */
router.post(
  '/:id/upcharges',
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
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      const parseResult = linkUpchargesSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const { upchargeIds } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const msi = await em.findOne(MeasureSheetItem, {
        id,
        company: company.id,
      });
      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      // Get existing links
      const existingLinks = await em.find(MeasureSheetItemUpCharge, {
        measureSheetItem: msi.id,
      });
      const existingUpchargeIds = new Set(
        existingLinks.map(l => l.upCharge.id),
      );

      // Get max sort order
      const maxSortOrder = Math.max(0, ...existingLinks.map(l => l.sortOrder));

      // Validate and create new links
      const upcharges = await em.find(UpCharge, {
        id: { $in: upchargeIds },
        company: company.id,
      });

      let linked = 0;
      let sortOrder = maxSortOrder + 1;

      for (const upchargeId of upchargeIds) {
        if (existingUpchargeIds.has(upchargeId)) continue;

        const upcharge = upcharges.find(u => u.id === upchargeId);
        if (!upcharge) continue;

        const link = new MeasureSheetItemUpCharge();
        link.measureSheetItem = msi;
        link.upCharge = em.getReference(UpCharge, upchargeId);
        link.sortOrder = sortOrder++;
        em.persist(link);
        linked++;
      }

      msi.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { msiId: msi.id, linkedUpcharges: linked, userId: user.id },
        'Upcharges linked to MSI',
      );

      res.status(200).json({
        success: true,
        linked,
        warnings: [],
      });
    } catch (err) {
      req.log.error({ err }, 'Link upcharges error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/measure-sheet-items/:id/upcharges/:upchargeId
 * Unlink an upcharge from an MSI
 */
router.delete(
  '/:id/upcharges/:upchargeId',
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
      const { id, upchargeId } = req.params;
      if (!id || !upchargeId) {
        res.status(400).json({ error: 'MSI ID and upcharge ID are required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const msi = await em.findOne(MeasureSheetItem, {
        id,
        company: company.id,
      });
      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      const link = await em.findOne(MeasureSheetItemUpCharge, {
        measureSheetItem: msi.id,
        upCharge: upchargeId,
      });
      if (!link) {
        res.status(404).json({ error: 'Upcharge link not found' });
        return;
      }

      em.remove(link);
      msi.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { msiId: msi.id, upchargeId, userId: user.id },
        'Upcharge unlinked from MSI',
      );

      res.status(200).json({ message: 'Upcharge unlinked successfully' });
    } catch (err) {
      req.log.error({ err }, 'Unlink upcharge error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/measure-sheet-items/:id/offices
 * Sync offices for an MSI (replace all office links)
 */
router.put(
  '/:id/offices',
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
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      const parseResult = syncOfficesSchema.safeParse(req.body);
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

      const { officeIds, version } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const msi = await em.findOne(
        MeasureSheetItem,
        { id, company: company.id },
        { populate: ['lastModifiedBy'] },
      );

      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      // Check optimistic locking
      if (msi.version !== version) {
        res.status(409).json({
          error: 'CONCURRENT_MODIFICATION',
          message: 'This item was modified by another user.',
          currentVersion: msi.version,
        });
        return;
      }

      // Validate all offices exist and belong to company
      const offices = await em.find(Office, {
        id: { $in: officeIds },
        company: company.id,
      });
      if (offices.length !== officeIds.length) {
        res.status(400).json({ error: 'One or more offices not found' });
        return;
      }

      // Get existing office links
      const existingLinks = await em.find(MeasureSheetItemOffice, {
        measureSheetItem: msi.id,
      });
      const existingOfficeIds = new Set(existingLinks.map(l => l.office.id));
      const newOfficeIds = new Set(officeIds);

      // Remove offices that are no longer in the list
      for (const link of existingLinks) {
        if (!newOfficeIds.has(link.office.id)) {
          em.remove(link);
        }
      }

      // Add new offices
      for (const officeId of officeIds) {
        if (!existingOfficeIds.has(officeId)) {
          const link = new MeasureSheetItemOffice();
          link.measureSheetItem = msi;
          link.office = em.getReference(Office, officeId);
          em.persist(link);
        }
      }

      msi.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { msiId: msi.id, officeIds, userId: user.id },
        'MSI offices synced',
      );

      res.status(200).json({
        message: 'Offices updated successfully',
        item: { id: msi.id, name: msi.name, version: msi.version },
      });
    } catch (err) {
      req.log.error({ err }, 'Sync MSI offices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/measure-sheet-items/:id/additional-details
 * Link additional detail fields to an MSI
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
        res.status(400).json({ error: 'MSI ID is required' });
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

      const msi = await em.findOne(MeasureSheetItem, {
        id,
        company: company.id,
      });
      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      // Get existing links
      const existingLinks = await em.find(
        MeasureSheetItemAdditionalDetailField,
        {
          measureSheetItem: msi.id,
        },
      );
      const existingFieldIds = new Set(
        existingLinks.map(l => l.additionalDetailField.id),
      );

      // Get max sort order
      const maxSortOrder = Math.max(0, ...existingLinks.map(l => l.sortOrder));

      // Validate and create new links
      const fields = await em.find(AdditionalDetailField, {
        id: { $in: fieldIds },
        company: company.id,
      });

      let linked = 0;
      let sortOrder = maxSortOrder + 1;

      for (const fieldId of fieldIds) {
        if (existingFieldIds.has(fieldId)) continue;

        const field = fields.find(f => f.id === fieldId);
        if (!field) continue;

        const link = new MeasureSheetItemAdditionalDetailField();
        link.measureSheetItem = msi;
        link.additionalDetailField = em.getReference(
          AdditionalDetailField,
          fieldId,
        );
        link.sortOrder = sortOrder++;
        em.persist(link);
        linked++;
      }

      msi.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { msiId: msi.id, linkedFields: linked, userId: user.id },
        'Additional details linked to MSI',
      );

      res.status(200).json({
        success: true,
        linked,
        warnings: [],
      });
    } catch (err) {
      req.log.error({ err }, 'Link additional details error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/measure-sheet-items/:id/additional-details/:fieldId
 * Unlink an additional detail field from an MSI
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
        res.status(400).json({ error: 'MSI ID and field ID are required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const msi = await em.findOne(MeasureSheetItem, {
        id,
        company: company.id,
      });
      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      const link = await em.findOne(MeasureSheetItemAdditionalDetailField, {
        measureSheetItem: msi.id,
        additionalDetailField: fieldId,
      });
      if (!link) {
        res.status(404).json({ error: 'Additional detail link not found' });
        return;
      }

      em.remove(link);
      msi.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      req.log.info(
        { msiId: msi.id, fieldId, userId: user.id },
        'Additional detail unlinked from MSI',
      );

      res
        .status(200)
        .json({ message: 'Additional detail unlinked successfully' });
    } catch (err) {
      req.log.error({ err }, 'Unlink additional detail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/measure-sheet-items/:id/options/order
 * Reorder options for an MSI
 */
router.put(
  '/:id/options/order',
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
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      const parseResult = reorderSchema.safeParse(req.body);
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

      const msi = await em.findOne(MeasureSheetItem, {
        id,
        company: company.id,
      });
      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      const links = await em.find(MeasureSheetItemOption, {
        measureSheetItem: msi.id,
      });
      const linkMap = new Map(links.map(l => [l.id, l]));

      for (let i = 0; i < orderedIds.length; i++) {
        const link = linkMap.get(orderedIds[i]!);
        if (link) {
          link.sortOrder = i;
        }
      }

      msi.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      res.status(200).json({ message: 'Options reordered successfully' });
    } catch (err) {
      req.log.error({ err }, 'Reorder options error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/measure-sheet-items/:id/upcharges/order
 * Reorder upcharges for an MSI
 */
router.put(
  '/:id/upcharges/order',
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
        res.status(400).json({ error: 'MSI ID is required' });
        return;
      }

      const parseResult = reorderSchema.safeParse(req.body);
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

      const msi = await em.findOne(MeasureSheetItem, {
        id,
        company: company.id,
      });
      if (!msi) {
        res.status(404).json({ error: 'Measure sheet item not found' });
        return;
      }

      const links = await em.find(MeasureSheetItemUpCharge, {
        measureSheetItem: msi.id,
      });
      const linkMap = new Map(links.map(l => [l.id, l]));

      for (let i = 0; i < orderedIds.length; i++) {
        const link = linkMap.get(orderedIds[i]!);
        if (link) {
          link.sortOrder = i;
        }
      }

      msi.lastModifiedBy = em.getReference(User, user.id);
      await em.flush();

      res.status(200).json({ message: 'Upcharges reordered successfully' });
    } catch (err) {
      req.log.error({ err }, 'Reorder upcharges error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
