import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToOne,
  OneToMany,
  Collection,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { OfficeIntegration } from './OfficeIntegration.entity';
import type { OfficeSettings } from './OfficeSettings.entity';

/**
 * Office entity representing a named grouping within a Company.
 *
 * Offices provide organizational hierarchy for:
 * - Grouping users by office
 * - Filtering data by office
 */
@Entity()
export class Office {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Office name (e.g., 'Main Office', 'West Coast Branch') */
  @Property({ type: 'string' })
  name!: string;

  /** Parent company */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** Whether this office is active */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Office settings (logo, branding, etc.) */
  @OneToOne('OfficeSettings', 'office', { nullable: true })
  settings?: OfficeSettings;

  /** Third-party integrations for this office */
  @OneToMany('OfficeIntegration', 'office')
  integrations = new Collection<OfficeIntegration>(this);
}
