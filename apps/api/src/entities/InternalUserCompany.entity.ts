import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { User } from './User.entity';

/**
 * Junction entity restricting which companies internal users can access.
 *
 * By default, internal users have access to all companies. This entity
 * allows platform admins to restrict specific internal users to only
 * certain companies for security or organizational purposes.
 *
 * If an internal user has ANY InternalUserCompany records, they can ONLY
 * access those specific companies. If they have NO records, they have
 * unrestricted access (legacy behavior).
 *
 * This enables:
 * - Regional support staff restricted to specific customer companies
 * - Partner access limited to their client companies
 * - Audit trail of who granted access
 */
@Entity()
@Unique({ properties: ['user', 'company'] })
export class InternalUserCompany {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The internal user being granted restricted access */
  @ManyToOne('User')
  @Index()
  user!: User;

  /** The company this internal user can access */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /**
   * User-controlled favorite flag for quick access in the company switcher.
   * Pinned companies appear in a dedicated section.
   */
  @Property({ type: 'boolean' })
  isPinned: Opt<boolean> = false;

  /** When access was granted to this company */
  @Property({ type: 'Date' })
  grantedAt: Opt<Date> = new Date();

  /**
   * Last time the internal user switched to this company.
   * Used for "Recent" section in company switcher.
   */
  @Property({ type: 'Date', nullable: true })
  @Index()
  lastAccessedAt?: Date;

  /** Platform admin who granted this access (for audit trail) */
  @ManyToOne('User', { nullable: true })
  grantedBy?: User;
}
