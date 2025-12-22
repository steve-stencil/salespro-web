import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  ManyToMany,
  Collection,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { DocumentTemplateCategory } from './DocumentTemplateCategory.entity';
import type { File } from './File.entity';
import type { Office } from './Office.entity';

/**
 * Raw iOS/Parse documentData structure.
 * Stored as JSONB - see plan for full schema description.
 */
export type DocumentDataJson = {
  objectId?: string;
  groupType: 'header' | 'body' | 'footer';
  data: unknown[];
}[];

/**
 * Raw iOS/Parse images array structure.
 */
export type ImagesJson = {
  __type?: string;
  name?: string;
  url?: string;
}[];

/**
 * DocumentTemplate entity for read-only template storage.
 *
 * Templates are ingested via ETL from the source system (iOS/Parse).
 * The payload fields (document_data_json, images_json) are stored as JSONB
 * to preserve the original structure for runtime form rendering.
 *
 * @see readonlytemplatesschema_08cb2e06.plan.md for full schema rationale
 */
@Entity()
export class DocumentTemplate {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Reference to the company that owns this template */
  @ManyToOne('Company', { nullable: false })
  @Index()
  company!: Company;

  /** Original objectId from Parse/iOS for traceability */
  @Property({ type: 'string', nullable: true })
  @Index()
  sourceTemplateId?: string;

  // --- Catalog fields (indexed for fast filtering) ---

  /** Template type: contract, proposal, etc. */
  @Property({ type: 'string' })
  @Index()
  type!: string;

  /** Page identifier: singlePage, pdfPage, etc. */
  @Property({ type: 'string' })
  @Index()
  pageId!: string;

  /** Category for grouping in selection UI (many templates -> one category) */
  @ManyToOne('DocumentTemplateCategory', { nullable: false })
  @Index()
  category!: DocumentTemplateCategory;

  /** Display name shown in the UI */
  @Property({ type: 'string' })
  displayName!: string;

  /** Sort order within category */
  @Property({ type: 'integer' })
  @Index()
  sortOrder!: number;

  /** Whether multiple pages can be added */
  @Property({ type: 'boolean' })
  canAddMultiplePages: Opt<boolean> = false;

  /** Whether this is a template (vs imported document) */
  @Property({ type: 'boolean' })
  isTemplate: Opt<boolean> = false;

  // --- State/Office filtering ---

  /** States where this template is available. ['ALL'] means all states. */
  @Property({ type: 'array', default: ['ALL'] })
  @Index({ type: 'GIN' })
  includedStates: Opt<string[]> = ['ALL'];

  /** States where this template is NOT available */
  @Property({ type: 'array', default: [] })
  @Index({ type: 'GIN' })
  excludedStates: Opt<string[]> = [];

  /**
   * Offices where this template is available (many-to-many).
   * Empty collection means template is available in all offices.
   */
  @ManyToMany('Office', undefined, {
    pivotTable: 'document_template_office',
    joinColumn: 'document_template_id',
    inverseJoinColumn: 'office_id',
  })
  includedOffices = new Collection<Office>(this);

  // --- Layout fields ---

  /** Page size string in iOS format: "width,height" */
  @Property({ type: 'string' })
  pageSizeStr!: string;

  /** Page width in points */
  @Property({ type: 'integer' })
  pageWidth!: number;

  /** Page height in points */
  @Property({ type: 'integer' })
  pageHeight!: number;

  /** Horizontal margin in points */
  @Property({ type: 'integer' })
  hMargin!: number;

  /** Vertical/width margin in points */
  @Property({ type: 'integer' })
  wMargin!: number;

  /** Number of photos per page for photo templates */
  @Property({ type: 'integer' })
  photosPerPage: Opt<number> = 1;

  // --- Watermark fields ---

  /** Whether watermark is enabled */
  @Property({ type: 'boolean' })
  useWatermark: Opt<boolean> = false;

  /** Watermark width as percentage of page */
  @Property({ type: 'float' })
  watermarkWidthPercent: Opt<number> = 100;

  /** Watermark transparency (0-1) */
  @Property({ type: 'float' })
  watermarkAlpha: Opt<number> = 0.05;

  // --- Asset references (optional File FK) ---

  /** PDF file for pdfPage type templates */
  @ManyToOne('File', { nullable: true })
  pdfFile?: File;

  /** Icon/thumbnail image file */
  @ManyToOne('File', { nullable: true })
  iconFile?: File;

  /** Watermark image file */
  @ManyToOne('File', { nullable: true })
  watermarkFile?: File;

  // --- Payload fields (JSONB) ---

  /**
   * Full documentData structure from iOS.
   * Contains header, body, footer groups with sections and cells.
   */
  @Property({ type: 'json' })
  documentDataJson!: DocumentDataJson;

  /**
   * Images array from iOS.
   * References images used within the template.
   */
  @Property({ type: 'json', nullable: true })
  imagesJson?: ImagesJson;

  /**
   * Icon background color from iOS: [r, g, b, a] format.
   */
  @Property({ type: 'json', nullable: true })
  iconBackgroundColor?: number[];

  // --- Derived fields (computed during ingest for performance) ---

  /** Whether this template contains user input sections */
  @Property({ type: 'boolean' })
  hasUserInput: Opt<boolean> = false;

  /** Count of signature fields in the template */
  @Property({ type: 'integer' })
  signatureFieldCount: Opt<number> = 0;

  /** Count of initials fields in the template */
  @Property({ type: 'integer' })
  initialsFieldCount: Opt<number> = 0;

  // --- Operational fields ---

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Soft delete timestamp */
  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}
