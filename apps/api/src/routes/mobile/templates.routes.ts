/**
 * Mobile template routes.
 * Provides endpoints for the mobile app template selection workflow.
 *
 * Based on iOS source:
 * - DocumentObjectSelectionCollectionViewController.m (loadDocuments, sortDocuments)
 *
 * @see readonlytemplatesschema_08cb2e06.plan.md for parity requirements
 */
import { raw } from '@mikro-orm/core';
import { Router } from 'express';

import { DocumentTemplate, DocumentType } from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { getStorageAdapter } from '../../lib/storage';
import { requireAuth, requirePermission } from '../../middleware';

import { listTemplatesQuerySchema, templateIdParamSchema } from './schemas';

import type { DocumentTemplateCategory } from '../../entities';
import type { Company, User } from '../../entities';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';
import type { Request, Response } from 'express';

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
 * Response type for template list items.
 */
type TemplateListItem = {
  id: string;
  objectId: string;
  displayName: string;
  category: string;
  categoryId: string;
  documentType: string;
  documentTypeId: string;
  thumbnailUrl?: string;
  iconUrl?: string;
  canAddMultiplePages: boolean;
  pageCount: number;
  isRequired: boolean;
  sortOrder: number;
  pageId: string;
  photosPerPage: number;
};

/**
 * Response type for category grouping.
 */
type CategoryInfo = {
  id: string;
  name: string;
  sortOrder: number;
  isCollapsed: boolean;
  isImported: boolean;
};

/**
 * Full template detail response.
 */
type TemplateDetail = TemplateListItem & {
  documentDataJson: unknown;
  imageUrls: string[];
  pdfUrl?: string;
  watermarkUrl?: string;
  hasUserInput: boolean;
  signatureFieldCount: number;
  initialsFieldCount: number;
};

/**
 * Map template entity to list item response.
 */
function mapTemplateToListItem(
  template: DocumentTemplate,
  signedUrls: { iconUrl?: string; thumbnailUrl?: string },
): TemplateListItem {
  const category = template.category;
  const docType = template.documentType;
  return {
    id: template.id,
    objectId: template.sourceTemplateId ?? template.id,
    displayName: template.displayName,
    category: category.name,
    categoryId: category.id,
    documentType: docType.name,
    documentTypeId: docType.id,
    thumbnailUrl: signedUrls.thumbnailUrl,
    iconUrl: signedUrls.iconUrl,
    canAddMultiplePages: template.canAddMultiplePages,
    pageCount: 1, // Single page templates
    isRequired: false, // Not stored in template, computed at runtime
    sortOrder: template.sortOrder,
    pageId: template.pageId,
    photosPerPage: template.photosPerPage,
  };
}

