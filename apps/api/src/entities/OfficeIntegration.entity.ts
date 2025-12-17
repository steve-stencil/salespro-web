import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Unique,
  Opt,
  OptionalProps,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Office } from './Office.entity';

/**
 * Office integration entity for flexible third-party integration credentials.
 *
 * Uses a key-value pattern to support arbitrary integrations without migrations:
 * - integrationKey identifies the integration (e.g., 'salesforce', 'hubspot', 'stripe')
 * - encryptedCredentials stores AES-256-GCM encrypted JSON credentials
 * - config stores non-sensitive configuration data
 *
 * Each office can have multiple integrations, but only one of each type.
 */
@Entity()
@Unique({ properties: ['office', 'integrationKey'] })
export class OfficeIntegration {
  /** Computed properties excluded from RequiredEntityData */
  [OptionalProps]?: 'hasCredentials';

  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Parent office this integration belongs to */
  @ManyToOne('Office')
  @Index()
  office!: Office;

  /**
   * Integration identifier (e.g., 'salesforce', 'hubspot', 'stripe').
   * Used to uniquely identify the integration type for an office.
   */
  @Property({ type: 'string', length: 100 })
  @Index()
  integrationKey!: string;

  /** Display name for the integration (e.g., 'Salesforce CRM') */
  @Property({ type: 'string', length: 255 })
  displayName!: string;

  /**
   * AES-256-GCM encrypted credentials JSON.
   * Format: {iv}:{authTag}:{encrypted} (all base64)
   * Contains sensitive data like API keys, tokens, secrets.
   */
  @Property({ type: 'text', nullable: true })
  encryptedCredentials?: string;

  /**
   * KMS-encrypted data key used to encrypt the credentials.
   * This key is decrypted by KMS to get the plaintext key for AES decryption.
   * Stored as base64-encoded ciphertext blob from KMS.
   */
  @Property({ type: 'text', nullable: true })
  encryptedDataKey?: string;

  /**
   * Non-sensitive configuration (unencrypted).
   * Contains settings like instance URLs, feature flags, etc.
   */
  @Property({ type: 'json', nullable: true })
  config?: Record<string, unknown>;

  /** Whether this integration is enabled */
  @Property({ type: 'boolean' })
  isEnabled: Opt<boolean> = true;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /**
   * Check if this integration has credentials stored.
   */
  get hasCredentials(): boolean {
    return this.encryptedCredentials != null;
  }
}
