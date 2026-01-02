/**
 * Pricing Import Worker - background processing for large Excel imports.
 * Uses pg-boss for job queue management.
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

import type { EntityManager } from '@mikro-orm/postgresql';
import type { PgBoss } from 'pg-boss';
import type { Job } from 'pg-boss';

/**
 * Job data passed to the worker
 */
type PricingImportJobData = {
  jobId: string;
  skipErrors?: boolean;
};

const MAX_ERRORS = 100;
const FLUSH_INTERVAL = 50; // Flush and yield every N rows

/**
 * Register the pricing import worker with pg-boss.
 */
export async function registerPricingImportWorker(boss: PgBoss): Promise<void> {
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

  // Count total rows (excluding header)
  let totalRows = 0;
  worksheet.eachRow((_row, rowNumber) => {
    if (rowNumber > 1) totalRows++;
  });

  job.totalRows = totalRows;
  job.status = PricingImportJobStatus.VALIDATING;
  await em.flush();

  // First pass: validate all rows
  const validationErrors = await validateAllRows(
    em,
    worksheet,
    config,
    job.company.id,
    priceTypes,
  );

  if (validationErrors.length > 0 && !skipErrors) {
    job.errors = validationErrors.slice(0, MAX_ERRORS);
    job.errorCount = validationErrors.length;
    job.status = PricingImportJobStatus.FAILED;
    job.completedAt = new Date();
    await em.flush();
    return;
  }

  // Second pass: process rows
  job.status = PricingImportJobStatus.PROCESSING;
  await em.flush();

  // Caches
  const officeCache = new Map<string, Office>();
  const optionCache = new Map<string, PriceGuideOption>();

  let processedCount = 0;

  // Collect rows for processing (eachRow doesn't support async callbacks)
  const rows: Array<{ row: ExcelJS.Row; rowNumber: number }> = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 1) {
      rows.push({ row, rowNumber });
    }
  });

  // Process rows sequentially
  for (const { row, rowNumber } of rows) {
    try {
      const parsed = parseRow(row, rowNumber, config);

      // Validate row
      const rowErrors = await validateRow(
        em,
        parsed,
        job.company.id,
        officeCache,
        optionCache,
      );

      if (rowErrors.length > 0) {
        job.errorCount++;
        if ((job.errors?.length ?? 0) < MAX_ERRORS) {
          job.errors = job.errors ?? [];
          job.errors.push(...rowErrors);
        }

        if (!skipErrors) {
          continue; // Skip this row
        }
      }

      // Process valid row
      if (parsed.optionId && parsed.officeId) {
        const result = await processRow(em, parsed, job.createdBy.id);

        switch (result) {
          case 'created':
            job.createdCount++;
            break;
          case 'updated':
            job.updatedCount++;
            break;
          case 'skipped':
            job.skippedCount++;
            break;
        }
      }

      job.processedRows++;
      processedCount++;

      // Flush and yield periodically
      if (processedCount % FLUSH_INTERVAL === 0) {
        await em.flush();
        // Clear managed entities to prevent memory bloat
        em.clear();
        // Re-fetch job to continue tracking
        const refreshedJob = await em.findOneOrFail(PricingImportJob, job.id);
        Object.assign(job, refreshedJob);

        // Yield to event loop
        await new Promise(r => setImmediate(r));
      }
    } catch (error) {
      job.errorCount++;
      if ((job.errors?.length ?? 0) < MAX_ERRORS) {
        job.errors = job.errors ?? [];
        job.errors.push({
          row: rowNumber,
          column: '',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
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
 * Parse column configuration from header row.
 */
function parseColumnConfig(
  headerRow: ExcelJS.Row,
  priceTypes: PriceObjectType[],
): ColumnConfig | null {
  const config: ColumnConfig = {
    optionNameCol: -1,
    brandCol: -1,
    itemCodeCol: -1,
    officeNameCol: -1,
    optionIdCol: -1,
    officeIdCol: -1,
    totalCol: -1,
    priceTypeCols: new Map(),
  };

  headerRow.eachCell((cell, colNumber) => {
    // Cell value can be various types, safely convert to string
    const rawValue = cell.value;
    let header = '';
    if (typeof rawValue === 'string') {
      header = rawValue.trim().toLowerCase();
    } else if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      header = rawValue.toString().trim().toLowerCase();
    }
    // For null/undefined/complex types, header stays empty

    switch (header) {
      case 'option name':
        config.optionNameCol = colNumber;
        break;
      case 'brand':
        config.brandCol = colNumber;
        break;
      case 'item code':
        config.itemCodeCol = colNumber;
        break;
      case 'office name':
        config.officeNameCol = colNumber;
        break;
      case 'option id':
        config.optionIdCol = colNumber;
        break;
      case 'office id':
        config.officeIdCol = colNumber;
        break;
      case 'total':
        config.totalCol = colNumber;
        break;
      default:
        // Check if it matches a price type name
        const matchByName = priceTypes.find(
          pt => pt.name.toLowerCase() === header,
        );
        if (matchByName) {
          config.priceTypeCols.set(matchByName.id, colNumber);
        }
    }
  });

  // Validate required columns
  if (config.officeIdCol === -1) {
    return null;
  }

  return config;
}

type ColumnConfig = {
  optionNameCol: number;
  brandCol: number;
  itemCodeCol: number;
  officeNameCol: number;
  optionIdCol: number;
  officeIdCol: number;
  totalCol: number;
  priceTypeCols: Map<string, number>;
};

type ParsedRow = {
  rowNumber: number;
  optionId: string | null;
  optionName: string | null;
  brand: string | null;
  itemCode: string | null;
  officeId: string | null;
  officeName: string | null;
  prices: Map<string, number>;
};

/**
 * Parse a data row from the Excel file.
 */
function parseRow(
  row: ExcelJS.Row,
  rowNumber: number,
  config: ColumnConfig,
): ParsedRow {
  const getCellValue = (colNumber: number): string | null => {
    if (colNumber === -1) return null;
    const cell = row.getCell(colNumber);
    const value = cell.value;
    if (value === null || value === undefined) return null;
    // Safely convert to string - value can be various types
    let strValue: string;
    if (typeof value === 'string') {
      strValue = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      strValue = value.toString();
    } else {
      // For Date or complex types, use ISO string
      strValue = value instanceof Date ? value.toISOString() : '';
    }
    return strValue.trim() || null;
  };

  const getNumericValue = (colNumber: number): number | null => {
    if (colNumber === -1) return null;
    const cell = row.getCell(colNumber);
    const value = cell.value;
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  };

  const prices = new Map<string, number>();
  for (const [priceTypeId, colNumber] of config.priceTypeCols) {
    const value = getNumericValue(colNumber);
    if (value !== null) {
      prices.set(priceTypeId, value);
    }
  }

  return {
    rowNumber,
    optionId: getCellValue(config.optionIdCol),
    optionName: getCellValue(config.optionNameCol),
    brand: getCellValue(config.brandCol),
    itemCode: getCellValue(config.itemCodeCol),
    officeId: getCellValue(config.officeIdCol),
    officeName: getCellValue(config.officeNameCol),
    prices,
  };
}

type ImportError = {
  row: number;
  column: string;
  message: string;
};

/**
 * Validate all rows in the worksheet.
 */
async function validateAllRows(
  em: EntityManager,
  worksheet: ExcelJS.Worksheet,
  config: ColumnConfig,
  companyId: string,
  priceTypes: PriceObjectType[],
): Promise<ImportError[]> {
  const errors: ImportError[] = [];
  const officeCache = new Map<string, Office>();
  const optionCache = new Map<string, PriceGuideOption>();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const parsed = parseRow(row, rowNumber, config);

    // Office ID required
    if (!parsed.officeId) {
      errors.push({
        row: rowNumber,
        column: 'Office ID',
        message: 'Office ID is required',
      });
      return;
    }

    // Option ID required
    if (!parsed.optionId) {
      errors.push({
        row: rowNumber,
        column: 'Option ID',
        message: 'Option ID is required for price updates',
      });
      return;
    }

    // Validate price values
    for (const [priceTypeId, amount] of parsed.prices) {
      if (amount < 0) {
        const pt = priceTypes.find(p => p.id === priceTypeId);
        errors.push({
          row: rowNumber,
          column: pt?.name ?? priceTypeId,
          message: 'Price values must be non-negative',
        });
      }
    }
  });

  // Validate all office and option IDs exist (batch lookup)
  const officeIds = new Set<string>();
  const optionIds = new Set<string>();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const parsed = parseRow(row, rowNumber, config);
    if (parsed.officeId) officeIds.add(parsed.officeId);
    if (parsed.optionId) optionIds.add(parsed.optionId);
  });

  // Batch load offices
  if (officeIds.size > 0) {
    const offices = await em.find(Office, {
      id: { $in: Array.from(officeIds) },
      company: companyId,
    });
    for (const office of offices) {
      officeCache.set(office.id, office);
    }
  }

  // Batch load options
  if (optionIds.size > 0) {
    const options = await em.find(PriceGuideOption, {
      id: { $in: Array.from(optionIds) },
      company: companyId,
    });
    for (const option of options) {
      optionCache.set(option.id, option);
    }
  }

  // Check for missing IDs
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const parsed = parseRow(row, rowNumber, config);

    if (parsed.officeId && !officeCache.has(parsed.officeId)) {
      errors.push({
        row: rowNumber,
        column: 'Office ID',
        message: `Office '${parsed.officeId}' not found in company`,
      });
    }

    if (parsed.optionId && !optionCache.has(parsed.optionId)) {
      errors.push({
        row: rowNumber,
        column: 'Option ID',
        message: `Option '${parsed.optionId}' not found in company`,
      });
    }
  });

  return errors;
}

