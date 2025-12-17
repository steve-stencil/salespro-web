import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Collection,
  OneToMany,
  Enum,
  Opt,
  OptionalProps,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { UserType } from './types';

import type { Company } from './Company.entity';
import type { Office } from './Office.entity';
import type { Session } from './Session.entity';
import type { UserOffice } from './UserOffice.entity';

/**
 * User entity for authentication and profile management.
 * Contains auth fields (password, lockout, MFA) and company association.
 */
@Entity()
export class User {
  /** Computed properties excluded from RequiredEntityData */
  [OptionalProps]?: 'isLocked' | 'fullName';
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  @Property({ type: 'string' })
  @Index()
  email!: string;

  @Property({ type: 'string', hidden: true })
  passwordHash!: string;

  @Property({ type: 'string', nullable: true })
  nameFirst?: string;

  @Property({ type: 'string', nullable: true })
  nameLast?: string;

  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  @Property({ type: 'boolean' })
  needsResetPassword: Opt<boolean> = false;

  @Property({ type: 'Date', nullable: true })
  lastLoginDate?: Date;

  /**
   * Type of user - company (regular) or internal (platform) user.
   * Internal users can switch between companies.
   */
  @Enum(() => UserType)
  userType: Opt<UserType> = UserType.COMPANY;

  /**
   * Company the user belongs to.
   * Required for company users, optional for internal users.
   */
  @ManyToOne('Company', { nullable: true })
  company?: Company;

  /**
   * The office the user is currently working in.
   * This determines what data the user sees in the mobile app.
   * Must be one of the user's allowed offices (in officeAccess).
   */
  @ManyToOne('Office', { nullable: true })
  currentOffice?: Office;

  /**
   * Collection of offices the user has access to.
   * Managed through the UserOffice join entity.
   */
  @OneToMany('UserOffice', 'user')
  officeAccess = new Collection<UserOffice>(this);

  /** Per-user session limit (overrides company default if set) */
  @Property({ type: 'integer' })
  maxSessions: Opt<number> = 2;

  // Lockout fields
  @Property({ type: 'integer' })
  failedLoginAttempts: Opt<number> = 0;

  @Property({ type: 'Date', nullable: true })
  lockedUntil?: Date;

  @Property({ type: 'Date', nullable: true })
  lastFailedLoginAt?: Date;

  // Email verification
  @Property({ type: 'boolean' })
  emailVerified: Opt<boolean> = false;

  @Property({ type: 'Date', nullable: true })
  emailVerifiedAt?: Date;

  /** Force re-auth for sessions created before this timestamp */
  @Property({ type: 'Date', nullable: true })
  forceLogoutAt?: Date;

  // MFA fields
  @Property({ type: 'boolean' })
  mfaEnabled: Opt<boolean> = false;

  /** TOTP secret (encrypted at rest) */
  @Property({ type: 'string', nullable: true, hidden: true })
  mfaSecret?: string;

  @Property({ type: 'Date', nullable: true })
  mfaEnabledAt?: Date;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  @OneToMany('Session', 'user')
  sessions = new Collection<Session>(this);

  /**
   * Check if the user account is currently locked
   */
  get isLocked(): boolean {
    if (!this.lockedUntil) return false;
    return this.lockedUntil > new Date();
  }

  /**
   * Get user's full name
   */
  get fullName(): string {
    const parts = [this.nameFirst, this.nameLast].filter(Boolean);
    return parts.join(' ') || this.email;
  }
}
