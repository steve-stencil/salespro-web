/**
 * Migration Routes
 *
 * Parameterized routes for ETL migration operations.
 * Uses /:collection pattern to support multiple collection types.
 */

import { Router } from 'express';

import { MigrationSessionStatus } from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';
import {
  EtlServiceError,
  EtlErrorCode,
  OfficeEtlService,
} from '../../services';

import {
  SUPPORTED_COLLECTIONS,
  collectionParamSchema,
  importBatchSchema,
} from './schemas';

import type { CollectionName } from './schemas';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/core';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * Get ETL service for a collection.
 * Factory pattern allows adding new collections easily.
 * When new collections are added, extend SUPPORTED_COLLECTIONS
 * and add cases here.
 */
function getEtlService(_collection: CollectionName, em: EntityManager) {
  // Currently only 'offices' is supported - return office service
  // When more collections are added:
  // switch (_collection) {
  //   case 'offices': return new OfficeEtlService(em);
  //   case 'users': return new UserEtlService(em);
  // }
  return new OfficeEtlService(em);
}

/**
 * Validate collection parameter middleware.
 */
function validateCollection(
  req: Request,
  res: Response,
  next: () => void,
): void {
  const { collection } = req.params;
  const result = collectionParamSchema.safeParse({ collection });

  if (!result.success) {
    res.status(400).json({
      error: 'Invalid collection',
      message: `Supported collections: ${SUPPORTED_COLLECTIONS.join(', ')}`,
    });
    return;
  }

  next();
}

/**
 * GET /migration/:collection/source-count
 * Get total count of items in legacy source database.
 * Scoped by the authenticated user's company in the source system.
 */
