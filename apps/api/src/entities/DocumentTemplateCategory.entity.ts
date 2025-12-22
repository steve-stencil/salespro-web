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
import type { DocumentTemplate } from './DocumentTemplate.entity';

/**
 * DocumentTemplateCategory entity for grouping document templates.
 *
 * Categories are company-scoped and provide:
 * - Grouping for template selection UI
 * - Sorting/ordering of categories
 * - "Imported" category special handling (always first in iOS)
 *
 * @see readonlytemplatesschema_08cb2e06.plan.md for schema rationale
 */
@Entity()
export class DocumentTemplateCategory {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Reference to the company that owns this category */
  @ManyToOne('Company', { nullable: false })
  @Index()
  company!: Company;

  /** Original category ID from Parse/iOS for traceability */
  @Property({ type: 'string', nullable: true })
  @Index()
  sourceCategoryId?: string;

  /** Category name (e.g., 'Contracts', 'Photos', 'Imported') */
  @Property({ type: 'string' })
  @Index()
  name!: string;

  /** Sort order for display (lower = earlier) */
  @Property({ type: 'integer' })
  @Index()
  sortOrder: Opt<number> = 0;

  /** Whether this is the "Imported" category (special handling in iOS) */
  @Property({ type: 'boolean' })
  isImported: Opt<boolean> = false;

  /** Templates belonging to this category */
  @OneToMany('DocumentTemplate', 'category')
  templates = new Collection<DocumentTemplate>(this);

  /** Timestamp when the category was created */
  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  /** Timestamp when the category was last updated */
  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Soft delete timestamp */
  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}
