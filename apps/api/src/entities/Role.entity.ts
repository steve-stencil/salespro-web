import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Index,
  Opt,
  OptionalProps,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { RoleType } from './types';

import type { Company } from './Company.entity';

/**
 * Role entity for the RBAC system.
 * Roles contain a collection of permissions stored as a string array.
 * Users can have multiple roles through the UserRole junction entity.
 *
 * System roles (type=SYSTEM) are built-in and cannot be deleted.
 * Company roles (type=COMPANY) are created by company admins.
 */
@Entity()
export class Role {
  /** Computed properties excluded from RequiredEntityData */
  [OptionalProps]?: 'isSystemRole' | 'isPlatformRole';
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  /**
   * Unique identifier for the role (e.g., 'salesRep', 'admin').
   * System roles have globally unique names.
   * Company roles must be unique within their company.
   */
  @Property({ type: 'string' })
  @Index()
  name!: string;

  /** Human-readable name for display (e.g., 'Sales Representative') */
  @Property({ type: 'string' })
  displayName!: string;

  /** Optional description of what this role is for */
  @Property({ type: 'string', nullable: true })
  description?: string;

  @Enum(() => RoleType)
  type: Opt<RoleType> = RoleType.COMPANY;

  /**
   * For PLATFORM roles: explicit permissions when switched into any company.
   * Supports wildcards: '*' (all), 'resource:*' (all actions for resource)
   * @example ['*'] for full access, or ['customer:read', 'user:read'] for limited access
   *
   * Only applicable for roles with type=PLATFORM. Empty array for other role types.
   */
  @Property({ type: 'json' })
  companyPermissions: Opt<string[]> = [];

  /**
   * Company this role belongs to.
   * Null for system-wide roles that are available to all companies.
   */
  @ManyToOne('Company', { nullable: true })
  @Index()
  company?: Company;

  /**
   * Array of permission strings.
   * Supports wildcards: '*' (all), 'resource:*' (all actions for resource)
   * @example ['customer:read', 'customer:create', 'report:*']
   */
  @Property({ type: 'json' })
  permissions: Opt<string[]> = [];

  /**
   * If true, this role is automatically assigned to new users
   * in the company (or all companies for system roles).
   */
  @Property({ type: 'boolean' })
  isDefault: Opt<boolean> = false;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  /**
   * Check if this is a system role (cannot be deleted/modified)
   */
  get isSystemRole(): boolean {
    return (this.type as RoleType) === RoleType.SYSTEM;
  }

  /**
   * Check if this is a platform role (for internal users)
   */
  get isPlatformRole(): boolean {
    return (this.type as RoleType) === RoleType.PLATFORM;
  }
}
