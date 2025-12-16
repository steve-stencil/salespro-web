import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Index,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import { RoleType, CompanyAccessLevel } from './types';

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
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

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
  type: RoleType = RoleType.COMPANY;

  /**
   * For PLATFORM roles: defines the access level within any company.
   * - FULL: SuperUser-level access (can do everything)
   * - READ_ONLY: Can view all data but cannot modify
   * - CUSTOM: Uses specific permissions defined in this role
   *
   * Only applicable for roles with type=PLATFORM. Null for other role types.
   */
  @Enum({ items: () => CompanyAccessLevel, nullable: true })
  companyAccessLevel?: CompanyAccessLevel;

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
  permissions: string[] = [];

  /**
   * If true, this role is automatically assigned to new users
   * in the company (or all companies for system roles).
   */
  @Property({ type: 'boolean' })
  isDefault: boolean = false;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  /**
   * Check if this is a system role (cannot be deleted/modified)
   */
  get isSystemRole(): boolean {
    return this.type === RoleType.SYSTEM;
  }

  /**
   * Check if this is a platform role (for internal users)
   */
  get isPlatformRole(): boolean {
    return this.type === RoleType.PLATFORM;
  }
}
