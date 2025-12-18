/**
 * Company settings routes.
 * Provides endpoints for managing company-wide settings like MFA requirements and logo.
 * These settings affect all users within a company.
 */
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import { Company, File, FileStatus, FileVisibility, User } from '../entities';
import { getORM } from '../lib/db';
import { PERMISSIONS } from '../lib/permissions';
import {
  getStorageAdapter,
  generateStorageKey,
  getFileExtension,
  sanitizeFilename,
} from '../lib/storage';
import { requireAuth, requirePermission } from '../middleware';
import { LOGO_CONFIG, isValidLogoMimeType } from '../services/office-settings';

import type { AuthenticatedRequest } from '../middleware/requireAuth';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

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

// ============================================================================
// Validation Schemas
// ============================================================================

const updateCompanySettingsSchema = z.object({
  mfaRequired: z.boolean().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get company context from authenticated request.
 * @returns Company context or null if not available
 */
function getCompanyContext(
  req: Request,
): { user: User; company: Company } | null {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  const company = authReq.companyContext;
  return user && company ? { user, company } : null;
}

/** Logo information in API response */
type LogoInfo = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  filename: string;
};

/**
 * Company settings response type
 */
type CompanySettingsResponse = {
  companyId: string;
  companyName: string;
  mfaRequired: boolean;
  logo: LogoInfo | null;
  updatedAt: string;
};

/**
 * Map company entity to settings response object.
 * @param company - Company entity
 * @param logoInfo - Optional logo info with signed URLs
 * @returns Formatted company settings response
 */
function mapCompanyToSettingsResponse(
  company: Company,
  logoInfo?: LogoInfo | null,
): CompanySettingsResponse {
  return {
    companyId: company.id,
    companyName: company.name,
    mfaRequired: company.mfaRequired,
    logo: logoInfo ?? null,
    updatedAt: company.updatedAt.toISOString(),
  };
}

/**
 * Generate logo info with signed URLs.
 */
async function generateLogoInfo(file: File): Promise<LogoInfo> {
  const storage = getStorageAdapter();
  const url = await storage.getSignedDownloadUrl({
    key: file.storageKey,
    expiresIn: 3600,
  });
  const thumbnailUrl = file.thumbnailKey
    ? await storage.getSignedDownloadUrl({
        key: file.thumbnailKey,
        expiresIn: 3600,
      })
    : null;

  return {
    id: file.id,
    url,
    thumbnailUrl,
    filename: file.filename,
  };
}

/**
 * Validate logo dimensions.
 */
async function validateLogoDimensions(
  buffer: Buffer,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width;
    const height = metadata.height;

    if (
      !width ||
      !height ||
      width < LOGO_CONFIG.minWidth ||
      height < LOGO_CONFIG.minHeight ||
      width > LOGO_CONFIG.maxWidth ||
      height > LOGO_CONFIG.maxHeight
    ) {
      return {
        valid: false,
        error: `Invalid dimensions (${String(width)}x${String(height)}). Logo must be between ${LOGO_CONFIG.minWidth}x${LOGO_CONFIG.minHeight} and ${LOGO_CONFIG.maxWidth}x${LOGO_CONFIG.maxHeight} pixels`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Could not process image: ${(error as Error).message}`,
    };
  }
}

// ============================================================================
// Company Settings Routes
// ============================================================================

/**
 * GET /companies/settings
 * Get company settings for the authenticated user's company.
 * Returns current MFA requirement status, logo, and other company-wide settings.
 */
router.get(
  '/settings',
  requireAuth(),
  requirePermission(PERMISSIONS.COMPANY_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company: companyContext } = context;
      const orm = getORM();
      const em = orm.em.fork();

      const company = await em.findOne(
        Company,
        { id: companyContext.id },
        { populate: ['logoFile'] },
      );
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      let logoInfo: LogoInfo | null = null;
      if (company.logoFile) {
        logoInfo = await generateLogoInfo(company.logoFile);
      }

      res.status(200).json({
        settings: mapCompanyToSettingsResponse(company, logoInfo),
      });
    } catch (err) {
      req.log.error({ err }, 'Get company settings error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /companies/settings
 * Update company settings (e.g., mfaRequired).
 * Changes to security settings are logged for audit purposes.
 */
router.patch(
  '/settings',
  requireAuth(),
  requirePermission(PERMISSIONS.COMPANY_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company: companyContext } = context;
      const parseResult = updateCompanySettingsSchema.safeParse(req.body);
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

      const { mfaRequired } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork();

      const company = await em.findOne(
        Company,
        { id: companyContext.id },
        { populate: ['logoFile'] },
      );
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      const changes: Record<string, { from: unknown; to: unknown }> = {};

      if (mfaRequired !== undefined && mfaRequired !== company.mfaRequired) {
        changes['mfaRequired'] = { from: company.mfaRequired, to: mfaRequired };
        company.mfaRequired = mfaRequired;
      }

      if (Object.keys(changes).length > 0) {
        await em.flush();
        req.log.info(
          {
            companyId: company.id,
            companyName: company.name,
            changes,
            userId: user.id,
          },
          'Company settings updated',
        );
      }

      let logoInfo: LogoInfo | null = null;
      if (company.logoFile) {
        logoInfo = await generateLogoInfo(company.logoFile);
      }

      res.status(200).json({
        message: 'Settings updated successfully',
        settings: mapCompanyToSettingsResponse(company, logoInfo),
      });
    } catch (err) {
      req.log.error({ err }, 'Update company settings error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /companies/settings/logo
 * Upload or update company logo.
 */
router.post(
  '/settings/logo',
  requireAuth(),
  requirePermission(PERMISSIONS.COMPANY_UPDATE),
  upload.single('logo'),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company: companyContext } = context;

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No logo file provided' });
        return;
      }

      // Validate MIME type
      if (!isValidLogoMimeType(file.mimetype)) {
        res.status(400).json({
          error: `Invalid file type. Allowed types: ${LOGO_CONFIG.allowedTypes.join(', ')}`,
        });
        return;
      }

      // Validate dimensions
      const dimensionCheck = await validateLogoDimensions(file.buffer);
      if (!dimensionCheck.valid) {
        res.status(400).json({ error: dimensionCheck.error });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();

      const company = await em.findOne(
        Company,
        { id: companyContext.id },
        { populate: ['logoFile'] },
      );
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      // Store old logo for cleanup
      const oldLogoFile = company.logoFile;

      // Upload the new logo file
      const storage = getStorageAdapter();
      const fileId = uuid();
      const ext = getFileExtension(file.originalname, file.mimetype);
      const storageKey = generateStorageKey(company.id, fileId, ext);
      const safeFilename = sanitizeFilename(file.originalname);

      await storage.upload({
        key: storageKey,
        buffer: file.buffer,
        mimeType: file.mimetype,
        metadata: {
          originalFilename: safeFilename,
          uploadedBy: user.id,
          purpose: 'company-logo',
        },
      });

      // Generate thumbnail
      let thumbnailKey: string | undefined;
      try {
        const thumbnailBuffer = await sharp(file.buffer)
          .resize(200, 200, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .toBuffer();
        thumbnailKey = `${company.id}/thumbnails/${fileId}_thumb.${ext}`;
        await storage.upload({
          key: thumbnailKey,
          buffer: thumbnailBuffer,
          mimeType: file.mimetype,
        });
      } catch (error) {
        req.log.warn(
          { err: error },
          'Company logo thumbnail generation failed',
        );
      }

      // Create file entity
      const fileEntity = new File();
      fileEntity.id = fileId;
      fileEntity.filename = safeFilename;
      fileEntity.storageKey = storageKey;
      fileEntity.mimeType = file.mimetype;
      fileEntity.size = file.buffer.length;
      fileEntity.visibility = FileVisibility.COMPANY;
      fileEntity.status = FileStatus.ACTIVE;
      fileEntity.company = em.getReference(Company, company.id);
      fileEntity.uploadedBy = em.getReference(User, user.id);
      fileEntity.thumbnailKey = thumbnailKey;
      fileEntity.description = `Company logo for ${company.name}`;

      em.persist(fileEntity);
      company.logoFile = fileEntity;
      await em.flush();

      // Clean up old logo file
      if (oldLogoFile) {
        oldLogoFile.status = FileStatus.DELETED;
        oldLogoFile.deletedAt = new Date();
        await em.flush();

        try {
          await storage.delete(oldLogoFile.storageKey);
          if (oldLogoFile.thumbnailKey) {
            await storage.delete(oldLogoFile.thumbnailKey);
          }
        } catch (error) {
          req.log.warn(
            { err: error },
            'Failed to delete old company logo from storage',
          );
        }
      }

      req.log.info(
        { companyId: company.id, userId: user.id, filename: file.originalname },
        'Company logo updated',
      );

      const logoInfo = await generateLogoInfo(fileEntity);

      res.status(200).json({
        message: 'Logo updated successfully',
        settings: mapCompanyToSettingsResponse(company, logoInfo),
      });
    } catch (err) {
      req.log.error({ err }, 'Upload company logo error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /companies/settings/logo
 * Remove company logo.
 */
router.delete(
  '/settings/logo',
  requireAuth(),
  requirePermission(PERMISSIONS.COMPANY_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { user, company: companyContext } = context;
      const orm = getORM();
      const em = orm.em.fork();

      const company = await em.findOne(
        Company,
        { id: companyContext.id },
        { populate: ['logoFile'] },
      );
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      const logoFile = company.logoFile;
      if (!logoFile) {
        res.status(200).json({
          message: 'No logo to remove',
          settings: mapCompanyToSettingsResponse(company, null),
        });
        return;
      }

      // Remove logo reference
      company.logoFile = undefined;
      await em.flush();

      // Soft delete the file entity
      logoFile.status = FileStatus.DELETED;
      logoFile.deletedAt = new Date();
      await em.flush();

      // Delete from storage
      const storage = getStorageAdapter();
      try {
        await storage.delete(logoFile.storageKey);
        if (logoFile.thumbnailKey) {
          await storage.delete(logoFile.thumbnailKey);
        }
      } catch (error) {
        req.log.warn(
          { err: error },
          'Failed to delete company logo from storage',
        );
      }

      req.log.info(
        { companyId: company.id, userId: user.id },
        'Company logo removed',
      );

      res.status(200).json({
        message: 'Logo removed successfully',
        settings: mapCompanyToSettingsResponse(company, null),
      });
    } catch (err) {
      req.log.error({ err }, 'Remove company logo error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
