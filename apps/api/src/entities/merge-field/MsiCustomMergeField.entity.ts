import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { CustomMergeFieldDefinition } from './CustomMergeFieldDefinition.entity';
import type { MeasureSheetItem } from '../price-guide/MeasureSheetItem.entity';

/**
 * MsiCustomMergeField - links MSIs to custom merge field definitions.
 *
 * Each MSI can have its own default value for a field from the company's
 * custom merge field library.
 *
 * @example
 * ```typescript
 * // If an MSI "Wood Frame Window" links to custom field "frameColor",
 * // it might have defaultValue = "Natural Oak"
 * ```
 */
@Entity()
@Unique({ properties: ['measureSheetItem', 'fieldDefinition'] })
@Index({ properties: ['fieldDefinition'] })
export class MsiCustomMergeField {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The MSI using this field */
  @ManyToOne('MeasureSheetItem')
  measureSheetItem!: MeasureSheetItem;

  /** Reference to the field definition in the library */
  @ManyToOne('CustomMergeFieldDefinition')
  fieldDefinition!: CustomMergeFieldDefinition;

  /** Default value for this field on this specific MSI */
  @Property({ type: 'text', nullable: true })
  defaultValue?: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
