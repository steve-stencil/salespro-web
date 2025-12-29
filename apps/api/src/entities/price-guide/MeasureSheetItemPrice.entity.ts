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

import type { MeasureSheetItem } from './MeasureSheetItem.entity';
import type { Office } from '../Office.entity';
import type { PriceObjectType } from './PriceObjectType.entity';

/**
 * MeasureSheetItemPrice entity - base price breakdowns for MSIs.
 * One price per MSI × office × priceType combination.
 * Supports future pricing via effectiveDate.
 * Uses optimistic locking via version field.
 * Price changes are automatically logged to PriceChangeLog via MikroORM hooks.
 */
@Entity()
@Unique({
  properties: ['measureSheetItem', 'office', 'priceType', 'effectiveDate'],
})
@Index({ properties: ['measureSheetItem', 'office', 'priceType'] })
@Index({ properties: ['office', 'priceType'] })
export class MeasureSheetItemPrice {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The measure sheet item this price belongs to */
  @ManyToOne('MeasureSheetItem')
  measureSheetItem!: MeasureSheetItem;

  /** The office this price applies to */
  @ManyToOne('Office')
  office!: Office;

  /** The price type (Materials, Labor, Tax, etc.) */
  @ManyToOne('PriceObjectType')
  priceType!: PriceObjectType;

  /** Price amount */
  @Property({ type: 'decimal', precision: 12, scale: 2 })
  amount: Opt<number> = 0;

  /** Future pricing support - null means current/default price */
  @Property({ type: 'Date', nullable: true })
  effectiveDate?: Date;

  /** Optimistic locking version - incremented on each update */
  @Property({ type: 'integer', version: true })
  version: Opt<number> = 1;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