/**
 * Validate a single row (for streaming processing).
 */
async function validateRow(
  em: EntityManager,
  row: ParsedRow,
  companyId: string,
  officeCache: Map<string, Office>,
  optionCache: Map<string, PriceGuideOption>,
): Promise<ImportError[]> {
  const errors: ImportError[] = [];

  if (!row.officeId) {
    errors.push({
      row: row.rowNumber,
      column: 'Office ID',
      message: 'Office ID is required',
    });
    return errors;
  }

  if (!row.optionId) {
    errors.push({
      row: row.rowNumber,
      column: 'Option ID',
      message: 'Option ID is required',
    });
    return errors;
  }

  // Check office (load if not cached)
  if (!officeCache.has(row.officeId)) {
    const office = await em.findOne(Office, {
      id: row.officeId,
      company: companyId,
    });
    if (office) {
      officeCache.set(row.officeId, office);
    }
  }

  if (!officeCache.has(row.officeId)) {
    errors.push({
      row: row.rowNumber,
      column: 'Office ID',
      message: `Office '${row.officeId}' not found`,
    });
  }

  // Check option (load if not cached)
  if (!optionCache.has(row.optionId)) {
    const option = await em.findOne(PriceGuideOption, {
      id: row.optionId,
      company: companyId,
    });
    if (option) {
      optionCache.set(row.optionId, option);
    }
  }

  if (!optionCache.has(row.optionId)) {
    errors.push({
      row: row.rowNumber,
      column: 'Option ID',
      message: `Option '${row.optionId}' not found`,
    });
  }

  return errors;
}

