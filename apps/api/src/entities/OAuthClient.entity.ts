import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Unique,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { OAuthClientType } from './types';

import type { Company } from './Company.entity';
import type { User } from './User.entity';

/**
 * OAuth client entity for registered 3rd party applications.
 * Supports both confidential (server-side) and public (mobile/SPA) clients.
 */
@Entity()
export class OAuthClient {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  @Property({ type: 'string' })
  @Unique()
  clientId!: string;

  /** Hashed client secret (null for public clients) */
  @Property({ type: 'string', nullable: true, hidden: true })
  clientSecretHash?: string;

  @Property({ type: 'array' })
  redirectUris: string[] = [];

  /** Allowed grant types: authorization_code, refresh_token, client_credentials */
  @Property({ type: 'array' })
  grants: string[] = ['authorization_code', 'refresh_token'];

  /** Access token lifetime in seconds */
  @Property({ type: 'integer' })
  accessTokenLifetime: number = 3600; // 1 hour

  /** Refresh token lifetime in seconds */
  @Property({ type: 'integer' })
  refreshTokenLifetime: number = 1209600; // 14 days

  @ManyToOne('User')
  owner!: User;

  @ManyToOne('Company')
  company!: Company;

  @Enum(() => OAuthClientType)
  clientType: OAuthClientType = OAuthClientType.CONFIDENTIAL;

  /** Require PKCE for this client (auto-true for public clients) */
  @Property({ type: 'boolean' })
  requirePkce: boolean = false;

  /** Scopes this client is allowed to request */
  @Property({ type: 'array' })
  allowedScopes: string[] = [];

  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'string', nullable: true })
  description?: string;

  @Property({ type: 'string', nullable: true })
  logoUrl?: string;

  @Property({ type: 'boolean' })
  isActive: boolean = true;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
