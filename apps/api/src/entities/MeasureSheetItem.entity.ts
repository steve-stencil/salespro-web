import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { PriceGuideCategory } from './PriceGuideCategory.entity';

/**
 * MeasureSheetItem entity representing an item in the price guide.
 *
 * Items belong to a category in the price guide hierarchy and represent
 * individual products or services that can be added to measure sheets.
 */
@Entity()
export class MeasureSheetItem {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Item name (e.g., 'GAF Timberline HD Shingles') */
  @Property({ type: 'string' })
  name!: string;

  /** Optional description of the item */
  @Property({ type: 'text', nullable: true })
  description?: string;

  /** Category this item belongs to */
  @ManyToOne('PriceGuideCategory')
  @Index()
  category!: PriceGuideCategory;

  /** Company this item belongs to */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /**
   * Sort order within the category.
   * Lower numbers appear first.
   */
  @Property({ type: 'integer' })
  sortOrder: Opt<number> = 0;

  /** Whether this item is active */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