router.get(
  '/:collection/source-count',
  requireAuth(),
  requirePermission(PERMISSIONS.DATA_MIGRATION),
  validateCollection,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      if (!user?.email) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { collection } = req.params as { collection: CollectionName };
      const orm = getORM();
      const em = orm.em.fork();
      const service = getEtlService(collection, em);

      // Initialize source company from user's email
      const sourceCompanyId = await service.initializeSourceCompany(user.email);

      const count = await service.getSourceCount();

      res.status(200).json({
        data: { count, sourceCompanyId },
      });
    } catch (err) {
      if (err instanceof EtlServiceError) {
        if (err.code === EtlErrorCode.SOURCE_CONNECTION_FAILED) {
          res.status(503).json({
            error: 'Source database unavailable',
            message: err.message,
          });
          return;
        }
        if (err.code === EtlErrorCode.SOURCE_COMPANY_NOT_FOUND) {
          res.status(404).json({
            error: 'Source company not found',
            message: err.message,
          });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      req.log.error({ err }, 'Get source count error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /migration/:collection/imported-status
 * Check which source IDs have already been imported.
 * Returns a set of sourceIds that exist in the target database.
 */
router.post(
  '/:collection/imported-status',
  requireAuth(),
  requirePermission(PERMISSIONS.DATA_MIGRATION),
  validateCollection,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const company = authReq.companyContext;

      if (!company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { sourceIds } = req.body as { sourceIds?: string[] };

      if (!Array.isArray(sourceIds)) {
        res.status(400).json({ error: 'sourceIds must be an array' });
        return;
      }

      const { collection } = req.params as { collection: CollectionName };
      const orm = getORM();
      const em = orm.em.fork();
      const service = getEtlService(collection, em);

      const importedSet = await service.getImportedSourceIds(
        company.id,
        sourceIds,
      );

      res.status(200).json({
        data: {
          importedSourceIds: Array.from(importedSet),
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Check imported status error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /migration/:collection/source
 * List source items from legacy database for preview.
 * Scoped by the authenticated user's company in the source system.
 */
router.get(
  '/:collection/source',
  requireAuth(),
  requirePermission(PERMISSIONS.DATA_MIGRATION),
  validateCollection,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      if (!user?.email) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { collection } = req.params as { collection: CollectionName };
      const skip = parseInt(req.query['skip'] as string) || 0;
      const limit = Math.min(
        parseInt(req.query['limit'] as string) || 100,
        100,
      );

      const orm = getORM();
      const em = orm.em.fork();
      const service = getEtlService(collection, em);

      // Initialize source company from user's email
      await service.initializeSourceCompany(user.email);

      const result = await service.fetchSourceItems(skip, limit);

      res.status(200).json({
        data: result.items,
        meta: {
          total: result.total,
          skip,
          limit,
        },
      });
    } catch (err) {
      if (err instanceof EtlServiceError) {
        if (err.code === EtlErrorCode.SOURCE_CONNECTION_FAILED) {
          res.status(503).json({
            error: 'Source database unavailable',
            message: err.message,
          });
          return;
        }
        if (err.code === EtlErrorCode.SOURCE_COMPANY_NOT_FOUND) {
          res.status(404).json({
            error: 'Source company not found',
            message: err.message,
          });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      req.log.error({ err }, 'Get source items error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /migration/:collection/sessions
 * Create a new migration session.
 * Looks up the user's company in the source system and stores it in the session.
 */
router.post(
  '/:collection/sessions',
  requireAuth(),
  requirePermission(PERMISSIONS.DATA_MIGRATION),
  validateCollection,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user?.email || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { collection } = req.params as { collection: CollectionName };
      const orm = getORM();
      const em = orm.em.fork();
      const service = getEtlService(collection, em);

      // Initialize source company from user's email
      const sourceCompanyId = await service.initializeSourceCompany(user.email);

      const session = await service.createSession(company.id, user.id);

      req.log.info(
        {
          sessionId: session.id,
          companyId: company.id,
          sourceCompanyId,
          userId: user.id,
          collection,
          totalCount: session.totalCount,
        },
        'Migration session created',
      );

      res.status(201).json({
        data: {
          id: session.id,
          status: session.status,
          sourceCompanyId: session.sourceCompanyId,
          totalCount: session.totalCount,
          importedCount: session.importedCount,
          skippedCount: session.skippedCount,
          errorCount: session.errorCount,
          createdAt: session.createdAt,
        },
      });
    } catch (err) {
      if (err instanceof EtlServiceError) {
        if (err.code === EtlErrorCode.SOURCE_COMPANY_NOT_FOUND) {
          res.status(404).json({
            error: 'Source company not found',
            message: err.message,
          });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      req.log.error({ err }, 'Create migration session error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /migration/:collection/sessions/:id
 * Get migration session status.
 */
router.get(
  '/:collection/sessions/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.DATA_MIGRATION),
  validateCollection,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const company = authReq.companyContext;

      if (!company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { collection, id } = req.params as {
        collection: CollectionName;
        id: string;
      };

      const orm = getORM();
      const em = orm.em.fork();
      const service = getEtlService(collection, em);

      const session = await service.getSession(id, company.id);

      if (!session) {
        res.status(404).json({ error: 'Migration session not found' });
        return;
      }

      res.status(200).json({
        data: {
          id: session.id,
          status: session.status,
          sourceCompanyId: session.sourceCompanyId,
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
      req.log.error({ err }, 'Get migration session error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /migration/:collection/sessions/:id/batch
 * Import the next batch of items.
 */
router.post(
  '/:collection/sessions/:id/batch',
  requireAuth(),
  requirePermission(PERMISSIONS.DATA_MIGRATION),
  validateCollection,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const company = authReq.companyContext;

      if (!user || !company) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { collection, id } = req.params as {
        collection: CollectionName;
        id: string;
      };

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

      const { skip, limit, sourceIds } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();
      const service = getEtlService(collection, em);

      // Get session to check state
      const session = await service.getSession(id, company.id);

      if (!session) {
        res.status(404).json({ error: 'Migration session not found' });
        return;
      }

      const currentStatus = session.status as MigrationSessionStatus;
      if (currentStatus === MigrationSessionStatus.COMPLETED) {
        res.status(400).json({ error: 'Migration session already completed' });
        return;
      }

      if (currentStatus === MigrationSessionStatus.FAILED) {
        res.status(400).json({ error: 'Migration session has failed' });
        return;
      }

      const result = await service.importBatch({
        companyId: company.id,
        skip,
        limit,
        sessionId: id,
        userId: user.id,
        sourceIds,
      });

      req.log.info(
        {
          sessionId: id,
          collection,
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
