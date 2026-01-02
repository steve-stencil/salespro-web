/**
 * Company logo library routes.
 * Provides endpoints for managing the company's logo library.
 * Logos in the library can be selected by offices or set as the company default.
 */
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import {
  Company,
  CompanyLogo,
  File,
  FileStatus,
  FileVisibility,
  OfficeSettings,
  User,
} from '../entities';
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
import type {
  NextFunction,
  Request,
  Response,
  Router as RouterType,
} from 'express';

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

/**
 * Handle multer upload errors and return appropriate HTTP responses.
 */
function handleMulterUploadError(err: unknown, res: Response): boolean {
  if (!err) {
    return false;
  }
  if (err instanceof multer.MulterError) {
    // Multer-specific errors (file size, etc.)
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large' });
      return true;
    }
    res.status(400).json({ error: err.message });
    return true;
  }
  if (err instanceof Error) {
    // Custom errors from fileFilter
    res.status(400).json({ error: err.message });
    return true;
  }
  res.status(400).json({ error: 'Upload failed' });
  return true;
}

// ============================================================================
// Validation Schemas
// ============================================================================

const uploadLogoSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const updateLogoSchema = z.object({
  name: z.string().min(1).max(100),
});

// ============================================================================
// Types
// ============================================================================

/** Logo information in API response */
type LogoLibraryItem = {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  filename: string;
  isDefault: boolean;
  usedByOfficeCount: number;
  createdAt: string;
};

