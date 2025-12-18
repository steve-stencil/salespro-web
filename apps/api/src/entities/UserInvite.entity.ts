import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { InviteStatus } from './types';

import type { Company } from './Company.entity';
import type { Office } from './Office.entity';
import type { User } from './User.entity';

/**
 * User invite entity for the email invitation system.
 * Allows admins to invite new users to join a company.
 * Supports both new user invites (create account) and existing user invites (add to company).
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

  /**
   * Flag indicating this invite is for an existing user to join an additional company.
   * When true, accepting the invite creates a UserCompany record instead of a new User.
   */
  @Property({ type: 'boolean' })
  isExistingUserInvite: Opt<boolean> = false;

  /**
   * Reference to the existing user when isExistingUserInvite is true.
   * Used to validate the correct user is accepting the invite.
   */
  @ManyToOne('User', { nullable: true })
  existingUser?: User;

  /** Roles to assign when invite is accepted */
  @Property({ type: 'array' })
  roles: string[] = [];

  /**
   * The office the user will be assigned to as their current/active office.
   * This determines what data the user sees by default.
   */
  @ManyToOne('Office')
  currentOffice!: Office;

  /**
   * Array of office IDs the user will have access to.
   * The currentOffice must be included in this list.
   */
  @Property({ type: 'array' })
  allowedOffices: string[] = [];

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
