import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Index,
  Unique,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from '../Company.entity';
import type { ItemTag } from './ItemTag.entity';

/**
 * Tag entity - reusable labels for organizing library items.
 * Tags are company-scoped and can be applied to Options, UpCharges,
 * and Additional Detail Fields via the polymorphic ItemTag junction table.
 *
 * Features:
 * - Colored labels for visual distinction
 * - Autocomplete-friendly with indexed name lookup
 * - Soft delete support via isActive flag
 */
@Entity()
@Unique({ properties: ['company', 'name'] })
@Index({ properties: ['company', 'name'] })
@Index({ properties: ['company', 'isActive'] })
export class Tag {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Multi-tenant isolation - company that owns this tag */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** Tag display name (unique per company) */
  @Property({ type: 'string', length: 100 })
  name!: string;

  /** Hex color code for visual display (e.g., "#FF5733") */
  @Property({ type: 'string', length: 7 })
  color!: string;

  /** Soft delete flag - false means tag is deleted */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Items tagged with this tag via polymorphic junction */
  @OneToMany('ItemTag', 'tag')
  itemTags = new Collection<ItemTag>(this);
}
