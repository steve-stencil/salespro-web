import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Index,
  Opt,
  OptionalProps,
} from '@mikro-orm/core';

import { SessionSource } from './types';

import type { Company } from './Company.entity';
import type { User } from './User.entity';

/**
 * Session entity for storing user sessions.
 * Supports SaaS multi-device login with source tracking.
 *
 * Note: user, company, and source are nullable because express-session
 * creates the session record before login. These fields are populated
 * by AuthService during the login flow.
 *
 * The sid is a string because express-session generates non-UUID session IDs.
 */
@Entity()
@Index({ properties: ['user', 'source'] })
@Index({ properties: ['user'] })
@Index({ properties: ['company'] })
@Index({ properties: ['expiresAt'] })
@Index({ properties: ['absoluteExpiresAt'] })
export class Session {
  /** Computed properties excluded from RequiredEntityData */
  [OptionalProps]?: 'isExpired';
  /** Session ID from express-session (not UUID format) */
  @PrimaryKey({ type: 'string', length: 64 })
  sid!: string;

  /** Session data stored as JSON */
  @Property({ type: 'json' })
  data: Opt<Record<string, unknown>> = {};

  /** Sliding expiration (extends on activity) */
  @Property({ type: 'Date' })
  expiresAt!: Date;

  /** Hard limit that cannot be extended */
  @Property({ type: 'Date' })
  absoluteExpiresAt!: Date;

  /** User who owns this session (set during login) */
  @ManyToOne('User', { nullable: true })
  user?: User;

  /** Company associated with session (set during login) */
  @ManyToOne('Company', { nullable: true })
  company?: Company;

  /**
   * Active company context for internal users.
   * Internal users can switch between companies; this tracks their current selection.
   * For regular company users, this is not used (their company is fixed).
   */
  @ManyToOne('Company', { nullable: true })
  activeCompany?: Company;

  /** Source platform for session management (set during login) */
  @Enum({ items: () => SessionSource, nullable: true })
  source?: SessionSource;

  /** Optional device fingerprint for identification */
  @Property({ type: 'string', nullable: true })
  deviceId?: string;

  @Property({ type: 'string', nullable: true })
  userAgent?: string;

  @Property({ type: 'string', nullable: true })
  ipAddress?: string;

  /** Original user for masquerade/impersonation sessions */
  @ManyToOne('User', { nullable: true })
  sourceUser?: User;

  /** Whether MFA has been verified for this session */
  @Property({ type: 'boolean' })
  mfaVerified: Opt<boolean> = false;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  lastActivityAt: Opt<Date> = new Date();

  /**
   * Check if session has expired (either sliding or absolute)
   */
  get isExpired(): boolean {
    const now = new Date();
    return this.expiresAt < now || this.absoluteExpiresAt < now;
  }
}