/**
 * GET /mobile/templates
 * List available templates for the mobile app.
 *
 * Filter semantics (matching iOS loadContracts):
 * - Include when template is allowed for the customer state (state-specific or "ALL")
 * - Exclude when template is excluded for that state
 * - Include only when template is included for the selected office
 * - Exclude templates that are "verification" pages
 * - Exclude templates marked as templates (not selectable pages) unless includeTemplates=true
 *
 * Sorting (matching iOS sortContracts):
 * - Group by category
 * - Sort categories alphabetically, but force "Imported" to the first position
 * - Within a category, sort by order by default, or alphabetically
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getAuthContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;

      // Parse and validate query parameters
      const queryResult = listTemplatesQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const { state, officeIds, documentTypeIds, sort, includeTemplates } =
        queryResult.data;

      // Validate documentTypeIds - empty array is an error (all templates must have a type)
      if (documentTypeIds.provided && documentTypeIds.ids.length === 0) {
        res.status(400).json({
          error:
            'documentTypeIds cannot be empty. All templates have a document type.',
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const storage = getStorageAdapter();

      // Build filter criteria with SQL-level filtering
      // Using Record to allow raw() expressions in filter
      const filter: Record<string, unknown> = {
        company: company.id,
        deletedAt: null,
      };

      // Filter by documentTypeIds if specified
      if (documentTypeIds.provided && documentTypeIds.ids.length > 0) {
        filter['documentType'] = { $in: documentTypeIds.ids };
      }

      // Filter by isTemplate (exclude templates unless specifically requested)
      if (!includeTemplates) {
        filter['isTemplate'] = false;
      }

      // Build $and conditions for complex filters
      const andConditions: unknown[] = [];

      // State filtering using PostgreSQL array operators
      // Only return templates where includedStates explicitly contains this state
      if (state) {
        andConditions.push(raw(`included_states @> ARRAY[?]::text[]`, [state]));
      }

      // Office filtering:
      // - Not provided: no filter
      // - Empty array: templates with NO offices assigned
      // - Array with values: templates assigned to any of these offices
      if (officeIds.provided) {
        if (officeIds.ids.length === 0) {
          // Empty array: return templates with no offices assigned
          andConditions.push(
            raw(
              `NOT EXISTS (
                SELECT 1 FROM document_template_office dto 
                WHERE dto.document_template_id = "DocumentTemplate".id
              )`,
            ),
          );
        } else {
          // Array with values: return templates assigned to any of these offices
          andConditions.push(
            raw(
              `EXISTS (
                SELECT 1 FROM document_template_office dto 
                WHERE dto.document_template_id = "DocumentTemplate".id 
                AND dto.office_id = ANY(?)
              )`,
              [officeIds.ids],
            ),
          );
        }
      }

      // Add $and conditions if any
      if (andConditions.length > 0) {
        filter['$and'] = andConditions;
      }

      // Execute query with relationships populated
      const templates = await em.find(
        DocumentTemplate,
        filter as Parameters<typeof em.find<DocumentTemplate>>[1],
        {
          populate: ['iconFile', 'category', 'documentType', 'includedOffices'],
        },
      );

      const filteredTemplates = templates;

      // Generate signed URLs for icons
      const templatesWithUrls: TemplateListItem[] = await Promise.all(
        filteredTemplates.map(async (template: DocumentTemplate) => {
          let iconUrl: string | undefined;
          let thumbnailUrl: string | undefined;

          if (template.iconFile) {
            iconUrl = await storage.getSignedDownloadUrl({
              key: template.iconFile.storageKey,
              expiresIn: 3600,
            });
            if (template.iconFile.thumbnailKey) {
              thumbnailUrl = await storage.getSignedDownloadUrl({
                key: template.iconFile.thumbnailKey,
                expiresIn: 3600,
              });
            }
          }

          return mapTemplateToListItem(template, { iconUrl, thumbnailUrl });
        }),
      );

      // Sort templates
      let sortedTemplates: TemplateListItem[];
      if (sort === 'alphabetic') {
        sortedTemplates = templatesWithUrls.sort(
          (a: TemplateListItem, b: TemplateListItem) =>
            a.displayName.localeCompare(b.displayName),
        );
      } else {
        sortedTemplates = templatesWithUrls.sort(
          (a: TemplateListItem, b: TemplateListItem) =>
            a.sortOrder - b.sortOrder,
        );
      }

      // Extract unique categories from templates using actual category entities
      const categoryMap = new Map<string, CategoryInfo>();
      for (const template of filteredTemplates) {
        const cat = template.category as DocumentTemplateCategory;
        if (!categoryMap.has(cat.id)) {
          categoryMap.set(cat.id, {
            id: cat.id,
            name: cat.name,
            sortOrder: cat.sortOrder,
            isCollapsed: false,
            isImported: cat.isImported,
          });
        }
      }

      // Sort categories: "Imported" first, then by sortOrder, then alphabetically
      const categories = Array.from(categoryMap.values()).sort(
        (a: CategoryInfo, b: CategoryInfo) => {
          // Imported always first
          if (a.isImported && !b.isImported) return -1;
          if (!a.isImported && b.isImported) return 1;
          // Then by sortOrder
          if (a.sortOrder !== b.sortOrder) {
            return a.sortOrder - b.sortOrder;
          }
          // Then alphabetically
          return a.name.localeCompare(b.name);
        },
      );

      res.status(200).json({
        templates: sortedTemplates,
        categories,
      });
    } catch (err) {
      req.log.error({ err }, 'List templates error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /mobile/templates/document-types
 * List document types available for the mobile app.
 *
 * Query parameters:
 * - officeIds (optional): Filter to types available in these offices (comma-separated UUIDs)
 *   - Not provided: no office filter applied
 *   - Empty string: return types with NO offices assigned
 *   - UUIDs: return types assigned to any of these offices
 */
