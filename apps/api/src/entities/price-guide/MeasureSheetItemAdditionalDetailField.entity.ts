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
 *
 * Tag Support:
 * - Set isTag=true to designate this field as the MSI's tag field
 * - Only one field per MSI can have isTag=true (enforced by partial unique index)
 * - Replaces legacy tagTitle, tagRequired, tagPickerOptions, tagParams on MSI
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

  /** Display order within this MSI (fractional index for insertion between items) */
  @Property({ type: 'string', length: 50 })
  @Index()
  sortOrder: Opt<string> = 'a0';

  /**
   * Whether this field is the tag field for the MSI.
   * Only one field per MSI can have isTag=true (enforced by partial unique index).
   * Tag fields appear in special UI location and populate line item tags.
   */
  @Property({ type: 'boolean' })
  isTag: Opt<boolean> = false;

  /** Migration session that created this entity (for rollback support) */
  @Property({ type: 'uuid', nullable: true })
  @Index()
  migrationSessionId?: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
