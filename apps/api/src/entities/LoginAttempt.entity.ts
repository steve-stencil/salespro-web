import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

/**
 * Login attempt entity for tracking authentication attempts.
 * Used for rate limiting and lockout enforcement.
 * Tracks by email (user may not exist) and IP address.
 */
@Entity()
@Index({ properties: ['email'] })
@Index({ properties: ['ipAddress'] })
@Index({ properties: ['createdAt'] })
export class LoginAttempt {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  /** Email used in login attempt (user may not exist) */
  @Property({ type: 'string' })
  email!: string;

  @Property({ type: 'string' })
  ipAddress!: string;

  @Property({ type: 'boolean' })
  success!: boolean;

  /** Reason for failure: invalid_password, account_locked, inactive, mfa_failed, etc. */
  @Property({ type: 'string', nullable: true })
  failureReason?: string;

  @Property({ type: 'string', nullable: true })
  userAgent?: string;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();
}
