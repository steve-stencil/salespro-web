---
name: Price Guide Export/Import - Pricing Spreadsheet
overview: Specification for exporting and importing price guide pricing data via Excel spreadsheet. Enables users to bulk edit option prices across offices. Uses pg-boss for background processing of large files.
todos:
  - id: "1"
    content: Install and configure pg-boss (PostgreSQL job queue)
    status: pending
  - id: "2"
    content: Create PricingImportJob entity and database migration
    status: pending
  - id: "3"
    content: Create pricing import worker process
    status: pending
  - id: "4"
    content: Add PRICE_GUIDE_IMPORT_EXPORT permission
    status: pending
  - id: "5"
    content: Create API endpoint for exporting option prices to XLSX
    status: pending
  - id: "6"
    content: Create API endpoint for importing option prices from XLSX
    status: pending
  - id: "7"
    content: Create import job status endpoint
    status: pending
  - id: "8"
    content: Add frontend API service functions for export/import
    status: pending
  - id: "9"
    content: Add export/import UI controls to pricing page
    status: pending
  - id: "10"
    content: Implement import validation and preview step
    status: pending
  - id: "11"
    content: Add email notification for completed background imports
    status: pending
  - id: "12"
    content: Add audit logging for import operations
    status: pending
---

# Price Guide Pricing Export/Import Specification

## Scope

**Phase 1 (this spec)**: Option Prices only**Phase 2 (future)**: UpCharge Default Prices**Phase 3 (future)**: UpCharge Option Overrides**Out of Scope**: Rollback/undo functionality for imports---

## Data Model Reference

**Option Pricing** (`OptionPrice` entity):

- One price per `(Option × Office × PriceType)` combination
- Location: `apps/api/src/entities/price-guide/OptionPrice.entity.ts`

**Related Entities**:

- `PriceGuideOption`: The option being priced
- `Office`: The office the price applies to
- `PriceObjectType`: The price type (Materials, Labor, Tax, Other, etc.)

**Filter Relationships** (for export filtering):

```
PriceGuideCategory (product categories)
       ↓
MeasureSheetItem (line items)
       ↓ (via MeasureSheetItemOption junction)
PriceGuideOption (options)
       ↓
OptionPrice (prices)

Tag → ItemTag (entityType: 'OPTION') → PriceGuideOption
```

- **Category → Options**: Options are linked to categories through MSIs
- **Tags → Options**: Tags are applied directly to options via polymorphic `ItemTag` table

---

## Permissions

### Required Permission

Add new permission: `PRICE_GUIDE_IMPORT_EXPORT`**Location**: `apps/api/src/lib/permissions.ts`

```typescript
export const PERMISSIONS = {
  // ... existing permissions ...
  
  PRICE_GUIDE_IMPORT_EXPORT: {
    key: 'price_guide:import_export',
    name: 'Price Guide Import/Export',
    description: 'Export and import price guide pricing data via spreadsheet',
    category: 'price_guide',
  },
} as const;
```

**Default Role Assignment**:

- Admin: ✅ Granted
- Manager: ✅ Granted  
- Sales Rep: ❌ Not granted

**Route Protection**:

```typescript
router.get('/options/export', 
  requirePermission('price_guide:import_export'),
  exportOptionsHandler
);

router.post('/options/import',
  requirePermission('price_guide:import_export'),
  importOptionsHandler
);
```

---

## Background Processing with pg-boss

### Why pg-boss

- Uses existing PostgreSQL database (no Redis infrastructure needed)
- Already planned for `PriceChangeJob` (mass price changes)
- Good enough for import/export volume (~100s of jobs/day max)
- Transactional consistency with main database

### Setup

**Install pg-boss:**

```bash
pnpm --filter api add pg-boss
```

**Configuration** (`apps/api/src/lib/job-queue.ts`):

```typescript
import PgBoss from 'pg-boss';

let boss: PgBoss | null = null;

export async function getJobQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      schema: 'pgboss',
      archiveCompletedAfterSeconds: 60 * 60 * 24 * 7, // 7 days
      retryLimit: 3,
      retryDelay: 30, // 30 seconds between retries
    });
    await boss.start();
  }
  return boss;
}

export async function stopJobQueue(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}
```

**Initialize in app startup** (`apps/api/src/index.ts`):

```typescript
import { getJobQueue, stopJobQueue } from './lib/job-queue';
import { registerPricingImportWorker } from './workers/pricing-import.worker';

// After database connection
const boss = await getJobQueue();
await registerPricingImportWorker(boss);

// On shutdown
process.on('SIGTERM', async () => {
  await stopJobQueue();
});
```

