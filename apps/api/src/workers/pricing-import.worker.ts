/**
 * Pricing Import Worker - background processing for large Excel imports.
 * Uses pg-boss for job queue management.
 *
 * OPTIMIZATION NOTES:
 * - Uses batch validation (2 queries for all offices + options)
 * - Uses chunk-based processing with batch price loading per chunk
 * - Minimizes total queries from O(rows × priceTypes) to O(rows / chunkSize)
 * - Clears identity map between chunks to prevent memory bloat
 */

import ExcelJS from 'exceljs';

import {
  PricingImportJob,
  PricingImportJobStatus,
  PriceObjectType,
  Office,
  PriceGuideOption,
  OptionPrice,
  User,
} from '../entities';
import { getORM } from '../lib/db';
import { emailService } from '../lib/email';
import { sendPricingImportCompleteEmail } from '../lib/email-templates';
import { getStorageAdapter } from '../lib/storage';
import {
  parseColumnConfig,
  parseRow,
  batchValidateRows,
  buildPriceKey,
  CHUNK_SIZE,
} from '../services/price-guide/pricing-import.service';

import type { ParsedRow } from '../services/price-guide/pricing-import.service';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { PgBoss, Job } from 'pg-boss';

/**
 * Job data passed to the worker
 */
type PricingImportJobData = {
  jobId: string;
  skipErrors?: boolean;
};

const MAX_ERRORS = 100;
const PROGRESS_UPDATE_INTERVAL = 100; // Update progress every N rows

/**
 * Register the pricing import worker with pg-boss.
 */
export async function registerPricingImportWorker(boss: PgBoss): Promise<void> {
  // pg-boss v12 requires queues to be created before workers can poll them
  await boss.createQueue('pricing-import');

  await boss.work<PricingImportJobData>(
    'pricing-import',
    {
      // Process one job at a time (batch size of 1)
      batchSize: 1,
      // Poll for new jobs every 2 seconds
      pollingIntervalSeconds: 2,
    },
    async (jobs: Job<PricingImportJobData>[]) => {
      // pg-boss v12 passes an array of jobs
      const job = jobs[0];
      if (!job) return;
      console.log(`[pricing-import] Starting job ${job.data.jobId}`);

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const importJob = await em.findOne(
        PricingImportJob,
        { id: job.data.jobId },
        { populate: ['createdBy', 'company'] },
      );

      if (!importJob) {
        console.error(`[pricing-import] Job ${job.data.jobId} not found`);
        return;
      }

      try {
        await processJob(em, importJob, job.data.skipErrors ?? false);
      } catch (err) {
        console.error(`[pricing-import] Job ${job.data.jobId} failed:`, err);
        importJob.markFailed(
          err instanceof Error ? err.message : 'Unknown error',
        );
        await em.flush();
      }

      // Send completion email
      await sendCompletionEmail(importJob);
    },
  );

  console.log('[pricing-import] Worker registered');
}

/**
 * Process the import job.
 * OPTIMIZED: Uses batch validation and chunk-based processing.
 */
