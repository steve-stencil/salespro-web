import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Enum,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { Office } from './Office.entity';
import type { User } from './User.entity';

/**
 * Status of a document draft.
 */
export enum DocumentDraftStatus {
  /** Draft is being created/edited */
  DRAFT = 'draft',
  /** Draft is ready for rendering/signing */
  READY = 'ready',
  /** Draft has been sent for signature */
  SENT = 'sent',
  /** Draft has been completed/signed */
  COMPLETED = 'completed',
  /** Draft was cancelled/abandoned */
  CANCELLED = 'cancelled',
}

/**
 * A selected template within a draft.
 * Tracks which templates were selected and with what page counts.
 */
export type DraftSelectedTemplate = {
  /** Template ID */
  templateId: string;
  /** Order in the document */
  order: number;
  /** Number of pages for multi-page templates */
  pageCount: number;
};

/**
 * User-entered values for a cell.
 * Keyed by cellId in the values JSON.
 */
export type DraftCellValue = {
  /** The cell ID */
  cellId: string;
  /** The user-entered value (string, number, array, etc.) */
  value: unknown;
  /** Timestamp when the value was last modified */
  modifiedAt?: string;
};

/**
 * Values storage structure for a draft.
 * Maps cellId -> value for all user-entered data.
 */
export type DraftValuesJson = {
  /** Values keyed by cellId */
  values: Record<string, DraftCellValue>;
  /** Photos attached to the draft */
  photos?: {
    /** Cell ID the photo belongs to */
    cellId: string;
    /** File ID of the photo */
    fileId: string;
    /** Order in the cell */
    order: number;
  }[];
  /** Signatures captured for the draft */
  signatures?: {
    /** Signature field ID */
    fieldId: string;
    /** File ID of the signature image */
    fileId: string;
    /** Signer name */
    signerName?: string;
    /** Timestamp when signed */
    signedAt?: string;
  }[];
  /** Initials captured for the draft */
  initials?: {
    /** Initials field ID */
    fieldId: string;
    /** File ID of the initials image */
    fileId: string;
  }[];
};

/**
 * Customer information attached to a draft.
 */
export type DraftCustomerInfo = {
  /** Customer ID (if from CRM) */
  customerId?: string;
  /** Customer name */
  name?: string;
  /** Customer email */
  email?: string;
  /** Customer phone */
  phone?: string;
  /** Customer address */
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
};

/**
 * DocumentDraft entity for storing user-entered values and draft state.
 *
 * Templates are read-only, but users need drafts to:
 * - Track which templates they've selected
 * - Store user-entered values from form filling
 * - Store photos, signatures, and initials
 * - Track draft status through the workflow
 *
 * @see readonlytemplatesschema_08cb2e06.plan.md for rationale
 */
@Entity()
export class DocumentDraft {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Reference to the company */
  @ManyToOne('Company', { nullable: false })
  @Index()
  company!: Company;

  /** Reference to the office */
  @ManyToOne('Office', { nullable: true })
  @Index()
  office?: Office;

  /** User who created/owns this draft */
  @ManyToOne('User', { nullable: false })
  @Index()
  createdBy!: User;

  /** External estimate/job ID this draft is associated with */
  @Property({ type: 'string', nullable: true })
  @Index()
  estimateId?: string;

  /** Draft status */
  @Enum(() => DocumentDraftStatus)
  @Index()
  status: Opt<DocumentDraftStatus> = DocumentDraftStatus.DRAFT;

  /** Display name for the draft (auto-generated or user-specified) */
  @Property({ type: 'string', nullable: true })
  name?: string;

  /**
   * Selected templates with their order and page counts.
   * Array of { templateId, order, pageCount }.
   */
  @Property({ type: 'json' })
  selectedTemplates: Opt<DraftSelectedTemplate[]> = [];

  /**
   * User-entered values, photos, signatures, and initials.
   * Stored as JSONB for flexibility.
   */
  @Property({ type: 'json' })
  valuesJson: Opt<DraftValuesJson> = { values: {} };

  /**
   * Customer information for placeholder replacement.
   */
  @Property({ type: 'json', nullable: true })
  customerInfo?: DraftCustomerInfo;

  /**
   * Metadata for tracking and auditing.
   */
  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  /** Timestamp when the draft was created */
  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  /** Timestamp when the draft was last updated */
  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Timestamp when the draft was soft deleted */
  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;

  /** Timestamp when the draft was sent for signature */
  @Property({ type: 'Date', nullable: true })
  sentAt?: Date;

  /** Timestamp when the draft was completed */
  @Property({ type: 'Date', nullable: true })
  completedAt?: Date;
}
