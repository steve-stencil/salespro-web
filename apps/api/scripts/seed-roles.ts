#!/usr/bin/env tsx
/**
 * Role Seeding Script
 *
 * Creates default system roles for the RBAC system.
 * Run with: pnpm --filter api db:seed-roles
 *
 * Options:
 *   --force    Clear existing system roles before seeding
 *
 * This script creates the following system roles:
 *   - superUser: Full access to everything (*)
 *   - admin: Full access to customers, users, offices, roles, settings
 *   - salesRep: Basic access for sales representatives (default for new users)
 */

import 'dotenv/config';

import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

import {
  Role,
  RoleType,
  CompanyAccessLevel,
  Company,
  User,
  Session,
  Office,
  UserOffice,
  UserRole,
} from '../src/entities';
import { PERMISSIONS } from '../src/lib/permissions';

/**
 * Role configuration interface
 */
type RoleConfig = {
  name: string;
  displayName: string;
  description: string;
  type: RoleType;
  isDefault: boolean;
  permissions: string[];
  companyAccessLevel?: CompanyAccessLevel;
};

/**
 * Default system roles configuration
 */
const DEFAULT_ROLES: RoleConfig[] = [
  {
    name: 'superUser',
    displayName: 'Super User',
    description: 'Full system access. Can do everything.',
    type: RoleType.SYSTEM,
    isDefault: false,
    permissions: ['*'], // All permissions
  },
  {
    name: 'admin',
    displayName: 'Administrator',
    description:
      'Company administrator with full access to manage users, roles, and settings.',
    type: RoleType.SYSTEM,
    isDefault: false,
    permissions: [
      'customer:*',
      'user:*',
      'office:*',
      'role:*',
      'settings:*',
      'company:*',
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.REPORT_EXPORT,
    ],
  },
  {
    name: 'salesRep',
    displayName: 'Sales Representative',
    description: 'Standard sales user with access to customers and reports.',
    type: RoleType.SYSTEM,
    isDefault: true, // Auto-assign to new users
    permissions: [
      PERMISSIONS.CUSTOMER_READ,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.OFFICE_READ,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.SETTINGS_READ,
    ],
  },
  {
    name: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access to customers and reports.',
    type: RoleType.SYSTEM,
    isDefault: false,
    permissions: [
      PERMISSIONS.CUSTOMER_READ,
      PERMISSIONS.OFFICE_READ,
      PERMISSIONS.REPORT_READ,
    ],
  },
];

/**
 * Platform roles configuration (for internal users)
 */
const PLATFORM_ROLES: RoleConfig[] = [
  {
    name: 'platformAdmin',
    displayName: 'Platform Administrator',
    description:
      'Full platform access. Can manage all companies and internal users.',
    type: RoleType.PLATFORM,
    isDefault: false,
    companyAccessLevel: CompanyAccessLevel.FULL,
    permissions: [
      PERMISSIONS.PLATFORM_ADMIN,
      PERMISSIONS.PLATFORM_VIEW_COMPANIES,
      PERMISSIONS.PLATFORM_SWITCH_COMPANY,
      PERMISSIONS.PLATFORM_VIEW_AUDIT_LOGS,
      PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS,
    ],
  },
  {
    name: 'platformSupport',
    displayName: 'Platform Support',
    description:
      'Read-only access to all companies for customer support purposes.',
    type: RoleType.PLATFORM,
    isDefault: false,
    companyAccessLevel: CompanyAccessLevel.READ_ONLY,
    permissions: [
      PERMISSIONS.PLATFORM_VIEW_COMPANIES,
      PERMISSIONS.PLATFORM_SWITCH_COMPANY,
      PERMISSIONS.PLATFORM_VIEW_AUDIT_LOGS,
    ],
  },
  {
    name: 'platformDeveloper',
    displayName: 'Platform Developer',
    description: 'Developer access with read permissions across companies.',
    type: RoleType.PLATFORM,
    isDefault: false,
    companyAccessLevel: CompanyAccessLevel.CUSTOM,
    permissions: [
      PERMISSIONS.PLATFORM_VIEW_COMPANIES,
      PERMISSIONS.PLATFORM_SWITCH_COMPANY,
      // Custom company permissions (read-only)
      PERMISSIONS.CUSTOMER_READ,
      PERMISSIONS.USER_READ,
      PERMISSIONS.OFFICE_READ,
      PERMISSIONS.ROLE_READ,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.REPORT_READ,
    ],
  },
];

