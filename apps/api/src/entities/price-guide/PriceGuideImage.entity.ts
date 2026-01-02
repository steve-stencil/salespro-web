import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from '../Company.entity';
import type { File } from '../File.entity';
import type { User } from '../User.entity';

/**
 * PriceGuideImage entity - shared product image library.
 * Wraps a File entity and allows images to be reused across multiple MSIs and UpCharges.
 * Uses optimistic locking via version field for concurrent edit protection.
 *
 * MSIs and UpCharges reference this entity via their thumbnailImage FK.
 * linkedMsiCount and linkedUpchargeCount are computed via queries.
 */
@Entity()
@Index({ properties: ['company', 'isActive'] })
@Index({ properties: ['company', 'name'] })
export class PriceGuideImage {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Multi-tenant isolation - company that owns this image */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** Image display name */
  @Property({ type: 'string', length: 255 })
  name!: string;

  /** Optional description */
  @Property({ type: 'text', nullable: true })
  description?: string;

  /**
   * The underlying File entity containing the S3 storage key.
   * File entity handles storage, thumbnails, and presigned URLs.
   */
  @ManyToOne('File')
  @Index()
  file!: File;

  /**
   * Full-text search vector (auto-generated).
   * Searchable by name and description.
   */
  @Property({ type: 'text', nullable: true })
  @Index({ type: 'fulltext' })
  searchVector?: string;

  /** Soft delete flag - false means image is deleted */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  /** Optimistic locking version - incremented on each update */
  @Property({ type: 'integer', version: true })
  version: Opt<number> = 1;

  /** User who last modified this image */
  @ManyToOne('User', { nullable: true })
  lastModifiedBy?: User;

  /** Migration session that created this entity (for rollback support) */
  @Property({ type: 'uuid', nullable: true })
  @Index()
  migrationSessionId?: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
