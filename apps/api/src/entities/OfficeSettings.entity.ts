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

import type { CompanyLogo } from './CompanyLogo.entity';
import type { Office } from './Office.entity';

/**
 * Office-level settings entity for core office configuration.
 *
 * Stores branding and display settings for an office including:
 * - Office logo (references CompanyLogo from the company's library)
 * - Future: branding colors, custom settings, etc.
 *
 * One-to-one relationship with Office entity.
 *
 * Logo inheritance logic:
 * 1. If logo is set, use the selected logo from company library
 * 2. If no logo, fall back to company's default logo
 * 3. If no default logo, show initials
 */
@Entity()
export class OfficeSettings {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Parent office this settings belongs to */
  @OneToOne('Office', 'settings', { owner: true })
  @Index()
  office!: Office;

  /**
   * Selected logo from the company's logo library.
   * If null, the office inherits the company's default logo.
   */
  @ManyToOne('CompanyLogo', { nullable: true })
  logo?: CompanyLogo;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
