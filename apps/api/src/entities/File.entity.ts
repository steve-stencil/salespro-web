import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Enum,
  Opt,
  OptionalProps,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { FileVisibility, FileStatus } from './types';

import type { Company } from './Company.entity';
import type { User } from './User.entity';

/**
 * File entity for tracking uploaded files and their metadata.
 * Stores file information with company-scoped storage keys.
 */
@Entity()
export class File {
  /** Computed properties excluded from RequiredEntityData */
  [OptionalProps]?: 'isImage' | 'isDeleted' | 'extension';
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** Original filename as uploaded by user */
  @Property({ type: 'string' })
  filename!: string;

  /**
   * Storage key (path) where the file is stored.
   * Format: {companyId}/files/{uuid}.{ext}
   */
  @Property({ type: 'string' })
  @Index()
  storageKey!: string;

  /** MIME type of the file (e.g., 'image/jpeg', 'application/pdf') */
  @Property({ type: 'string' })
  mimeType!: string;

  /** File size in bytes */
  @Property({ type: 'bigint' })
  size!: number;

  /** File visibility for access control */
  @Enum(() => FileVisibility)
  visibility: Opt<FileVisibility> = FileVisibility.COMPANY;

  /** File upload status */
  @Enum(() => FileStatus)
  @Index()
  status: Opt<FileStatus> = FileStatus.ACTIVE;

  /**
   * Company the file belongs to.
   * Also embedded in the storageKey prefix for storage isolation.
   */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** User who uploaded the file */
  @ManyToOne('User')
  @Index()
  uploadedBy!: User;

  /**
   * Storage key for the thumbnail (if the file is an image).
   * Format: {companyId}/thumbnails/{uuid}_thumb.{ext}
   */
  @Property({ type: 'string', nullable: true })
  thumbnailKey?: string;

  /** Optional description of the file */
  @Property({ type: 'string', nullable: true })
  description?: string;

  /** Additional metadata stored as JSON */
  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  /** Timestamp when the file was created */
  @Property({ type: 'Date' })
  @Index()
  createdAt: Opt<Date> = new Date();

  /** Timestamp when the file was last updated */
  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /** Timestamp when the file was soft deleted (null if active) */
  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;

  /**
   * Check if the file is an image based on MIME type.
   */
  get isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  /**
   * Check if the file has been soft deleted.
   */
  get isDeleted(): boolean {
    return (
      (this.status as FileStatus) === FileStatus.DELETED ||
      this.deletedAt != null
    );
  }

  /**
   * Get file extension from the filename.
   */
  get extension(): string {
    const parts = this.filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }
}
