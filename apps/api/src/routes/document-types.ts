/**
 * Document Types Routes
 *
 * CRUD operations for managing document types (contract, proposal, custom).
 */

import { Router } from 'express';
import { z } from 'zod';

import { Company, DocumentTemplate, DocumentType, Office } from '../entities';
import { getORM } from '../lib/db';
import { PERMISSIONS } from '../lib/permissions';
import { requireAuth, requirePermission } from '../middleware';

import type { AuthenticatedRequest } from '../middleware/requireAuth';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createDocumentTypeSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  sortOrder: z.number().int().optional(),
  officeIds: z.array(z.string().uuid()).optional(),
});

const updateDocumentTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  officeIds: z.array(z.string().uuid()).optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map DocumentType entity to response object.
 */
function mapDocumentTypeToResponse(
  docType: DocumentType,
  officeIds?: string[],
) {
  return {
    id: docType.id,
    name: docType.name,
    isDefault: docType.isDefault,
    sortOrder: docType.sortOrder,
    officeIds: officeIds ?? [],
    createdAt: docType.createdAt,
    updatedAt: docType.updatedAt,
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /document-types
 * List all document types for the company.
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.DOCUMENT_TYPE_READ),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const company = authReq.companyContext;

      if (!company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { officeId } = req.query;
      const orm = getORM();
      const em = orm.em.fork();

      const where: Record<string, unknown> = {
        company: company.id,
        deletedAt: null,
      };

      let types = await em.find(DocumentType, where, {
        orderBy: { sortOrder: 'ASC', name: 'ASC' },
        populate: ['offices'],
      });

      // Filter by office if specified
      if (officeId && typeof officeId === 'string') {
        types = types.filter(t => {
          const officeIds = t.offices.getItems().map(o => o.id);
          // Empty offices means available to all
          return officeIds.length === 0 || officeIds.includes(officeId);
        });
      }

      res.status(200).json({
        data: types.map(t =>
          mapDocumentTypeToResponse(
            t,
            t.offices.getItems().map(o => o.id),
          ),
        ),
      });
    } catch (err) {
      req.log.error({ err }, 'List document types error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /document-types/:id
 * Get a specific document type.
 */
router.get(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.DOCUMENT_TYPE_READ),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const company = authReq.companyContext;

      if (!company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Document type ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const docType = await em.findOne(
        DocumentType,
        { id, company: company.id, deletedAt: null },
        { populate: ['offices'] },
      );

      if (!docType) {
        res.status(404).json({ error: 'Document type not found' });
        return;
      }

      res.status(200).json({
        data: mapDocumentTypeToResponse(
          docType,
          docType.offices.getItems().map(o => o.id),
        ),
      });
    } catch (err) {
      req.log.error({ err }, 'Get document type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /document-types
 * Create a new document type.
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.DOCUMENT_TYPE_CREATE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = createDocumentTypeSchema.safeParse(req.body);
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

      const { name, sortOrder, officeIds } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      // Check for duplicate name
      const existing = await em.findOne(DocumentType, {
        company: company.id,
        name,
        deletedAt: null,
      });

      if (existing) {
        res.status(409).json({
          error: 'Document type name already exists',
          message: `A document type with the name "${name}" already exists.`,
        });
        return;
      }

      const docType = new DocumentType();
      docType.company = em.getReference(Company, company.id);
      docType.name = name;
      docType.isDefault = false;
      docType.sortOrder = sortOrder ?? 0;

      // Add offices if specified
      if (officeIds && officeIds.length > 0) {
        for (const officeId of officeIds) {
          const office = await em.findOne(Office, {
            id: officeId,
            company: company.id,
          });
          if (office) {
            docType.offices.add(office);
          }
        }
      }

      await em.persistAndFlush(docType);

      req.log.info(
        { documentTypeId: docType.id, name: docType.name, userId: user.id },
        'Document type created',
      );

      res.status(201).json({
        message: 'Document type created successfully',
        data: mapDocumentTypeToResponse(
          docType,
          docType.offices.getItems().map(o => o.id),
        ),
      });
    } catch (err) {
      req.log.error({ err }, 'Create document type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /document-types/:id
 * Update a document type.
 */
router.patch(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.DOCUMENT_TYPE_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Document type ID is required' });
        return;
      }

      const parseResult = updateDocumentTypeSchema.safeParse(req.body);
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

      const { name, sortOrder, officeIds } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      const docType = await em.findOne(
        DocumentType,
        { id, company: company.id, deletedAt: null },
        { populate: ['offices'] },
      );

      if (!docType) {
        res.status(404).json({ error: 'Document type not found' });
        return;
      }

      // Check for duplicate name if changing
      if (name && name !== docType.name) {
        const existing = await em.findOne(DocumentType, {
          company: company.id,
          name,
          deletedAt: null,
        });
        if (existing && existing.id !== docType.id) {
          res.status(409).json({
            error: 'Document type name already exists',
            message: `A document type with the name "${name}" already exists.`,
          });
          return;
        }
        docType.name = name;
      }

      if (sortOrder !== undefined) {
        docType.sortOrder = sortOrder;
      }

      // Update offices if specified
      if (officeIds !== undefined) {
        // Clear existing offices
        docType.offices.removeAll();

        // Add new offices
        for (const officeId of officeIds) {
          const office = await em.findOne(Office, {
            id: officeId,
            company: company.id,
          });
          if (office) {
            docType.offices.add(office);
          }
        }
      }

      await em.flush();

      req.log.info(
        { documentTypeId: docType.id, userId: user.id },
        'Document type updated',
      );

      res.status(200).json({
        message: 'Document type updated successfully',
        data: mapDocumentTypeToResponse(
          docType,
          docType.offices.getItems().map(o => o.id),
        ),
      });
    } catch (err) {
      req.log.error({ err }, 'Update document type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /document-types/:id
 * Soft delete a document type.
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.DOCUMENT_TYPE_DELETE),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Document type ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const docType = await em.findOne(DocumentType, {
        id,
        company: company.id,
        deletedAt: null,
      });

      if (!docType) {
        res.status(404).json({ error: 'Document type not found' });
        return;
      }

      // Prevent deletion of default types
      if (docType.isDefault) {
        res.status(400).json({
          error: 'Cannot delete default document type',
          message:
            'Default document types (contract, proposal) cannot be deleted.',
        });
        return;
      }

      // Check if any templates are using this type
      const templateCount = await em.count(DocumentTemplate, {
        documentType: docType.id,
        deletedAt: null,
      });

      if (templateCount > 0) {
        res.status(400).json({
          error: 'Document type is in use',
          message: `This document type is used by ${templateCount} template(s). Reassign or delete them first.`,
          templateCount,
        });
        return;
      }

      // Soft delete
      docType.deletedAt = new Date();
      await em.flush();

      req.log.info(
        { documentTypeId: docType.id, name: docType.name, userId: user.id },
        'Document type deleted',
      );

      res.status(204).send();
    } catch (err) {
      req.log.error({ err }, 'Delete document type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
