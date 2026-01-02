import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  Unique,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { MergeFieldCategory, MergeFieldDataType } from './types';

/**
 * MergeField entity - SYSTEM merge fields only.
 *
 * These are global, computed fields shared across all companies.
 * Values are computed at runtime from entity data (e.g., item.quantity
 * comes from the line item's actual quantity).
 *
 * No company FK - these are seeded once and shared globally.
 *
 * @example
 * ```typescript
 * // System fields appear in templates as:
 * // {{item.quantity}}, {{option.selected.totalPrice}}, etc.
 * ```
 */
@Entity()
@Index({ properties: ['category', 'isActive'] })
export class MergeField {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /**
   * Unique key globally, e.g., "item.quantity", "option.selected.totalPrice"
   * This is what appears in templates: {{item.quantity}}
   */
  @Property({ type: 'string', length: 100 })
  @Unique()
  key!: string;

  /** Human-readable name for UI display */
  @Property({ type: 'string', length: 255 })
  displayName!: string;

  /** Help text explaining what this field contains */
  @Property({ type: 'text', nullable: true })
  description?: string;

  /** Category for grouping in UI */
  @Enum(() => MergeFieldCategory)
  @Index()
  category!: MergeFieldCategory;

  /** Data type - controls formatting when rendered */
  @Enum(() => MergeFieldDataType)
  dataType!: MergeFieldDataType;

  /** Soft delete / deprecate flag */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
