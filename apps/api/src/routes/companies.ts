/**
 * Company settings routes.
 * Provides endpoints for managing company-wide settings like MFA requirements.
 * Logo management is now handled through the logo library (/companies/logos).
 */
import { Router } from 'express';
import { z } from 'zod';

import { Company } from '../entities';
import { getORM } from '../lib/db';
import { PERMISSIONS } from '../lib/permissions';
import { getStorageAdapter } from '../lib/storage';
import { requireAuth, requirePermission } from '../middleware';

import type { CompanyLogo, User } from '../entities';
import type { AuthenticatedRequest } from '../middleware/requireAuth';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

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
  name: string;
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
  /** Default logo info (null if no default set) */
  logo: LogoInfo | null;
  /** ID of the default logo in the library */
  defaultLogoId: string | null;
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
    defaultLogoId: company.defaultLogo?.id ?? null,
    updatedAt: company.updatedAt.toISOString(),
  };
}

/**
 * Generate logo info with signed URLs from CompanyLogo.
 */
async function generateLogoInfo(companyLogo: CompanyLogo): Promise<LogoInfo> {
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
  };
}

// ============================================================================
// Company Settings Routes
// ============================================================================

/**
 * GET /companies/settings
 * Get company settings for the authenticated user's company.
 * Returns current MFA requirement status, default logo, and other company-wide settings.
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
        { populate: ['defaultLogo.file'] },
      );
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      let logoInfo: LogoInfo | null = null;
      if (company.defaultLogo) {
        logoInfo = await generateLogoInfo(company.defaultLogo);
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
 * Note: Logo management is now handled through /companies/logos endpoints.
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
        { populate: ['defaultLogo.file'] },
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
      if (company.defaultLogo) {
        logoInfo = await generateLogoInfo(company.defaultLogo);
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
 * @deprecated Use POST /companies/logos to upload to the logo library,
 * then POST /companies/logos/:id/set-default to set as default.
 */
router.post(
  '/settings/logo',
  requireAuth(),
  requirePermission(PERMISSIONS.COMPANY_UPDATE),
  (_req: Request, res: Response) => {
    res.status(410).json({
      error:
        'This endpoint is deprecated. Use POST /companies/logos to upload logos to the library.',
    });
  },
);

/**
 * DELETE /companies/settings/logo
 * @deprecated Use DELETE /companies/logos/default to remove the default logo.
 */
router.delete(
  '/settings/logo',
  requireAuth(),
  requirePermission(PERMISSIONS.COMPANY_UPDATE),
  (_req: Request, res: Response) => {
    res.status(410).json({
      error:
        'This endpoint is deprecated. Use DELETE /companies/logos/default to remove the default logo.',
    });
  },
);

export default router;
