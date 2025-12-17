/**
 * Office settings routes for managing office-level configuration.
 * Handles logo upload/removal and settings retrieval.
 */

import { Router } from 'express';
import multer from 'multer';

import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import { requireAuth, requirePermission } from '../../middleware';
import {
  OfficeSettingsService,
  OfficeSettingsError,
  OfficeSettingsErrorCode,
  LOGO_CONFIG,
} from '../../services/office-settings';

import type { Company, User } from '../../entities';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router({ mergeParams: true });

// Configure multer for logo upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: LOGO_CONFIG.maxSizeBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (
      LOGO_CONFIG.allowedTypes.includes(
        file.mimetype as (typeof LOGO_CONFIG.allowedTypes)[number],
      )
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Allowed types: ${LOGO_CONFIG.allowedTypes.join(', ')}`,
        ),
      );
    }
  },
});

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
function handleSettingsError(
  error: unknown,
  req: Request,
  res: Response,
): void {
  if (error instanceof OfficeSettingsError) {
    switch (error.code) {
      case OfficeSettingsErrorCode.OFFICE_NOT_FOUND:
      case OfficeSettingsErrorCode.SETTINGS_NOT_FOUND:
        res.status(404).json({ error: error.message });
        return;
      case OfficeSettingsErrorCode.INVALID_FILE_TYPE:
      case OfficeSettingsErrorCode.INVALID_DIMENSIONS:
        res.status(400).json({ error: error.message });
        return;
      case OfficeSettingsErrorCode.FILE_TOO_LARGE:
        res.status(413).json({ error: error.message });
        return;
      case OfficeSettingsErrorCode.CROSS_COMPANY_ACCESS:
        res.status(403).json({ error: error.message });
        return;
      default:
        req.log.error({ err: error }, 'Office settings error');
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
  }

  req.log.error({ err: error }, 'Unexpected office settings error');
  res.status(500).json({ error: 'Internal server error' });
}

/**
 * GET /offices/:id/settings
 * Get office settings for a specific office
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.OFFICE_READ),
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

      const orm = getORM();
      const em = orm.em.fork();
      const service = new OfficeSettingsService(em);

      const settings = await service.getSettings(officeId, user.company!.id);
      res.status(200).json({ settings });
    } catch (error) {
      handleSettingsError(error, req, res);
    }
  },
);

/**
 * POST /offices/:id/settings/logo
 * Upload or update office logo
 */
router.post(
  '/logo',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  upload.single('logo'),
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

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No logo file provided' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const service = new OfficeSettingsService(em);

      const settings = await service.updateLogo({
        officeId,
        companyId: user.company!.id,
        file: {
          buffer: file.buffer,
          filename: file.originalname,
          mimeType: file.mimetype,
        },
        user: {
          id: user.id,
          company: { id: user.company!.id },
        },
      });

      req.log.info(
        { officeId, userId: user.id, filename: file.originalname },
        'Office logo updated',
      );

      res.status(200).json({
        message: 'Logo updated successfully',
        settings,
      });
    } catch (error) {
      handleSettingsError(error, req, res);
    }
  },
);

/**
 * DELETE /offices/:id/settings/logo
 * Remove office logo
 */
router.delete(
  '/logo',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
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

      const orm = getORM();
      const em = orm.em.fork();
      const service = new OfficeSettingsService(em);

      const settings = await service.removeLogo(officeId, user.company!.id);

      req.log.info({ officeId, userId: user.id }, 'Office logo removed');

      res.status(200).json({
        message: 'Logo removed successfully',
        settings,
      });
    } catch (error) {
      handleSettingsError(error, req, res);
    }
  },
);

export default router;
