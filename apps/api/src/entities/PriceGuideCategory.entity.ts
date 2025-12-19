import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { MeasureSheetItem } from './MeasureSheetItem.entity';
import type { PriceGuideCategoryOffice } from './PriceGuideCategoryOffice.entity';

/**
 * PriceGuideCategory entity representing a hierarchical category in the price guide.
 *
 * Categories can be nested infinitely deep (like folders) via the self-referential
 * parent-child relationship. Categories with parentId=null are root-level categories.
 *
 * Example hierarchy:
 * - Roofing (root)
 *   - Shingles
 *     - Asphalt Shingles
 *     - Metal Shingles
 *   - Gutters
 * - Windows (root)
 *   - Double Hung
 *   - Casement
 */
@Entity()
export class PriceGuideCategory {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Category name (e.g., 'Roofing', 'Windows', 'Asphalt Shingles') */
  @Property({ type: 'string' })
  name!: string;

  /**
   * Parent category reference.
   * Null indicates this is a root-level category.
   */
  @ManyToOne('PriceGuideCategory', { nullable: true })
  @Index()
  parent?: PriceGuideCategory;

  /** Company this category belongs to */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /**
   * Sort order within the parent category (or root level).
   * Lower numbers appear first.
   */
  @Property({ type: 'integer' })
  sortOrder: Opt<number> = 0;

  /** Whether this category is active */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Child categories */
  @OneToMany('PriceGuideCategory', 'parent')
  children = new Collection<PriceGuideCategory>(this);

  /** Measure sheet items in this category */
  @OneToMany('MeasureSheetItem', 'category')
  items = new Collection<MeasureSheetItem>(this);

  /**
   * Office assignments for this category.
   * Only used for root categories (where parent is null).
   * Child categories inherit access through their root ancestor.
   */
  @OneToMany('PriceGuideCategoryOffice', 'category')
  officeAssignments = new Collection<PriceGuideCategoryOffice>(this);
}
