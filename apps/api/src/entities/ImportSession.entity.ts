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
 * Status of an import session.
 */
export enum ImportSessionStatus {
  /** Session created but import not started */
  PENDING = 'pending',
  /** Import is currently running */
  IN_PROGRESS = 'in_progress',
  /** Import completed successfully */
  COMPLETED = 'completed',
  /** Import failed with errors */
  FAILED = 'failed',
}

/**
 * Office mapping from source to target.
 * Key is the source office objectId.
 * Value is either:
 * - UUID of the target office
 * - 'create' to create a new office
 * - 'none' to skip office assignment
 */
export type OfficeMapping = Record<string, string>;

/**
 * Type mapping from source type name to DocumentType ID.
 * Key is the source type name (e.g., 'contract').
 * Value is the UUID of the target DocumentType.
 */
export type TypeMapping = Record<string, string>;

/**
 * Error details for a failed template import.
 */
export type ImportError = {
  /** Source template ID that failed */
  templateId: string;
  /** Error message */
  error: string;
  /** Timestamp when the error occurred */
  timestamp?: string;
};

/**
 * ImportSession entity for tracking ETL import progress.
 *
 * Import sessions track:
 * - Office and type mappings configured by the user
 * - Progress counts (imported, skipped, errors)
 * - Error details for debugging
 *
 * Sessions are created when a user starts an import and updated
 * as batches are processed.
 */
@Entity()
export class ImportSession {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Reference to the company importing templates */
  @ManyToOne('Company', { nullable: false })
  @Index()
  company!: Company;

  /** User who initiated the import */
  @ManyToOne('User', { nullable: false })
  @Index()
  createdBy!: User;

  /** Current status of the import */
  @Enum(() => ImportSessionStatus)
  @Index()
  status: Opt<ImportSessionStatus> = ImportSessionStatus.PENDING;

  /**
   * Mapping of source office IDs to target offices.
   * Configured by user in step 1 of import wizard.
   */
  @Property({ type: 'json' })
  officeMapping: Opt<OfficeMapping> = {};

  /**
   * Mapping of source type names to DocumentType IDs.
   * Configured by user in step 2 of import wizard.
   */
  @Property({ type: 'json' })
  typeMapping: Opt<TypeMapping> = {};

  /** Total number of documents to import */
  @Property({ type: 'integer' })
  totalCount: Opt<number> = 0;

  /** Number of documents successfully imported */
  @Property({ type: 'integer' })
  importedCount: Opt<number> = 0;

  /** Number of documents skipped (already exist) */
  @Property({ type: 'integer' })
  skippedCount: Opt<number> = 0;

  /** Number of documents that failed to import */
  @Property({ type: 'integer' })
  errorCount: Opt<number> = 0;

  /**
   * Detailed error information for failed imports.
   * Stored for debugging and user feedback.
   */
  @Property({ type: 'json' })
  errors: Opt<ImportError[]> = [];

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
