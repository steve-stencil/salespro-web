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
 * Trusted device entity for MFA bypass on known devices.
 * Allows users to skip MFA on devices they've previously verified.
 */
@Entity()
@Index({ properties: ['user'] })
@Index({ properties: ['deviceFingerprint'] })
export class TrustedDevice {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  @ManyToOne('User')
  user!: User;

  /** Hash of device characteristics for identification */
  @Property({ type: 'string' })
  deviceFingerprint!: string;

  /** Human-readable device name (e.g., "Chrome on MacOS") */
  @Property({ type: 'string' })
  deviceName!: string;

  @Property({ type: 'string', nullable: true })
  lastIpAddress?: string;

  @Property({ type: 'Date' })
  lastSeenAt!: Date;

  /** Optional: auto-expire trust after this date */
  @Property({ type: 'Date', nullable: true })
  trustExpiresAt?: Date;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  /**
   * Check if device trust has expired
   */
  get isTrustExpired(): boolean {
    if (!this.trustExpiresAt) return false;
    return this.trustExpiresAt < new Date();
  }
}
