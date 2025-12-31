 
import { Router } from 'express';
import { z } from 'zod';

import {
  Tag,
  ItemTag,
  TaggableEntityType,
  Company,
  PriceGuideOption,
  UpCharge,
  AdditionalDetailField,
  MeasureSheetItem,
} from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';

import type { AuthenticatedRequest } from '../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const listQuerySchema = z.object({
  search: z.string().optional(),
});

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
});

const setItemTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});

const entityTypeSchema = z.enum([
  'OPTION',
  'UPCHARGE',
  'ADDITIONAL_DETAIL',
  'MEASURE_SHEET_ITEM',
]);

// ============================================================================
// Helper Functions
// ============================================================================

type CompanyContext = { company: Company };

function getCompanyContext(req: Request): CompanyContext | null {
  const authReq = req as AuthenticatedRequest;
  const company = authReq.companyContext;
  return company ? { company } : null;
}

/**
 * Maps TaggableEntityType enum to actual entity class for validation
 */
function getEntityClass(
  entityType: TaggableEntityType,
):
  | typeof PriceGuideOption
  | typeof UpCharge
  | typeof AdditionalDetailField
  | typeof MeasureSheetItem {
  switch (entityType) {
    case TaggableEntityType.OPTION:
      return PriceGuideOption;
    case TaggableEntityType.UPCHARGE:
      return UpCharge;
    case TaggableEntityType.ADDITIONAL_DETAIL:
      return AdditionalDetailField;
    case TaggableEntityType.MEASURE_SHEET_ITEM:
      return MeasureSheetItem;
  }
}

/**
 * Validates that an entity exists and belongs to the company
 */
async function validateEntityExists(
  em: EntityManager,
  entityType: TaggableEntityType,
  entityId: string,
  companyId: string,
): Promise<boolean> {
  const EntityClass = getEntityClass(entityType);
  const entity = await em.findOne(EntityClass, {
    id: entityId,
    company: companyId,
  });
  return entity !== null;
}

// ============================================================================
// Tag CRUD Routes
// ============================================================================

/**
 * GET /price-guide/tags
 * List all tags for the company with optional search
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

      const { search } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const qb = em
        .createQueryBuilder(Tag, 't')
        .select('*')
        .where({ company: company.id, isActive: true });

      // Search by name (case-insensitive)
      if (search) {
        qb.andWhere({ name: { $ilike: `%${search}%` } });
      }

      qb.orderBy({ name: 'ASC' });

      const tags = await qb.getResultList();

      res.status(200).json({
        tags: tags.map(t => ({
          id: t.id,
          name: t.name,
          color: t.color,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'List tags error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/tags/:id
 * Get tag detail
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
        res.status(400).json({ error: 'Tag ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const tag = await em.findOne(Tag, { id, company: company.id });

      if (!tag) {
        res.status(404).json({ error: 'Tag not found' });
        return;
      }

      res.status(200).json({
        tag: {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          isActive: tag.isActive,
          createdAt: tag.createdAt.toISOString(),
          updatedAt: tag.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get tag error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/tags
 * Create a new tag
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

      const { company } = context;
      const parseResult = createTagSchema.safeParse(req.body);
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

      // Check for duplicate name
      const existing = await em.findOne(Tag, {
        company: company.id,
        name: data.name,
        isActive: true,
      });
      if (existing) {
        res.status(409).json({
          error: 'A tag with this name already exists',
        });
        return;
      }

      const tag = new Tag();
      tag.name = data.name;
      tag.color = data.color;
      tag.company = em.getReference(Company, company.id);

      await em.persistAndFlush(tag);

      req.log.info({ tagId: tag.id, tagName: tag.name }, 'Tag created');

      res.status(201).json({
        message: 'Tag created successfully',
        tag: {
          id: tag.id,
          name: tag.name,
          color: tag.color,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create tag error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/tags/:id
 * Update a tag
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

      const { company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Tag ID is required' });
        return;
      }

      const parseResult = updateTagSchema.safeParse(req.body);
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

      const tag = await em.findOne(Tag, { id, company: company.id });

      if (!tag) {
        res.status(404).json({ error: 'Tag not found' });
        return;
      }

      // Check for duplicate name if name is being changed
      if (data.name && data.name !== tag.name) {
        const existing = await em.findOne(Tag, {
          company: company.id,
          name: data.name,
          isActive: true,
          id: { $ne: id },
        });
        if (existing) {
          res.status(409).json({
            error: 'A tag with this name already exists',
          });
          return;
        }
        tag.name = data.name;
      }

      if (data.color !== undefined) {
        tag.color = data.color;
      }

      await em.flush();

      req.log.info({ tagId: tag.id }, 'Tag updated');

      res.status(200).json({
        message: 'Tag updated successfully',
        tag: {
          id: tag.id,
          name: tag.name,
          color: tag.color,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update tag error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/tags/:id
 * Soft delete a tag (also removes all item associations)
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

      const { company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Tag ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const tag = await em.findOne(Tag, { id, company: company.id });

      if (!tag) {
        res.status(404).json({ error: 'Tag not found' });
        return;
      }

      // Soft delete the tag
      tag.isActive = false;

      // Remove all item tag associations (cascade handled by FK constraint)
      // But we explicitly delete to ensure clean removal
      await em.nativeDelete(ItemTag, { tag: id });

      await em.flush();

      req.log.info({ tagId: tag.id, tagName: tag.name }, 'Tag deleted');

      res.status(200).json({ message: 'Tag deleted successfully' });
    } catch (err) {
      req.log.error({ err }, 'Delete tag error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// Item Tag Assignment Routes
// ============================================================================

/**
 * GET /price-guide/tags/items/:entityType/:entityId
 * Get tags for a specific item
 */
