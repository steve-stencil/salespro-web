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

import type { Office } from '../Office.entity';
import type { PriceObjectType } from './PriceObjectType.entity';

/**
 * OfficePriceType entity - Junction table linking offices to price types.
 *
 * This enables per-office price type configuration:
 * - Different offices can use different price types
 * - Display order can be customized per office via sortOrder
 *
 * Enablement model:
 * - Row exists → Price type is enabled for this office
 * - Row doesn't exist → Price type is disabled for this office
 *
 * Workflow:
 * 1. Company creates PriceObjectType records at company level
 * 2. Admin assigns price types to offices via this junction table
 * 3. When editing pricing, only price types assigned to the office are shown
 */
@Entity()
@Unique({ properties: ['office', 'priceType'] })
export class OfficePriceType {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Office this assignment belongs to */
  @ManyToOne('Office')
  @Index()
  office!: Office;

  /** The price type being assigned */
  @ManyToOne('PriceObjectType')
  @Index()
  priceType!: PriceObjectType;

  /** Office-specific display ordering */
  @Property({ type: 'integer' })
  sortOrder: Opt<number> = 0;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