---

## PricingImportJob Entity

Track import job status and progress.**Location**: `apps/api/src/entities/price-guide/PricingImportJob.entity.ts`

```typescript
import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Enum,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';
import type { User } from '../User.entity';
import type { Company } from '../Company.entity';

export enum PricingImportJobStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity()
@Index({ properties: ['status', 'createdAt'] })
@Index({ properties: ['createdBy', 'createdAt'] })
@Index({ properties: ['company', 'createdAt'] })
export class PricingImportJob {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  @ManyToOne('Company')
  company!: Company;

  @Enum(() => PricingImportJobStatus)
  status: Opt<PricingImportJobStatus> = PricingImportJobStatus.PENDING;

  /** Original filename */
  @Property({ type: 'string' })
  filename!: string;

  /** S3 key for uploaded file (temporary storage) */
  @Property({ type: 'string' })
  fileKey!: string;

  /** Total rows in file (set after validation) */
  @Property({ type: 'integer', nullable: true })
  totalRows?: number;

  /** Rows processed so far */
  @Property({ type: 'integer' })
  processedRows: Opt<number> = 0;

  /** Results summary */
  @Property({ type: 'integer' })
  createdCount: Opt<number> = 0;

  @Property({ type: 'integer' })
  updatedCount: Opt<number> = 0;

  @Property({ type: 'integer' })
  skippedCount: Opt<number> = 0;

  @Property({ type: 'integer' })
  errorCount: Opt<number> = 0;

  /** Validation/processing errors (limit to first 100) */
  @Property({ type: 'json', nullable: true })
  errors?: Array<{ row: number; column: string; message: string }>;

  /** Whether email notification was sent */
  @Property({ type: 'boolean' })
  emailSent: Opt<boolean> = false;

  @ManyToOne('User')
  createdBy!: User;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', nullable: true })
  completedAt?: Date;
}
```

### Database Migration

**Location**: `apps/api/src/migrations/Migration{timestamp}_PricingImportJob.ts`

```typescript
import { Migration } from '@mikro-orm/migrations';

export class MigrationPricingImportJob extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE "pricing_import_job" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "filename" varchar(255) NOT NULL,
        "file_key" varchar(500) NOT NULL,
        "total_rows" integer,
        "processed_rows" integer NOT NULL DEFAULT 0,
        "created_count" integer NOT NULL DEFAULT 0,
        "updated_count" integer NOT NULL DEFAULT 0,
        "skipped_count" integer NOT NULL DEFAULT 0,
        "error_count" integer NOT NULL DEFAULT 0,
        "errors" jsonb,
        "email_sent" boolean NOT NULL DEFAULT false,
        "created_by_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz,
        CONSTRAINT "pricing_import_job_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pricing_import_job_company_fkey" 
          FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "pricing_import_job_created_by_fkey" 
          FOREIGN KEY ("created_by_id") REFERENCES "user"("id")
      );
      
      CREATE INDEX "pricing_import_job_status_created_at_idx" 
        ON "pricing_import_job" ("status", "created_at");
      CREATE INDEX "pricing_import_job_created_by_created_at_idx" 
        ON "pricing_import_job" ("created_by_id", "created_at");
      CREATE INDEX "pricing_import_job_company_created_at_idx" 
        ON "pricing_import_job" ("company_id", "created_at");
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS "pricing_import_job"');
  }
}
```

---

## S3 Temporary File Storage

Use the existing S3 bucket with a dedicated prefix for import temp files.

### File Path Structure

```javascript
s3://{EXISTING_BUCKET}/
  └── temp/
      └── pricing-imports/
          └── {companyId}/
              └── {jobId}/
                  └── {originalFilename}
```

### Cleanup Policy

- Files deleted immediately after successful processing
- Files deleted after 24 hours for failed/abandoned jobs (via scheduled cleanup job)

### Implementation

```typescript
// apps/api/src/services/price-guide/pricing-import.service.ts

const TEMP_PREFIX = 'temp/pricing-imports';

function getTempFileKey(companyId: string, jobId: string, filename: string): string {
  return `${TEMP_PREFIX}/${companyId}/${jobId}/${filename}`;
}

async function uploadTempFile(
  file: Buffer,
  companyId: string,
  jobId: string,
  filename: string
): Promise<string> {
  const key = getTempFileKey(companyId, jobId, filename);
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file,
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  return key;
}

async function deleteTempFile(fileKey: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: fileKey,
  }));
}
```

