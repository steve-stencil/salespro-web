import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  ManyToOne,
  OneToMany,
  Collection,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { PriceGuideStatus } from './types';

import type { Company } from './Company.entity';
import type { PriceGuideCategory } from './PriceGuideCategory.entity';

/**
 * PriceGuide entity representing a company's price catalog.
 *
 * A price guide serves as a master catalog of products and services with
 * their associated pricing. Companies can have multiple price guides
 * (e.g., for different regions, client types, or time periods).
 */
@Entity()
export class PriceGuide {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Name of the price guide (e.g., "Standard Pricing 2024", "Enterprise Rates") */
  @Property({ type: 'string', length: 255 })
  name!: string;

  /** Optional description of the price guide */
  @Property({ type: 'text', nullable: true })
  description?: string;

  /** Parent company that owns this price guide */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** Current status of the price guide */
  @Enum(() => PriceGuideStatus)
  status: Opt<PriceGuideStatus> = PriceGuideStatus.DRAFT;

  /** Whether this is the company's default price guide */
  @Property({ type: 'boolean' })
  @Index()
  isDefault: Opt<boolean> = false;

  /** Optional effective start date for this price guide */
  @Property({ type: 'Date', nullable: true })
  effectiveFrom?: Date;

  /** Optional effective end date for this price guide */
  @Property({ type: 'Date', nullable: true })
  effectiveUntil?: Date;

  /** Default currency code (ISO 4217, e.g., "USD", "EUR") */
  @Property({ type: 'string', length: 3 })
  currency: Opt<string> = 'USD';

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Categories within this price guide */
  @OneToMany('PriceGuideCategory', 'priceGuide')
  categories = new Collection<PriceGuideCategory>(this);
}
