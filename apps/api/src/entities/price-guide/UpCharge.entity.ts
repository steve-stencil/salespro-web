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
import type { MeasureSheetItemUpCharge } from './MeasureSheetItemUpCharge.entity';
import type { UpChargeAdditionalDetailField } from './UpChargeAdditionalDetailField.entity';
import type { UpChargeDisabledOption } from './UpChargeDisabledOption.entity';
import type { UpChargePrice } from './UpChargePrice.entity';

/**
 * UpCharge entity - shared add-ons/accessories library.
 * Standalone entity linked to MSIs via MeasureSheetItemUpCharge junction table.
 * Uses optimistic locking via version field for concurrent edit protection.
 * linkedMsiCount is maintained via PostgreSQL database trigger.
 */
@Entity()
@Index({ properties: ['company', 'isActive'] })
@Index({ properties: ['company', 'name'] })
export class UpCharge {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Multi-tenant isolation - company that owns this upcharge */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** UpCharge display name */
  @Property({ type: 'string', length: 255 })
  name!: string;

  /** Description/info text */
  @Property({ type: 'text', nullable: true })
  note?: string;

  /** Measurement type - user-defined string (e.g., "sqft", "linft", "each") */
  @Property({ type: 'string', length: 50, nullable: true })
  measurementType?: string;

  /** Namespace identifier for placeholders (future use) */
  @Property({ type: 'string', nullable: true })
  identifier?: string;

  /** Product thumbnail URL */
  @Property({ type: 'string', nullable: true })
  imageUrl?: string;

  /**
   * Denormalized count of linked MSIs.
   * Updated automatically via PostgreSQL trigger on MeasureSheetItemUpCharge.
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

  /** User who last modified this upcharge */
  @ManyToOne('User', { nullable: true })
  lastModifiedBy?: User;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** MSI links via junction table */
  @OneToMany('MeasureSheetItemUpCharge', 'upCharge')
  msiLinks = new Collection<MeasureSheetItemUpCharge>(this);

  /** Additional detail fields linked to this upcharge */
  @OneToMany('UpChargeAdditionalDetailField', 'upCharge')
  additionalDetailFields = new Collection<UpChargeAdditionalDetailField>(this);

  /** Options this upcharge does NOT apply to */
  @OneToMany('UpChargeDisabledOption', 'upCharge')
  disabledOptions = new Collection<UpChargeDisabledOption>(this);

  /** Price breakdowns (default and option-specific overrides) */
  @OneToMany('UpChargePrice', 'upCharge')
  prices = new Collection<UpChargePrice>(this);
}
