import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { User } from './User.entity';

/**
 * Status of a migration session.
 */
export enum MigrationSessionStatus {
  /** Session created but import not started */
  PENDING = 'pending',
  /** Import is currently running */
  IN_PROGRESS = 'in_progress',
  /** Import completed successfully */
  COMPLETED = 'completed',
  /** Import failed with errors */
  FAILED = 'failed',
  /** Session was rolled back after completion */
  ROLLED_BACK = 'rolled_back',
  /** Rollback attempt failed */
  ROLLBACK_FAILED = 'rollback_failed',
}

/**
 * Error details for a failed item import.
 */
export type MigrationError = {
  /** Source object ID that failed */
  sourceId: string;
  /** Error message */
  error: string;
  /** Timestamp when the error occurred */
  timestamp?: string;
};

/**
 * MigrationSession entity for tracking ETL import progress.
 *
 * Migration sessions track:
 * - Progress counts (imported, skipped, errors)
 * - Error details for debugging
 *
 * Sessions are created when a user starts a migration and updated
 * as batches are processed.
 */
@Entity()
export class MigrationSession {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Reference to the company importing data */
  @ManyToOne('Company', { nullable: false })
  @Index()
  company!: Company;

  /** User who initiated the import */
  @ManyToOne('User', { nullable: false })
  @Index()
  createdBy!: User;

  /**
   * Source company ID from the legacy system.
   * Used to scope all ETL queries to this company's data.
   */
  @Property({ type: 'string' })
  @Index()
  sourceCompanyId!: string;

  /** Current status of the import */
  @Enum(() => MigrationSessionStatus)
  @Index()
  status: Opt<MigrationSessionStatus> = MigrationSessionStatus.PENDING;

  /** Total number of items to import */
  @Property({ type: 'integer' })
  totalCount: Opt<number> = 0;

  /** Number of items successfully imported */
  @Property({ type: 'integer' })
  importedCount: Opt<number> = 0;

  /** Number of items skipped (already exist) */
  @Property({ type: 'integer' })
  skippedCount: Opt<number> = 0;

  /** Number of items that failed to import */
  @Property({ type: 'integer' })
  errorCount: Opt<number> = 0;

  /**
   * Detailed error information for failed imports.
   * Stored for debugging and user feedback.
   */
  @Property({ type: 'json' })
  errors: Opt<MigrationError[]> = [];

  /** Timestamp when the session was created */
  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  /** Timestamp when the session was last updated */
  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Timestamp when the import completed (success or failure) */
  @Property({ type: 'Date', nullable: true })
  completedAt?: Date;
}
