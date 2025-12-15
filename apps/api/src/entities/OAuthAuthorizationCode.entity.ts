import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { OAuthClient } from './OAuthClient.entity';
import type { User } from './User.entity';

/**
 * OAuth authorization code entity for the authorization code flow.
 * Short-lived, single-use codes exchanged for tokens.
 * Supports PKCE (RFC 7636) for public clients.
 */
@Entity()
@Index({ properties: ['codeHash'] })
export class OAuthAuthorizationCode {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  /** Hashed authorization code */
  @Property({ type: 'string', hidden: true })
  codeHash!: string;

  @Property({ type: 'Date' })
  expiresAt!: Date;

  @Property({ type: 'string' })
  redirectUri!: string;

  @Property({ type: 'array' })
  scope: string[] = [];

  @ManyToOne('OAuthClient')
  client!: OAuthClient;

  @ManyToOne('User')
  user!: User;

  /** PKCE code challenge (RFC 7636) */
  @Property({ type: 'string', nullable: true })
  codeChallenge?: string;

  /** PKCE code challenge method: 'S256' or 'plain' */
  @Property({ type: 'string', nullable: true })
  codeChallengeMethod?: string;

  /** State parameter for CSRF protection */
  @Property({ type: 'string', nullable: true })
  state?: string;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  /** When the code was used (for single-use enforcement) */
  @Property({ type: 'Date', nullable: true })
  usedAt?: Date;

  /**
   * Check if code has expired
   */
  get isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  /**
   * Check if code has already been used
   */
  get isUsed(): boolean {
    return this.usedAt != null;
  }
}
