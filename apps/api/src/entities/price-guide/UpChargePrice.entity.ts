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

import type { MeasureSheetItem } from './MeasureSheetItem.entity';
import type { PriceGuideOption } from './PriceGuideOption.entity';
import type { UpCharge } from './UpCharge.entity';
import type { Office } from '../Office.entity';
import type { PriceObjectType } from './PriceObjectType.entity';
import type { UpChargePricePercentageBase } from './UpChargePricePercentageBase.entity';

/**
 * UpChargePrice entity - price breakdowns for upcharges.
 * Supports three-tier pricing hierarchy with office simplification.
 *
 * Pricing Hierarchy (most specific wins):
 * 1. MSI+Option Override: (upCharge, option, measureSheetItem, office?, priceType)
 *    - Applies to one option in ONE specific MSI
 * 2. Global Option Override: (upCharge, option, null, office?, priceType)
 *    - Applies to one option across ALL MSIs
 * 3. Default: (upCharge, null, null, office?, priceType)
 *    - Base price when no overrides exist
 *
 * Office Handling:
 * - office=null: Default price for all offices
 * - office=<id>: Override price for specific office
 *
 * Pricing Lookup Logic:
 * 1. Query for (upCharge, option, msi, office) → MSI+Option+Office override
 * 2. Query for (upCharge, option, msi, null) → MSI+Option default
 * 3. Query for (upCharge, option, null, office) → Global Option+Office override
 * 4. Query for (upCharge, option, null, null) → Global Option default
 * 5. Query for (upCharge, null, null, office) → Default+Office override
 * 6. Query for (upCharge, null, null, null) → Default (all offices)
 *
 * If isPercentage=true, calculate: amount × sum(parent option prices for types in percentageBase)
 * If no pricing found, use $0 (admin gets warning when linking)
 *
 * Uses optimistic locking via version field.
 * Price changes are automatically logged to PriceChangeLog via MikroORM hooks.
 */
@Entity()
@Unique({
  properties: ['upCharge', 'option', 'measureSheetItem', 'office', 'priceType'],
})
@Index({
  properties: ['upCharge', 'option', 'measureSheetItem', 'office', 'priceType'],
})
@Index({ properties: ['upCharge', 'option', 'office', 'priceType'] })
@Index({ properties: ['upCharge', 'office', 'priceType'] })
@Index({ properties: ['measureSheetItem'] })
export class UpChargePrice {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The upcharge this price belongs to */
  @ManyToOne('UpCharge')
  upCharge!: UpCharge;

  /**
   * Specific option for override pricing, or null for default pricing.
   * When null, this is a default price (tier 3).
   * When set with measureSheetItem=null, this is a global option override (tier 2).
   * When set with measureSheetItem, this is an MSI+Option override (tier 1).
   */
  @ManyToOne('PriceGuideOption', { nullable: true })
  option?: PriceGuideOption;

  /**
   * Specific MSI for MSI-level override, or null for global pricing.
   * Only meaningful when option is also set.
   * When null, the price applies globally (default or global option override).
   * When set, the price only applies to this specific MSI+Option combination.
   */
  @ManyToOne('MeasureSheetItem', { nullable: true })
  measureSheetItem?: MeasureSheetItem;

  /**
   * The office this price applies to, or null for all offices.
   * When null, this is the default price for all offices.
   * When set, this is an office-specific override.
   */
  @ManyToOne('Office', { nullable: true })
  office?: Office;

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