router.get(
  '/items/:entityType/:entityId',
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
      const { entityType, entityId } = req.params;

      // Validate entity type
      const typeResult = entityTypeSchema.safeParse(entityType);
      if (!typeResult.success) {
        res.status(400).json({
          error: 'Invalid entity type',
          validTypes: [
            'OPTION',
            'UPCHARGE',
            'ADDITIONAL_DETAIL',
            'MEASURE_SHEET_ITEM',
          ],
        });
        return;
      }

      if (!entityId) {
        res.status(400).json({ error: 'Entity ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify the entity exists and belongs to company
      const entityExists = await validateEntityExists(
        em,
        typeResult.data as TaggableEntityType,
        entityId,
        company.id,
      );
      if (!entityExists) {
        res.status(404).json({ error: 'Entity not found' });
        return;
      }

      // Get tags for this item
      const itemTags = await em.find(
        ItemTag,
        {
          entityType: typeResult.data as TaggableEntityType,
          entityId,
        },
        { populate: ['tag'] },
      );

      // Filter to only active tags
      const activeTags = itemTags
        .filter(it => it.tag.isActive)
        .map(it => ({
          id: it.tag.id,
          name: it.tag.name,
          color: it.tag.color,
        }));

      res.status(200).json({ tags: activeTags });
    } catch (err) {
      req.log.error({ err }, 'Get item tags error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/tags/items/:entityType/:entityId
 * Set tags for a specific item (replaces all existing tags)
 */
router.put(
  '/items/:entityType/:entityId',
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
      const { entityType, entityId } = req.params;

      // Validate entity type
      const typeResult = entityTypeSchema.safeParse(entityType);
      if (!typeResult.success) {
        res.status(400).json({
          error: 'Invalid entity type',
          validTypes: [
            'OPTION',
            'UPCHARGE',
            'ADDITIONAL_DETAIL',
            'MEASURE_SHEET_ITEM',
          ],
        });
        return;
      }

      if (!entityId) {
        res.status(400).json({ error: 'Entity ID is required' });
        return;
      }

      const parseResult = setItemTagsSchema.safeParse(req.body);
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

      const { tagIds } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify the entity exists and belongs to company
      const entityExists = await validateEntityExists(
        em,
        typeResult.data as TaggableEntityType,
        entityId,
        company.id,
      );
      if (!entityExists) {
        res.status(404).json({ error: 'Entity not found' });
        return;
      }

      // Validate all tag IDs belong to this company
      if (tagIds.length > 0) {
        const validTags = await em.find(Tag, {
          id: { $in: tagIds },
          company: company.id,
          isActive: true,
        });

        if (validTags.length !== tagIds.length) {
          const validIds = new Set(validTags.map(t => t.id));
          const invalidIds = tagIds.filter(id => !validIds.has(id));
          res.status(400).json({
            error: 'Invalid tag IDs',
            invalidIds,
          });
          return;
        }
      }

      // Remove all existing tags for this item
      await em.nativeDelete(ItemTag, {
        entityType: typeResult.data as TaggableEntityType,
        entityId,
      });

      // Add new tags
      const newItemTags: ItemTag[] = [];
      for (const tagId of tagIds) {
        const itemTag = new ItemTag();
        itemTag.tag = em.getReference(Tag, tagId);
        itemTag.entityType = typeResult.data as TaggableEntityType;
        itemTag.entityId = entityId;
        newItemTags.push(itemTag);
      }

      if (newItemTags.length > 0) {
        em.persist(newItemTags);
      }

      await em.flush();

      // Fetch the updated tags to return
      const updatedTags = await em.find(
        Tag,
        { id: { $in: tagIds }, isActive: true },
        { orderBy: { name: 'ASC' } },
      );

      req.log.info(
        { entityType, entityId, tagCount: tagIds.length },
        'Item tags updated',
      );

      res.status(200).json({
        message: 'Tags updated successfully',
        tags: updatedTags.map(t => ({
          id: t.id,
          name: t.name,
          color: t.color,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Set item tags error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
