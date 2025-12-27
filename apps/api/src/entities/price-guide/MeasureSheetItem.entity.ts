import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from '../Company.entity';
import type { User } from '../User.entity';
import type { MeasureSheetItemAdditionalDetailField } from './MeasureSheetItemAdditionalDetailField.entity';
import type { MeasureSheetItemOffice } from './MeasureSheetItemOffice.entity';
import type { MeasureSheetItemOption } from './MeasureSheetItemOption.entity';
import type { MeasureSheetItemUpCharge } from './MeasureSheetItemUpCharge.entity';
import type { PriceGuideCategory } from './PriceGuideCategory.entity';

/**
 * MeasureSheetItem entity - the main line item that sales reps add to estimates.
 * Contains product configuration, pricing links, and custom tag fields.
 * Uses optimistic locking via version field for concurrent edit protection.
 */
@Entity()
@Index({ properties: ['company', 'category'] })
@Index({ properties: ['company', 'isActive', 'sortOrder'] })
export class MeasureSheetItem {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Multi-tenant isolation - company that owns this item */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** Leaf category in hierarchy */
  @ManyToOne('PriceGuideCategory')
  category!: PriceGuideCategory;

  /** Item display name */
  @Property({ type: 'string', length: 255 })
  name!: string;

  /** Item description/notes */
  @Property({ type: 'text', nullable: true })
  note?: string;

  /** Measurement type - user-defined string (e.g., "sqft", "linft", "each") */
  @Property({ type: 'string', length: 50 })
  measurementType!: string;

  /** Product thumbnail URL */
  @Property({ type: 'string', nullable: true })
  imageUrl?: string;

  /** Quantity formula identifier */
  @Property({ type: 'string', nullable: true })
  formulaId?: string;

  /** Formula expression for calculating quantity */
  @Property({ type: 'string', nullable: true })
  qtyFormula?: string;

  /** Default quantity */
  @Property({ type: 'decimal', precision: 12, scale: 4 })
  defaultQty: Opt<number> = 1;

  /** Use toggle switch vs quantity input */
  @Property({ type: 'boolean' })
  showSwitch: Opt<boolean> = false;

  /**
   * Fractional index for ordering.
   * Uses decimal to allow inserting items between others without reordering.
   */
  @Property({ type: 'decimal', precision: 18, scale: 8 })
  sortOrder: Opt<number> = 0;

  // Custom tag fields
  /** Custom field: Tag label */
  @Property({ type: 'string', nullable: true })
  tagTitle?: string;

  /** Custom field: Whether tag is required */
  @Property({ type: 'boolean' })
  tagRequired: Opt<boolean> = false;

  /** Custom field: Picker options array */
  @Property({ type: 'json', nullable: true })
  tagPickerOptions?: unknown[];

  /** Custom field: Additional tag parameters */
  @Property({ type: 'json', nullable: true })
  tagParams?: Record<string, unknown>;

  /**
   * Full-text search vector (auto-generated).
   * Searchable by name, note, category name, and linked option names.
   * Generated via PostgreSQL tsvector.
   */
  @Property({ type: 'text', nullable: true })
  @Index({ type: 'fulltext' })
  searchVector?: string;

  /** Legacy SSMeasureSheetItem objectId for migration tracking */
  @Property({ type: 'string', nullable: true })
  @Index()
  sourceId?: string;

  /** Soft delete flag - false means item is deleted */
  @Property({ type: 'boolean' })
  isActive: Opt<boolean> = true;

  /** Optimistic locking version - incremented on each update */
  @Property({ type: 'integer', version: true })
  version: Opt<number> = 1;

  /** User who last modified this item */
  @ManyToOne('User', { nullable: true })
  lastModifiedBy?: User;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Office visibility - which offices can see this item */
  @OneToMany('MeasureSheetItemOffice', 'measureSheetItem')
  offices = new Collection<MeasureSheetItemOffice>(this);

  /** Linked options from shared library */
  @OneToMany('MeasureSheetItemOption', 'measureSheetItem')
  options = new Collection<MeasureSheetItemOption>(this);

  /** Linked upcharges from shared library */
  @OneToMany('MeasureSheetItemUpCharge', 'measureSheetItem')
  upCharges = new Collection<MeasureSheetItemUpCharge>(this);

  /** Linked additional detail fields from shared library */
  @OneToMany('MeasureSheetItemAdditionalDetailField', 'measureSheetItem')
  additionalDetailFields =
    new Collection<MeasureSheetItemAdditionalDetailField>(this);
}
