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

import type { Company } from '../Company.entity';

/**
 * PriceObjectType entity - TypeCodes for pricing breakdown.
 * Supports global system types (company=null) and company-specific custom types.
 *
 * Global Default Types (seeded on app initialization):
 * - MATERIAL → "Materials"
 * - LABOR → "Labor"
 * - TAX → "Tax"
 * - OTHER → "Other"
 *
 * Note: V1 legacy prices without PriceObjects migrate to "OTHER" type.
 */
@Entity()
@Index({ properties: ['company', 'isActive', 'sortOrder'] })
@Unique({ properties: ['company', 'code'] })
export class PriceObjectType {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /**
   * Company that owns this type (null = global system type).
   * Global types are available to all companies.
   */
  @ManyToOne('Company', { nullable: true })
  @Index()
  company?: Company;

  /** Unique code (e.g., "MATERIAL", "LABOR") */
  @Property({ type: 'string', length: 50 })
  code!: string;

  /** Display name (e.g., "Materials", "Labor") */
  @Property({ type: 'string', length: 255 })
  name!: string;

  /** Type description */
  @Property({ type: 'text', nullable: true })
  description?: string;

  /** Display ordering */
  @Property({ type: 'integer' })
  sortOrder: Opt<number> = 0;

  /** Soft delete flag */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  // Note: OneToMany collections to pricing entities will be added in Week 2
  // - optionPrices: OptionPrice[] (option prices using this type)
  // - upChargePrices: UpChargePrice[] (upcharge prices using this type)
  // - percentageBaseReferences: UpChargePricePercentageBase[] (percentage base references)
}

/**
 * Default price type codes for seeding.
 * These are created as global types (company=null).
 */
export const DEFAULT_PRICE_TYPES = [
  { code: 'MATERIAL', name: 'Materials', sortOrder: 1 },
  { code: 'LABOR', name: 'Labor', sortOrder: 2 },
  { code: 'TAX', name: 'Tax', sortOrder: 3 },
  { code: 'OTHER', name: 'Other', sortOrder: 4 },
] as const;
