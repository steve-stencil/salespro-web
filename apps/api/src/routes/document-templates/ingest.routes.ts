/**
 * Document template ingest routes.
 * Handles ETL push operations for read-only templates.
 *
 * @see readonlytemplatesschema_08cb2e06.plan.md for API contract
 */
import { Router } from 'express';

import {
  DocumentTemplate,
  DocumentTemplateCategory,
  DocumentType,
  File,
  Office,
} from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { getStorageAdapter } from '../../lib/storage';
import {
  requireAuth,
  requirePermission,
  uploadSingle,
  handleUploadError,
} from '../../middleware';

import { ingestUpsertRequestSchema, assetKindSchema } from './schemas';

import type { DocumentTemplateUpsert } from './schemas';
import type { DocumentDataJson, Company, User } from '../../entities';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';
import type {
  EntityManager,
  IDatabaseDriver,
  Connection,
} from '@mikro-orm/core';
import type { Request, Response, NextFunction } from 'express';

const router: Router = Router();

/**
 * Get auth context from request.
 */
function getAuthContext(req: Request): { user: User; company: Company } | null {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  const company = authReq.companyContext;
  return user && company ? { user, company } : null;
}

/**
 * Find or create a category by name for a company.
 */
async function findOrCreateCategory(
  em: EntityManager<IDatabaseDriver<Connection>>,
  company: Company,
  categoryData: DocumentTemplateUpsert['category'],
): Promise<DocumentTemplateCategory> {
  // Try to find existing category by name
  let category = await em.findOne(DocumentTemplateCategory, {
    company,
    name: categoryData.name,
    deletedAt: null,
  });

  if (!category) {
    // Create new category
    category = new DocumentTemplateCategory();
    category.company = company;
    category.name = categoryData.name;
    category.sourceCategoryId = categoryData.sourceCategoryId;
    category.sortOrder = categoryData.sortOrder;
    category.isImported = categoryData.isImported;
    em.persist(category);
  } else {
    // Update existing category if needed
    if (categoryData.sourceCategoryId) {
      category.sourceCategoryId = categoryData.sourceCategoryId;
    }
    category.sortOrder = categoryData.sortOrder;
    category.isImported = categoryData.isImported;
  }

  return category;
}

/**
 * Get offices by IDs for a company.
 */
async function getOfficesByIds(
  em: EntityManager<IDatabaseDriver<Connection>>,
  company: Company,
  officeIds: string[],
): Promise<Office[]> {
  if (officeIds.length === 0) {
    return [];
  }

  return em.find(Office, {
    id: { $in: officeIds },
    company,
  });
}

/**
 * POST /document-templates/ingest/upsert
 * Upsert document templates for a company.
 *
 * Accepts an array of templates and upserts by (company_id, source_template_id).
 * This is the main ETL endpoint for pushing templates from the source system.
 *
 * Categories are automatically created/matched by name.
 * Offices are linked by ID (must already exist).
 */
