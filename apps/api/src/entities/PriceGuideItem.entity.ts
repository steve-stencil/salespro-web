import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  ManyToOne,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { PriceGuideItemStatus, PricingType } from './types';

import type { PriceGuideCategory } from './PriceGuideCategory.entity';

/**
 * PriceGuideItem entity representing an individual product or service with pricing.
 *
 * Items contain the actual pricing information and details for products/services
 * that can be added to quotes, invoices, or proposals. Supports multiple pricing
 * types (fixed, hourly, per-unit, variable).
 */
@Entity()
export class PriceGuideItem {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Item name (e.g., "Website Design", "Consulting Hour") */
  @Property({ type: 'string', length: 255 })
  name!: string;

  /** Detailed description of the item */
  @Property({ type: 'text', nullable: true })
  description?: string;

  /** Optional SKU/product code for inventory systems */
  @Property({ type: 'string', length: 100, nullable: true })
  @Index()
  sku?: string;

  /** Parent category this item belongs to */
  @ManyToOne('PriceGuideCategory')
  @Index()
  category!: PriceGuideCategory;

  /** Type of pricing for this item */
  @Enum(() => PricingType)
  pricingType: Opt<PricingType> = PricingType.FIXED;

  /** Base price amount (stored as decimal with 4 decimal places for precision) */
  @Property({ type: 'decimal', precision: 12, scale: 4 })
  price!: string;

  /** Minimum price (for variable pricing or negotiation floor) */
  @Property({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  minPrice?: string;

  /** Maximum price (for variable pricing or negotiation ceiling) */
  @Property({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  maxPrice?: string;

  /** Cost to the company (for margin calculations) */
  @Property({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  cost?: string;

  /** Unit of measure (e.g., "hour", "each", "sqft", "project") */
  @Property({ type: 'string', length: 50, nullable: true })
  unit?: string;

  /** Whether taxes apply to this item */
  @Property({ type: 'boolean' })
  taxable: Opt<boolean> = true;

  /** Current status of the item */
  @Enum(() => PriceGuideItemStatus)
  @Index()
  status: Opt<PriceGuideItemStatus> = PriceGuideItemStatus.ACTIVE;

  /** Display order within the category */
  @Property({ type: 'integer' })
  sortOrder: Opt<number> = 0;

  /** Optional notes for internal use */
  @Property({ type: 'text', nullable: true })
  internalNotes?: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
