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

import { PriceChangeJobStatus, PriceChangeTargetType } from './types';

import type { PriceChangeOperation } from './types';
import type { User } from '../User.entity';

/**
 * PriceChangeJob entity - tracks mass price change operations with progress monitoring.
 * Uses pg-boss (PostgreSQL-based job queue) for background processing.
 *
 * Workflow:
 * 1. Admin initiates mass price change
 * 2. API creates PriceChangeJob record
 * 3. API queues job with pg-boss
 * 4. Worker process picks up job
 * 5. Worker updates prices, increments processedRecords
 * 6. Worker marks job as completed/failed
 * 7. UI polls job status for progress updates
 */
@Entity()
@Index({ properties: ['status', 'createdAt'] })
@Index({ properties: ['createdBy', 'createdAt'] })
export class PriceChangeJob {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Job status */
  @Enum(() => PriceChangeJobStatus)
  status: Opt<PriceChangeJobStatus> = PriceChangeJobStatus.PENDING;

  /** Target type - options or upcharges */
  @Enum(() => PriceChangeTargetType)
  targetType!: PriceChangeTargetType;

  /** Array of item IDs to update */
  @Property({ type: 'json' })
  targetIds!: string[];

  /**
   * Operation configuration:
   * { type: 'increase'|'decrease', valueType: 'percent'|'fixed', value: number, filters?: {...} }
   */
  @Property({ type: 'json' })
  operation!: PriceChangeOperation;

  /** Total items to process */
  @Property({ type: 'integer' })
  totalRecords!: number;

  /** Items processed so far */
  @Property({ type: 'integer' })
  processedRecords: Opt<number> = 0;

  /** Items that failed processing */
  @Property({ type: 'integer' })
  failedRecords: Opt<number> = 0;

  /** Array of error details: [{ itemId, message }] */
  @Property({ type: 'json', nullable: true })
  errors?: { itemId: string; message: string }[];

  /** User who initiated the job */
  @ManyToOne('User')
  createdBy!: User;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  /** When job finished (success or failure) */
  @Property({ type: 'Date', nullable: true })
  completedAt?: Date;
}