---

## Export Service (Streaming)

**Location**: `apps/api/src/services/price-guide/pricing-export.service.ts`Export streams directly to HTTP response - no file stored on disk or S3.

```typescript
import ExcelJS from 'exceljs';
import { Response } from 'express';
import { EntityManager } from '@mikro-orm/postgresql';
import { OptionPrice } from '../entities/price-guide/OptionPrice.entity';
import { PriceObjectType } from '../entities/price-guide/PriceObjectType.entity';

type ExportOptions = {
  companyId: string;
  officeIds?: string[];
  optionIds?: string[];
  categoryIds?: string[];
  tagIds?: string[];
};

export async function exportOptionPricesToResponse(
  em: EntityManager,
  res: Response,
  options: ExportOptions
): Promise<void> {
  // 1. Get company's price types for column headers
  const priceTypes = await em.find(PriceObjectType, {
    company: options.companyId,
    isActive: true,
  }, { orderBy: { sortOrder: 'ASC' } });

  // 2. Build option IDs filter from all sources
  let filteredOptionIds: string[] | undefined = options.optionIds;
  
  // Filter by category: get options linked to MSIs in these categories
  // IMPORTANT: Cascades to include all descendant categories
  if (options.categoryIds?.length) {
    // Get all descendant category IDs (recursive)
    const allCategoryIds = await getCategoryIdsWithDescendants(
      em, 
      options.companyId, 
      options.categoryIds
    );
    
    const msiOptions = await em.find(MeasureSheetItemOption, {
      measureSheetItem: { 
        category: { id: { $in: allCategoryIds } },
        company: options.companyId,
        isActive: true,
      },
    }, { fields: ['option.id'] });
    
    const categoryOptionIds = [...new Set(msiOptions.map(mo => mo.option.id))];
    filteredOptionIds = filteredOptionIds 
      ? filteredOptionIds.filter(id => categoryOptionIds.includes(id))
      : categoryOptionIds;
  }
  
  // Filter by tags: get options with these tags
  if (options.tagIds?.length) {
    const itemTags = await em.find(ItemTag, {
      tag: { id: { $in: options.tagIds } },
      entityType: TaggableEntityType.OPTION,
    }, { fields: ['entityId'] });
    
    const taggedOptionIds = [...new Set(itemTags.map(it => it.entityId))];
    filteredOptionIds = filteredOptionIds
      ? filteredOptionIds.filter(id => taggedOptionIds.includes(id))
      : taggedOptionIds;
  }
  
  // If filters resulted in empty set, return empty file
  if (filteredOptionIds?.length === 0) {
    // Return empty spreadsheet with just headers
  }
  
  // 3. Query prices with filters
  const whereClause: any = {
    option: { company: options.companyId, isActive: true },
  };
  if (options.officeIds?.length) {
    whereClause.office = { id: { $in: options.officeIds } };
  }
  if (filteredOptionIds?.length) {
    whereClause.option.id = { $in: filteredOptionIds };
  }

  const prices = await em.find(OptionPrice, whereClause, {
    populate: ['option', 'office', 'priceType'],
    orderBy: { option: { name: 'ASC' }, office: { name: 'ASC' } },
  });

  // 3. Group prices by option+office
  const grouped = groupPricesByOptionAndOffice(prices, priceTypes);

  // 4. Set response headers
  const timestamp = new Date().toISOString().split('T')[0];
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="option-prices-${timestamp}.xlsx"`
  );

  // 5. Create streaming workbook that writes directly to response
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
  });

  const worksheet = workbook.addWorksheet('Option Prices');

  // 6. Define columns
  const columns = [
    { header: 'Option Name', key: 'optionName', width: 25 },
    { header: 'Brand', key: 'brand', width: 15 },
    { header: 'Item Code', key: 'itemCode', width: 15 },
    { header: 'Office Name', key: 'officeName', width: 20 },
    ...priceTypes.map(pt => ({ header: pt.name, key: pt.id, width: 12 })),
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Option ID', key: 'optionId', width: 12, outlineLevel: 1 },
    { header: 'Office ID', key: 'officeId', width: 12, outlineLevel: 1 },
  ];
  worksheet.columns = columns;

  // 7. Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E5E5' },
  };
  headerRow.commit();

  // 8. Write data rows
  for (const row of grouped) {
    const rowData: Record<string, any> = {
      optionName: row.optionName,
      brand: row.brand || '',
      itemCode: row.itemCode || '',
      officeName: row.officeName,
      total: row.total,
      optionId: row.optionId,
      officeId: row.officeId,
    };
    
    // Add price for each price type
    for (const pt of priceTypes) {
      rowData[pt.id] = row.prices[pt.id] ?? 0;
    }
    
    worksheet.addRow(rowData).commit();
  }

  // 9. Apply formatting
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  
  // Format price columns as currency
  const priceStartCol = 5; // After Office Name
  for (let i = priceStartCol; i <= priceStartCol + priceTypes.length; i++) {
    worksheet.getColumn(i).numFmt = '$#,##0.00';
  }

  // Collapse ID columns
  worksheet.properties.outlineLevelCol = 1;

  // 10. Finalize and close stream
  await workbook.commit();
}