router.get(
  '/document-types',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getAuthContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;

      // Parse officeIds parameter
      const officeIdsParam = req.query['officeIds'];
      const officeIds: { provided: false } | { provided: true; ids: string[] } =
        officeIdsParam === undefined
          ? { provided: false }
          : typeof officeIdsParam === 'string' && officeIdsParam === ''
            ? { provided: true, ids: [] }
            : typeof officeIdsParam === 'string'
              ? {
                  provided: true,
                  ids: officeIdsParam.split(',').map(id => id.trim()),
                }
              : { provided: false };

      const orm = getORM();
      const em = orm.em.fork();

      // Build filter with SQL-level office filtering
      const filter: Record<string, unknown> = {
        company: company.id,
        deletedAt: null,
      };

      // Office filtering:
      // - Not provided: no filter
      // - Empty array: types with NO offices assigned
      // - Array with values: types assigned to any of these offices
      if (officeIds.provided) {
        if (officeIds.ids.length === 0) {
          // Empty array: return types with no offices assigned
          filter['$and'] = [
            raw(
              `NOT EXISTS (
                SELECT 1 FROM document_type_office dto 
                WHERE dto.document_type_id = "DocumentType".id
              )`,
            ),
          ];
        } else {
          // Array with values: return types assigned to any of these offices
          filter['$and'] = [
            raw(
              `EXISTS (
                SELECT 1 FROM document_type_office dto 
                WHERE dto.document_type_id = "DocumentType".id 
                AND dto.office_id = ANY(?)
              )`,
              [officeIds.ids],
            ),
          ];
        }
      }

      const documentTypes = await em.find(
        DocumentType,
        filter as Parameters<typeof em.find<DocumentType>>[1],
        {
          orderBy: { sortOrder: 'ASC', name: 'ASC' },
        },
      );

      res.status(200).json({
        documentTypes: documentTypes.map(dt => ({
          id: dt.id,
          name: dt.name,
          isDefault: dt.isDefault,
          sortOrder: dt.sortOrder,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'List document types error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /mobile/templates/:id
 * Get full template detail including contractDataJson.
 *
 * Returns all template data needed for form rendering.
 */
router.get(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getAuthContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;

      // Validate path parameter
      const paramResult = templateIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: 'Invalid template ID' });
        return;
      }

      const { id } = paramResult.data;

      const orm = getORM();
      const em = orm.em.fork();
      const storage = getStorageAdapter();

      // Find template with all relationships
      const template = await em.findOne(
        DocumentTemplate,
        { id, company: company.id, deletedAt: null },
        {
          populate: [
            'pdfFile',
            'iconFile',
            'watermarkFile',
            'category',
            'documentType',
            'templateImages',
          ],
        },
      );

      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      // Generate signed URLs
      let iconUrl: string | undefined;
      let thumbnailUrl: string | undefined;
      let pdfUrl: string | undefined;
      let watermarkUrl: string | undefined;

      if (template.iconFile) {
        iconUrl = await storage.getSignedDownloadUrl({
          key: template.iconFile.storageKey,
          expiresIn: 3600,
        });
        if (template.iconFile.thumbnailKey) {
          thumbnailUrl = await storage.getSignedDownloadUrl({
            key: template.iconFile.thumbnailKey,
            expiresIn: 3600,
          });
        }
      }

      if (template.pdfFile) {
        pdfUrl = await storage.getSignedDownloadUrl({
          key: template.pdfFile.storageKey,
          expiresIn: 3600,
        });
      }

      if (template.watermarkFile) {
        watermarkUrl = await storage.getSignedDownloadUrl({
          key: template.watermarkFile.storageKey,
          expiresIn: 3600,
        });
      }

      // Generate signed URLs for template images
      const imageUrls: string[] = [];
      for (const imageFile of template.templateImages.getItems()) {
        const imageUrl = await storage.getSignedDownloadUrl({
          key: imageFile.storageKey,
          expiresIn: 3600,
        });
        imageUrls.push(imageUrl);
      }

      const cat = template.category as DocumentTemplateCategory;
      const docType = template.documentType;
      const response: TemplateDetail = {
        id: template.id,
        objectId: template.sourceTemplateId ?? template.id,
        displayName: template.displayName,
        category: cat.name,
        categoryId: cat.id,
        documentType: docType.name,
        documentTypeId: docType.id,
        thumbnailUrl,
        iconUrl,
        canAddMultiplePages: template.canAddMultiplePages,
        pageCount: 1,
        isRequired: false,
        sortOrder: template.sortOrder,
        pageId: template.pageId,
        photosPerPage: template.photosPerPage,
        documentDataJson: template.documentDataJson,
        imageUrls,
        pdfUrl,
        watermarkUrl,
        hasUserInput: template.hasUserInput,
        signatureFieldCount: template.signatureFieldCount,
        initialsFieldCount: template.initialsFieldCount,
      };

      res.status(200).json({ template: response });
    } catch (err) {
      req.log.error({ err }, 'Get template detail error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
