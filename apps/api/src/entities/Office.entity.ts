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
 * Office entity representing a branch/location within a Company.
 *
 * Offices provide organizational hierarchy for:
 * - Grouping users by location
 * - Office-specific settings and configurations
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

  /** Address line 1 */
  @Property({ type: 'string', nullable: true })
  address1?: string;

  /** Address line 2 */
  @Property({ type: 'string', nullable: true })
  address2?: string;

  /** City */
  @Property({ type: 'string', nullable: true })
  city?: string;

  /** State/Province */
  @Property({ type: 'string', nullable: true })
  state?: string;

  /** ZIP/Postal code */
  @Property({ type: 'string', nullable: true })
  postalCode?: string;

  /** Country */
  @Property({ type: 'string', nullable: true })
  country?: string;

  /** Phone number */
  @Property({ type: 'string', nullable: true })
  phone?: string;

  /** Email address */
  @Property({ type: 'string', nullable: true })
  email?: string;

  /** Whether this office is active */
  @Property({ type: 'boolean' })
  isActive: boolean = true;

  /**
   * Office-specific settings stored as JSON.
   * Can include timezone, business hours, etc.
   */
  @Property({ type: 'json', nullable: true })
  settings?: Record<string, unknown>;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  /**
   * Get full address as a formatted string
   */
  get fullAddress(): string {
    const parts = [
      this.address1,
      this.address2,
      this.city,
      this.state,
      this.postalCode,
      this.country,
    ].filter(Boolean);
    return parts.join(', ');
  }
}
