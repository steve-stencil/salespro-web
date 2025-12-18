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
 * Junction entity linking Users to Companies for multi-company access.
 *
 * This enables:
 * - Users belonging to multiple companies (e.g., owning multiple subscriptions)
 * - Per-company activation/deactivation by company admins
 * - User-controlled pinned companies for quick access
 * - Tracking of last accessed company for "Recent" functionality
 *
 * Billing note: Each active UserCompany counts as a seat in that company.
 */
@Entity()
@Unique({ properties: ['user', 'company'] })
export class UserCompany {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The user with company access */
  @ManyToOne('User')
  @Index()
  user!: User;

  /** The company the user has access to */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /**
   * Whether the user is active in this company.
   * Company admins can deactivate to remove access without deleting the record.
   * Deactivated memberships don't count toward billing.
   */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  /**
   * User-controlled favorite flag for quick access in the company switcher.
   * Pinned companies appear in a dedicated section.
   */
  @Property({ type: 'boolean' })
  isPinned: Opt<boolean> = false;

  /** When the user first gained access to this company */
  @Property({ type: 'Date' })
  joinedAt: Opt<Date> = new Date();

  /**
   * Last time the user switched to this company.
   * Updated on each company switch, used for "Recent" section in company switcher.
   */
  @Property({ type: 'Date', nullable: true })
  @Index()
  lastAccessedAt?: Date;

  /**
   * When the membership was deactivated.
   * Null if currently active, set when company admin deactivates the user.
   */
  @Property({ type: 'Date', nullable: true })
  deactivatedAt?: Date;

  /** Who deactivated this membership (for audit trail) */
  @ManyToOne('User', { nullable: true })
  deactivatedBy?: User;
}
