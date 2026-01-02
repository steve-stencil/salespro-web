/**
 * Pricing Import Service - imports option prices from Excel spreadsheet.
 * Handles file validation, preview, and processing.
 */

import ExcelJS from 'exceljs';

import {
  OptionPrice,
  PriceObjectType,
  PriceGuideOption,
  Office,
  User,
} from '../../entities';
import { getStorageAdapter } from '../../lib/storage';

import type { EntityManager } from '@mikro-orm/postgresql';
import type {
  PricingImportPreview,
  PricingImportResult,
  PricingImportError,
} from '@shared/core';

/**
 * Import options for synchronous processing
 */
export type ImportOptions = {
  companyId: string;
  userId: string;
  /** Skip invalid rows instead of failing */
  skipErrors?: boolean;
};

/**
 * Expected column configuration from Excel file
 */
type ColumnConfig = {
  optionNameCol: number;
  brandCol: number;
  itemCodeCol: number;
  officeNameCol: number;
  optionIdCol: number;
  officeIdCol: number;
  totalCol: number;
  /** Map of priceType name -> column index */
  priceTypeCols: Map<string, number>;
  /** Map of priceType ID -> column index (for ID-based matching) */
  priceTypeIdCols: Map<string, number>;
};

/**
 * Parsed row from Excel file
 */
type ParsedRow = {
  rowNumber: number;
  optionId: string | null;
  optionName: string | null;
  brand: string | null;
  itemCode: string | null;
  officeId: string | null;
  officeName: string | null;
  /** Price amounts keyed by priceTypeId */
  prices: Map<string, number>;
};

/** Threshold for background processing */
export const BACKGROUND_PROCESSING_THRESHOLD = 1000;

/** Maximum file size (10MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum errors to store */
const MAX_ERRORS = 100;

/**
 * S3 key prefix for temporary import files
 */
const TEMP_PREFIX = 'temp/pricing-imports';

/**
 * Generate S3 key for temporary file storage.
 */
export function getTempFileKey(
  companyId: string,
  jobId: string,
  filename: string,
): string {
  return `${TEMP_PREFIX}/${companyId}/${jobId}/${filename}`;
}

/**
 * Upload temporary file to S3 for background processing.
 */
