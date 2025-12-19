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

import type { PriceGuide } from './PriceGuide.entity';
import type { PriceGuideItem } from './PriceGuideItem.entity';

/**
 * PriceGuideCategory entity for organizing price guide items into groups.
 *
 * Categories provide hierarchical organization for price guide items,
 * allowing for better navigation and filtering of products/services.
 * Supports self-referencing for nested categories (parent-child).
 */
@Entity()
export class PriceGuideCategory {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Category name (e.g., "Professional Services", "Materials") */
  @Property({ type: 'string', length: 255 })
  name!: string;

  /** Optional description of the category */
  @Property({ type: 'text', nullable: true })
  description?: string;

  /** Parent price guide this category belongs to */
  @ManyToOne('PriceGuide')
  @Index()
  priceGuide!: PriceGuide;

  /** Optional parent category for nested hierarchy */
  @ManyToOne('PriceGuideCategory', { nullable: true })
  @Index()
  parentCategory?: PriceGuideCategory;

  /** Display order within the parent (price guide or parent category) */
  @Property({ type: 'integer' })
  sortOrder: Opt<number> = 0;

  /** Whether this category is active and visible */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Child categories (for hierarchical structure) */
  @OneToMany('PriceGuideCategory', 'parentCategory')
  childCategories = new Collection<PriceGuideCategory>(this);

  /** Items within this category */
  @OneToMany('PriceGuideItem', 'category')
  items = new Collection<PriceGuideItem>(this);
}
