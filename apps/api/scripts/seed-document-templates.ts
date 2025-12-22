#!/usr/bin/env tsx
/**
 * Document Template Seeding Script
 *
 * Loads example JSON files from apps/mobile/example-json into the database.
 * Run with: pnpm --filter api db:seed-templates
 *
 * Options:
 *   --count <n>          Number of files to load (default: 5)
 *   --files <f1,f2,...>  Specific files to load (comma-separated, no .json ext)
 *   --force              Clear existing templates before seeding
 *   --company-id <id>    Company ID to use (auto-detects first company if omitted)
 *   --list               List available JSON files and exit
 *   --dry-run            Parse and validate files without inserting
 *
 * Examples:
 *   pnpm db:seed-templates --count 5
 *   pnpm db:seed-templates --files 0jGH2dOtAo,0JjRFx4Trt
 *   pnpm db:seed-templates --list
 *   pnpm db:seed-templates --force --count 10
 *   pnpm db:seed-templates --company-id abc123 --count 5
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

import {
  Company,
  DocumentTemplate,
  DocumentTemplateCategory,
  Office,
} from '../src/entities';

import type { DocumentDataJson, ImagesJson } from '../src/entities';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Path to the example JSON files */
const EXAMPLE_JSON_DIR = path.resolve(__dirname, '../../mobile/example-json');

/** Color codes for console output */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
} as const;

/**
 * Log a message with a colored prefix
 */
