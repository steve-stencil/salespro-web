/**
 * Mobile template routes.
 * Provides endpoints for the mobile app template selection workflow.
 *
 * Based on iOS source:
 * - DocumentObjectSelectionCollectionViewController.m (loadDocuments, sortDocuments)
 *
 * @see readonlytemplatesschema_08cb2e06.plan.md for parity requirements
 */
import { Router } from 'express';

import { DocumentTemplate  } from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { getStorageAdapter } from '../../lib/storage';
import { requireAuth, requirePermission } from '../../middleware';

import { listTemplatesQuerySchema, templateIdParamSchema } from './schemas';

import type {DocumentTemplateCategory} from '../../entities';
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
  thumbnailUrl?: string;
  iconUrl?: string;
  canAddMultiplePages: boolean;
  pageCount: number;
  isRequired: boolean;
  sortOrder: number;
  pageId: string;
  photosPerPage: number;
  iconBackgroundColor?: number[];
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
  imagesJson?: unknown;
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
  return {
    id: template.id,
    objectId: template.sourceTemplateId ?? template.id,
    displayName: template.displayName,
    category: category.name,
    categoryId: category.id,
    thumbnailUrl: signedUrls.thumbnailUrl,
    iconUrl: signedUrls.iconUrl,
    canAddMultiplePages: template.canAddMultiplePages,
    pageCount: 1, // Single page templates
    isRequired: false, // Not stored in template, computed at runtime
    sortOrder: template.sortOrder,
    pageId: template.pageId,
    photosPerPage: template.photosPerPage,
    iconBackgroundColor: template.iconBackgroundColor ?? undefined,
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

      const { type, state, officeId, sort, includeTemplates } =
        queryResult.data;

      const orm = getORM();
      const em = orm.em.fork();
      const storage = getStorageAdapter();

      // Build filter criteria
      const filter: {
        company: Company;
        deletedAt: null;
        type?: string;
        isTemplate?: boolean;
      } = {
        company: company,
        deletedAt: null,
      };

      // Filter by type if specified
      if (type) {
        filter.type = type;
      }

      // Filter by isTemplate (exclude templates unless specifically requested)
      if (!includeTemplates) {
        filter.isTemplate = false;
      }

      // Execute query with relationships populated
      const templates = await em.find(DocumentTemplate, filter, {
        populate: ['iconFile', 'category', 'includedOffices'],
      });

      // Apply state filtering in memory (more complex array operations)
      let filteredTemplates = templates;
      if (state) {
        filteredTemplates = filteredTemplates.filter(t => {
          // Include if included_states contains state OR contains 'ALL'
          const isIncluded =
            t.includedStates.includes(state) ||
            t.includedStates.includes('ALL');
          // Exclude if excluded_states contains state
          const isExcluded = t.excludedStates.includes(state);
          return isIncluded && !isExcluded;
        });
      }

      // Apply office filtering using the relationship
      if (officeId) {
        filteredTemplates = filteredTemplates.filter(t => {
          // Include if no offices specified (available to all) OR office is in the collection
          const officeCollection = t.includedOffices;
          if (!officeCollection.isInitialized()) {
            return true; // Can't filter, include by default
          }
          const offices = officeCollection.getItems();
          return offices.length === 0 || offices.some(o => o.id === officeId);
        });
      }

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
        { populate: ['pdfFile', 'iconFile', 'watermarkFile', 'category'] },
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

      const cat = template.category as DocumentTemplateCategory;
      const response: TemplateDetail = {
        id: template.id,
        objectId: template.sourceTemplateId ?? template.id,
        displayName: template.displayName,
        category: cat.name,
        categoryId: cat.id,
        thumbnailUrl,
        iconUrl,
        canAddMultiplePages: template.canAddMultiplePages,
        pageCount: 1,
        isRequired: false,
        sortOrder: template.sortOrder,
        pageId: template.pageId,
        photosPerPage: template.photosPerPage,
        iconBackgroundColor: template.iconBackgroundColor ?? undefined,
        documentDataJson: template.documentDataJson,
        imagesJson: template.imagesJson,
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