router.post(
  '/ingest/upsert',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_INGEST),
  async (req: Request, res: Response) => {
    try {
      const context = getAuthContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;

      // Validate request body
      const parseResult = ingestUpsertRequestSchema.safeParse(req.body);
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

      const { templates: templateData } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      const results = {
        created: 0,
        updated: 0,
        categoriesCreated: 0,
        errors: [] as { sourceTemplateId: string; error: string }[],
      };

      // Cache for categories to avoid repeated lookups
      const categoryCache = new Map<string, DocumentTemplateCategory>();

      // Process each template
      for (const data of templateData) {
        try {
          // Find or create category
          let category = categoryCache.get(data.category.name);
          if (!category) {
            const existingCategory = await em.findOne(
              DocumentTemplateCategory,
              {
                company,
                name: data.category.name,
                deletedAt: null,
              },
            );

            if (existingCategory) {
              category = existingCategory;
            } else {
              category = await findOrCreateCategory(em, company, data.category);
              results.categoriesCreated++;
            }
            categoryCache.set(data.category.name, category);
          }

          // Get offices if specified
          const offices = await getOfficesByIds(
            em,
            company,
            data.includedOfficeIds,
          );

          // Try to find existing template by source_template_id
          const existing = await em.findOne(
            DocumentTemplate,
            {
              company,
              sourceTemplateId: data.sourceTemplateId,
            },
            { populate: ['includedOffices'] },
          );

          // Resolve document type
          const documentType = await em.findOne(DocumentType, {
            id: data.documentTypeId,
            company,
            deletedAt: null,
          });

          if (!documentType) {
            results.errors.push({
              sourceTemplateId: data.sourceTemplateId,
              error: `Document type not found: ${data.documentTypeId}`,
            });
            continue;
          }

          if (existing) {
            // Update existing template
            existing.documentType = documentType;
            existing.pageId = data.pageId;
            existing.category = category;
            existing.displayName = data.displayName;
            existing.sortOrder = data.sortOrder;
            existing.canAddMultiplePages = data.canAddMultiplePages;
            existing.isTemplate = data.isTemplate;
            existing.includedStates = data.includedStates;
            existing.pageWidth = data.pageWidth;
            existing.pageHeight = data.pageHeight;
            existing.hMargin = data.hMargin;
            existing.wMargin = data.wMargin;
            existing.photosPerPage = data.photosPerPage;
            existing.useWatermark = data.useWatermark;
            existing.watermarkWidthPercent = data.watermarkWidthPercent;
            existing.watermarkAlpha = data.watermarkAlpha;
            existing.documentDataJson =
              data.documentDataJson as DocumentDataJson;
            existing.hasUserInput = data.hasUserInput;
            existing.signatureFieldCount = data.signatureFieldCount;
            existing.initialsFieldCount = data.initialsFieldCount;

            // Update template images (clear and re-add)
            existing.templateImages.removeAll();
            for (const fileId of data.templateImageFileIds) {
              existing.templateImages.add(em.getReference(File, fileId));
            }

            // Update offices (clear and re-add)
            existing.includedOffices.removeAll();
            for (const office of offices) {
              existing.includedOffices.add(office);
            }

            results.updated++;
          } else {
            // Create new template
            const template = new DocumentTemplate();
            template.company = company;
            template.sourceTemplateId = data.sourceTemplateId;
            template.documentType = documentType;
            template.pageId = data.pageId;
            template.category = category;
            template.displayName = data.displayName;
            template.sortOrder = data.sortOrder;
            template.canAddMultiplePages = data.canAddMultiplePages;
            template.isTemplate = data.isTemplate;
            template.includedStates = data.includedStates;
            template.pageWidth = data.pageWidth;
            template.pageHeight = data.pageHeight;
            template.hMargin = data.hMargin;
            template.wMargin = data.wMargin;
            template.photosPerPage = data.photosPerPage;
            template.useWatermark = data.useWatermark;
            template.watermarkWidthPercent = data.watermarkWidthPercent;
            template.watermarkAlpha = data.watermarkAlpha;
            template.documentDataJson =
              data.documentDataJson as DocumentDataJson;
            template.hasUserInput = data.hasUserInput;
            template.signatureFieldCount = data.signatureFieldCount;
            template.initialsFieldCount = data.initialsFieldCount;

            // Add template images
            for (const fileId of data.templateImageFileIds) {
              template.templateImages.add(em.getReference(File, fileId));
            }

            // Add offices
            for (const office of offices) {
              template.includedOffices.add(office);
            }

            em.persist(template);
            results.created++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push({
            sourceTemplateId: data.sourceTemplateId,
            error: message,
          });
        }
      }

      // Flush all changes
      await em.flush();

      req.log.info(
        {
          companyId: company.id,
          created: results.created,
          updated: results.updated,
          categoriesCreated: results.categoriesCreated,
          errors: results.errors.length,
        },
        'Document templates ingested',
      );

      res.status(200).json({
        message: 'Templates ingested successfully',
        results,
      });
    } catch (err) {
      req.log.error({ err }, 'Ingest templates error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /document-templates/ingest/:templateId/assets/:kind
 * Upload an asset (pdf, icon, watermark) for a template.
 *
 * Uses the existing File storage adapter pattern.
 */
router.post(
  '/ingest/:templateId/assets/:kind',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_INGEST),
  uploadSingle,
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    handleUploadError(err, req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const context = getAuthContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company } = context;
      const { templateId, kind } = req.params;

      // Validate kind parameter
      const kindResult = assetKindSchema.safeParse(kind);
      if (!kindResult.success) {
        res.status(400).json({
          error: 'Invalid asset kind. Must be: pdf, icon, or watermark',
        });
        return;
      }

      const authReq = req as Request & { file?: Express.Multer.File };
      const file = authReq.file;
      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      // Find the template
      const template = await em.findOne(DocumentTemplate, {
        id: templateId,
        company: company.id,
      });

      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      // Create storage key
      const fileExt = file.originalname.split('.').pop() ?? 'bin';
      const storageKey = `${company.id}/templates/${template.id}/${kindResult.data}.${fileExt}`;

      // Upload to storage
      const storage = getStorageAdapter();
      await storage.upload({
        key: storageKey,
        buffer: file.buffer,
        mimeType: file.mimetype,
      });

      // Create or update File entity
      let fileEntity = await em.findOne(File, { storageKey });

      if (!fileEntity) {
        fileEntity = new File();
        fileEntity.storageKey = storageKey;
        fileEntity.company = company;
        fileEntity.uploadedBy = user;
        em.persist(fileEntity);
      }

      fileEntity.filename = file.originalname;
      fileEntity.mimeType = file.mimetype;
      fileEntity.size = file.size;

      // Link file to template
      switch (kindResult.data) {
        case 'pdf':
          template.pdfFile = fileEntity;
          break;
        case 'icon':
          template.iconFile = fileEntity;
          break;
        case 'watermark':
          template.watermarkFile = fileEntity;
          break;
      }

      await em.flush();

      req.log.info(
        {
          templateId,
          kind: kindResult.data,
          fileId: fileEntity.id,
        },
        'Template asset uploaded',
      );

      res.status(200).json({
        message: 'Asset uploaded successfully',
        fileId: fileEntity.id,
        storageKey,
      });
    } catch (err) {
      req.log.error({ err }, 'Upload template asset error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
