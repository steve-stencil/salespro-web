import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Index,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { InviteStatus } from './types';

import type { Company } from './Company.entity';
import type { User } from './User.entity';

/**
 * User invite entity for the email invitation system.
 * Allows admins to invite new users to join a company.
 */
@Entity()
@Index({ properties: ['tokenHash'] })
@Index({ properties: ['email'] })
@Index({ properties: ['status'] })
export class UserInvite {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  @Property({ type: 'string' })
  email!: string;

  /** Hashed invite token */
  @Property({ type: 'string', hidden: true })
  tokenHash!: string;

  @ManyToOne('Company')
  company!: Company;

  @ManyToOne('User')
  invitedBy!: User;

  /** Roles to assign when invite is accepted */
  @Property({ type: 'array' })
  roles: string[] = [];

  /** Invite expiration (typically 7 days) */
  @Property({ type: 'Date' })
  expiresAt!: Date;

  @Enum(() => InviteStatus)
  status: InviteStatus = InviteStatus.PENDING;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', nullable: true })
  acceptedAt?: Date;

  /**
   * Check if invite has expired
   */
  get isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  /**
   * Check if invite is still valid (pending and not expired)
   */
  get isValid(): boolean {
    return this.status === InviteStatus.PENDING && !this.isExpired;
  }
}
