/**
 * Office integration routes for managing third-party integrations.
 * Handles CRUD operations for encrypted integration credentials.
 */

import { Router } from 'express';

import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';
import {
  OfficeIntegrationService,
  OfficeIntegrationError,
  OfficeIntegrationErrorCode,
} from '../../services/office-integration';

import {
  integrationKeySchema,
  upsertIntegrationSchema,
  listIntegrationsQuerySchema,
} from './schemas';

import type { Company, User } from '../../entities';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router({ mergeParams: true });

/**
 * Request type with authenticated user
 */
type AuthenticatedRequest = Request & {
  user?: User & { company?: Company };
};

/**
 * Get user from authenticated request.
 */
function getAuthenticatedUser(
  req: Request,
): (User & { company?: Company }) | null {
  const user = (req as AuthenticatedRequest).user;
  return user?.company ? user : null;
}

/**
 * Map error to HTTP response.
 */
function handleIntegrationError(
  error: unknown,
  req: Request,
  res: Response,
): void {
  if (error instanceof OfficeIntegrationError) {
    switch (error.code) {
      case OfficeIntegrationErrorCode.OFFICE_NOT_FOUND:
      case OfficeIntegrationErrorCode.INTEGRATION_NOT_FOUND:
        res.status(404).json({ error: error.message });
        return;
      case OfficeIntegrationErrorCode.INVALID_CREDENTIALS:
        res.status(400).json({ error: error.message });
        return;
      case OfficeIntegrationErrorCode.MISSING_ENCRYPTION_KEY:
        req.log.error({ err: error }, 'Missing encryption key');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      case OfficeIntegrationErrorCode.ENCRYPTION_FAILED:
      case OfficeIntegrationErrorCode.DECRYPTION_FAILED:
        req.log.error({ err: error }, 'Encryption/decryption error');
        res.status(500).json({ error: 'Failed to process credentials' });
        return;
      case OfficeIntegrationErrorCode.CROSS_COMPANY_ACCESS:
        res.status(403).json({ error: error.message });
        return;
      default:
        req.log.error({ err: error }, 'Office integration error');
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
  }

  req.log.error({ err: error }, 'Unexpected office integration error');
  res.status(500).json({ error: 'Internal server error' });
}

/**
 * GET /offices/:id/integrations
 * List all integrations for an office
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_READ),
  async (req: Request, res: Response) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id: officeId } = req.params;
      if (!officeId) {
        res.status(400).json({ error: 'Office ID is required' });
        return;
      }

      const queryResult = listIntegrationsQuerySchema.safeParse(req.query);
      const options = queryResult.success ? queryResult.data : {};

      const orm = getORM();
      const em = orm.em.fork();
      const service = new OfficeIntegrationService(em);

      const integrations = await service.listIntegrations(
        officeId,
        user.company!.id,
        options,
      );

      res.status(200).json({ integrations });
    } catch (error) {
      handleIntegrationError(error, req, res);
    }
  },
);

/**
 * GET /offices/:id/integrations/:key
 * Get a specific integration by key
 */
router.get(
  '/:key',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_READ),
  async (req: Request, res: Response) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id: officeId, key: integrationKey } = req.params;
      if (!officeId) {
        res.status(400).json({ error: 'Office ID is required' });
        return;
      }

      const keyResult = integrationKeySchema.safeParse({ key: integrationKey });
      if (!keyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: keyResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const service = new OfficeIntegrationService(em);

      const integration = await service.getIntegration(
        officeId,
        user.company!.id,
        keyResult.data.key,
      );

      res.status(200).json({ integration });
    } catch (error) {
      handleIntegrationError(error, req, res);
    }
  },
);

/**
 * PUT /offices/:id/integrations/:key
 * Create or update an integration
 */
router.put(
  '/:key',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id: officeId, key: integrationKey } = req.params;
      if (!officeId) {
        res.status(400).json({ error: 'Office ID is required' });
        return;
      }

      const keyResult = integrationKeySchema.safeParse({ key: integrationKey });
      if (!keyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: keyResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const bodyResult = upsertIntegrationSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: bodyResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const service = new OfficeIntegrationService(em);

      const integration = await service.upsertIntegration({
        officeId,
        companyId: user.company!.id,
        integrationKey: keyResult.data.key,
        ...bodyResult.data,
      });

      req.log.info(
        { officeId, integrationKey: keyResult.data.key, userId: user.id },
        'Integration upserted',
      );

      res.status(200).json({
        message: 'Integration saved successfully',
        integration,
      });
    } catch (error) {
      handleIntegrationError(error, req, res);
    }
  },
);

/**
 * DELETE /offices/:id/integrations/:key
 * Delete an integration
 */
router.delete(
  '/:key',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id: officeId, key: integrationKey } = req.params;
      if (!officeId) {
        res.status(400).json({ error: 'Office ID is required' });
        return;
      }

      const keyResult = integrationKeySchema.safeParse({ key: integrationKey });
      if (!keyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: keyResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const service = new OfficeIntegrationService(em);

      await service.deleteIntegration(
        officeId,
        user.company!.id,
        keyResult.data.key,
      );

      req.log.info(
        { officeId, integrationKey: keyResult.data.key, userId: user.id },
        'Integration deleted',
      );

      res.status(200).json({ message: 'Integration deleted successfully' });
    } catch (error) {
      handleIntegrationError(error, req, res);
    }
  },
);

export default router;
