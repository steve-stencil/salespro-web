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
import type { PriceGuideOption } from '../price-guide/PriceGuideOption.entity';

/**
 * OptionCustomMergeField - links Options to custom merge field definitions.
 *
 * Each Option can have its own default value for a field from the company's
 * custom merge field library.
 *
 * @example
 * ```typescript
 * // If an Option "Premium Grade" links to custom field "warrantyYears",
 * // it might have defaultValue = "25"
 * ```
 */
@Entity()
@Unique({ properties: ['option', 'fieldDefinition'] })
@Index({ properties: ['fieldDefinition'] })
export class OptionCustomMergeField {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The Option using this field */
  @ManyToOne('PriceGuideOption')
  option!: PriceGuideOption;

  /** Reference to the field definition in the library */
  @ManyToOne('CustomMergeFieldDefinition')
  fieldDefinition!: CustomMergeFieldDefinition;

  /** Default value for this field on this specific Option */
  @Property({ type: 'text', nullable: true })
  defaultValue?: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
