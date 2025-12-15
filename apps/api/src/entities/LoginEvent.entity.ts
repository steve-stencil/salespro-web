import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Index,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { LoginEventType, SessionSource } from './types';

import type { User } from './User.entity';

/**
 * Login event entity for comprehensive audit logging.
 * Tracks all authentication-related events for security and compliance.
 */
@Entity()
@Index({ properties: ['user'] })
@Index({ properties: ['eventType'] })
@Index({ properties: ['createdAt'] })
export class LoginEvent {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  @ManyToOne('User', { nullable: true })
  user?: User;

  @Property({ type: 'string' })
  email!: string;

  @Enum(() => LoginEventType)
  eventType!: LoginEventType;

  @Property({ type: 'string' })
  ipAddress!: string;

  @Property({ type: 'string' })
  userAgent!: string;

  /** GeoIP location (city, country) if available */
  @Property({ type: 'string', nullable: true })
  location?: string;

  @Enum(() => SessionSource)
  source!: SessionSource;

  /** Additional event-specific metadata */
  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();
}
