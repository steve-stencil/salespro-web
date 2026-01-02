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
import type { PriceGuideOption } from './PriceGuideOption.entity';

/**
 * MeasureSheetItemOption junction table - links MSIs to shared options.
 * Creates the many-to-many relationship between MSIs and the options library.
 * Includes sortOrder for ordering options within an MSI.
 */
@Entity()
@Unique({ properties: ['measureSheetItem', 'option'] })
@Index({ properties: ['measureSheetItem', 'sortOrder'] })
@Index({ properties: ['option'] })
export class MeasureSheetItemOption {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The measure sheet item */
  @ManyToOne('MeasureSheetItem')
  measureSheetItem!: MeasureSheetItem;

  /** The shared option from the library */
  @ManyToOne('PriceGuideOption')
  option!: PriceGuideOption;

  /** Display order within this MSI */
  @Property({ type: 'integer' })
  sortOrder: Opt<number> = 0;

  /** Migration session that created this entity (for rollback support) */
  @Property({ type: 'uuid', nullable: true })
  @Index()
  migrationSessionId?: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