/** Color codes for console output */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
} as const;

/**
 * Log a message with a colored prefix
 */
function log(
  message: string,
  type: 'info' | 'success' | 'warn' | 'error' = 'info',
): void {
  const prefixes = {
    info: `${colors.cyan}[INFO]${colors.reset}`,
    success: `${colors.green}[SUCCESS]${colors.reset}`,
    warn: `${colors.yellow}[WARN]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
  };
  console.log(`${prefixes[type]} ${message}`);
}

/**
 * Get database configuration
 */
function getORMConfig(): Parameters<typeof MikroORM.init<PostgreSqlDriver>>[0] {
  const databaseUrl =
    process.env['DATABASE_URL'] ??
    'postgresql://postgres:postgres@localhost:5432/salespro_dev';

  return {
    clientUrl: databaseUrl,
    driver: PostgreSqlDriver,
    entities: [Role, Company, User, Session, Office, UserOffice, UserRole],
    debug: false,
    allowGlobalContext: true,
  };
}

/**
 * Check if system or platform roles already exist
 */
async function checkExistingRoles(orm: MikroORM): Promise<Role[]> {
  const em = orm.em.fork();
  return em.find(Role, {
    type: { $in: [RoleType.SYSTEM, RoleType.PLATFORM] },
  });
}

/**
 * Clear existing system and platform roles
 */
async function clearSystemRoles(orm: MikroORM): Promise<void> {
  const em = orm.em.fork();
  const existingRoles = await em.find(Role, {
    type: { $in: [RoleType.SYSTEM, RoleType.PLATFORM] },
  });

  if (existingRoles.length > 0) {
    for (const role of existingRoles) {
      em.remove(role);
      log(`Removed existing role: ${role.name} (${role.type})`, 'warn');
    }
    await em.flush();
  }
}

/**
 * Create or update roles from a config array
 */
async function seedRolesFromConfig(
  orm: MikroORM,
  roleConfigs: RoleConfig[],
): Promise<Role[]> {
  const em = orm.em.fork();
  const createdRoles: Role[] = [];

  for (const roleConfig of roleConfigs) {
    // Check if role already exists
    let role = await em.findOne(Role, {
      name: roleConfig.name,
      type: roleConfig.type,
    });

    if (role) {
      // Update existing role
      role.displayName = roleConfig.displayName;
      role.description = roleConfig.description;
      role.permissions = roleConfig.permissions;
      role.isDefault = roleConfig.isDefault;
      if (roleConfig.companyAccessLevel !== undefined) {
        role.companyAccessLevel = roleConfig.companyAccessLevel;
      }
      log(`Updated existing role: ${role.name} (${role.type})`, 'info');
    } else {
      // Create new role
      role = new Role();
      role.name = roleConfig.name;
      role.displayName = roleConfig.displayName;
      role.description = roleConfig.description;
      role.type = roleConfig.type;
      role.permissions = roleConfig.permissions;
      role.isDefault = roleConfig.isDefault;
      if (roleConfig.companyAccessLevel !== undefined) {
        role.companyAccessLevel = roleConfig.companyAccessLevel;
      }
      // role.company is undefined by default for system/platform roles
      em.persist(role);
      log(`Created new role: ${role.name} (${role.type})`, 'success');
    }

    createdRoles.push(role);
  }

  await em.flush();
  return createdRoles;
}

/**
 * Create or update all system and platform roles
 */
async function seedRoles(orm: MikroORM): Promise<Role[]> {
  // Seed system roles
  log('Seeding system roles...', 'info');
  const systemRoles = await seedRolesFromConfig(orm, DEFAULT_ROLES);

  // Seed platform roles
  log('Seeding platform roles...', 'info');
  const platformRoles = await seedRolesFromConfig(orm, PLATFORM_ROLES);

  return [...systemRoles, ...platformRoles];
}

/**
 * Print summary of seeded roles
 */
function printSummary(roles: Role[]): void {
  const systemRoles = roles.filter(r => r.type === RoleType.SYSTEM);
  const platformRoles = roles.filter(r => r.type === RoleType.PLATFORM);

  console.log('');
  console.log(
    `${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.green}  ROLES SEEDED SUCCESSFULLY!${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log('');

  // Print system roles
  if (systemRoles.length > 0) {
    console.log(
      `${colors.bright}System Roles (for company users):${colors.reset}`,
    );
    console.log('');
    for (const role of systemRoles) {
      const defaultTag = role.isDefault
        ? ` ${colors.yellow}[DEFAULT]${colors.reset}`
        : '';
      console.log(
        `${colors.cyan}${role.displayName}${colors.reset}${defaultTag}`,
      );
      console.log(`  Name: ${role.name}`);
      console.log(`  Description: ${role.description ?? 'N/A'}`);
      console.log(`  Permissions: ${role.permissions.length} permission(s)`);
      if (role.permissions.length <= 5) {
        console.log(`    ${role.permissions.join(', ')}`);
      } else {
        console.log(`    ${role.permissions.slice(0, 5).join(', ')}...`);
      }
      console.log('');
    }
  }

  // Print platform roles
  if (platformRoles.length > 0) {
    console.log(
      `${colors.bright}Platform Roles (for internal users):${colors.reset}`,
    );
    console.log('');
    for (const role of platformRoles) {
      console.log(`${colors.cyan}${role.displayName}${colors.reset}`);
      console.log(`  Name: ${role.name}`);
      console.log(`  Description: ${role.description ?? 'N/A'}`);
      console.log(`  Company Access: ${role.companyAccessLevel ?? 'N/A'}`);
      console.log(`  Permissions: ${role.permissions.length} permission(s)`);
      if (role.permissions.length <= 5) {
        console.log(`    ${role.permissions.join(', ')}`);
      } else {
        console.log(`    ${role.permissions.slice(0, 5).join(', ')}...`);
      }
      console.log('');
    }
  }
}

/**
 * Main seeding function
 */
async function seedRolesMain(): Promise<void> {
  const forceFlag = process.argv.includes('--force');

  log('Starting role seeding...', 'info');
  log(
    `Database: ${process.env['DATABASE_URL'] ?? 'using default URL'}`,
    'info',
  );

  let orm: MikroORM | null = null;

  try {
    // Initialize ORM
    orm = await MikroORM.init<PostgreSqlDriver>(getORMConfig());
    log('Database connection established', 'success');

    // Check for existing roles
    const existingRoles = await checkExistingRoles(orm);

    if (existingRoles.length > 0) {
      if (forceFlag) {
        log('Force flag detected, clearing existing system roles...', 'warn');
        await clearSystemRoles(orm);
      } else {
        log(`Found ${existingRoles.length} existing system role(s)`, 'info');
        log('Roles will be updated in place (use --force to recreate)', 'info');
      }
    }

    // Seed roles
    const roles = await seedRoles(orm);

    // Print summary
    printSummary(roles);
  } catch (error) {
    log(
      `Role seeding failed: ${error instanceof Error ? error.message : String(error)}`,
      'error',
    );
    throw error;
  } finally {
    if (orm) {
      await orm.close();
      log('Database connection closed', 'info');
    }
  }
}

// Run the seed script
seedRolesMain()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Fatal error during role seeding:', error);
    process.exit(1);
  });
