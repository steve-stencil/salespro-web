import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
  Index,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { Company } from './Company.entity';
import type { Role } from './Role.entity';
import type { User } from './User.entity';

/**
 * Junction entity linking Users to Roles within a Company context.
 *
 * This enables:
 * - Multiple roles per user (composable permissions)
 * - Different roles in different companies (multi-tenant)
 * - Audit trail of who assigned the role and when
 *
 * A user's effective permissions are the union of all their roles' permissions.
 */
@Entity()
@Unique({ properties: ['user', 'role', 'company'] })
export class UserRole {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  /** The user being assigned the role */
  @ManyToOne('User')
  @Index()
  user!: User;

  /** The role being assigned */
  @ManyToOne('Role')
  @Index()
  role!: Role;

  /** The company context for this role assignment */
  @ManyToOne('Company')
  @Index()
  company!: Company;

  /** When this role was assigned */
  @Property({ type: 'Date' })
  assignedAt: Date = new Date();

  /** Who assigned this role (null if system-assigned) */
  @ManyToOne('User', { nullable: true })
  assignedBy?: User;
}
