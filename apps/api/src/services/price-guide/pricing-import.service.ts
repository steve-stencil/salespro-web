/**
 * Pricing Import Service - imports option prices from Excel spreadsheet.
 * Handles file validation, preview, and processing.
 *
 * OPTIMIZATION NOTES:
 * - Uses batch loading for validation (offices, options loaded in bulk)
 * - Uses chunk-based processing for large imports
 * - Batch loads existing prices per chunk to minimize queries
 * - Uses bulk upsert operations instead of per-row inserts
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

/** Chunk size for batch processing */
const CHUNK_SIZE = 500;

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
 * Handles both plain text and rich text headers (common in Excel tables).
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
    // Extract cell value (handles rich text, formulas, etc.)
    const rawValue = extractCellValue(cell.value);
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
 * Rich text segment from ExcelJS.
 * Text might be undefined in some edge cases with malformed data.
 */
type RichTextSegment = {
  text?: string;
  font?: Record<string, unknown>;
};

/**
 * Extract the actual value from a cell, handling various Excel cell types.
 *
 * ExcelJS cell values can be:
 * - Primitive: string, number, boolean, Date
 * - Formula: { formula: string, result?: unknown }
 * - Rich text: { richText: Array<{ text: string, font?: {...} }> }
 * - Hyperlink: { text: string, hyperlink: string }
 * - Error: { error: { ... } }
 *
 * Excel tables often convert plain text to rich text format, which breaks
 * simple string checks.
 */