export async function uploadTempFile(
  buffer: Buffer,
  companyId: string,
  jobId: string,
  filename: string,
): Promise<string> {
  const key = getTempFileKey(companyId, jobId, filename);
  const storage = getStorageAdapter();

  await storage.upload({
    key,
    buffer,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return key;
}

/**
 * Delete temporary file from S3.
 */
export async function deleteTempFile(fileKey: string): Promise<void> {
  try {
    const storage = getStorageAdapter();
    await storage.delete(fileKey);
  } catch {
    // Log but don't throw - file might already be deleted
    console.warn(`[pricing-import] Failed to delete temp file: ${fileKey}`);
  }
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
    priceTypeIdCols: new Map(),
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
    return null; // Office ID is required
  }

  return config;
}

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

/**
 * Validate a parsed row against database records.
 */
async function validateRow(
  em: EntityManager,
  row: ParsedRow,
  companyId: string,
  officeCache: Map<string, Office>,
  optionCache: Map<string, PriceGuideOption>,
): Promise<PricingImportError[]> {
  const errors: PricingImportError[] = [];

  // Office ID is required
  if (!row.officeId) {
    errors.push({
      row: row.rowNumber,
      column: 'Office ID',
      message: 'Office ID is required',
    });
    return errors;
  }

  // Validate office exists
  let office: Office | undefined | null = officeCache.get(row.officeId);
  if (!office) {
    office = await em.findOne(Office, {
      id: row.officeId,
      company: companyId,
    });
    if (office) {
      officeCache.set(row.officeId, office);
    }
  }

  if (!office) {
    errors.push({
      row: row.rowNumber,
      column: 'Office ID',
      message: `Office '${row.officeId}' not found in company`,
    });
  }

  // If option ID provided, validate it exists
  if (row.optionId) {
    let option: PriceGuideOption | undefined | null = optionCache.get(
      row.optionId,
    );
    if (!option) {
      option = await em.findOne(PriceGuideOption, {
        id: row.optionId,
        company: companyId,
      });
      if (option) {
        optionCache.set(row.optionId, option);
      }
    }

    if (!option) {
      errors.push({
        row: row.rowNumber,
        column: 'Option ID',
        message: `Option '${row.optionId}' not found in company`,
      });
    }
  } else {
    // Option ID is required (we don't support creating new options via import)
    errors.push({
      row: row.rowNumber,
      column: 'Option ID',
      message: 'Option ID is required for price updates',
    });
  }

  // Validate price values
  for (const [priceTypeId, amount] of row.prices) {
    if (amount < 0) {
      errors.push({
        row: row.rowNumber,
        column: priceTypeId,
        message: 'Price values must be non-negative',
      });
    }
  }

  return errors;
}

/**
 * Preview import without applying changes.
 * Validates all rows and returns summary + preview of changes.
 */
export async function previewImport(
  em: EntityManager,
  buffer: Buffer,
  companyId: string,
): Promise<PricingImportPreview> {
  const result: PricingImportPreview = {
    valid: true,
    summary: {
      totalRows: 0,
      toCreate: 0,
      toUpdate: 0,
      toSkip: 0,
      errors: 0,
    },
    errors: [],
    preview: [],
  };

  // Get company's price types
  const priceTypes = await em.find(
    PriceObjectType,
    { company: companyId, isActive: true },
    { orderBy: { sortOrder: 'ASC' } },
  );

  // Load workbook
  const workbook = new ExcelJS.Workbook();
  // Use buffer.buffer to get the underlying ArrayBuffer
  await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
  const worksheet = workbook.getWorksheet(1);

  if (!worksheet) {
    result.valid = false;
    result.errors.push({
      row: 0,
      column: '',
      message: 'No worksheet found in file',
    });
    return result;
  }

  // Parse header row
  const headerRow = worksheet.getRow(1);
  const config = parseColumnConfig(headerRow, priceTypes);

  if (!config) {
    result.valid = false;
    result.errors.push({
      row: 1,
      column: '',
      message: 'Missing required columns. Expected: Office ID',
    });
    return result;
  }

  // Caches for validation
  const officeCache = new Map<string, Office>();
  const optionCache = new Map<string, PriceGuideOption>();

  // Process each row
  let rowCount = 0;
  const rows: ParsedRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    rowCount++;
    rows.push(parseRow(row, rowNumber, config));
  });

  result.summary.totalRows = rowCount;

  // Validate all rows
  for (const row of rows) {
    const rowErrors = await validateRow(
      em,
      row,
      companyId,
      officeCache,
      optionCache,
    );

    if (rowErrors.length > 0) {
      result.summary.errors += rowErrors.length;
      if (result.errors.length < MAX_ERRORS) {
        result.errors.push(
          ...rowErrors.slice(0, MAX_ERRORS - result.errors.length),
        );
      }
      continue;
    }

    // Determine action: create, update, or skip
    if (row.optionId && row.officeId) {
      // Check existing prices
      const existingPrices = await em.find(OptionPrice, {
        option: row.optionId,
        office: row.officeId,
      });

      const existingPriceMap = new Map<string, number>();
      for (const ep of existingPrices) {
        existingPriceMap.set(ep.priceType.id, Number(ep.amount));
      }

      // Determine if this is a create, update, or skip
      let hasChanges = false;
      const changes: Record<string, { from: number; to: number }> = {};

      for (const [priceTypeId, newAmount] of row.prices) {
        const existingAmount = existingPriceMap.get(priceTypeId) ?? 0;
        if (Math.abs(existingAmount - newAmount) > 0.001) {
          hasChanges = true;
          const priceType = priceTypes.find(pt => pt.id === priceTypeId);
          if (priceType) {
            changes[priceType.name] = { from: existingAmount, to: newAmount };
          }
        }
      }

      if (hasChanges) {
        if (existingPrices.length === 0) {
          result.summary.toCreate++;
        } else {
          result.summary.toUpdate++;
        }

        // Add to preview (first 50 rows)
        if (result.preview.length < 50) {
          const option = optionCache.get(row.optionId);
          const office = officeCache.get(row.officeId);
          result.preview.push({
            row: row.rowNumber,
            action: existingPrices.length === 0 ? 'create' : 'update',
            optionName: option?.name ?? row.optionName ?? 'Unknown',
            officeName: office?.name ?? row.officeName ?? 'Unknown',
            changes,
          });
        }
      } else {
        result.summary.toSkip++;
        if (result.preview.length < 50) {
          const option = optionCache.get(row.optionId);
          const office = officeCache.get(row.officeId);
          result.preview.push({
            row: row.rowNumber,
            action: 'skip',
            optionName: option?.name ?? row.optionName ?? 'Unknown',
            officeName: office?.name ?? row.officeName ?? 'Unknown',
          });
        }
      }
    }
  }

  result.valid = result.summary.errors === 0;

  return result;
}

