import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from '../Company.entity';
import type { User } from '../User.entity';
import type { MeasureSheetItemOption } from './MeasureSheetItemOption.entity';
import type { OptionPrice } from './OptionPrice.entity';
import type { UpChargeDisabledOption } from './UpChargeDisabledOption.entity';
import type { UpChargePrice } from './UpChargePrice.entity';

/**
 * PriceGuideOption entity - shared product variants library.
 * Standalone entity linked to MSIs via MeasureSheetItemOption junction table.
 * Uses optimistic locking via version field for concurrent edit protection.
 * linkedMsiCount is maintained via PostgreSQL database trigger.
 */
@Entity()
@Index({ properties: ['company', 'isActive'] })
@Index({ properties: ['company', 'name'] })
export class PriceGuideOption {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Multi-tenant isolation - company that owns this option */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** Brand/manufacturer name */
  @Property({ type: 'string', nullable: true })
  brand?: string;

  /** Option display name */
  @Property({ type: 'string', length: 255 })
  name!: string;

  /** SKU/product code */
  @Property({ type: 'string', nullable: true })
  itemCode?: string;

  /** Measurement type - user-defined string (e.g., "sqft", "linft", "each") */
  @Property({ type: 'string', length: 50, nullable: true })
  measurementType?: string;

  /**
   * Full-text search vector (auto-generated).
   * Searchable by name, brand, and itemCode.
   * Generated via PostgreSQL tsvector.
   */
  @Property({ type: 'text', nullable: true })
  @Index({ type: 'fulltext' })
  searchVector?: string;

  /**
   * Denormalized count of linked MSIs.
   * Updated automatically via PostgreSQL trigger on MeasureSheetItemOption.
   */
  @Property({ type: 'integer' })
  linkedMsiCount: Opt<number> = 0;

  /** Legacy SSPriceGuideItem objectId for migration tracking */
  @Property({ type: 'string', nullable: true })
  @Index()
  sourceId?: string;

  /** Migration session that created this entity (for rollback support) */
  @Property({ type: 'uuid', nullable: true })
  @Index()
  migrationSessionId?: string;

  /** Soft delete flag - false means item is deleted (90-day retention) */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  /** Optimistic locking version - incremented on each update */
  @Property({ type: 'integer', version: true })
  version: Opt<number> = 1;

  /** User who last modified this option */
  @ManyToOne('User', { nullable: true })
  lastModifiedBy?: User;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** MSI links via junction table */
  @OneToMany('MeasureSheetItemOption', 'option')
  msiLinks = new Collection<MeasureSheetItemOption>(this);

  /** Price breakdowns by office and type */
  @OneToMany('OptionPrice', 'option')
  prices = new Collection<OptionPrice>(this);

  /** UpCharge override prices for this specific option */
  @OneToMany('UpChargePrice', 'option')
  upChargePriceOverrides = new Collection<UpChargePrice>(this);

  /** UpCharges that are disabled for this option */
  @OneToMany('UpChargeDisabledOption', 'option')
  disabledUpCharges = new Collection<UpChargeDisabledOption>(this);
}