function extractCellValue(cellValue: ExcelJS.CellValue): unknown {
  if (cellValue === null || cellValue === undefined) return null;

  // Handle primitive types directly
  if (typeof cellValue !== 'object') {
    return cellValue;
  }

  // Handle formula cells - extract the result
  if ('formula' in cellValue) {
    const formulaCell = cellValue as { formula: string; result?: unknown };
    // Result might also be rich text, so recurse
    return extractCellValue(formulaCell.result as ExcelJS.CellValue);
  }

  // Handle rich text cells (common in Excel tables)
  // Structure: { richText: [{ text: '...', font: {...} }, ...] }
  if ('richText' in cellValue) {
    const richTextCell = cellValue as { richText: RichTextSegment[] };
    if (Array.isArray(richTextCell.richText)) {
      // Concatenate all text segments
      return richTextCell.richText.map(segment => segment.text ?? '').join('');
    }
    return null;
  }

  // Handle hyperlink cells
  // Structure: { text: '...', hyperlink: '...' }
  if ('text' in cellValue && 'hyperlink' in cellValue) {
    const hyperlinkCell = cellValue as { text: string; hyperlink: string };
    return hyperlinkCell.text;
  }

  // Handle cells with just text property (some hyperlink variants)
  if (
    'text' in cellValue &&
    typeof (cellValue as { text: unknown }).text === 'string'
  ) {
    return (cellValue as { text: string }).text;
  }

  // Handle error cells - return null
  if ('error' in cellValue) {
    return null;
  }

  // Handle Date objects
  if (cellValue instanceof Date) {
    return cellValue;
  }

  // Unknown object type - try to stringify or return null
  return null;
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
    const value = extractCellValue(cell.value);
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
    const value = extractCellValue(cell.value);
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
 * Build a composite key for OptionPrice lookup.
 */
function buildPriceKey(
  optionId: string,
  officeId: string,
  priceTypeId: string,
): string {
  return `${optionId}:${officeId}:${priceTypeId}`;
}

/**
 * UUID v4 regex pattern for validation.
 * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars total)
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID format.
 */
function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Batch validate all rows against database records.
 * Uses bulk loading to minimize queries.
 */
async function batchValidateRows(
  em: EntityManager,
  rows: ParsedRow[],
  companyId: string,
  officeCache: Map<string, Office>,
  optionCache: Map<string, PriceGuideOption>,
): Promise<PricingImportError[]> {
  const errors: PricingImportError[] = [];

  // Collect unique IDs from rows
  const officeIds = new Set<string>();
  const optionIds = new Set<string>();

  // Track rows with invalid IDs to skip database lookup
  const rowsWithInvalidIds = new Set<number>();

  for (const row of rows) {
    // Check required fields first
    if (!row.officeId) {
      errors.push({
        row: row.rowNumber,
        column: 'Office ID',
        message: 'Office ID is required',
      });
      rowsWithInvalidIds.add(row.rowNumber);
      continue;
    }

    if (!row.optionId) {
      errors.push({
        row: row.rowNumber,
        column: 'Option ID',
        message: 'Option ID is required for price updates',
      });
      rowsWithInvalidIds.add(row.rowNumber);
      continue;
    }

    // Validate UUID format for Office ID
    if (!isValidUuid(row.officeId)) {
      errors.push({
        row: row.rowNumber,
        column: 'Office ID',
        message: `Invalid Office ID format: '${row.officeId}' (must be a valid UUID)`,
      });
      rowsWithInvalidIds.add(row.rowNumber);
      continue;
    }

    // Validate UUID format for Option ID
    if (!isValidUuid(row.optionId)) {
      errors.push({
        row: row.rowNumber,
        column: 'Option ID',
        message: `Invalid Option ID format: '${row.optionId}' (must be a valid UUID)`,
      });
      rowsWithInvalidIds.add(row.rowNumber);
      continue;
    }

    // Validate price values
    for (const [, amount] of row.prices) {
      if (amount < 0) {
        errors.push({
          row: row.rowNumber,
          column: 'Price',
          message: 'Price values must be non-negative',
        });
      }
    }

    // Collect IDs for batch lookup (only if not already cached)
    if (!officeCache.has(row.officeId)) {
      officeIds.add(row.officeId);
    }
    if (!optionCache.has(row.optionId)) {
      optionIds.add(row.optionId);
    }
  }

  // Batch load offices not in cache
  if (officeIds.size > 0) {
    const offices = await em.find(Office, {
      id: { $in: Array.from(officeIds) },
      company: companyId,
    });
    for (const office of offices) {
      officeCache.set(office.id, office);
    }
  }

  // Batch load options not in cache
  if (optionIds.size > 0) {
    const options = await em.find(PriceGuideOption, {
      id: { $in: Array.from(optionIds) },
      company: companyId,
    });
    for (const option of options) {
      optionCache.set(option.id, option);
    }
  }

  // Check for missing IDs (skip rows that already have validation errors)
  for (const row of rows) {
    if (rowsWithInvalidIds.has(row.rowNumber)) {
      continue;
    }

    if (row.officeId && !officeCache.has(row.officeId)) {
      errors.push({
        row: row.rowNumber,
        column: 'Office ID',
        message: `Office '${row.officeId}' not found in company`,
      });
    }

    if (row.optionId && !optionCache.has(row.optionId)) {
      errors.push({
        row: row.rowNumber,
        column: 'Option ID',
        message: `Option '${row.optionId}' not found in company`,
      });
    }
  }

  return errors;
}

/**
 * Validate a parsed row against database records.
 * DEPRECATED: Use batchValidateRows for better performance.
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
 * OPTIMIZED: Uses batch loading for validation and existing price lookup.
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

  // Caches for validation - populated once via batch loading
  const officeCache = new Map<string, Office>();
  const optionCache = new Map<string, PriceGuideOption>();

  // Parse all rows
  const rows: ParsedRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    rows.push(parseRow(row, rowNumber, config));
  });

  result.summary.totalRows = rows.length;

  // Batch validate all rows (2 queries for offices + options)
  const validationErrors = await batchValidateRows(
    em,
    rows,
    companyId,
    officeCache,
    optionCache,
  );

  // Track which rows have errors
  const rowsWithErrors = new Set(validationErrors.map(e => e.row));
  result.summary.errors = validationErrors.length;
  result.errors = validationErrors.slice(0, MAX_ERRORS);

  // Filter to valid rows for preview
  const validRows = rows.filter(
    r => r.optionId && r.officeId && !rowsWithErrors.has(r.rowNumber),
  );

  // Batch load existing prices for valid rows (1 query)
  if (validRows.length > 0) {
    const uniqueOptionIds = [...new Set(validRows.map(r => r.optionId!))];
    const uniqueOfficeIds = [...new Set(validRows.map(r => r.officeId!))];

    const existingPrices = await em.find(
      OptionPrice,
      {
        option: { $in: uniqueOptionIds },
        office: { $in: uniqueOfficeIds },
        effectiveDate: null, // Current prices only
      },
      { populate: ['option', 'office', 'priceType'] },
    );

    // Build lookup map
    const existingPriceMap = new Map<string, OptionPrice>();
    for (const price of existingPrices) {
      const key = buildPriceKey(
        price.option.id,
        price.office.id,
        price.priceType.id,
      );
      existingPriceMap.set(key, price);
    }

    // Track which option+office combos have any existing prices
    const hasExistingPricesSet = new Set<string>();
    for (const price of existingPrices) {
      hasExistingPricesSet.add(`${price.option.id}:${price.office.id}`);
    }

    // Determine action for each valid row
    for (const row of validRows) {
      if (!row.optionId || !row.officeId) continue;

      let hasChanges = false;
      const changes: Record<string, { from: number; to: number }> = {};
      const comboKey = `${row.optionId}:${row.officeId}`;
      const hasExisting = hasExistingPricesSet.has(comboKey);

      for (const [priceTypeId, newAmount] of row.prices) {
        const key = buildPriceKey(row.optionId, row.officeId, priceTypeId);
        const existingPrice = existingPriceMap.get(key);
        const existingAmount = existingPrice ? Number(existingPrice.amount) : 0;

        if (Math.abs(existingAmount - newAmount) > 0.001) {
          hasChanges = true;
          const priceType = priceTypes.find(pt => pt.id === priceTypeId);
          if (priceType) {
            changes[priceType.name] = { from: existingAmount, to: newAmount };
          }
        }
      }

      if (hasChanges) {
        if (hasExisting) {
          result.summary.toUpdate++;
        } else {
          result.summary.toCreate++;
        }

        // Add to preview (first 50 rows)
        if (result.preview.length < 50) {
          const option = optionCache.get(row.optionId);
          const office = officeCache.get(row.officeId);
          result.preview.push({
            row: row.rowNumber,
            action: hasExisting ? 'update' : 'create',
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
 * OPTIMIZED: Uses batch validation and chunk-based processing.
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

  // Parse all rows
  const rows: ParsedRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      rows.push(parseRow(row, rowNumber, config));
    }
  });

  // Caches populated via batch loading
  const officeCache = new Map<string, Office>();
  const optionCache = new Map<string, PriceGuideOption>();

  // Batch validate all rows upfront (2 queries)
  const validationErrors = await batchValidateRows(
    em,
    rows,
    options.companyId,
    officeCache,
    optionCache,
  );

  // Track which rows have errors
  const rowsWithErrors = new Set(validationErrors.map(e => e.row));

  if (validationErrors.length > 0) {
    if (options.skipErrors) {
      result.errors = validationErrors.slice(0, MAX_ERRORS);
    } else {
      result.success = false;
      result.errors = validationErrors.slice(0, MAX_ERRORS);
      return result;
    }
  }

  // Filter to valid rows
  const validRows = rows.filter(
    r => r.optionId && r.officeId && !rowsWithErrors.has(r.rowNumber),
  );

  // Process in chunks for better memory management
  const chunkResult = await processRowsInChunks(
    em,
    validRows,
    options.userId,
    CHUNK_SIZE,
  );

  result.created = chunkResult.created;
  result.updated = chunkResult.updated;
  result.skipped = chunkResult.skipped;

  return result;
}

/**
 * Process rows in chunks with batch operations.
 * Minimizes queries by:
 * 1. Batch loading existing prices per chunk
 * 2. Using bulk upsert operations
 */
async function processRowsInChunks(
  em: EntityManager,
  validRows: ParsedRow[],
  userId: string,
  chunkSize: number,
): Promise<{ created: number; updated: number; skipped: number }> {
  const result = { created: 0, updated: 0, skipped: 0 };

  // Track modified options to update lastModifiedBy
  const modifiedOptionIds = new Set<string>();

  for (let i = 0; i < validRows.length; i += chunkSize) {
    const chunk = validRows.slice(i, i + chunkSize);

    // Get unique IDs for this chunk
    const chunkOptionIds = [
      ...new Set(chunk.map(r => r.optionId).filter(Boolean) as string[]),
    ];
    const chunkOfficeIds = [
      ...new Set(chunk.map(r => r.officeId).filter(Boolean) as string[]),
    ];

    // Batch load existing prices for this chunk (1 query per chunk)
    const existingPrices = await em.find(
      OptionPrice,
      {
        option: { $in: chunkOptionIds },
        office: { $in: chunkOfficeIds },
        effectiveDate: null,
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

    // Flush after each chunk to persist changes
    await em.flush();
  }

  // Batch update lastModifiedBy for all modified options (1 query)
  if (modifiedOptionIds.size > 0) {
    const userRef = em.getReference(User, userId);
    await em
      .createQueryBuilder(PriceGuideOption)
      .update({ lastModifiedBy: userRef })
      .where({ id: { $in: Array.from(modifiedOptionIds) } })
      .execute();
  }

  return result;
}

/**
 * Process a single row - upsert prices.
 * DEPRECATED: Use processRowsInChunks for better performance.
 * Kept for backward compatibility.
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
      priceRecord.effectiveDate = null;
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

// Re-export types and functions for worker
export type { ParsedRow, ColumnConfig };
export {
  parseColumnConfig,
  parseRow,
  validateRow,
  batchValidateRows,
  processRowsInChunks,
  buildPriceKey,
  CHUNK_SIZE,
};
