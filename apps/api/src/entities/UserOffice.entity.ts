import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
  Unique,
  Opt,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Office } from './Office.entity';
import type { User } from './User.entity';

/**
 * UserOffice entity for managing user-office access.
 * This is a join table that defines which offices a user can access.
 * Users can have access to multiple offices but only one "current office"
 * which determines what data they see in the mobile app.
 */
@Entity()
@Unique({ properties: ['user', 'office'] })
export class UserOffice {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /** The user being granted office access */
  @ManyToOne('User')
  @Index()
  user!: User;

  /** The office the user has access to */
  @ManyToOne('Office')
  @Index()
  office!: Office;

  /** When this office access was granted */
  @Property({ type: 'Date' })
  assignedAt: Opt<Date> = new Date();

  /** The admin user who granted this access (null if system-assigned) */
  @ManyToOne('User', { nullable: true })
  assignedBy?: User;
}