/**
 * Process import synchronously (for small files < 1000 rows).
 */
export async function processImportSync(
  em: EntityManager,
  buffer: Buffer,
  options: ImportOptions,
): Promise<PricingImportResult> {
  const result: PricingImportResult = {
    success: true,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Get company's price types
  const priceTypes = await em.find(
    PriceObjectType,
    { company: options.companyId, isActive: true },
    { orderBy: { sortOrder: 'ASC' } },
  );

  // Load workbook
  const workbook = new ExcelJS.Workbook();
  // Use buffer.buffer to get the underlying ArrayBuffer
  await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
  const worksheet = workbook.getWorksheet(1);

  if (!worksheet) {
    result.success = false;
    result.errors.push({
      row: 0,
      column: '',
      message: 'No worksheet found in file',
    });
    return result;
  }

  // Parse header row
  const headerRow = worksheet.getRow(1);
  const config = parseColumnConfig(headerRow, priceTypes);

  if (!config) {
    result.success = false;
    result.errors.push({
      row: 1,
      column: '',
      message: 'Missing required columns. Expected: Office ID',
    });
    return result;
  }

  // Caches
  const officeCache = new Map<string, Office>();
  const optionCache = new Map<string, PriceGuideOption>();

  // Collect rows for processing
  const rows: Array<{ row: ExcelJS.Row; rowNumber: number }> = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      rows.push({ row, rowNumber });
    }
  });

  // Process each row
  for (const { row, rowNumber } of rows) {
    const parsed = parseRow(row, rowNumber, config);
    const rowErrors = await validateRow(
      em,
      parsed,
      options.companyId,
      officeCache,
      optionCache,
    );

    if (rowErrors.length > 0) {
      if (options.skipErrors) {
        if (result.errors.length < MAX_ERRORS) {
          result.errors.push(...rowErrors);
        }
        continue;
      } else {
        result.success = false;
        result.errors.push(...rowErrors);
        continue;
      }
    }

    // Process valid row
    if (parsed.optionId && parsed.officeId) {
      const rowResult = await processRow(em, parsed, options.userId);
      switch (rowResult) {
        case 'created':
          result.created++;
          break;
        case 'updated':
          result.updated++;
          break;
        case 'skipped':
          result.skipped++;
          break;
      }
    }
  }

  await em.flush();

  return result;
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
 * Process a row for async import job - returns result type.
 */
export async function processRowForJob(
  em: EntityManager,
  row: ParsedRow,
  userId: string,
): Promise<'created' | 'updated' | 'skipped' | 'error'> {
  try {
    return await processRow(em, row, userId);
  } catch {
    return 'error';
  }
}

// Re-export types
export type { ParsedRow, ColumnConfig };
export { parseColumnConfig, parseRow, validateRow };
