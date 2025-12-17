import {
  Entity,
  PrimaryKey,
  Property,
  OneToOne,
  ManyToOne,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { File } from './File.entity';
import type { Office } from './Office.entity';

/**
 * Office-level settings entity for core office configuration.
 *
 * Stores branding and display settings for an office including:
 * - Office logo (references File entity)
 * - Future: branding colors, custom settings, etc.
 *
 * One-to-one relationship with Office entity.
 */
@Entity()
export class OfficeSettings {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Parent office this settings belongs to */
  @OneToOne('Office', 'settings', { owner: true })
  @Index()
  office!: Office;

  /** Logo file reference (nullable - office may not have a logo) */
  @ManyToOne('File', { nullable: true })
  logoFile?: File;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
