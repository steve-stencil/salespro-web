import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Collection,
  OneToMany,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { Session } from './Session.entity';

/**
 * User entity for authentication and profile management.
 * Contains auth fields (password, lockout, MFA) and company association.
 */
@Entity()
export class User {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

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
  isActive: boolean = true;

  @Property({ type: 'boolean' })
  needsResetPassword: boolean = false;

  @Property({ type: 'Date', nullable: true })
  lastLoginDate?: Date;

  @ManyToOne('Company')
  company!: Company;

  /** Per-user session limit (overrides company default if set) */
  @Property({ type: 'integer' })
  maxSessions: number = 2;

  // Lockout fields
  @Property({ type: 'integer' })
  failedLoginAttempts: number = 0;

  @Property({ type: 'Date', nullable: true })
  lockedUntil?: Date;

  @Property({ type: 'Date', nullable: true })
  lastFailedLoginAt?: Date;

  // Email verification
  @Property({ type: 'boolean' })
  emailVerified: boolean = false;

  @Property({ type: 'Date', nullable: true })
  emailVerifiedAt?: Date;

  /** Force re-auth for sessions created before this timestamp */
  @Property({ type: 'Date', nullable: true })
  forceLogoutAt?: Date;

  // MFA fields
  @Property({ type: 'boolean' })
  mfaEnabled: boolean = false;

  /** TOTP secret (encrypted at rest) */
  @Property({ type: 'string', nullable: true, hidden: true })
  mfaSecret?: string;

  @Property({ type: 'Date', nullable: true })
  mfaEnabledAt?: Date;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

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
