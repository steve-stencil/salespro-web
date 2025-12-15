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
 * OAuth token entity for issued access and refresh tokens.
 * Tokens are hashed for security, with prefixes stored for identification.
 * Supports refresh token rotation with family tracking.
 */
@Entity()
@Index({ properties: ['accessTokenHash'] })
@Index({ properties: ['refreshTokenHash'] })
@Index({ properties: ['refreshTokenFamily'] })
export class OAuthToken {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  /** Hashed access token */
  @Property({ type: 'string', hidden: true })
  accessTokenHash!: string;

  /** First 8 characters of access token for identification */
  @Property({ type: 'string' })
  accessTokenPrefix!: string;

  @Property({ type: 'Date' })
  accessTokenExpiresAt!: Date;

  /** Hashed refresh token */
  @Property({ type: 'string', nullable: true, hidden: true })
  refreshTokenHash?: string;

  /** First 8 characters of refresh token for identification */
  @Property({ type: 'string', nullable: true })
  refreshTokenPrefix?: string;

  @Property({ type: 'Date', nullable: true })
  refreshTokenExpiresAt?: Date;

  /** Links all rotated tokens in a family for security tracking */
  @Property({ type: 'string', nullable: true })
  refreshTokenFamily?: string;

  /** Points to the new token after rotation */
  @Property({ type: 'string', nullable: true })
  replacedByTokenId?: string;

  @Property({ type: 'Date', nullable: true })
  revokedAt?: Date;

  /** Reason for revocation: user_logout, rotation, suspicious_reuse, etc. */
  @Property({ type: 'string', nullable: true })
  revokedReason?: string;

  @Property({ type: 'array' })
  scope: string[] = [];

  @ManyToOne('OAuthClient')
  client!: OAuthClient;

  @ManyToOne('User')
  user!: User;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  /**
   * Check if access token has expired
   */
  get isAccessTokenExpired(): boolean {
    return this.accessTokenExpiresAt < new Date();
  }

  /**
   * Check if refresh token has expired
   */
  get isRefreshTokenExpired(): boolean {
    if (!this.refreshTokenExpiresAt) return true;
    return this.refreshTokenExpiresAt < new Date();
  }

  /**
   * Check if token is revoked
   */
  get isRevoked(): boolean {
    return this.revokedAt != null;
  }
}
