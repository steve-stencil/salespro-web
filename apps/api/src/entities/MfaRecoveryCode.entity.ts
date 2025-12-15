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
 * MFA recovery code entity for backup authentication.
 * Single-use codes that can be used when TOTP is unavailable.
 */
@Entity()
@Index({ properties: ['user'] })
@Index({ properties: ['codeHash'] })
export class MfaRecoveryCode {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  @ManyToOne('User')
  user!: User;

  /** Hashed backup code */
  @Property({ type: 'string', hidden: true })
  codeHash!: string;

  /** When code was used (null if unused) */
  @Property({ type: 'Date', nullable: true })
  usedAt?: Date;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  /**
   * Check if code has been used
   */
  get isUsed(): boolean {
    return this.usedAt != null;
  }
}
