import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Index,
  Unique,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { PriceGuideOption } from './PriceGuideOption.entity';
import type { UpCharge } from './UpCharge.entity';
import type { Office } from '../Office.entity';
import type { PriceObjectType } from './PriceObjectType.entity';
import type { UpChargePricePercentageBase } from './UpChargePricePercentageBase.entity';

/**
 * UpChargePrice entity - price breakdowns for upcharges.
 * Supports default pricing (option=null) and option-specific overrides.
 *
 * Pricing Lookup Logic:
 * 1. Query for (upCharge, selectedOption, office, priceType) → if exists, use override
 * 2. If not found, query for (upCharge, null, office, priceType) → use default price
 * 3. If isPercentage=true, calculate: amount × sum(parent option prices for types in percentageBase)
 * 4. If no pricing found, use $0 (admin gets warning when linking)
 *
 * Uses optimistic locking via version field.
 * Price changes are automatically logged to PriceChangeLog via MikroORM hooks.
 */
@Entity()
@Unique({ properties: ['upCharge', 'option', 'office', 'priceType'] })
@Index({ properties: ['upCharge', 'option', 'office', 'priceType'] })
@Index({ properties: ['upCharge', 'office', 'priceType'] })
export class UpChargePrice {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The upcharge this price belongs to */
  @ManyToOne('UpCharge')
  upCharge!: UpCharge;

  /**
   * Specific option for override pricing, or null for default pricing.
   * When null, this price is the default used when no option-specific override exists.
   */
  @ManyToOne('PriceGuideOption', { nullable: true })
  option?: PriceGuideOption;

  /** The office this price applies to */
  @ManyToOne('Office')
  office!: Office;

  /** The price type (Materials, Labor, Tax, etc.) */
  @ManyToOne('PriceObjectType')
  priceType!: PriceObjectType;

  /** Price amount (or percentage multiplier if isPercentage=true) */
  @Property({ type: 'decimal', precision: 12, scale: 2 })
  amount: Opt<number> = 0;

  /**
   * If true, amount is a percentage multiplier (e.g., 0.10 = 10%).
   * Final price = amount × sum(parent option prices for types in percentageBase)
   */
  @Property({ type: 'boolean' })
  isPercentage: Opt<boolean> = false;

  /** Optimistic locking version - incremented on each update */
  @Property({ type: 'integer', version: true })
  version: Opt<number> = 1;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /**
   * Price types to sum when calculating percentage-based pricing.
   * Only used when isPercentage=true.
   */
  @OneToMany('UpChargePricePercentageBase', 'upChargePrice')
  percentageBase = new Collection<UpChargePricePercentageBase>(this);
}
