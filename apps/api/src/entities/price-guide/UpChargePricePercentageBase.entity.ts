import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Unique,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { PriceObjectType } from './PriceObjectType.entity';
import type { UpChargePrice } from './UpChargePrice.entity';

/**
 * UpChargePricePercentageBase junction table - defines which price types to sum
 * when calculating percentage-based upcharge pricing.
 *
 * Example: For "Grilles" upcharge at 10% of Materials+Labor:
 * 1. Create UpChargePrice with isPercentage=true, amount=0.10
 * 2. Create two UpChargePricePercentageBase rows: one for "Materials", one for "Labor"
 * 3. Calculation: 0.10 × (Materials price + Labor price)
 *
 * Benefits:
 * - Queryable (can find all upcharges using specific price type)
 * - Database enforces referential integrity
 * - Easier to extend with multipliers/weights per type
 */
@Entity()
@Unique({ properties: ['upChargePrice', 'priceType'] })
@Index({ properties: ['upChargePrice'] })
export class UpChargePricePercentageBase {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The percentage-based upcharge price */
  @ManyToOne('UpChargePrice')
  upChargePrice!: UpChargePrice;

  /** The price type to include in the sum */
  @ManyToOne('PriceObjectType')
  priceType!: PriceObjectType;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
