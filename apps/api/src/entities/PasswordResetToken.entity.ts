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
 * Password reset token entity for secure password recovery.
 * Tokens are cryptographically random and hashed before storage.
 * Single-use with expiration.
 */
@Entity()
@Index({ properties: ['tokenHash'] })
@Index({ properties: ['user'] })
export class PasswordResetToken {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  /** Hashed token for secure storage */
  @Property({ type: 'string', hidden: true })
  tokenHash!: string;

  @ManyToOne('User')
  user!: User;

  /** Token expiration (typically 1 hour) */
  @Property({ type: 'Date' })
  expiresAt!: Date;

  /** When token was used (null if unused) */
  @Property({ type: 'Date', nullable: true })
  usedAt?: Date;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  /**
   * Check if token has expired
   */
  get isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  /**
   * Check if token has been used
   */
  get isUsed(): boolean {
    return this.usedAt != null;
  }

  /**
   * Check if token is valid (not expired and not used)
   */
  get isValid(): boolean {
    return !this.isExpired && !this.isUsed;
  }
}
