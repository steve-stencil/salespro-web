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

import type { Company } from './Company.entity';
import type { User } from './User.entity';

/**
 * Type of ETL mapping being performed.
 * Add new values as additional mapping steps are implemented.
 */
export enum EtlMappingType {
  /** Office mapping from source to target */
  OFFICES = 'offices',
  /** Document type mapping from source to target */
  TYPES = 'types',
  /** Category mapping from source to target */
  CATEGORIES = 'categories',
  // Future mapping types:
  // USERS = 'users',
  // PRICE_GUIDES = 'price_guides',
  // MATERIALS = 'materials',
}

/**
 * Status of an ETL mapping session.
 */
export enum EtlMappingSessionStatus {
  /** Session created but not yet completed */
  PENDING = 'pending',
  /** All mappings have been processed */
  COMPLETED = 'completed',
}

/**
 * Action to take for a source item during migration.
 */
export type EtlMappingAction = 'map' | 'create' | 'skip';

/**
 * Base mapping entry structure.
 * Each mapping type may have additional fields in its entries.
 */
export type EtlMappingEntry = {
  /** Source item ID from legacy system */
  sourceId: string;
  /** Source item name/label for display */
  sourceName: string;
  /** Action to take: map to existing, create new, or skip */
  action: EtlMappingAction;
  /** Target item ID if action is 'map' */
  targetId?: string;
  /** Created item ID if action is 'create' (populated after creation) */
  createdId?: string;
};

/**
 * Info about an item that was created during a mapping session.
 */
export type EtlCreatedItem = {
  /** Source ID from legacy system */
  sourceId: string;
  /** Created item ID in new system */
  createdId: string;
  /** Created item name */
  name: string;
};

/**
 * EtlMappingSession entity for tracking ETL mapping operations.
 *
 * This is a generic entity that handles all types of ETL mappings
 * (offices, types, categories, etc.) using a discriminator field.
 *
 * Benefits:
 * - Single entity for all mapping types
 * - Easy to add new mapping types via enum
 * - Consistent patterns across all migration steps
 * - Extensible for future ETL needs
 */
@Entity()
export class EtlMappingSession {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Reference to the company performing the migration */
  @ManyToOne('Company', { nullable: false })
  @Index()
  company!: Company;

  /** User who initiated the mapping */
  @ManyToOne('User', { nullable: false })
  @Index()
  createdBy!: User;

  /** Type of mapping being performed */
  @Enum(() => EtlMappingType)
  @Index()
  mappingType!: EtlMappingType;

  /** Current status of the mapping session */
  @Enum(() => EtlMappingSessionStatus)
  @Index()
  status: Opt<EtlMappingSessionStatus> = EtlMappingSessionStatus.PENDING;

  /**
   * Array of mapping entries.
   * Structure is consistent across types but stored as JSON for flexibility.
   */
  @Property({ type: 'json' })
  mappings: Opt<EtlMappingEntry[]> = [];

  /**
   * Pre-computed resolved mapping (sourceId -> targetId/createdId).
   * This is populated after processing for quick lookups during import.
   */
  @Property({ type: 'json' })
  resolvedMapping: Opt<Record<string, string>> = {};

  /**
   * Items that were created during this session.
   * Useful for showing confirmation to the user.
   */
  @Property({ type: 'json' })
  createdItems: Opt<EtlCreatedItem[]> = [];

  /** Timestamp when the session was created */
  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  /** Timestamp when the session was last updated */
  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Timestamp when the mapping was completed */
  @Property({ type: 'Date', nullable: true })
  completedAt?: Date;

  /**
   * Compute and update the resolved mapping from entries.
   * Call this after processing all mappings.
   */
  computeResolvedMapping(): void {
    const result: Record<string, string> = {};

    for (const entry of this.mappings) {
      if (entry.action === 'skip') {
        continue;
      }

      const resolvedId = entry.createdId ?? entry.targetId;
      if (resolvedId) {
        result[entry.sourceId] = resolvedId;
      }
    }

    this.resolvedMapping = result;
  }

  /**
   * Get source item names indexed by source ID.
   */
  getSourceNames(): Record<string, string> {
    const result: Record<string, string> = {};

    for (const entry of this.mappings) {
      result[entry.sourceId] = entry.sourceName;
    }

    return result;
  }
}

