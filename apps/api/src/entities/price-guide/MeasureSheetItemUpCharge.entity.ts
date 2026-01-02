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
import type { UpCharge } from './UpCharge.entity';

/**
 * MeasureSheetItemUpCharge junction table - links MSIs to shared upcharges.
 * Creates the many-to-many relationship between MSIs and the upcharges library.
 * Includes sortOrder for ordering upcharges within an MSI.
 */
@Entity()
@Unique({ properties: ['measureSheetItem', 'upCharge'] })
@Index({ properties: ['measureSheetItem', 'sortOrder'] })
@Index({ properties: ['upCharge'] })
export class MeasureSheetItemUpCharge {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The measure sheet item */
  @ManyToOne('MeasureSheetItem')
  measureSheetItem!: MeasureSheetItem;

  /** The shared upcharge from the library */
  @ManyToOne('UpCharge')
  upCharge!: UpCharge;

  /** Display order within this MSI */
  @Property({ type: 'integer' })
  sortOrder: Opt<number> = 0;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
