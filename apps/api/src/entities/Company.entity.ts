import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  Collection,
  OneToMany,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import {
  SubscriptionTier,
  SessionLimitStrategy,
  DEFAULT_PASSWORD_POLICY,
} from './types';

import type { PasswordPolicy } from './types';
import type { User } from './User.entity';

/**
 * Company entity representing a tenant in the multi-tenant SaaS system.
 * Contains subscription info, session limits, and security policies.
 */
@Entity()
export class Company {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  @Property({ type: 'string' })
  name!: string;

  /** Maximum number of paid user seats */
  @Property({ type: 'integer' })
  maxSeats: Opt<number> = 5;

  /** Default session limit per user (inherited by users) */
  @Property({ type: 'integer' })
  maxSessionsPerUser: Opt<number> = 2;

  @Enum(() => SubscriptionTier)
  tier: Opt<SubscriptionTier> = SubscriptionTier.FREE;

  /** Strategy for handling concurrent session limits */
  @Enum(() => SessionLimitStrategy)
  sessionLimitStrategy: Opt<SessionLimitStrategy> =
    SessionLimitStrategy.REVOKE_OLDEST;

  /** Company-configurable password policy */
  @Property({ type: 'json' })
  passwordPolicy: Opt<PasswordPolicy> = { ...DEFAULT_PASSWORD_POLICY };

  /** Require MFA for all users in this company */
  @Property({ type: 'boolean' })
  mfaRequired: Opt<boolean> = false;

  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  @OneToMany('User', 'company')
  users = new Collection<User>(this);
}