function log(
  message: string,
  type: 'info' | 'success' | 'warn' | 'error' = 'info',
): void {
  const prefixes = {
    info: `${colors.cyan}[INFO]${colors.reset}`,
    success: `${colors.green}[SUCCESS]${colors.reset}`,
    warn: `${colors.yellow}[WARN]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
  };
  console.log(`${prefixes[type]} ${message}`);
}

/**
 * Raw iOS/Parse document object structure from JSON files
 */
type RawDocumentObject = {
  objectId: string;
  type: string;
  pageId: string;
  category: string;
  displayName: string;
  order: number;
  canAddMultiplePages: boolean;
  isTemplate?: boolean;
  includedStates?: string[];
  excludedStates?: string[];
  includedOffices?: Array<{ objectId: string; className: string }>;
  pageSize: string;
  hMargin: number;
  wMargin: number;
  photosPerPage?: number;
  useWatermark?: boolean;
  watermarkWidthPercent?: number;
  watermarkAlpha?: number;
  documentData: DocumentDataJson;
  images?: ImagesJson;
  iconBackgroundColor?: number[];
  iconImage?: { url: string; name: string };
  pdf?: { url: string; name: string };
  watermark?: { url: string; name: string };
  company?: { objectId: string };
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Parse CLI arguments
 */
function parseArgs(): {
  count: number;
  files: string[];
  force: boolean;
  companyId: string | undefined;
  list: boolean;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  let count = 5;
  let files: string[] = [];
  let force = false;
  let companyId: string | undefined;
  let list = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--count' && args[i + 1]) {
      count = Math.max(1, parseInt(args[i + 1]!, 10) || 5);
      i++;
    } else if (arg === '--files' && args[i + 1]) {
      files = args[i + 1]!.split(',').map(f => f.trim());
      i++;
    } else if (arg === '--company-id' && args[i + 1]) {
      companyId = args[i + 1];
      i++;
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--list') {
      list = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { count, files, force, companyId, list, dryRun };
}

/**
 * List available JSON files in the example directory
 */
function listAvailableFiles(): string[] {
  if (!fs.existsSync(EXAMPLE_JSON_DIR)) {
    log(`Example JSON directory not found: ${EXAMPLE_JSON_DIR}`, 'error');
    return [];
  }

  return fs
    .readdirSync(EXAMPLE_JSON_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
}

/**
 * Parse page size string "width,height" into components
 */
function parsePageSize(pageSizeStr: string): {
  width: number;
  height: number;
} {
  const [width, height] = pageSizeStr
    .split(',')
    .map(s => parseInt(s.trim(), 10));
  return {
    width: width ?? 612,
    height: height ?? 792,
  };
}

/**
 * Check if contractData contains user input required sections
 * Mirrors iOS: containsUserInputRequiredSection
 */
function hasUserInputRequired(contractData: DocumentDataJson): boolean {
  for (const group of contractData) {
    if (group.groupType === 'body' && Array.isArray(group.data)) {
      for (const section of group.data) {
        const sectionObj = section as Record<string, unknown>;
        if (sectionObj['userInputRequired'] === true) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Count signature and initials fields in contractData
 */
function countSignatureFields(contractData: DocumentDataJson): {
  signatures: number;
  initials: number;
} {
  let signatures = 0;
  let initials = 0;

  function scanCellItems(items: unknown[]): void {
    for (const item of items) {
      const cell = item as Record<string, unknown>;
      const cellType = cell['cellType'] as string | undefined;

      if (cellType === 'signature') {
        signatures++;
      }
      if (cell['initialsRequired'] === true) {
        initials++;
      }

      // Recursively check detailItems
      if (Array.isArray(cell['detailItems'])) {
        scanCellItems(cell['detailItems'] as unknown[]);
      }
    }
  }

  for (const group of contractData) {
    if (Array.isArray(group.data)) {
      for (const section of group.data) {
        const sectionObj = section as Record<string, unknown>;

        // Header sections have nested cellItems arrays
        if (Array.isArray(sectionObj['cellItems'])) {
          const cellItems = sectionObj['cellItems'] as unknown[];
          for (const row of cellItems) {
            if (Array.isArray(row)) {
              scanCellItems(row);
            } else {
              scanCellItems([row]);
            }
          }
        }
      }
    }
  }

  return { signatures, initials };
}

/** Type for transformed template data (before category/office resolution) */
type TransformedTemplateData = {
  // Category info (will be resolved to entity later)
  categoryName: string;
  // Office IDs (will be resolved to entities later)
  includedOfficeIds: string[];
  // Template fields
  sourceTemplateId: string;
  type: string;
  pageId: string;
  displayName: string;
  sortOrder: number;
  canAddMultiplePages: boolean;
  isTemplate: boolean;
  includedStates: string[];
  excludedStates: string[];
  pageSizeStr: string;
  pageWidth: number;
  pageHeight: number;
  hMargin: number;
  wMargin: number;
  photosPerPage: number;
  useWatermark: boolean;
  watermarkWidthPercent: number;
  watermarkAlpha: number;
  documentDataJson: DocumentDataJson;
  imagesJson: ImagesJson | undefined;
  iconBackgroundColor: number[] | undefined;
  hasUserInput: boolean;
  signatureFieldCount: number;
  initialsFieldCount: number;
};

/**
 * Transform raw JSON to TransformedTemplateData
 */
function transformToTemplate(raw: RawDocumentObject): TransformedTemplateData {
  const pageSize = parsePageSize(raw.pageSize);
  const { signatures, initials } = countSignatureFields(raw.documentData);

  // Extract office IDs from Parse pointers
  const includedOfficeIds = (raw.includedOffices ?? [])
    .map(o => o.objectId)
    .filter(Boolean);

  return {
    // Category info (will be resolved to entity later)
    categoryName: raw.category,
    // Office IDs (will be resolved to entities later)
    includedOfficeIds,
    // Template data
    sourceTemplateId: raw.objectId,
    type: raw.type,
    pageId: raw.pageId,
    displayName: raw.displayName,
    sortOrder: raw.order,
    canAddMultiplePages: raw.canAddMultiplePages,
    isTemplate: raw.isTemplate ?? false,
    includedStates: raw.includedStates ?? ['ALL'],
    excludedStates: raw.excludedStates ?? [],
    pageSizeStr: raw.pageSize,
    pageWidth: pageSize.width,
    pageHeight: pageSize.height,
    hMargin: raw.hMargin,
    wMargin: raw.wMargin,
    photosPerPage: raw.photosPerPage ?? 1,
    useWatermark: raw.useWatermark ?? false,
    watermarkWidthPercent: raw.watermarkWidthPercent ?? 100,
    watermarkAlpha: raw.watermarkAlpha ?? 0.05,
    documentDataJson: raw.documentData,
    imagesJson: raw.images,
    iconBackgroundColor: raw.iconBackgroundColor,
    hasUserInput: hasUserInputRequired(raw.documentData),
    signatureFieldCount: signatures,
    initialsFieldCount: initials,
  };
}

/**
 * Get database configuration for seeding
 */
function getORMConfig(): Parameters<typeof MikroORM.init<PostgreSqlDriver>>[0] {
  const databaseUrl =
    process.env['DATABASE_URL'] ??
    'postgresql://postgres:postgres@localhost:5432/salespro_dev';

  return {
    clientUrl: databaseUrl,
    driver: PostgreSqlDriver,
    entities: [Company, DocumentTemplate, DocumentTemplateCategory, Office],
    debug: false,
    allowGlobalContext: true,
  };
}

/**
 * Main seeding function
 */
async function seed(): Promise<void> {
  const args = parseArgs();

  // Handle --list flag
  if (args.list) {
    const files = listAvailableFiles();
    console.log(
      `\n${colors.cyan}Available JSON files (${files.length} total):${colors.reset}\n`,
    );
    files.slice(0, 50).forEach((f, i) => {
      console.log(
        `  ${colors.dim}${String(i + 1).padStart(3)}.${colors.reset} ${f.replace('.json', '')}`,
      );
    });
    if (files.length > 50) {
      console.log(
        `\n  ${colors.dim}... and ${files.length - 50} more${colors.reset}`,
      );
    }
    console.log('');
    return;
  }

  // Determine which files to load
  const availableFiles = listAvailableFiles();
  let filesToLoad: string[];

  if (args.files.length > 0) {
    // Load specific files
    filesToLoad = args.files.map(f => (f.endsWith('.json') ? f : `${f}.json`));
    const missing = filesToLoad.filter(f => !availableFiles.includes(f));
    if (missing.length > 0) {
      log(`Files not found: ${missing.join(', ')}`, 'error');
      process.exit(1);
    }
  } else {
    // Load N files
    filesToLoad = availableFiles.slice(0, args.count);
  }

  if (filesToLoad.length === 0) {
    log('No files to load', 'warn');
    return;
  }

  log(`Loading ${filesToLoad.length} template(s)...`, 'info');
  if (args.dryRun) {
    log('Dry run mode - no database changes will be made', 'warn');
  }

  let orm: MikroORM | null = null;

  try {
    // Parse and validate JSON files
    const templates: Array<{
      filename: string;
      raw: RawDocumentObject;
      data: TransformedTemplateData;
    }> = [];

    for (const filename of filesToLoad) {
      const filepath = path.join(EXAMPLE_JSON_DIR, filename);
      const content = fs.readFileSync(filepath, 'utf-8');

      try {
        const raw = JSON.parse(content) as RawDocumentObject;
        const data = transformToTemplate(raw);
        templates.push({ filename, raw, data });
        log(`Parsed: ${filename} → "${data.displayName}"`, 'success');
      } catch (parseError) {
        log(
          `Failed to parse ${filename}: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          'error',
        );
      }
    }

    if (args.dryRun) {
      console.log(`\n${colors.cyan}Dry run summary:${colors.reset}`);
      console.log(
        `  Parsed: ${templates.length} / ${filesToLoad.length} files`,
      );
      templates.forEach(t => {
        console.log(`  - ${t.data.displayName} (${t.data.categoryName})`);
        console.log(
          `    hasUserInput: ${t.data.hasUserInput}, signatures: ${t.data.signatureFieldCount}, initials: ${t.data.initialsFieldCount}`,
        );
      });
      return;
    }

    // Initialize ORM
    orm = await MikroORM.init<PostgreSqlDriver>(getORMConfig());
    log('Database connection established', 'success');

    const em = orm.em.fork();

    // Find or validate company
    let company: Company | null = null;

    if (args.companyId) {
      // Use specified company ID
      company = await em.findOne(Company, { id: args.companyId });
      if (!company) {
        log(`Company not found: ${args.companyId}`, 'error');
        log('Run "pnpm db:seed" first to create seed companies', 'info');
        process.exit(1);
      }
    } else {
      // Auto-detect first available company
      company = await em.findOne(
        Company,
        { isActive: true },
        { orderBy: { createdAt: 'ASC' } },
      );
      if (!company) {
        log('No companies found in database', 'error');
        log('Run "pnpm db:seed" first to create seed companies', 'info');
        process.exit(1);
      }
      log(`Auto-detected company: ${company.name}`, 'info');
    }

    log(`Using company: ${company.name} (${company.id})`, 'info');
    const companyId = company.id;

    // Clear existing templates if --force
    if (args.force) {
      const deleted = await em.nativeDelete(DocumentTemplate, {
        company: companyId,
      });
      log(`Deleted ${deleted} existing template(s)`, 'warn');
    }

    // Cache for categories (name -> entity)
    const categoryCache = new Map<string, DocumentTemplateCategory>();

    /**
     * Find or create a category by name.
     */
    async function getOrCreateCategory(
      categoryName: string,
    ): Promise<DocumentTemplateCategory> {
      const cached = categoryCache.get(categoryName);
      if (cached) return cached;

      // Try to find existing
      const existing = await em.findOne(DocumentTemplateCategory, {
        company: companyId,
        name: categoryName,
        deletedAt: null,
      });

      if (existing) {
        categoryCache.set(categoryName, existing);
        return existing;
      }

      // Create new category
      const newCategory = new DocumentTemplateCategory();
      newCategory.company = em.getReference(Company, companyId);
      newCategory.name = categoryName;
      newCategory.sortOrder = categoryCache.size;
      newCategory.isImported = categoryName.toLowerCase() === 'imported';
      em.persist(newCategory);
      log(`Created category: "${categoryName}"`, 'info');

      categoryCache.set(categoryName, newCategory);
      return newCategory;
    }

    // Insert templates
    let inserted = 0;
    let skipped = 0;

    for (const { data } of templates) {
      // Check if already exists
      const existing = await em.findOne(DocumentTemplate, {
        sourceTemplateId: data.sourceTemplateId,
        company: companyId,
      });

      if (existing && !args.force) {
        log(`Skipping "${data.displayName}" (already exists)`, 'warn');
        skipped++;
        continue;
      }

      // Get or create category
      const category = await getOrCreateCategory(data.categoryName);

      // Get offices (skip if none specified or offices don't exist)
      const offices: Office[] = [];
      if (data.includedOfficeIds.length > 0) {
        const foundOffices = await em.find(Office, {
          id: { $in: data.includedOfficeIds },
          company: companyId,
        });
        offices.push(...foundOffices);
      }

      const template = new DocumentTemplate();
      template.company = em.getReference(Company, companyId);
      template.category = category;
      template.sourceTemplateId = data.sourceTemplateId;
      template.type = data.type;
      template.pageId = data.pageId;
      template.displayName = data.displayName;
      template.sortOrder = data.sortOrder;
      template.canAddMultiplePages = data.canAddMultiplePages;
      template.isTemplate = data.isTemplate;
      template.includedStates = data.includedStates;
      template.excludedStates = data.excludedStates;
      template.pageSizeStr = data.pageSizeStr;
      template.pageWidth = data.pageWidth;
      template.pageHeight = data.pageHeight;
      template.hMargin = data.hMargin;
      template.wMargin = data.wMargin;
      template.photosPerPage = data.photosPerPage;
      template.useWatermark = data.useWatermark;
      template.watermarkWidthPercent = data.watermarkWidthPercent;
      template.watermarkAlpha = data.watermarkAlpha;
      template.documentDataJson = data.documentDataJson;
      template.imagesJson = data.imagesJson;
      template.iconBackgroundColor = data.iconBackgroundColor;
      template.hasUserInput = data.hasUserInput;
      template.signatureFieldCount = data.signatureFieldCount;
      template.initialsFieldCount = data.initialsFieldCount;

      // Add offices to the collection
      for (const office of offices) {
        template.includedOffices.add(office);
      }

      em.persist(template);
      inserted++;
    }

    await em.flush();

    // Print summary
    console.log('');
    console.log(
      `${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`,
    );
    console.log(
      `${colors.bright}${colors.green}  DOCUMENT TEMPLATES SEEDED${colors.reset}`,
    );
    console.log(
      `${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`,
    );
    console.log('');
    console.log(`  ${colors.cyan}Company:${colors.reset} ${company.name}`);
    console.log(
      `  ${colors.cyan}Categories:${colors.reset} ${categoryCache.size}`,
    );
    console.log(`  ${colors.cyan}Inserted:${colors.reset} ${inserted}`);
    console.log(`  ${colors.cyan}Skipped:${colors.reset} ${skipped}`);
    console.log('');

    if (inserted > 0) {
      log('Templates ready for testing!', 'success');
    }
  } catch (error) {
    log(
      `Seeding failed: ${error instanceof Error ? error.message : String(error)}`,
      'error',
    );
    throw error;
  } finally {
    if (orm) {
      await orm.close();
      log('Database connection closed', 'info');
    }
  }
}

// Run the seed script
seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  });
