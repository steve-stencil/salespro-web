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

import type { AdditionalDetailField } from './AdditionalDetailField.entity';
import type { MeasureSheetItem } from './MeasureSheetItem.entity';

/**
 * MeasureSheetItemAdditionalDetailField junction table - links MSIs to shared fields.
 * Creates the many-to-many relationship between MSIs and additional detail fields.
 * These are MSI-level fields (as opposed to upcharge-level fields).
 * Includes sortOrder for ordering fields within an MSI.
 */
@Entity()
@Unique({ properties: ['measureSheetItem', 'additionalDetailField'] })
@Index({ properties: ['measureSheetItem', 'sortOrder'] })
@Index({ properties: ['additionalDetailField'] })
export class MeasureSheetItemAdditionalDetailField {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The measure sheet item */
  @ManyToOne('MeasureSheetItem')
  measureSheetItem!: MeasureSheetItem;

  /** The shared additional detail field from the library */
  @ManyToOne('AdditionalDetailField')
  additionalDetailField!: AdditionalDetailField;

  /** Display order within this MSI */
  @Property({ type: 'integer' })
  sortOrder: Opt<number> = 0;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
