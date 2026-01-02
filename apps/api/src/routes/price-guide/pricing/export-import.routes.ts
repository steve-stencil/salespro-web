/**
 * Pricing Export/Import routes.
 * Handles Excel file export and import for option prices.
 */

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import {
  PricingImportJob,
  PricingImportJobStatus,
  Company,
  User,
} from '../../../entities';
import { getORM } from '../../../lib/db';
import { getJobQueue, JOB_QUEUES } from '../../../lib/job-queue';
import { PERMISSIONS } from '../../../lib/permissions';
import { requireAuth, requirePermission } from '../../../middleware';
import {
  exportOptionPricesToResponse,
  getExportRowCount,
} from '../../../services/price-guide/pricing-export.service';
import {
  previewImport,
  processImportSync,
  uploadTempFile,
  BACKGROUND_PROCESSING_THRESHOLD,
  MAX_FILE_SIZE_BYTES,
} from '../../../services/price-guide/pricing-import.service';

import type { AuthenticatedRequest } from '../../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// Configure multer for file uploads (10MB max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    // Accept only Excel files
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

// ============================================================================
// Validation Schemas
// ============================================================================

const exportQuerySchema = z.object({
  officeIds: z.string().optional(),
  optionIds: z.string().optional(),
  categoryIds: z.string().optional(),
  tagIds: z.string().optional(),
});

const importBodySchema = z.object({
  skipErrors: z
    .string()
    .optional()
    .transform(val => val === 'true'),
});

// ============================================================================
// Helper Functions
// ============================================================================

function getCompanyContext(
  req: Request,
): { user: User; company: Company } | undefined {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  const company = authReq.companyContext;
  return user && company ? { user, company } : undefined;
}

/**
 * Parse comma-separated UUID string into array.
 */
function parseUuidArray(input: string | undefined): string[] | undefined {
  if (!input) return undefined;
  return input
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /price-guide/pricing/options/export
 * Export option prices to Excel file.
 *
 * Query params:
 * - officeIds: comma-separated office UUIDs
 * - optionIds: comma-separated option UUIDs
 * - categoryIds: comma-separated category UUIDs (cascades to children)
 * - tagIds: comma-separated tag UUIDs
 */
router.get(
  '/export',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_IMPORT_EXPORT),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = exportQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.issues,
        });
        return;
      }

      const { officeIds, optionIds, categoryIds, tagIds } = parseResult.data;

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const exportOptions = {
        companyId: context.company.id,
        officeIds: parseUuidArray(officeIds),
        optionIds: parseUuidArray(optionIds),
        categoryIds: parseUuidArray(categoryIds),
        tagIds: parseUuidArray(tagIds),
      };

      await exportOptionPricesToResponse(em, res, exportOptions);
    } catch (err) {
      // If headers already sent (streaming started), can't send error response
      if (!res.headersSent) {
        const errorMessage =
          err instanceof Error
            ? `${err.message}\n${err.stack}`
            : 'Unknown error';
        res.status(500).json({
          error: 'Export failed',
          details: errorMessage,
        });
      }
    }
  },
);

/**
 * GET /price-guide/pricing/options/export/count
 * Get estimated row count for export preview.
 */
router.get(
  '/export/count',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_IMPORT_EXPORT),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const parseResult = exportQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.issues,
        });
        return;
      }

      const { officeIds, optionIds, categoryIds, tagIds } = parseResult.data;

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const count = await getExportRowCount(em, {
        companyId: context.company.id,
        officeIds: parseUuidArray(officeIds),
        optionIds: parseUuidArray(optionIds),
        categoryIds: parseUuidArray(categoryIds),
        tagIds: parseUuidArray(tagIds),
      });

      res.status(200).json({ estimatedRows: count });
    } catch (err) {
      req.log.error({ err }, 'Export count error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({
        error: 'Failed to get export count',
        details:
          process.env['NODE_ENV'] !== 'production' ? errorMessage : undefined,
      });
    }
  },
);

/**
 * POST /price-guide/pricing/options/import/preview
 * Preview import without applying changes.
 */
