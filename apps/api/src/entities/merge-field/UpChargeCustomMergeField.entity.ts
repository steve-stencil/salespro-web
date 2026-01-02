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
import type { UpCharge } from '../price-guide/UpCharge.entity';

/**
 * UpChargeCustomMergeField - links UpCharges to custom merge field definitions.
 *
 * Each UpCharge can have its own default value for a field from the company's
 * custom merge field library.
 *
 * @example
 * ```typescript
 * // If an UpCharge "Color Upgrade" links to custom field "colorName",
 * // it might have defaultValue = "Custom Color"
 * ```
 */
@Entity()
@Unique({ properties: ['upCharge', 'fieldDefinition'] })
@Index({ properties: ['fieldDefinition'] })
export class UpChargeCustomMergeField {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The UpCharge using this field */
  @ManyToOne('UpCharge')
  upCharge!: UpCharge;

  /** Reference to the field definition in the library */
  @ManyToOne('CustomMergeFieldDefinition')
  fieldDefinition!: CustomMergeFieldDefinition;

  /** Default value for this field on this specific UpCharge */
  @Property({ type: 'text', nullable: true })
  defaultValue?: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
