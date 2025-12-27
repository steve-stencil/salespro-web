import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Index,
  Enum,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { AdditionalDetailInputType, AdditionalDetailCellType } from './types';

import type {
  SizePickerConfig,
  UnitedInchConfig,
  PhotoFieldConfig,
} from './types';
import type { Company } from '../Company.entity';
import type { User } from '../User.entity';
import type { MeasureSheetItemAdditionalDetailField } from './MeasureSheetItemAdditionalDetailField.entity';
import type { UpChargeAdditionalDetailField } from './UpChargeAdditionalDetailField.entity';

/**
 * AdditionalDetailField entity - shared custom input fields library.
 * Can be linked to MSIs or UpCharges via junction tables.
 * Uses optimistic locking via version field for concurrent edit protection.
 * linkedMsiCount and linkedUpChargeCount are maintained via PostgreSQL database triggers.
 */
@Entity()
@Index({ properties: ['company', 'isActive'] })
@Index({ properties: ['company', 'title'] })
export class AdditionalDetailField {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Multi-tenant isolation - company that owns this field */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** Field label */
  @Property({ type: 'string', length: 255 })
  title!: string;

  /**
   * Input type - controls the input control used for data entry.
   * Also implies display size (textarea = expanded, others = compact).
   */
  @Enum(() => AdditionalDetailInputType)
  inputType!: AdditionalDetailInputType;

  /**
   * Cell type - controls how the value is displayed in lists/tables.
   * text=render as text, photos=render as photo thumbnails
   */
  @Enum({ items: () => AdditionalDetailCellType, nullable: true })
  cellType?: AdditionalDetailCellType;

  /** Input placeholder text */
  @Property({ type: 'string', nullable: true })
  placeholder?: string;

  /** Helper text for the field */
  @Property({ type: 'string', nullable: true })
  note?: string;

  /** Default value for the field */
  @Property({ type: 'string', nullable: true })
  defaultValue?: string;

  /** Whether the field is required */
  @Property({ type: 'boolean' })
  isRequired: Opt<boolean> = false;

  /** Legacy field - whether to copy value */
  @Property({ type: 'boolean' })
  shouldCopy: Opt<boolean> = false;

  /** Picker options for PICKER input type */
  @Property({ type: 'json', nullable: true })
  pickerValues?: string[];

  /** Configuration for SIZE_PICKER and SIZE_PICKER_3D input types */
  @Property({ type: 'json', nullable: true })
  sizePickerConfig?: SizePickerConfig;

  /** Configuration for UNITED_INCH input type */
  @Property({ type: 'json', nullable: true })
  unitedInchConfig?: UnitedInchConfig;

  /** Configuration for PHOTOS cell type */
  @Property({ type: 'json', nullable: true })
  photoConfig?: PhotoFieldConfig;

  /** Allow decimal input for NUMBER and CURRENCY input types */
  @Property({ type: 'boolean' })
  allowDecimal: Opt<boolean> = false;

  /** Display format for DATE, TIME, DATETIME input types (e.g., "MM/dd/yyyy") */
  @Property({ type: 'string', nullable: true })
  dateDisplayFormat?: string;

  /** Placeholder text shown when field value is empty/not added */
  @Property({ type: 'string', nullable: true })
  notAddedReplacement?: string;

  /**
   * Denormalized count of linked MSIs.
   * Updated automatically via PostgreSQL trigger on MeasureSheetItemAdditionalDetailField.
   */
  @Property({ type: 'integer' })
  linkedMsiCount: Opt<number> = 0;

  /**
   * Denormalized count of linked UpCharges.
   * Updated automatically via PostgreSQL trigger on UpChargeAdditionalDetailField.
   */
  @Property({ type: 'integer' })
  linkedUpChargeCount: Opt<number> = 0;

  /** Legacy objectId for migration tracking */
  @Property({ type: 'string', nullable: true })
  @Index()
  sourceId?: string;

  /** Soft delete flag - false means item is deleted (90-day retention) */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  /** Optimistic locking version - incremented on each update */
  @Property({ type: 'integer', version: true })
  version: Opt<number> = 1;

  /** User who last modified this field */
  @ManyToOne('User', { nullable: true })
  lastModifiedBy?: User;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** MSI links via junction table */
  @OneToMany('MeasureSheetItemAdditionalDetailField', 'additionalDetailField')
  msiLinks = new Collection<MeasureSheetItemAdditionalDetailField>(this);

  /** UpCharge links via junction table */
  @OneToMany('UpChargeAdditionalDetailField', 'additionalDetailField')
  upChargeLinks = new Collection<UpChargeAdditionalDetailField>(this);
}
