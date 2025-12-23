/**
 * ETL Routes for Document Template Import
 *
 * Handles importing document templates from Parse/legacy system.
 */

import { Router } from 'express';

import { ImportSession, ImportSessionStatus, Office } from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';
import {
  DocumentTemplateEtlService,
  EtlServiceError,
  EtlErrorCode,
} from '../../services';

import { createImportSessionSchema, importBatchSchema } from './schemas';

import type { AuthenticatedRequest } from '../../middleware/requireAuth';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * GET /etl/source-offices
 * Fetch offices from Parse source system.
 */
router.get(
  '/source-offices',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_INGEST),
  async (req: Request, res: Response) => {
    try {
      const orm = getORM();
      const em = orm.em.fork();
      const service = new DocumentTemplateEtlService(em);

      const sourceOffices = await service.fetchSourceOffices();

      res.status(200).json({
        data: sourceOffices,
      });
    } catch (err) {
      if (err instanceof EtlServiceError) {
        if (err.code === EtlErrorCode.PARSE_CONNECTION_FAILED) {
          res.status(503).json({
            error: 'Parse service unavailable',
            message: err.message,
          });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      req.log.error({ err }, 'Fetch source offices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /etl/source-types
 * Fetch distinct document types from Parse source.
 */
router.get(
  '/source-types',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_INGEST),
  async (req: Request, res: Response) => {
    try {
      const orm = getORM();
      const em = orm.em.fork();
      const service = new DocumentTemplateEtlService(em);

      const sourceTypes = await service.fetchSourceTypes();

      res.status(200).json({
        data: sourceTypes,
      });
    } catch (err) {
      if (err instanceof EtlServiceError) {
        res.status(400).json({ error: err.message });
        return;
      }
      req.log.error({ err }, 'Fetch source types error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /etl/source-document-count
 * Get total document count from Parse source.
 */
router.get(
  '/source-document-count',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_INGEST),
  async (req: Request, res: Response) => {
    try {
      const orm = getORM();
      const em = orm.em.fork();
      const service = new DocumentTemplateEtlService(em);

      const count = await service.getSourceDocumentCount();

      res.status(200).json({
        data: { count },
      });
    } catch (err) {
      if (err instanceof EtlServiceError) {
        res.status(400).json({ error: err.message });
        return;
      }
      req.log.error({ err }, 'Get source document count error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /etl/local-offices
 * Get offices from local database for mapping UI.
 */
router.get(
  '/local-offices',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_INGEST),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const company = authReq.companyContext;

      if (!company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const offices = await em.find(
        Office,
        { company: company.id },
        { orderBy: { name: 'ASC' } },
      );

      res.status(200).json({
        data: offices.map(o => ({
          id: o.id,
          name: o.name,
          isActive: o.isActive,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Get local offices error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /etl/import-sessions
 * Create a new import session with office and type mappings.
 */
router.post(
  '/import-sessions',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_INGEST),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = createImportSessionSchema.safeParse(req.body);
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

      const { officeMapping, typeMapping } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const service = new DocumentTemplateEtlService(em);

      const session = await service.createImportSession(
        company.id,
        user.id,
        officeMapping,
        typeMapping,
      );

      req.log.info(
        {
          sessionId: session.id,
          companyId: company.id,
          userId: user.id,
          totalCount: session.totalCount,
        },
        'Import session created',
      );

      res.status(201).json({
        data: {
          id: session.id,
          status: session.status,
          officeMapping: session.officeMapping,
          typeMapping: session.typeMapping,
          totalCount: session.totalCount,
          importedCount: session.importedCount,
          skippedCount: session.skippedCount,
          errorCount: session.errorCount,
          createdAt: session.createdAt,
        },
      });
    } catch (err) {
      if (err instanceof EtlServiceError) {
        if (err.code === EtlErrorCode.INVALID_MAPPING) {
          res.status(400).json({
            error: err.message,
            details: err.details,
          });
          return;
        }
      }
      req.log.error({ err }, 'Create import session error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /etl/import-sessions/:id
 * Get import session status and progress.
 */
router.get(
  '/import-sessions/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_INGEST),
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
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const session = await em.findOne(ImportSession, {
        id,
        company: company.id,
      });

      if (!session) {
        res.status(404).json({ error: 'Import session not found' });
        return;
      }

      res.status(200).json({
        data: {
          id: session.id,
          status: session.status,
          officeMapping: session.officeMapping,
          typeMapping: session.typeMapping,
          totalCount: session.totalCount,
          importedCount: session.importedCount,
          skippedCount: session.skippedCount,
          errorCount: session.errorCount,
          errors: session.errors,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get import session error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /etl/import-sessions/:id/batch
 * Import the next batch of documents.
 */
router.post(
  '/import-sessions/:id/batch',
  requireAuth(),
  requirePermission(PERMISSIONS.TEMPLATE_INGEST),
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
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const parseResult = importBatchSchema.safeParse(req.body);
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

      const { skip, limit } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      // Get session
      const session = await em.findOne(ImportSession, {
        id,
        company: company.id,
      });

      if (!session) {
        res.status(404).json({ error: 'Import session not found' });
        return;
      }

      const currentStatus = session.status as ImportSessionStatus;
      if (currentStatus === ImportSessionStatus.COMPLETED) {
        res.status(400).json({ error: 'Import session already completed' });
        return;
      }

      if (currentStatus === ImportSessionStatus.FAILED) {
        res.status(400).json({ error: 'Import session has failed' });
        return;
      }

      const service = new DocumentTemplateEtlService(em);
      const result = await service.importBatch({
        companyId: company.id,
        officeMapping: session.officeMapping,
        typeMapping: session.typeMapping,
        skip,
        limit,
        sessionId: session.id,
        userId: user.id,
      });

      req.log.info(
        {
          sessionId: session.id,
          skip,
          limit,
          imported: result.importedCount,
          skipped: result.skippedCount,
          errors: result.errorCount,
        },
        'Batch imported',
      );

      // Refresh session to get updated counts
      await em.refresh(session);

      res.status(200).json({
        data: {
          ...result,
          session: {
            id: session.id,
            status: session.status,
            totalCount: session.totalCount,
            importedCount: session.importedCount,
            skippedCount: session.skippedCount,
            errorCount: session.errorCount,
            completedAt: session.completedAt,
          },
        },
      });
    } catch (err) {
      if (err instanceof EtlServiceError) {
        if (err.code === EtlErrorCode.SESSION_NOT_FOUND) {
          res.status(404).json({ error: err.message });
          return;
        }
        if (err.code === EtlErrorCode.SESSION_INVALID_STATE) {
          res.status(400).json({ error: err.message });
          return;
        }
      }
      req.log.error({ err }, 'Import batch error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
