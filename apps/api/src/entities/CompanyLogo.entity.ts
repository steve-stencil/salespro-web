import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { File } from './File.entity';

/**
 * CompanyLogo entity representing a logo in the company's logo library.
 * Companies can have multiple logos in their library, with one set as the default.
 * Offices can select logos from this library.
 */
@Entity()
export class CompanyLogo {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /**
   * User-friendly name for the logo (e.g., "Main Logo", "Holiday Logo").
   */
  @Property({ type: 'string' })
  name!: string;

  /**
   * Company that owns this logo.
   */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /**
   * The actual file containing the logo image.
   */
  @ManyToOne('File')
  @Index()
  file!: File;

  /**
   * Timestamp when the logo was added to the library.
   */
  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  /**
   * Timestamp when the logo was last updated.
   */
  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
