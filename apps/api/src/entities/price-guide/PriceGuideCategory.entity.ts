import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Index,
  Opt,
  Enum,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { PriceGuideCategoryType } from './types';

import type { Company } from '../Company.entity';
import type { User } from '../User.entity';
import type { MeasureSheetItem } from './MeasureSheetItem.entity';

/**
 * PriceGuideCategory entity for organizing MeasureSheetItems in a hierarchy.
 * Supports self-referential parent-child relationships for nested categories.
 * Uses optimistic locking via version field for concurrent edit protection.
 */
@Entity()
@Index({ properties: ['company', 'parent'] })
@Index({ properties: ['company', 'name'] })
export class PriceGuideCategory {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Multi-tenant isolation - company that owns this category */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /**
   * Parent category for hierarchy (null = root category).
   * Self-referential relationship for nested categories.
   */
  @ManyToOne('PriceGuideCategory', { nullable: true })
  parent?: PriceGuideCategory;

  /** Category display name */
  @Property({ type: 'string', length: 255 })
  name!: string;

  /**
   * Category display type - controls navigation behavior in the mobile app.
   * - DEFAULT: Shows MSIs directly when selected (no subcategory drill-down)
   * - DETAIL: Shows subcategories first, then MSIs
   * - DEEP_DRILL_DOWN: Multiple levels of subcategory hierarchy
   *
   * Imported from legacy CustomConfig.categories_[].type field.
   */
  @Enum({ items: () => PriceGuideCategoryType })
  categoryType: Opt<PriceGuideCategoryType> = PriceGuideCategoryType.DEFAULT;

  /**
   * Fractional index for ordering within parent category.
   * Uses string keys (e.g., "a0", "a0V") to allow inserting between items
   * without reordering all subsequent items.
   */
  @Property({ type: 'string', length: 50 })
  @Index()
  sortOrder: Opt<string> = 'a0';

  /**
   * Hierarchy depth (0=root, 1=sub, 2=drill-down, etc.).
   * Maintained for query optimization.
   * UI shows warning when depth > 5 levels.
   */
  @Property({ type: 'integer' })
  depth: Opt<number> = 0;

  /** Soft delete flag - false means category is deleted */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  /** Optimistic locking version - incremented on each update */
  @Property({ type: 'integer', version: true })
  version: Opt<number> = 1;

  /** User who last modified this category */
  @ManyToOne('User', { nullable: true })
  lastModifiedBy?: User;

  /**
   * Legacy CustomConfig.categories_[].objectId for migration tracking.
   * Used to identify previously imported categories and prevent duplicates.
   */
  @Property({ type: 'string', nullable: true })
  @Index()
  sourceId?: string;

  /** Migration session that created this entity (for rollback support) */
  @Property({ type: 'uuid', nullable: true })
  @Index()
  migrationSessionId?: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Child categories in this category */
  @OneToMany('PriceGuideCategory', 'parent')
  children = new Collection<PriceGuideCategory>(this);

  /** MeasureSheetItems in this category */
  @OneToMany('MeasureSheetItem', 'category')
  items = new Collection<MeasureSheetItem>(this);
}
