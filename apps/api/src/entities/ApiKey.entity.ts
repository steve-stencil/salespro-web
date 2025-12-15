import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { User } from './User.entity';

/**
 * API key entity for server-to-server authentication.
 * Provides long-lived keys with scoped permissions.
 */
@Entity()
@Index({ properties: ['keyHash'] })
@Index({ properties: ['company'] })
@Index({ properties: ['keyPrefix'] })
export class ApiKey {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  /** Hashed API key */
  @Property({ type: 'string', hidden: true })
  keyHash!: string;

  /** Key prefix for identification (e.g., "sk_live_abc123") */
  @Property({ type: 'string' })
  keyPrefix!: string;

  /** User-defined name for the key */
  @Property({ type: 'string' })
  name!: string;

  @ManyToOne('Company')
  company!: Company;

  @ManyToOne('User')
  createdBy!: User;

  /** Scopes/permissions granted to this key */
  @Property({ type: 'array' })
  scopes: string[] = [];

  @Property({ type: 'Date', nullable: true })
  lastUsedAt?: Date;

  @Property({ type: 'string', nullable: true })
  lastUsedIp?: string;

  /** Optional expiration date */
  @Property({ type: 'Date', nullable: true })
  expiresAt?: Date;

  @Property({ type: 'boolean' })
  isActive: boolean = true;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', nullable: true })
  revokedAt?: Date;

  @Property({ type: 'string', nullable: true })
  revokedBy?: string;

  /**
   * Check if key has expired
   */
  get isExpired(): boolean {
    if (!this.expiresAt) return false;
    return this.expiresAt < new Date();
  }

  /**
   * Check if key is valid (active, not revoked, not expired)
   */
  get isValid(): boolean {
    return this.isActive && !this.revokedAt && !this.isExpired;
  }
}