/**
 * Process a single row - upsert prices.
 */
async function processRow(
  em: EntityManager,
  row: ParsedRow,
  userId: string,
): Promise<'created' | 'updated' | 'skipped'> {
  if (!row.optionId || !row.officeId) return 'skipped';

  let hasChanges = false;
  let isNew = false;

  for (const [priceTypeId, newAmount] of row.prices) {
    let priceRecord = await em.findOne(OptionPrice, {
      option: row.optionId,
      office: row.officeId,
      priceType: priceTypeId,
    });

    if (priceRecord) {
      if (Math.abs(Number(priceRecord.amount) - newAmount) > 0.001) {
        priceRecord.amount = newAmount;
        hasChanges = true;
      }
    } else {
      priceRecord = new OptionPrice();
      priceRecord.option = em.getReference(PriceGuideOption, row.optionId);
      priceRecord.office = em.getReference(Office, row.officeId);
      priceRecord.priceType = em.getReference(PriceObjectType, priceTypeId);
      priceRecord.amount = newAmount;
      em.persist(priceRecord);
      hasChanges = true;
      isNew = true;
    }
  }

  // Update option's lastModifiedBy
  if (hasChanges) {
    const option = await em.findOne(PriceGuideOption, row.optionId);
    if (option) {
      option.lastModifiedBy = em.getReference(User, userId);
    }
  }

  if (!hasChanges) return 'skipped';
  return isNew ? 'created' : 'updated';
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