async function processJob(
  em: EntityManager,
  job: PricingImportJob,
  skipErrors: boolean,
): Promise<void> {
  // Update status to processing
  job.status = PricingImportJobStatus.PROCESSING;
  await em.flush();

  // Download file from S3
  const storage = getStorageAdapter();
  const fileStream = await storage.download(job.fileKey);

  // Collect chunks into buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of fileStream) {
    // chunk could be string or Buffer, ensure it's bytes
    const bytes =
      typeof chunk === 'string' ? Buffer.from(chunk) : new Uint8Array(chunk);
    chunks.push(bytes);
  }

  // Concatenate chunks
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const fileBuffer = new Uint8Array(totalLength);
  let position = 0;
  for (const chunk of chunks) {
    fileBuffer.set(chunk, position);
    position += chunk.length;
  }

  // Load workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer.buffer);
  const worksheet = workbook.getWorksheet(1);

  if (!worksheet) {
    throw new Error('No worksheet found in file');
  }

  // Get company's price types
  const priceTypes = await em.find(
    PriceObjectType,
    { company: job.company.id, isActive: true },
    { orderBy: { sortOrder: 'ASC' } },
  );

  // Parse header row
  const headerRow = worksheet.getRow(1);
  const config = parseColumnConfig(headerRow, priceTypes);

  if (!config) {
    throw new Error('Missing required columns');
  }

  // Parse all rows
  const rows: ParsedRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 1) {
      rows.push(parseRow(row, rowNumber, config));
    }
  });

  job.totalRows = rows.length;
  job.status = PricingImportJobStatus.VALIDATING;
  await em.flush();

  // Batch validate all rows (2 queries total for offices + options)
  const officeCache = new Map<string, Office>();
  const optionCache = new Map<string, PriceGuideOption>();

  const validationErrors = await batchValidateRows(
    em,
    rows,
    job.company.id,
    officeCache,
    optionCache,
  );

  if (validationErrors.length > 0 && !skipErrors) {
    job.errors = validationErrors.slice(0, MAX_ERRORS);
    job.errorCount = validationErrors.length;
    job.status = PricingImportJobStatus.FAILED;
    job.completedAt = new Date();
    await em.flush();
    return;
  }

  // Track errors for rows that failed validation
  const rowsWithErrors = new Set(validationErrors.map(e => e.row));
  job.errors = validationErrors.slice(0, MAX_ERRORS);
  job.errorCount = validationErrors.length;

  // Filter to valid rows
  const validRows = rows.filter(
    r => r.optionId && r.officeId && !rowsWithErrors.has(r.rowNumber),
  );

  // Start processing phase
  job.status = PricingImportJobStatus.PROCESSING;
  await em.flush();

  // Track modified options to update lastModifiedBy
  const modifiedOptionIds = new Set<string>();

  // Process in chunks with batch operations
  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);

    try {
      const chunkResult = await processChunk(
        em,
        chunk,
        job.createdBy.id,
        modifiedOptionIds,
      );

      job.createdCount += chunkResult.created;
      job.updatedCount += chunkResult.updated;
      job.skippedCount += chunkResult.skipped;
      job.processedRows += chunk.length;

      // Update progress periodically
      if (job.processedRows % PROGRESS_UPDATE_INTERVAL === 0) {
        await em.flush();
        console.log(
          `[pricing-import] Job ${job.id}: ${job.processedRows}/${rows.length} rows processed`,
        );
      }

      // Clear identity map between chunks to prevent memory bloat
      // But first flush to persist changes
      await em.flush();
      em.clear();

      // Re-fetch job entity to continue tracking
      const refreshedJob = await em.findOneOrFail(
        PricingImportJob,
        { id: job.id },
        { populate: ['createdBy', 'company'] },
      );

      // Copy state back (flush persisted it, we need to update the local reference)
      job.createdCount = refreshedJob.createdCount;
      job.updatedCount = refreshedJob.updatedCount;
      job.skippedCount = refreshedJob.skippedCount;
      job.processedRows = refreshedJob.processedRows;
      job.errorCount = refreshedJob.errorCount;
      job.errors = refreshedJob.errors;

      // Yield to event loop to allow other work
      await new Promise(r => setImmediate(r));
    } catch (error) {
      job.errorCount++;
      if ((job.errors?.length ?? 0) < MAX_ERRORS) {
        job.errors = job.errors ?? [];
        job.errors.push({
          row: chunk[0]?.rowNumber ?? 0,
          column: '',
          message: `Chunk error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
      await em.flush();
    }
  }

  // Batch update lastModifiedBy for all modified options (1 query)
  if (modifiedOptionIds.size > 0) {
    const userRef = em.getReference(User, job.createdBy.id);
    await em
      .createQueryBuilder(PriceGuideOption)
      .update({ lastModifiedBy: userRef })
      .where({ id: { $in: Array.from(modifiedOptionIds) } })
      .execute();
  }

  // Final flush
  await em.flush();

  // Mark complete
  job.status = PricingImportJobStatus.COMPLETED;
  job.completedAt = new Date();
  await em.flush();

  // Cleanup: delete temp file from S3
  try {
    await storage.delete(job.fileKey);
  } catch {
    console.warn(`[pricing-import] Failed to delete temp file: ${job.fileKey}`);
  }

  console.log(
    `[pricing-import] Job ${job.id} completed: ` +
      `created=${job.createdCount}, updated=${job.updatedCount}, ` +
      `skipped=${job.skippedCount}, errors=${job.errorCount}`,
  );
}

/**
 * Process a chunk of rows with batch operations.
 * Batch loads existing prices and processes all rows in chunk.
 */
async function processChunk(
  em: EntityManager,
  chunk: ParsedRow[],
  _userId: string,
  modifiedOptionIds: Set<string>,
): Promise<{ created: number; updated: number; skipped: number }> {
  const result = { created: 0, updated: 0, skipped: 0 };

  // Get unique IDs for this chunk
  const chunkOptionIds = [
    ...new Set(chunk.map(r => r.optionId).filter(Boolean) as string[]),
  ];
  const chunkOfficeIds = [
    ...new Set(chunk.map(r => r.officeId).filter(Boolean) as string[]),
  ];

  if (chunkOptionIds.length === 0 || chunkOfficeIds.length === 0) {
    result.skipped = chunk.length;
    return result;
  }

  // Batch load existing prices for this chunk (1 query)
  const existingPrices = await em.find(
    OptionPrice,
    {
      option: { $in: chunkOptionIds },
      office: { $in: chunkOfficeIds },
      effectiveDate: null, // Current prices only
    },
    { populate: ['option', 'office', 'priceType'] },
  );

  // Build lookup map
  const priceMap = new Map<string, OptionPrice>();
  for (const price of existingPrices) {
    const key = buildPriceKey(
      price.option.id,
      price.office.id,
      price.priceType.id,
    );
    priceMap.set(key, price);
  }

  // Process chunk rows
  for (const row of chunk) {
    if (!row.optionId || !row.officeId) {
      result.skipped++;
      continue;
    }

    let rowHasChanges = false;
    let rowIsNew = false;

    for (const [priceTypeId, newAmount] of row.prices) {
      const key = buildPriceKey(row.optionId, row.officeId, priceTypeId);
      const existingPrice = priceMap.get(key);

      if (existingPrice) {
        // Update existing price if changed
        if (Math.abs(Number(existingPrice.amount) - newAmount) > 0.001) {
          existingPrice.amount = newAmount;
          rowHasChanges = true;
        }
      } else {
        // Create new price record (effectiveDate = null means current price)
        const newPrice = new OptionPrice();
        newPrice.option = em.getReference(PriceGuideOption, row.optionId);
        newPrice.office = em.getReference(Office, row.officeId);
        newPrice.priceType = em.getReference(PriceObjectType, priceTypeId);
        newPrice.amount = newAmount;
        newPrice.effectiveDate = null;
        em.persist(newPrice);

        // Add to map to prevent duplicate creates in same chunk
        priceMap.set(key, newPrice);

        rowHasChanges = true;
        rowIsNew = true;
      }
    }

    if (rowHasChanges) {
      modifiedOptionIds.add(row.optionId);
      if (rowIsNew) {
        result.created++;
      } else {
        result.updated++;
      }
    } else {
      result.skipped++;
    }
  }

  return result;
}

/**
 * Send completion email to user.
 */
async function sendCompletionEmail(job: PricingImportJob): Promise<void> {
  if (job.emailSent) return;

  try {
    if (!emailService.isConfigured()) {
      console.log(
        '[pricing-import] Email service not configured, skipping notification',
      );
      return;
    }

    // Determine status for email - compare string values
    const isCompleted =
      (job.status as PricingImportJobStatus) ===
      PricingImportJobStatus.COMPLETED;

    const template = sendPricingImportCompleteEmail({
      filename: job.filename,
      status: isCompleted ? 'completed' : 'failed',
      created: job.createdCount,
      updated: job.updatedCount,
      skipped: job.skippedCount,
      errors: job.errorCount,
    });

    await emailService.sendEmail({
      to: job.createdBy.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    job.emailSent = true;
    console.log(`[pricing-import] Sent completion email for job ${job.id}`);
  } catch (err) {
    console.error('[pricing-import] Failed to send completion email:', err);
  }
}
