import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { OptionPrice } from './OptionPrice.entity';
import type { UpChargePrice } from './UpChargePrice.entity';
import type { User } from '../User.entity';

/**
 * PriceChangeLog entity - append-only audit log for price changes.
 * Enables point-in-time price reconstruction for compliance/auditing.
 * Automatically captured via MikroORM @AfterUpdate hooks on OptionPrice/UpChargePrice.
 *
 * Use Cases:
 * - "What was this price on quote date?"
 * - Price trend analysis
 * - Compliance/audit requirements
 * - Debugging estimate price discrepancies
 *
 * Note: Either optionPrice OR upChargePrice is set, not both.
 */
@Entity()
@Index({ properties: ['optionPrice', 'changedAt'] })
@Index({ properties: ['upChargePrice', 'changedAt'] })
@Index({ properties: ['changedBy', 'changedAt'] })
export class PriceChangeLog {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The option price that was changed (null if upcharge price) */
  @ManyToOne('OptionPrice', { nullable: true })
  optionPrice?: OptionPrice;

  /** The upcharge price that was changed (null if option price) */
  @ManyToOne('UpChargePrice', { nullable: true })
  upChargePrice?: UpChargePrice;

  /** Previous price amount */
  @Property({ type: 'decimal', precision: 12, scale: 2 })
  oldAmount!: number;

  /** New price amount */
  @Property({ type: 'decimal', precision: 12, scale: 2 })
  newAmount!: number;

  /** User who made the change */
  @ManyToOne('User')
  changedBy!: User;

  /** When the change occurred */
  @Property({ type: 'Date' })
  changedAt: Opt<Date> = new Date();
}
