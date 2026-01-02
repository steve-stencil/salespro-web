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

import { PricingImportJobStatus } from './types';

import type { Company } from '../Company.entity';
import type { User } from '../User.entity';

/**
 * Import error entry with row, column, and message details.
 */
export type ImportError = {
  /** Row number in the spreadsheet (1-indexed, excluding header) */
  row: number;
  /** Column name or ID where the error occurred */
  column: string;
  /** Human-readable error message */
  message: string;
};

/**
 * PricingImportJob entity - tracks background pricing import operations.
 * Uses pg-boss (PostgreSQL-based job queue) for background processing.
 *
 * Workflow:
 * 1. User uploads Excel file with pricing data
 * 2. API validates file structure (preview mode)
 * 3. User confirms import
 * 4. For large files (≥1000 rows): API creates PricingImportJob and queues job
 * 5. Worker picks up job, processes file, updates progress
 * 6. Worker sends completion email
 * 7. User can poll status or check email for results
 */
@Entity()
@Index({ properties: ['status', 'createdAt'] })
@Index({ properties: ['createdBy', 'createdAt'] })
@Index({ properties: ['company', 'createdAt'] })
export class PricingImportJob {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Company this import belongs to */
  @ManyToOne('Company')
  company!: Company;

  /** Current job status */
  @Enum(() => PricingImportJobStatus)
  status: Opt<PricingImportJobStatus> = PricingImportJobStatus.PENDING;

  /** Original filename uploaded by user */
  @Property({ type: 'string', length: 255 })
  filename!: string;

  /** S3 key for uploaded file (temporary storage) */
  @Property({ type: 'string', length: 500 })
  fileKey!: string;

  /** Total rows in file (set after validation, excludes header) */
  @Property({ type: 'integer', nullable: true })
  totalRows?: number;

  /** Rows processed so far */
  @Property({ type: 'integer' })
  processedRows: Opt<number> = 0;

  /** Number of new option prices created */
  @Property({ type: 'integer' })
  createdCount: Opt<number> = 0;

  /** Number of existing prices updated */
  @Property({ type: 'integer' })
  updatedCount: Opt<number> = 0;

  /** Number of rows skipped (no changes needed) */
  @Property({ type: 'integer' })
  skippedCount: Opt<number> = 0;

  /** Number of rows with errors */
  @Property({ type: 'integer' })
  errorCount: Opt<number> = 0;

  /** Validation/processing errors (limited to first 100) */
  @Property({ type: 'json', nullable: true })
  errors?: ImportError[];

  /** Whether email notification was sent on completion */
  @Property({ type: 'boolean' })
  emailSent: Opt<boolean> = false;

  /** User who initiated the import */
  @ManyToOne('User')
  createdBy!: User;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', nullable: true })
  completedAt?: Date;

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Add an error to the errors array (limited to MAX_ERRORS).
   */
  addError(row: number, column: string, message: string): void {
    const MAX_ERRORS = 100;
    this.errors ??= [];
    if (this.errors.length < MAX_ERRORS) {
      this.errors.push({ row, column, message });
    }
    this.errorCount = (this.errorCount || 0) + 1;
  }

  /**
   * Mark job as completed with final counts.
   */
  markCompleted(): void {
    this.status = PricingImportJobStatus.COMPLETED;
    this.completedAt = new Date();
  }

  /**
   * Mark job as failed with error message.
   */
  markFailed(message: string): void {
    this.status = PricingImportJobStatus.FAILED;
    this.completedAt = new Date();
    this.errors = [{ row: 0, column: '', message }];
  }

  /**
   * Get progress percentage (0-100).
   */
  getProgressPercent(): number {
    if (!this.totalRows || this.totalRows === 0) return 0;
    return Math.round((this.processedRows / this.totalRows) * 100);
  }
}
