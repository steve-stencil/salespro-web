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
import type { UpCharge } from './UpCharge.entity';

/**
 * UpChargeAdditionalDetailField junction table - links upcharges to shared fields.
 * Creates the many-to-many relationship between upcharges and additional detail fields.
 * These are upcharge-level fields (as opposed to MSI-level fields).
 * Includes sortOrder for ordering fields within an upcharge.
 */
@Entity()
@Unique({ properties: ['upCharge', 'additionalDetailField'] })
@Index({ properties: ['upCharge', 'sortOrder'] })
@Index({ properties: ['additionalDetailField'] })
export class UpChargeAdditionalDetailField {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The upcharge */
  @ManyToOne('UpCharge')
  upCharge!: UpCharge;

  /** The shared additional detail field from the library */
  @ManyToOne('AdditionalDetailField')
  additionalDetailField!: AdditionalDetailField;

  /** Display order within this upcharge */
  @Property({ type: 'integer' })
  sortOrder: Opt<number> = 0;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
