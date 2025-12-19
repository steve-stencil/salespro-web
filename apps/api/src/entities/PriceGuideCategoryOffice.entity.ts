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

import type { Office } from './Office.entity';
import type { PriceGuideCategory } from './PriceGuideCategory.entity';

/**
 * Junction entity for assigning root-level PriceGuideCategories to Offices.
 *
 * Only root categories (where parentId is null) should have office assignments.
 * Child categories inherit access through their root ancestor.
 *
 * This allows filtering categories by office at the root level while keeping
 * the category hierarchy simple - once you're inside a root category, all
 * children are accessible regardless of office.
 */
@Entity()
@Unique({ properties: ['category', 'office'] })
export class PriceGuideCategoryOffice {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The root category being assigned to an office */
  @ManyToOne('PriceGuideCategory')
  @Index()
  category!: PriceGuideCategory;

  /** The office this category is assigned to */
  @ManyToOne('Office')
  @Index()
  office!: Office;

  /** When this assignment was created */
  @Property({ type: 'Date' })
  assignedAt: Opt<Date> = new Date();
}
