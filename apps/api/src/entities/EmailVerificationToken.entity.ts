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
 * Email verification token entity for validating user email addresses.
 */
@Entity()
@Index({ properties: ['tokenHash'] })
@Index({ properties: ['user'] })
export class EmailVerificationToken {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  /** Hashed verification token */
  @Property({ type: 'string', hidden: true })
  tokenHash!: string;

  @ManyToOne('User')
  user!: User;

  /** Email address being verified (may differ from user's current email) */
  @Property({ type: 'string' })
  email!: string;

  /** Token expiration (typically 24 hours) */
  @Property({ type: 'Date' })
  expiresAt!: Date;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  /**
   * Check if token has expired
   */
  get isExpired(): boolean {
    return this.expiresAt < new Date();
  }
}
