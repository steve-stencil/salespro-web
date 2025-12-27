import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from '../Company.entity';
import type { User } from '../User.entity';

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

  // Note: OneToMany collections to junction tables and pricing will be added in Week 2
  // - msiLinks: MeasureSheetItemOption[] (MSI links via junction table)
  // - prices: OptionPrice[] (price breakdowns by office and type)
  // - upChargePriceOverrides: UpChargePrice[] (override prices for this option)
  // - disabledUpCharges: UpChargeDisabledOption[] (upcharges disabled for this option)
}
