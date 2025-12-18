/**
 * Company settings routes.
 * Provides endpoints for managing company-wide settings like MFA requirements.
 * These settings affect all users within a company.
 */
import { Router } from 'express';
import { z } from 'zod';

import { Company } from '../entities';
import { getORM } from '../lib/db';
import { PERMISSIONS } from '../lib/permissions';
import { requireAuth, requirePermission } from '../middleware';

import type { User } from '../entities';
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

/**
 * Company settings response type
 */
type CompanySettingsResponse = {
  companyId: string;
  companyName: string;
  mfaRequired: boolean;
  updatedAt: string;
};

/**
 * Map company entity to settings response object.
 * @param company - Company entity
 * @returns Formatted company settings response
 */
function mapCompanyToSettingsResponse(
  company: Company,
): CompanySettingsResponse {
  return {
    companyId: company.id,
    companyName: company.name,
    mfaRequired: company.mfaRequired,
    updatedAt: company.updatedAt.toISOString(),
  };
}

// ============================================================================
// Company Settings Routes
// ============================================================================

/**
 * GET /companies/settings
 * Get company settings for the authenticated user's company.
 * Returns current MFA requirement status and other company-wide settings.
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

      const company = await em.findOne(Company, { id: companyContext.id });
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      res.status(200).json({
        settings: mapCompanyToSettingsResponse(company),
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

      const company = await em.findOne(Company, { id: companyContext.id });
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

      res.status(200).json({
        message: 'Settings updated successfully',
        settings: mapCompanyToSettingsResponse(company),
      });
    } catch (err) {
      req.log.error({ err }, 'Update company settings error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
