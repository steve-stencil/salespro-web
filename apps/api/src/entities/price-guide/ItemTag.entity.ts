import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Index,
  Unique,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { TaggableEntityType } from './types';

import type { Tag } from './Tag.entity';

/**
 * ItemTag entity - polymorphic junction table for tagging.
 * Links tags to any taggable entity type (Options, UpCharges, Additional Details).
 *
 * This design allows:
 * - Single table for all tag assignments
 * - Easy extension to new entity types (just add enum value)
 * - Efficient queries for "all items with tag X"
 *
 * Trade-offs:
 * - No FK constraint on entityId (can't reference multiple tables)
 * - Application-level integrity required for orphan cleanup
 * - Soft deletes on parent entities help mitigate orphan issues
 */
@Entity()
@Unique({ properties: ['tag', 'entityType', 'entityId'] })
@Index({ properties: ['entityType', 'entityId'] })
@Index({ properties: ['tag'] })
export class ItemTag {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The tag being applied */
  @ManyToOne('Tag')
  @Index()
  tag!: Tag;

  /** Type of entity being tagged */
  @Enum(() => TaggableEntityType)
  entityType!: TaggableEntityType;

  /** ID of the tagged entity (no FK - polymorphic reference) */
  @Property({ type: 'uuid' })
  @Index()
  entityId!: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
