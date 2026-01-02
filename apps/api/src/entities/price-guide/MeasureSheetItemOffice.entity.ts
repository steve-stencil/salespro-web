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

/**
 * MeasureSheetItemOffice junction table - controls office visibility for MSIs.
 * Determines which offices can see and use a particular measure sheet item.
 */
@Entity()
@Unique({ properties: ['measureSheetItem', 'office'] })
@Index({ properties: ['measureSheetItem'] })
@Index({ properties: ['office'] })
export class MeasureSheetItemOffice {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The measure sheet item */
  @ManyToOne('MeasureSheetItem')
  measureSheetItem!: MeasureSheetItem;

  /** The office with access to this MSI */
  @ManyToOne('Office')
  office!: Office;

  /** Migration session that created this entity (for rollback support) */
  @Property({ type: 'uuid', nullable: true })
  @Index()
  migrationSessionId?: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
