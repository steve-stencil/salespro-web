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

import type { Company } from '../Company.entity';
import type { OfficePriceType } from './OfficePriceType.entity';
import type { OptionPrice } from './OptionPrice.entity';
import type { ParentPriceTypeCode } from './types';
import type { UpChargePrice } from './UpChargePrice.entity';
import type { UpChargePricePercentageBase } from './UpChargePricePercentageBase.entity';

/**
 * PriceObjectType entity - Company-specific price type definitions.
 *
 * Each company defines their own price types, which must map to a parent code
 * for cross-company reporting aggregation.
 *
 * Parent Codes (hardcoded):
 * - MATERIAL → Cost of materials only
 * - LABOR → Cost of labor only
 * - MATERIAL_LABOR → Combined installed price (materials + labor not separated)
 * - TAX → Tax charges
 * - OTHER → Miscellaneous charges
 *
 * Example:
 * - Company A: "Roofing Labor" → parentCode: LABOR
 * - Company B: "Windows Labor" → parentCode: LABOR
 * - Report aggregation: GROUP BY parentCode → all labor costs together
 */
@Entity()
@Index({ properties: ['company', 'isActive', 'sortOrder'] })
@Unique({ properties: ['company', 'code'] })
export class PriceObjectType {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /**
   * Company that owns this price type (required).
   * All price types are company-specific - no global types.
   */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** Unique code within company (e.g., "ROOFING_LABOR") */
  @Property({ type: 'string', length: 50 })
  code!: string;

  /** Display name (e.g., "Roofing Labor") */
  @Property({ type: 'string', length: 255 })
  name!: string;

  /**
   * Parent code for cross-company aggregation (required).
   * Must be one of: MATERIAL, LABOR, MATERIAL_LABOR, TAX, OTHER
   */
  @Property({ type: 'string', length: 20 })
  parentCode!: ParentPriceTypeCode;

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

  /** Option prices using this type */
  @OneToMany('OptionPrice', 'priceType')
  optionPrices = new Collection<OptionPrice>(this);

  /** UpCharge prices using this type */
  @OneToMany('UpChargePrice', 'priceType')
  upChargePrices = new Collection<UpChargePrice>(this);

  /** Percentage base references using this type */
  @OneToMany('UpChargePricePercentageBase', 'priceType')
  percentageBaseReferences = new Collection<UpChargePricePercentageBase>(this);

  /** Office assignments for this price type */
  @OneToMany('OfficePriceType', 'priceType')
  officeAssignments = new Collection<OfficePriceType>(this);
}
