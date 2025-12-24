import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  ManyToMany,
  Collection,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { Office } from './Office.entity';

/**
 * DocumentType entity for categorizing document templates.
 *
 * Document types (e.g., "contract", "proposal") can be:
 * - System defaults that come pre-seeded
 * - Custom types created by users
 *
 * Types can be scoped to specific offices via M2M relationship.
 * Empty offices collection means the type is available in all offices.
 */
@Entity()
export class DocumentType {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Reference to the company that owns this type */
  @ManyToOne('Company', { nullable: false })
  @Index()
  company!: Company;

  /** Type name (e.g., 'contract', 'proposal', 'custom') */
  @Property({ type: 'string' })
  @Index()
  name!: string;

  /** Whether this is a system default type (contract, proposal) */
  @Property({ type: 'boolean' })
  isDefault: Opt<boolean> = false;

  /** Sort order for display */
  @Property({ type: 'integer' })
  @Index()
  sortOrder: Opt<number> = 0;

  /**
   * Offices where this type is available (many-to-many).
   * Empty collection means type is available in all offices.
   */
  @ManyToMany('Office', undefined, {
    pivotTable: 'document_type_office',
    joinColumn: 'document_type_id',
    inverseJoinColumn: 'office_id',
  })
  offices = new Collection<Office>(this);

  /** Timestamp when the type was created */
  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  /** Timestamp when the type was last updated */
  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Soft delete timestamp */
  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}