/**
 * Get category IDs including all descendants (recursive).
 * Uses PostgreSQL recursive CTE for efficient tree traversal.
 */
async function getCategoryIdsWithDescendants(
  em: EntityManager,
  companyId: string,
  categoryIds: string[]
): Promise<string[]> {
  // Use recursive CTE to get all descendant categories
  const result = await em.getConnection().execute<{ id: string }[]>(`
    WITH RECURSIVE category_tree AS (
      -- Base case: selected categories
      SELECT id 
      FROM price_guide_category 
      WHERE id = ANY($1) 
        AND company_id = $2 
        AND is_active = true
      
      UNION ALL
      
      -- Recursive case: children of categories in tree
      SELECT c.id 
      FROM price_guide_category c
      INNER JOIN category_tree ct ON c.parent_id = ct.id
      WHERE c.company_id = $2 
        AND c.is_active = true
    )
    SELECT DISTINCT id FROM category_tree
  `, [categoryIds, companyId]);
  
  return result.map(r => r.id);
}
```

---

## Worker Process

**Location**: `apps/api/src/workers/pricing-import.worker.ts`

```typescript
import PgBoss from 'pg-boss';
import ExcelJS from 'exceljs';
import { EntityManager } from '@mikro-orm/postgresql';
import { PricingImportJob, PricingImportJobStatus } from '../entities/price-guide/PricingImportJob.entity';
import { downloadFromS3, deleteFromS3 } from '../lib/storage';
import { sendImportCompleteEmail } from '../services/email.service';
import { logAuditEvent } from '../lib/audit';

type PricingImportJobData = {
  jobId: string;
};

const MAX_ERRORS = 100;

export async function registerPricingImportWorker(boss: PgBoss): Promise<void> {
  await boss.work<PricingImportJobData>(
    'pricing-import',
    { 
      teamSize: 1, 
      teamConcurrency: 1,
      newJobCheckInterval: 2000, // Check for new jobs every 2 seconds
    },
    async (job) => {
      const { jobId } = job.data;
      const em = getEntityManager();
      
      const importJob = await em.findOneOrFail(PricingImportJob, jobId, {
        populate: ['createdBy', 'company'],
      });
      
      try {
        // Update status to processing
        importJob.status = PricingImportJobStatus.PROCESSING;
        await em.flush();
        
        // Download file from S3
        const fileBuffer = await downloadFromS3(importJob.fileKey);
        
        // Process with streaming
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.getWorksheet(1);
        
        if (!worksheet) {
          throw new Error('No worksheet found in file');
        }
        
        importJob.totalRows = worksheet.rowCount - 1; // Exclude header
        
        // First pass: validate all rows
        importJob.status = PricingImportJobStatus.VALIDATING;
        await em.flush();
        
        const validationErrors = await validateAllRows(em, worksheet, importJob);
        if (validationErrors.length > 0) {
          importJob.errors = validationErrors.slice(0, MAX_ERRORS);
          importJob.errorCount = validationErrors.length;
          importJob.status = PricingImportJobStatus.FAILED;
          importJob.completedAt = new Date();
          await em.flush();
          await sendCompletionEmail(importJob);
          return;
        }
        
        // Second pass: process rows
        importJob.status = PricingImportJobStatus.PROCESSING;
        await em.flush();
        
        worksheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header
          
          try {
            const result = await processRow(em, importJob, row, rowNumber);
            if (result === 'created') importJob.createdCount++;
            else if (result === 'updated') importJob.updatedCount++;
            else if (result === 'skipped') importJob.skippedCount++;
            
            importJob.processedRows++;
          } catch (err) {
            importJob.errorCount++;
            addError(importJob, rowNumber, '', err.message);
          }
          
          // Flush and yield every 50 rows
          if (rowNumber % 50 === 0) {
            await em.flush();
            await new Promise(r => setImmediate(r));
          }
        });
        
        importJob.status = PricingImportJobStatus.COMPLETED;
        importJob.completedAt = new Date();
        
        // Audit log
        await logAuditEvent(em, {
          action: 'PRICING_IMPORT_COMPLETED',
          userId: importJob.createdBy.id,
          companyId: importJob.company.id,
          metadata: {
            jobId: importJob.id,
            filename: importJob.filename,
            created: importJob.createdCount,
            updated: importJob.updatedCount,
            skipped: importJob.skippedCount,
            errors: importJob.errorCount,
          },
        });
        
      } catch (err) {
        importJob.status = PricingImportJobStatus.FAILED;
        importJob.errors = [{ row: 0, column: '', message: err.message }];
        importJob.completedAt = new Date();
        
        // Audit log failure
        await logAuditEvent(em, {
          action: 'PRICING_IMPORT_FAILED',
          userId: importJob.createdBy.id,
          companyId: importJob.company.id,
          metadata: {
            jobId: importJob.id,
            filename: importJob.filename,
            error: err.message,
          },
        });
      }
      
      await em.flush();
      
      // Send email notification
      await sendCompletionEmail(importJob);
      
      // Cleanup: delete temp file from S3
      try {
        await deleteFromS3(importJob.fileKey);
      } catch (err) {
        console.error('Failed to delete temp file:', err);
      }
    }
  );
}

