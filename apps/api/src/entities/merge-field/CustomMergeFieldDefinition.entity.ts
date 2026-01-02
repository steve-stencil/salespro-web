import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Enum,
  Unique,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { MergeFieldDataType } from './types';

import type { Company } from '../Company.entity';
import type { User } from '../User.entity';
import type { MsiCustomMergeField } from './MsiCustomMergeField.entity';
import type { OptionCustomMergeField } from './OptionCustomMergeField.entity';
import type { UpChargeCustomMergeField } from './UpChargeCustomMergeField.entity';

/**
 * CustomMergeFieldDefinition entity - per-company custom field library.
 *
 * Companies can create custom merge fields like {{custom.frameColor}} that
 * can be linked to MSIs, Options, or UpCharges with per-entity default values.
 *
 * This is the "definition" in the library - the actual values come from
 * junction tables (MsiCustomMergeField, etc.).
 *
 * @example
 * ```typescript
 * // Custom fields appear in templates as:
 * // {{custom.frameColor}}, {{custom.warrantyYears}}, etc.
 * ```
 */
@Entity()
@Unique({ properties: ['company', 'key'] })
@Index({ properties: ['company', 'isActive'] })
export class CustomMergeFieldDefinition {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Multi-tenant isolation - company that owns this field definition */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /**
   * Unique key per company, e.g., "frameColor"
   * Rendered as: {{custom.frameColor}}
   */
  @Property({ type: 'string', length: 100 })
  key!: string;

  /** Human-readable name for UI display */
  @Property({ type: 'string', length: 255 })
  displayName!: string;

  /** Help text explaining what this field is for */
  @Property({ type: 'text', nullable: true })
  description?: string;

  /** Data type - controls formatting when rendered */
  @Enum(() => MergeFieldDataType)
  dataType: Opt<MergeFieldDataType> = MergeFieldDataType.TEXT;

  /** Soft delete flag */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  /** Legacy placeholder string for migration tracking (e.g., "%colorCode%") */
  @Property({ type: 'string', nullable: true })
  @Index()
  sourceId?: string;

  /** User who last modified this field */
  @ManyToOne('User', { nullable: true })
  lastModifiedBy?: User;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** MSIs using this field */
  @OneToMany('MsiCustomMergeField', 'fieldDefinition')
  msiUsages = new Collection<MsiCustomMergeField>(this);

  /** Options using this field */
  @OneToMany('OptionCustomMergeField', 'fieldDefinition')
  optionUsages = new Collection<OptionCustomMergeField>(this);

  /** UpCharges using this field */
  @OneToMany('UpChargeCustomMergeField', 'fieldDefinition')
  upChargeUsages = new Collection<UpChargeCustomMergeField>(this);
}
