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

import type { PriceGuideOption } from './PriceGuideOption.entity';
import type { UpCharge } from './UpCharge.entity';

/**
 * UpChargeDisabledOption junction table - tracks which options an upcharge does NOT apply to.
 * When an option is in this table for a given upcharge, that upcharge is disabled/hidden
 * when the user selects that option.
 */
@Entity()
@Unique({ properties: ['upCharge', 'option'] })
@Index({ properties: ['upCharge'] })
@Index({ properties: ['option'] })
export class UpChargeDisabledOption {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The upcharge */
  @ManyToOne('UpCharge')
  upCharge!: UpCharge;

  /** The option this upcharge is disabled for */
  @ManyToOne('PriceGuideOption')
  option!: PriceGuideOption;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