function addError(
  job: PricingImportJob, 
  row: number, 
  column: string, 
  message: string
): void {
  if (!job.errors) job.errors = [];
  if (job.errors.length < MAX_ERRORS) {
    job.errors.push({ row, column, message });
  }
}

async function sendCompletionEmail(job: PricingImportJob): Promise<void> {
  if (job.emailSent) return;
  
  try {
    await sendImportCompleteEmail({
      to: job.createdBy.email,
      filename: job.filename,
      status: job.status,
      created: job.createdCount,
      updated: job.updatedCount,
      skipped: job.skippedCount,
      errors: job.errorCount,
    });
    job.emailSent = true;
  } catch (err) {
    console.error('Failed to send import completion email:', err);
  }
}
```

---

## Email Notification

**Location**: `apps/api/src/services/email.service.ts`Add function for import completion notification:

```typescript
type ImportCompleteEmailParams = {
  to: string;
  filename: string;
  status: 'completed' | 'failed';
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

export async function sendImportCompleteEmail(params: ImportCompleteEmailParams): Promise<void> {
  const subject = params.status === 'completed'
    ? `Price Guide Import Complete: ${params.filename}`
    : `Price Guide Import Failed: ${params.filename}`;
  
  const body = params.status === 'completed'
    ? `
Your price guide import has completed successfully.

File: ${params.filename}

Results:
- Created: ${params.created} new options
- Updated: ${params.updated} prices
- Skipped: ${params.skipped} rows (no changes)
- Errors: ${params.errors}

You can view the full results in the Price Guide dashboard.
    `.trim()
    : `
Your price guide import has failed.

File: ${params.filename}
Errors: ${params.errors}

Please review the file and try again. You can view error details in the Price Guide dashboard.
    `.trim();

  await sendEmail({
    to: params.to,
    subject,
    text: body,
  });
}
```

---

## Audit Logging

Log import operations to existing audit log system.**Events to log**:| Event | When | Metadata ||-------|------|----------|| `PRICING_IMPORT_STARTED` | Job created | filename, rowCount || `PRICING_IMPORT_COMPLETED` | Job succeeded | created, updated, skipped, errors || `PRICING_IMPORT_FAILED` | Job failed | error message || `PRICING_EXPORT` | Export requested | rowCount, filters |**Implementation**:

```typescript
// In import endpoint
await logAuditEvent(em, {
  action: 'PRICING_IMPORT_STARTED',
  userId: req.user.id,
  companyId: req.user.companyId,
  metadata: {
    jobId: job.id,
    filename: file.originalname,
  },
});

// In export endpoint
await logAuditEvent(em, {
  action: 'PRICING_EXPORT',
  userId: req.user.id,
  companyId: req.user.companyId,
  metadata: {
    rowCount: exportedRows,
    filters: { officeIds, optionIds, categoryIds, tagIds },
  },
});
```

---

## Import Preview (Validation-Only Mode)

Before committing changes, show user what will happen.

### API Endpoint

```javascript
POST /api/price-guide/pricing/options/import/preview
Content-Type: multipart/form-data
```

**Response**:

```typescript
{
  valid: boolean;
  summary: {
    totalRows: number;
    toCreate: number;
    toUpdate: number;
    toSkip: number;
    errors: number;
  };
  errors: Array<{ row: number; column: string; message: string }>;
  preview: Array<{
    row: number;
    action: 'create' | 'update' | 'skip';
    optionName: string;
    officeName: string;
    changes?: Record<string, { from: number; to: number }>;
  }>;
}
```

### UI Flow

```javascript
1. User selects file
2. Frontend calls POST /import/preview
3. Show preview dialog:
   ┌─────────────────────────────────────────────────┐
   │ Import Preview                                  │
   ├─────────────────────────────────────────────────┤
   │ File: option-prices.xlsx                        │
   │ Total rows: 150                                 │
   │                                                 │
   │ ✓ 12 new options will be created               │
   │ ✓ 138 prices will be updated                   │
   │ ⚠ 2 errors found (see below)                   │
   │                                                 │
   │ Errors:                                         │
   │ • Row 45: Office ID 'xyz' not found            │
   │ • Row 89: Invalid price value 'abc'            │
   │                                                 │
   │ [Cancel]              [Fix and Re-upload]       │
   │                       [Import Anyway (skip 2)]  │
   └─────────────────────────────────────────────────┘
4. User confirms → POST /import (actual import)
```

---

## Processing Flow

### Small Files (< 1000 rows): Synchronous

```javascript
User uploads file
       ↓
API validates file (preview)
       ↓
User confirms import
       ↓
API processes immediately (streaming)
       ↓
Return results
```

### Large Files (≥ 1000 rows): Background Job

```javascript
User uploads file
       ↓
API validates file (preview)
       ↓
User confirms import
       ↓
API saves file to S3 temp bucket
       ↓
API creates PricingImportJob (status: pending)
       ↓
API queues job with pg-boss
       ↓
Return { jobId, status: 'pending' }
       ↓
Worker picks up job
       ↓
Worker processes file (streaming)
       ↓
Worker updates job status
       ↓
Worker sends completion email
       ↓
UI polls for status or user checks email
```

---

## Frontend API Service

**Location**: `apps/web/src/services/price-guide.ts`Add these functions:

```typescript
import { apiClient } from '../lib/api-client';
import type { 
  PricingImportResult, 
  PricingImportJobStatus,
  PricingImportPreview,
} from '@shared/core';

/** Export filter options */
export type ExportFilters = {
  officeIds?: string[];
  optionIds?: string[];
  categoryIds?: string[];
  tagIds?: string[];
};

/** Export option prices - triggers file download */
export async function exportOptionPrices(filters?: ExportFilters): Promise<void> {
  const params = new URLSearchParams();
  if (filters?.officeIds?.length) {
    params.set('officeIds', filters.officeIds.join(','));
  }
  if (filters?.optionIds?.length) {
    params.set('optionIds', filters.optionIds.join(','));
  }
  if (filters?.categoryIds?.length) {
    params.set('categoryIds', filters.categoryIds.join(','));
  }
  if (filters?.tagIds?.length) {
    params.set('tagIds', filters.tagIds.join(','));
  }
  
  const response = await apiClient.get(
    `/price-guide/pricing/options/export?${params}`,
    { responseType: 'blob' }
  );
  
  // Trigger download
  const blob = new Blob([response.data], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `option-prices-${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Preview import without applying changes */
export async function previewOptionPricesImport(
  file: File
): Promise<PricingImportPreview> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post(
    '/price-guide/pricing/options/import/preview',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  
  return response.data;
}

/** Import option prices from file */
export async function importOptionPrices(
  file: File,
  options?: { skipErrors?: boolean }
): Promise<PricingImportResult | { jobId: string; status: 'pending' }> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.skipErrors) {
    formData.append('skipErrors', 'true');
  }
  
  const response = await apiClient.post(
    '/price-guide/pricing/options/import',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  
  return response.data;
}

/** Get import job status (for async imports) */
export async function getImportJobStatus(
  jobId: string
): Promise<PricingImportJobStatus> {
  const response = await apiClient.get(
    `/price-guide/pricing/options/import/${jobId}`
  );
  return response.data;
}

/** Poll import job until complete */
export async function waitForImportJob(
  jobId: string,
  onProgress?: (status: PricingImportJobStatus) => void
): Promise<PricingImportJobStatus> {
  const POLL_INTERVAL = 2000; // 2 seconds
  
  while (true) {
    const status = await getImportJobStatus(jobId);
    onProgress?.(status);
    
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
    
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}
```

---

## Export Format

### File Format

- **Type**: Excel (.xlsx)
- **Library**: ExcelJS
- **Sheet Name**: "Option Prices"

### Column Structure

Columns are ordered with human-readable fields first, system IDs collapsed at the end.| Column | Header | Width | Visibility | Description ||--------|--------|-------|------------|-------------|| A | `Option Name` | 25 | Visible | Option display name || B | `Brand` | 15 | Visible | Brand/manufacturer || C | `Item Code` | 15 | Visible | SKU/product code || D | `Office Name` | 20 | Visible | Office display name || E+ | `{PriceTypeName}` | 12 | Visible | Dynamic columns for each price type || N-1 | `Total` | 12 | Visible | Calculated sum (read-only) || N | `Option ID` | 12 | **Collapsed** | System UUID for option || N+1 | `Office ID` | 12 | **Collapsed** | System UUID for office |**Notes**:

- Price type columns are **dynamic** based on company's configured `PriceObjectType` records
- Price type columns are ordered by `sortOrder`
- ID columns are grouped and collapsed by default

### Example Export

```javascript
Option Name    | Brand | Item Code  | Office Name | Materials | Labor  | Tax   | Total  | Option ID | Office ID
---------------|-------|------------|-------------|-----------|--------|-------|--------|-----------|----------
Pella Premium  | Pella | PPW-200-DH | Denver      | 200.00    | 150.00 | 35.00 | 385.00 | abc123    | off456
Pella Premium  | Pella | PPW-200-DH | Boulder     | 210.00    | 160.00 | 37.00 | 407.00 | abc123    | off789
```

---

## Import Format

### File Requirements

- **Type**: Excel (.xlsx)
- **Sheet**: First worksheet is processed
- **Header Row**: Row 1 must contain expected column headers
- **Max file size**: 10MB

### Import Logic

| `Option ID` | `Office ID` | Action ||-------------|-------------|--------|| Has value | Has value | **Update** existing price record || Has value | Empty | **Error** - Office ID is required || Empty | Has value | **Create** new option with prices || Empty | Empty | **Error** - Office ID is required |

### Validation Rules

**Row-level validation**:

- `Office ID` is required for all rows
- `Office ID` must exist in the company's offices
- If `Option ID` is provided, it must exist
- Price values must be valid numbers (≥ 0)

**Cross-row consistency validation**:All rows with the same `Option ID` must have identical metadata (name, brand, item code).Error: `"Option ID 'abc123' has conflicting values for 'Option Name': 'Pella Premium NEW' (row 2) vs 'Pella Premium' (row 5)"`---

## API Endpoints

### Export Endpoint

```javascript
GET /api/price-guide/pricing/options/export
```

**Permission**: `price_guide:import_export`

**Query Parameters**:

| Parameter | Type | Description |

|-----------|------|-------------|

| `officeIds` | string | Comma-separated office UUIDs |

| `optionIds` | string | Comma-separated option UUIDs |

| `categoryIds` | string | Comma-separated category UUIDs (**cascades to child categories**) |

| `tagIds` | string | Comma-separated tag UUIDs (filters to options with these tags) |

All filters are optional. Multiple filters are AND-ed together (e.g., `categoryIds=x&tagIds=y` returns options that are both in category X AND have tag Y).

**Category Cascading**: Selecting a parent category (e.g., "Windows") automatically includes all options in child categories (e.g., "Double Hung", "Casement"). Uses PostgreSQL recursive CTE for efficient tree traversal.

**Response**: Binary XLSX file download

### Import Preview Endpoint

```javascript
POST /api/price-guide/pricing/options/import/preview
Content-Type: multipart/form-data
```

**Permission**: `price_guide:import_export`**Request Body**: `file` - XLSX file**Response**: Preview with validation results

### Import Endpoint

```javascript
POST /api/price-guide/pricing/options/import
Content-Type: multipart/form-data
```

**Permission**: `price_guide:import_export`**Request Body**:

- `file`: XLSX file
- `skipErrors` (optional): If true, skip invalid rows instead of failing

**Response** (small file): `PricingImportResult`**Response** (large file): `{ jobId, status: 'pending' }`

### Import Job Status Endpoint

```javascript
GET /api/price-guide/pricing/options/import/:jobId
```

**Permission**: `price_guide:import_export`**Response**: `PricingImportJobStatus`---

## UI Components

**Location**: `apps/web/src/components/price-guide/`

- `PricingExportDialog.tsx` - Export with filter options
- `PricingImportDialog.tsx` - Upload and preview
- `PricingImportPreview.tsx` - Show what will change
- `PricingImportProgress.tsx` - Progress bar for async imports

### Export Dialog Filter UI

The export dialog should allow users to filter what gets exported:

```
┌─────────────────────────────────────────────────────────────┐
│ Export Pricing                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Filter by:                                                  │
│                                                             │
│ Offices         [Select offices...        ▾]               │
│                 ☑ Denver  ☑ Boulder  ☐ Colorado Springs    │
│                                                             │
│ Categories      [Select categories...     ▾]               │
│                 ☑ Windows  ☐ Doors  ☐ Siding               │
│                                                             │
│ Tags            [Select tags...           ▾]               │
│                 ☑ Premium  ☐ Budget  ☐ Clearance           │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│ Estimated rows: ~2,450                                      │
│                                                             │
│                        [Cancel]    [Export XLSX]            │
└─────────────────────────────────────────────────────────────┘
```

**Notes**:

- All filters are optional (empty = export all)
- Multiple selections are AND-ed (options must match ALL criteria)
- **Category selection cascades** - selecting a parent category automatically includes all options in child/grandchild categories
- Show estimated row count before export (via lightweight count query)

---

## File Locations

**API**:

- Job queue: `apps/api/src/lib/job-queue.ts`
- Worker: `apps/api/src/workers/pricing-import.worker.ts`
- Export service: `apps/api/src/services/price-guide/pricing-export.service.ts`
- Import service: `apps/api/src/services/price-guide/pricing-import.service.ts`
- Routes: `apps/api/src/routes/price-guide/pricing/export-import.routes.ts`
- Entity: `apps/api/src/entities/price-guide/PricingImportJob.entity.ts`
- Migration: `apps/api/src/migrations/Migration{timestamp}_PricingImportJob.ts`

**Web**:

- API service: `apps/web/src/services/price-guide.ts`
- Components: `apps/web/src/components/price-guide/Pricing*.tsx`

**Shared**:

- Types: `packages/shared/src/types/price-guide.ts`

---

## Shared Types

Add to: `packages/shared/src/types/price-guide.ts`

```typescript
/** Export filter options */
export type PricingExportFilters = {
  /** Filter to specific offices */
  officeIds?: string[];
  /** Filter to specific options */
  optionIds?: string[];
  /** 
   * Filter to options in these categories (via MSI links).
   * CASCADES: includes all descendant categories automatically.
   */
  categoryIds?: string[];
  /** Filter to options with these tags */
  tagIds?: string[];
};

/** Import preview response */
export type PricingImportPreview = {
  valid: boolean;
  summary: {
    totalRows: number;
    toCreate: number;
    toUpdate: number;
    toSkip: number;
    errors: number;
  };
  errors: Array<{ row: number; column: string; message: string }>;
  preview: Array<{
    row: number;
    action: 'create' | 'update' | 'skip';
    optionName: string;
    officeName: string;
    changes?: Record<string, { from: number; to: number }>;
  }>;
};

/** Import result response (sync) */
export type PricingImportResult = {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    row: number;
    column: string;
    message: string;
  }>;
};

/** Import job status (async) */
export type PricingImportJobStatus = {
  id: string;
  status: 'pending' | 'validating' | 'processing' | 'completed' | 'failed';
  filename: string;
  totalRows: number | null;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ row: number; column: string; message: string }> | null;
  createdAt: string;
  completedAt: string | null;
};

/** Import response (could be sync result or async job) */
export type PricingImportResponse =
  | PricingImportResult
  | { jobId: string; status: 'pending'; message: string };
```

---

## Dependencies

**New**:

- `pg-boss` - PostgreSQL-based job queue
- `exceljs` - Excel file handling

**Install**:

```bash
pnpm --filter api add pg-boss exceljs
pnpm --filter @shared/core build
```

---

## Security Considerations

- Permission required: `price_guide:import_export`
- Validate file type server-side (magic bytes, not just extension)
- Limit file size: 10MB max
- Validate all IDs belong to the user's company (multi-tenant isolation)
- Rate limit import endpoint: 5 imports per hour per user
- Audit log all import/export operations
- Clean up temp files from S3 after processing
- Limit stored errors to first 100 to prevent DB bloat