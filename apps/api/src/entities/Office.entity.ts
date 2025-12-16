import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';

/**
 * Office entity representing a named grouping within a Company.
 *
 * Offices provide organizational hierarchy for:
 * - Grouping users by office
 * - Filtering data by office
 */
@Entity()
export class Office {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  /** Office name (e.g., 'Main Office', 'West Coast Branch') */
  @Property({ type: 'string' })
  name!: string;

  /** Parent company */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** Whether this office is active */
  @Property({ type: 'boolean' })
  isActive: boolean = true;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