router.post(
  '/import/preview',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_IMPORT_EXPORT),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const preview = await previewImport(
        em,
        req.file.buffer,
        context.company.id,
      );

      res.status(200).json(preview);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;
      req.log.error({ err, errorMessage, errorStack }, 'Import preview error');
      console.error(
        '[pricing-import] Preview error:',
        errorMessage,
        errorStack,
      );
      res.status(500).json({
        error: 'Preview failed',
        message: errorMessage,
      });
    }
  },
);

/**
 * POST /price-guide/pricing/options/import
 * Import option prices from Excel file.
 *
 * For small files (< 1000 rows): processes synchronously
 * For large files: queues background job
 *
 * Form data:
 * - file: Excel file
 * - skipErrors: "true" to skip invalid rows instead of failing
 */
router.post(
  '/import',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_IMPORT_EXPORT),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const bodyResult = importBodySchema.safeParse(req.body);
      const skipErrors = bodyResult.success
        ? bodyResult.data.skipErrors
        : false;

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // First, preview to get row count
      const preview = await previewImport(
        em,
        req.file.buffer,
        context.company.id,
      );

      // If preview has errors and skipErrors is false, reject
      if (!preview.valid && !skipErrors) {
        res.status(400).json({
          error: 'Validation failed',
          preview,
        });
        return;
      }

      const totalRows = preview.summary.totalRows;

      // Small file: process synchronously
      if (totalRows < BACKGROUND_PROCESSING_THRESHOLD) {
        const result = await processImportSync(em, req.file.buffer, {
          companyId: context.company.id,
          userId: context.user.id,
          skipErrors,
        });

        req.log.info(
          {
            userId: context.user.id,
            companyId: context.company.id,
            filename: req.file.originalname,
            result,
          },
          'Pricing import completed (sync)',
        );

        res.status(200).json(result);
        return;
      }

      // Large file: queue background job
      const job = new PricingImportJob();
      job.company = em.getReference(Company, context.company.id);
      job.createdBy = em.getReference(User, context.user.id);
      job.filename = req.file.originalname;
      job.totalRows = totalRows;
      job.status = PricingImportJobStatus.PENDING;

      // Generate file key and upload to S3
      const fileKey = await uploadTempFile(
        req.file.buffer,
        context.company.id,
        job.id,
        req.file.originalname,
      );
      job.fileKey = fileKey;

      em.persist(job);
      await em.flush();

      // Queue the job
      const boss = await getJobQueue();
      await boss.send(JOB_QUEUES.PRICING_IMPORT, {
        jobId: job.id,
        skipErrors,
      });

      req.log.info(
        {
          userId: context.user.id,
          companyId: context.company.id,
          jobId: job.id,
          filename: req.file.originalname,
          totalRows,
        },
        'Pricing import queued',
      );

      res.status(202).json({
        jobId: job.id,
        status: 'pending',
        message: `Import queued for background processing (${totalRows} rows)`,
      });
    } catch (err) {
      req.log.error({ err }, 'Import error');
      res.status(500).json({ error: 'Import failed' });
    }
  },
);

/**
 * GET /price-guide/pricing/options/import/:jobId
 * Get import job status.
 */
router.get(
  '/import/:jobId',
  requireAuth(),
  requirePermission(PERMISSIONS.PRICE_GUIDE_IMPORT_EXPORT),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { jobId } = req.params;
      if (!jobId) {
        res.status(400).json({ error: 'Job ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const job = await em.findOne(PricingImportJob, {
        id: jobId,
        company: context.company.id,
      });

      if (!job) {
        res.status(404).json({ error: 'Import job not found' });
        return;
      }

      res.status(200).json({
        id: job.id,
        status: job.status,
        filename: job.filename,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        createdCount: job.createdCount,
        updatedCount: job.updatedCount,
        skippedCount: job.skippedCount,
        errorCount: job.errorCount,
        errors: job.errors,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
      });
    } catch (err) {
      req.log.error({ err }, 'Get import job status error');
      res.status(500).json({ error: 'Failed to get job status' });
    }
  },
);

export default router;