/** Company context from request */
type CompanyContext = {
  user: User;
  company: Company;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get company context from authenticated request.
 */
function getCompanyContext(req: Request): CompanyContext | null {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  const company = authReq.companyContext;
  return user && company ? { user, company } : null;
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

/**
 * Generate logo info with signed URLs.
 */
async function generateLogoInfo(
  companyLogo: CompanyLogo,
  isDefault: boolean,
  usedByOfficeCount: number,
): Promise<LogoLibraryItem> {
  const storage = getStorageAdapter();
  const file = companyLogo.file;

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
    id: companyLogo.id,
    name: companyLogo.name,
    url,
    thumbnailUrl,
    filename: file.filename,
    isDefault,
    usedByOfficeCount,
    createdAt: companyLogo.createdAt.toISOString(),
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /companies/logos
 * List all logos in the company's logo library.
 */
router.get(
  '/',
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

      // Get company with default logo
      const company = await em.findOne(
        Company,
        { id: companyContext.id },
        { populate: ['defaultLogo'] },
      );
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      // Get all logos in the library
      const logos = await em.find(
        CompanyLogo,
        { company: company.id },
        { populate: ['file'], orderBy: { createdAt: 'DESC' } },
      );

      // Count office usage for each logo
      const officeSettings = await em.find(OfficeSettings, {
        logo: { $in: logos.map(l => l.id) },
      });

      const usageCountMap = new Map<string, number>();
      for (const setting of officeSettings) {
        const logoId =
          typeof setting.logo === 'string' ? setting.logo : setting.logo?.id;
        if (logoId) {
          usageCountMap.set(logoId, (usageCountMap.get(logoId) ?? 0) + 1);
        }
      }

      // Map logos to response format
      const logoItems: LogoLibraryItem[] = await Promise.all(
        logos.map(async logo => {
          const isDefault = company.defaultLogo?.id === logo.id;
          const usedByOfficeCount = usageCountMap.get(logo.id) ?? 0;
          return generateLogoInfo(logo, isDefault, usedByOfficeCount);
        }),
      );

      res.status(200).json({
        logos: logoItems,
        defaultLogoId: company.defaultLogo?.id ?? null,
      });
    } catch (err) {
      req.log.error({ err }, 'List company logos error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /companies/logos
 * Upload a new logo to the company's logo library.
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.COMPANY_UPDATE),
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('logo')(req, res, (err: unknown) => {
      if (handleMulterUploadError(err, res)) {
        return;
      }
      next();
    });
  },
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

      // Parse optional name from body
      const bodyParse = uploadLogoSchema.safeParse(req.body);
      const logoName =
        bodyParse.success && bodyParse.data.name
          ? bodyParse.data.name
          : file.originalname.replace(/\.[^.]+$/, '');

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
        { populate: ['defaultLogo'] },
      );
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      // Upload the logo file
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
          purpose: 'company-logo-library',
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
        req.log.warn({ err: error }, 'Logo thumbnail generation failed');
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
      fileEntity.description = `Logo library: ${logoName}`;

      em.persist(fileEntity);

      // Create company logo entry
      const companyLogo = new CompanyLogo();
      companyLogo.name = logoName;
      companyLogo.company = company;
      companyLogo.file = fileEntity;

      em.persist(companyLogo);
      await em.flush();

      // If this is the first logo, set it as default
      const logoCount = await em.count(CompanyLogo, { company: company.id });
      const setAsDefault = logoCount === 1;

      if (setAsDefault) {
        company.defaultLogo = companyLogo;
        await em.flush();
      }

      req.log.info(
        {
          companyId: company.id,
          logoId: companyLogo.id,
          userId: user.id,
          filename: file.originalname,
          setAsDefault,
        },
        'Logo added to library',
      );

      const logoInfo = await generateLogoInfo(companyLogo, setAsDefault, 0);

      res.status(201).json({
        message: 'Logo added to library',
        logo: logoInfo,
      });
    } catch (err) {
      req.log.error({ err }, 'Upload company logo error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PATCH /companies/logos/:id
 * Update logo name in the library.
 */
router.patch(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.COMPANY_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company: companyContext } = context;
      const { id: logoId } = req.params;

      const parseResult = updateLogoSchema.safeParse(req.body);
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

      const { name } = parseResult.data;

      const orm = getORM();
      const em = orm.em.fork();

      const companyLogo = await em.findOne(
        CompanyLogo,
        { id: logoId, company: companyContext.id },
        { populate: ['file'] },
      );

      if (!companyLogo) {
        res.status(404).json({ error: 'Logo not found' });
        return;
      }

      // Check if this is the default logo
      const company = await em.findOne(
        Company,
        { id: companyContext.id },
        { populate: ['defaultLogo'] },
      );
      const isDefault = company?.defaultLogo?.id === companyLogo.id;

      // Count office usage
      const usedByOfficeCount = await em.count(OfficeSettings, {
        logo: logoId,
      });

      companyLogo.name = name;
      await em.flush();

      const logoInfo = await generateLogoInfo(
        companyLogo,
        isDefault,
        usedByOfficeCount,
      );

      res.status(200).json({
        message: 'Logo updated',
        logo: logoInfo,
      });
    } catch (err) {
      req.log.error({ err }, 'Update company logo error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /companies/logos/default
 * Remove the default logo (company will have no default).
 * NOTE: This route MUST be defined before /:id to avoid "default" being parsed as a UUID.
 */
router.delete(
  '/default',
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

      const company = await em.findOne(Company, { id: companyContext.id });
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      company.defaultLogo = undefined;
      await em.flush();

      req.log.info(
        { companyId: company.id, userId: user.id },
        'Default logo removed',
      );

      res.status(200).json({
        message: 'Default logo removed',
      });
    } catch (err) {
      req.log.error({ err }, 'Remove default logo error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /companies/logos/:id
 * Remove a logo from the library.
 * Cannot delete a logo that is set as default or used by offices.
 */
router.delete(
  '/:id',
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
      const { id: logoId } = req.params;

      const orm = getORM();
      const em = orm.em.fork();

      const companyLogo = await em.findOne(
        CompanyLogo,
        { id: logoId, company: companyContext.id },
        { populate: ['file'] },
      );

      if (!companyLogo) {
        res.status(404).json({ error: 'Logo not found' });
        return;
      }

      // Check if this is the default logo
      const company = await em.findOne(
        Company,
        { id: companyContext.id },
        { populate: ['defaultLogo'] },
      );
      if (company?.defaultLogo?.id === companyLogo.id) {
        res.status(400).json({
          error:
            'Cannot delete the default logo. Please set another logo as default first.',
        });
        return;
      }

      // Check if logo is used by any offices
      const usedByOfficeCount = await em.count(OfficeSettings, {
        logo: logoId,
      });
      if (usedByOfficeCount > 0) {
        res.status(400).json({
          error: `Cannot delete logo. It is currently used by ${usedByOfficeCount} office(s). Please update those offices first.`,
        });
        return;
      }

      // Soft delete the file
      const fileEntity = companyLogo.file;
      fileEntity.status = FileStatus.DELETED;
      fileEntity.deletedAt = new Date();

      // Remove the company logo entry
      em.remove(companyLogo);
      await em.flush();

      // Delete from storage
      const storage = getStorageAdapter();
      try {
        await storage.delete(fileEntity.storageKey);
        if (fileEntity.thumbnailKey) {
          await storage.delete(fileEntity.thumbnailKey);
        }
      } catch (error) {
        req.log.warn({ err: error }, 'Failed to delete logo from storage');
      }

      req.log.info(
        { companyId: companyContext.id, logoId, userId: user.id },
        'Logo removed from library',
      );

      res.status(200).json({
        message: 'Logo removed from library',
      });
    } catch (err) {
      req.log.error({ err }, 'Delete company logo error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /companies/logos/:id/set-default
 * Set a logo as the company's default logo.
 */
router.post(
  '/:id/set-default',
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
      const { id: logoId } = req.params;

      const orm = getORM();
      const em = orm.em.fork();

      const companyLogo = await em.findOne(
        CompanyLogo,
        { id: logoId, company: companyContext.id },
        { populate: ['file'] },
      );

      if (!companyLogo) {
        res.status(404).json({ error: 'Logo not found' });
        return;
      }

      const company = await em.findOne(Company, { id: companyContext.id });
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      company.defaultLogo = companyLogo;
      await em.flush();

      // Count office usage
      const usedByOfficeCount = await em.count(OfficeSettings, {
        logo: logoId,
      });

      const logoInfo = await generateLogoInfo(
        companyLogo,
        true,
        usedByOfficeCount,
      );

      req.log.info(
        { companyId: company.id, logoId, userId: user.id },
        'Default logo updated',
      );

      res.status(200).json({
        message: 'Default logo updated',
        logo: logoInfo,
      });
    } catch (err) {
      req.log.error({ err }, 'Set default logo error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;

