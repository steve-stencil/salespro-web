import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { User } from './User.entity';

/**
 * Remember me token entity for persistent login.
 * Used to automatically create new sessions when the short-lived session expires.
 */
@Entity()
@Index({ properties: ['tokenHash'] })
@Index({ properties: ['user'] })
@Index({ properties: ['expiresAt'] })
export class RememberMeToken {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  /** Hashed token for secure storage */
  @Property({ type: 'string', hidden: true })
  tokenHash!: string;

  /** First characters of token for identification */
  @Property({ type: 'string' })
  tokenPrefix!: string;

  @ManyToOne('User')
  user!: User;

  /** Token expiration (typically 30 days) */
  @Property({ type: 'Date' })
  expiresAt!: Date;

  @Property({ type: 'string', nullable: true })
  deviceFingerprint?: string;

  @Property({ type: 'string', nullable: true })
  userAgent?: string;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', nullable: true })
  lastUsedAt?: Date;

  /**
   * Check if token has expired
   */
  get isExpired(): boolean {
    return this.expiresAt < new Date();
  }
}
