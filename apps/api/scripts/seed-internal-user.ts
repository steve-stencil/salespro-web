#!/usr/bin/env tsx
/**
 * Internal Platform User Seeding Script
 *
 * Creates an internal platform user with a company, office, and platform admin role.
 * Run with: pnpm --filter api db:seed-internal-user
 *
 * Options:
 *   --force              Clear existing internal user data before seeding
 *   --email <email>      Set internal user email (or use SEED_INTERNAL_EMAIL env var)
 *   --password <pass>    Set internal user password (or use SEED_INTERNAL_PASSWORD env var)
 *
 * Environment Variables:
 *   SEED_INTERNAL_EMAIL     Internal user email (default: platform@salespro.dev)
 *   SEED_INTERNAL_PASSWORD  Internal user password (default: PlatformAdmin123!)
 *
 * Examples:
 *   pnpm db:seed-internal-user --email admin@platform.dev --password SecurePass123!
 *   SEED_INTERNAL_EMAIL=admin@platform.dev pnpm db:seed-internal-user
 */

import 'dotenv/config';

import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

import {
  Company,
  User,
  Session,
  Office,
  UserOffice,
  Role,
  UserRole,
  SubscriptionTier,
  SessionLimitStrategy,
  DEFAULT_PASSWORD_POLICY,
  RoleType,
  UserType,
  CompanyAccessLevel,
} from '../src/entities';
import { hashPassword } from '../src/lib/crypto';
import { PERMISSIONS } from '../src/lib/permissions';

/**
 * Parse command line arguments for --email and --password
 */
function parseCliArgs(): {
  email: string | undefined;
  password: string | undefined;
} {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let password: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1];
      i++; // Skip next arg
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1];
      i++; // Skip next arg
    }
  }

  return { email, password };
}

/**
 * Get seed configuration with CLI args and env vars taking precedence
 */
function getSeedConfig(): {
  company: {
    name: string;
    maxSeats: number;
    maxSessionsPerUser: number;
    tier: SubscriptionTier;
    sessionLimitStrategy: SessionLimitStrategy;
    mfaRequired: boolean;
  };
  office: {
    name: string;
  };
  user: {
    email: string;
    password: string;
    nameFirst: string;
    nameLast: string;
    emailVerified: boolean;
    maxSessions: number;
  };
} {
  const cliArgs = parseCliArgs();

  // Priority: CLI args > Environment variables > Defaults
  const email =
    cliArgs.email ??
    process.env['SEED_INTERNAL_EMAIL'] ??
    'platform@salespro.dev';

  const password =
    cliArgs.password ??
    process.env['SEED_INTERNAL_PASSWORD'] ??
    'PlatformAdmin123!';

  return {
    company: {
      name: 'Platform Operations',
      maxSeats: 100,
      maxSessionsPerUser: 10,
      tier: SubscriptionTier.ENTERPRISE,
      sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
      mfaRequired: false,
    },
    office: {
      name: 'Platform HQ',
    },
    user: {
      email,
      password,
      nameFirst: 'Platform',
      nameLast: 'Admin',
      emailVerified: true,
      maxSessions: 10,
    },
  };
}

/** Color codes for console output */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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
 * Get database configuration for seeding
 */
function getORMConfig(): Parameters<typeof MikroORM.init<PostgreSqlDriver>>[0] {
  const databaseUrl =
    process.env['DATABASE_URL'] ??
    'postgresql://postgres:postgres@localhost:5432/salespro_dev';

  return {
    clientUrl: databaseUrl,
    driver: PostgreSqlDriver,
    entities: [Company, User, Session, Office, UserOffice, Role, UserRole],
    debug: false,
    allowGlobalContext: true,
  };
}

/**
 * Check if seed data already exists
 */
async function checkExistingData(
  orm: MikroORM,
  seedConfig: ReturnType<typeof getSeedConfig>,
): Promise<{
  company: Company | null;
  user: User | null;
  office: Office | null;
}> {
  const em = orm.em.fork();

  const company = await em.findOne(Company, {
    name: seedConfig.company.name,
  });

  const user = await em.findOne(User, {
    email: seedConfig.user.email,
  });

  const office = company
    ? await em.findOne(Office, {
        name: seedConfig.office.name,
        company: company.id,
      })
    : null;

  return { company, user, office };
}

/**
 * Clear existing seed data
 */
async function clearSeedData(
  orm: MikroORM,
  seedConfig: ReturnType<typeof getSeedConfig>,
): Promise<void> {
  const em = orm.em.fork();

  // Find the seed user
  const user = await em.findOne(User, { email: seedConfig.user.email });
  if (user) {
    // Remove user role assignments
    await em.nativeDelete(UserRole, { user: user.id });
    // Remove user office assignments
    await em.nativeDelete(UserOffice, { user: user.id });
    // Remove sessions
    await em.nativeDelete(Session, { user: user.id });
    // Remove user
    em.remove(user);
    log(`Removed existing user: ${user.email}`, 'warn');
  }

  // Find and remove company and office
  const company = await em.findOne(Company, { name: seedConfig.company.name });
  if (company) {
    // Remove offices first
    const offices = await em.find(Office, { company: company.id });
    for (const office of offices) {
      em.remove(office);
      log(`Removed existing office: ${office.name}`, 'warn');
    }
    em.remove(company);
    log(`Removed existing company: ${company.name}`, 'warn');
  }

  await em.flush();
}

/**
 * Create the seed company
 */
async function createCompany(
  orm: MikroORM,
  seedConfig: ReturnType<typeof getSeedConfig>,
): Promise<Company> {
  const em = orm.em.fork();

  const company = new Company();
  company.name = seedConfig.company.name;
  company.maxSeats = seedConfig.company.maxSeats;
  company.maxSessionsPerUser = seedConfig.company.maxSessionsPerUser;
  company.tier = seedConfig.company.tier;
  company.sessionLimitStrategy = seedConfig.company.sessionLimitStrategy;
  company.passwordPolicy = { ...DEFAULT_PASSWORD_POLICY };
  company.mfaRequired = seedConfig.company.mfaRequired;
  company.isActive = true;

  await em.persistAndFlush(company);
  return company;
}

/**
 * Create the seed office
 */
async function createOffice(
  orm: MikroORM,
  company: Company,
  seedConfig: ReturnType<typeof getSeedConfig>,
): Promise<Office> {
  const em = orm.em.fork();

  const companyRef = em.getReference(Company, company.id);

  const office = new Office();
  office.name = seedConfig.office.name;
  office.company = companyRef;
  office.isActive = true;

  await em.persistAndFlush(office);
  return office;
}

/**
 * Get or create the platform admin role
 */
async function getOrCreatePlatformAdminRole(orm: MikroORM): Promise<Role> {
  const em = orm.em.fork();

  // Check if platform admin role already exists
  let role = await em.findOne(Role, {
    name: 'platformAdmin',
    type: RoleType.PLATFORM,
  });

  if (!role) {
    // Create the platform admin role
    role = new Role();
    role.name = 'platformAdmin';
    role.displayName = 'Platform Administrator';
    role.description =
      'Full platform access. Can manage all companies and internal users.';
    role.type = RoleType.PLATFORM;
    role.companyAccessLevel = CompanyAccessLevel.FULL;
    role.permissions = [
      PERMISSIONS.PLATFORM_ADMIN,
      PERMISSIONS.PLATFORM_VIEW_COMPANIES,
      PERMISSIONS.PLATFORM_SWITCH_COMPANY,
      PERMISSIONS.PLATFORM_VIEW_AUDIT_LOGS,
      PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS,
    ];
    role.isDefault = false;

    await em.persistAndFlush(role);
    log('Created platformAdmin role', 'success');
  } else {
    log('Found existing platformAdmin role', 'info');
  }

  return role;
}

/**
 * Create the seed internal platform user
 */
async function createInternalUser(
  orm: MikroORM,
  company: Company,
  seedConfig: ReturnType<typeof getSeedConfig>,
): Promise<User> {
  const em = orm.em.fork();

  const companyRef = em.getReference(Company, company.id);
  const passwordHash = await hashPassword(seedConfig.user.password);

  const user = new User();
  user.email = seedConfig.user.email;
  user.passwordHash = passwordHash;
  user.nameFirst = seedConfig.user.nameFirst;
  user.nameLast = seedConfig.user.nameLast;
  user.company = companyRef;
  user.isActive = true;
  user.emailVerified = seedConfig.user.emailVerified;
  user.maxSessions = seedConfig.user.maxSessions;
  user.mfaEnabled = false;
  user.needsResetPassword = false;
  user.failedLoginAttempts = 0;
  user.userType = UserType.INTERNAL; // This makes the user a platform user!

  await em.persistAndFlush(user);
  return user;
}

/**
 * Assign platform role to user
 */
async function assignPlatformRole(
  orm: MikroORM,
  user: User,
  role: Role,
): Promise<UserRole> {
  const em = orm.em.fork();

  const userRef = em.getReference(User, user.id);
  const roleRef = em.getReference(Role, role.id);

  const userRole = new UserRole();
  userRole.user = userRef;
  userRole.role = roleRef;
  // Note: company is null for platform role assignments
  userRole.assignedAt = new Date();

  await em.persistAndFlush(userRole);
  return userRole;
}

/**
 * Get or create the admin system role (for company-level access)
 */
async function getOrCreateAdminRole(orm: MikroORM): Promise<Role> {
  const em = orm.em.fork();

  // Check if admin role already exists
  let role = await em.findOne(Role, {
    name: 'admin',
    type: RoleType.SYSTEM,
  });

  if (!role) {
    // Create the admin role with full company permissions
    role = new Role();
    role.name = 'admin';
    role.displayName = 'Administrator';
    role.description =
      'Company administrator with full access to manage users, roles, and settings.';
    role.type = RoleType.SYSTEM;
    role.permissions = [
      'customer:*',
      'user:*',
      'office:*',
      'role:*',
      'settings:*',
      'company:*',
      'report:read',
      'report:export',
    ];
    role.isDefault = false;

    await em.persistAndFlush(role);
    log('Created admin system role', 'success');
  } else {
    log('Found existing admin system role', 'info');
  }

  return role;
}

/**
 * Assign company role to user (with company context)
 */
async function assignCompanyRole(
  orm: MikroORM,
  user: User,
  role: Role,
  company: Company,
): Promise<UserRole> {
  const em = orm.em.fork();

  const userRef = em.getReference(User, user.id);
  const roleRef = em.getReference(Role, role.id);
  const companyRef = em.getReference(Company, company.id);

  const userRole = new UserRole();
  userRole.user = userRef;
  userRole.role = roleRef;
  userRole.company = companyRef; // Company context for company-level roles
  userRole.assignedAt = new Date();

  await em.persistAndFlush(userRole);
  return userRole;
}

/**
 * Assign user to office
 */
async function assignUserToOffice(
  orm: MikroORM,
  user: User,
  office: Office,
): Promise<UserOffice> {
  const em = orm.em.fork();

  const userRef = em.getReference(User, user.id);
  const officeRef = em.getReference(Office, office.id);

  const userOffice = new UserOffice();
  userOffice.user = userRef;
  userOffice.office = officeRef;
  userOffice.assignedAt = new Date();

  await em.persistAndFlush(userOffice);
  return userOffice;
}

/**
 * Print seed summary
 */
function printSummary(
  company: Company,
  office: Office,
  user: User,
  platformRole: Role,
  adminRole: Role,
  seedConfig: ReturnType<typeof getSeedConfig>,
): void {
  console.log('');
  console.log(
    `${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.magenta}  INTERNAL PLATFORM USER SEEDED SUCCESSFULLY!${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log('');
  console.log(`${colors.cyan}Company:${colors.reset}`);
  console.log(`  Name: ${company.name}`);
  console.log(`  Tier: ${company.tier}`);
  console.log(`  ID: ${company.id}`);
  console.log('');
  console.log(`${colors.cyan}Office:${colors.reset}`);
  console.log(`  Name: ${office.name}`);
  console.log(`  ID: ${office.id}`);
  console.log('');
  console.log(`${colors.cyan}Assigned Roles:${colors.reset}`);
  console.log('');
  console.log(
    `  ${colors.green}1. Platform Role (for platform operations):${colors.reset}`,
  );
  console.log(`     Name: ${platformRole.displayName}`);
  console.log(`     Type: ${platformRole.type}`);
  console.log(`     Access Level: ${platformRole.companyAccessLevel}`);
  console.log(
    `     Permissions: ${platformRole.permissions.length} permission(s)`,
  );
  console.log('');
  console.log(
    `  ${colors.green}2. Company Role (for company-level access):${colors.reset}`,
  );
  console.log(`     Name: ${adminRole.displayName}`);
  console.log(`     Type: ${adminRole.type}`);
  console.log(
    `     Permissions: ${adminRole.permissions.length} permission(s)`,
  );
  console.log('');
  console.log(`${colors.cyan}Internal Platform User:${colors.reset}`);
  console.log(
    `  Email: ${colors.bright}${seedConfig.user.email}${colors.reset}`,
  );
  console.log(
    `  Password: ${colors.bright}${seedConfig.user.password}${colors.reset}`,
  );
  console.log(`  Name: ${user.nameFirst} ${user.nameLast}`);
  console.log(
    `  User Type: ${colors.magenta}${user.userType}${colors.reset} (Platform User)`,
  );
  console.log(`  ID: ${user.id}`);
  console.log('');
  console.log(
    `${colors.green}✓ This user can now view and manage Platform Roles!${colors.reset}`,
  );
  console.log('');
  console.log(
    `${colors.yellow}⚠️  Remember to change the default password in production!${colors.reset}`,
  );
  console.log('');
}

/**
 * Main seeding function
 */
async function seed(): Promise<void> {
  const forceFlag = process.argv.includes('--force');
  const seedConfig = getSeedConfig();

  log('Starting internal platform user seeding...', 'info');
  log(
    `Database: ${process.env['DATABASE_URL'] ?? 'using default URL'}`,
    'info',
  );
  log(`Internal User Email: ${seedConfig.user.email}`, 'info');

  let orm: MikroORM | null = null;

  try {
    // Initialize ORM
    orm = await MikroORM.init<PostgreSqlDriver>(getORMConfig());
    log('Database connection established', 'success');

    // Check for existing data
    const existing = await checkExistingData(orm, seedConfig);

    if (existing.company || existing.user) {
      if (forceFlag) {
        log('Force flag detected, clearing existing seed data...', 'warn');
        await clearSeedData(orm, seedConfig);
      } else {
        if (existing.company) {
          log(`Company "${seedConfig.company.name}" already exists`, 'warn');
        }
        if (existing.user) {
          log(`User "${seedConfig.user.email}" already exists`, 'warn');
        }
        log('Use --force flag to clear existing data and reseed', 'info');
        log('Seeding skipped - data already exists', 'warn');
        return;
      }
    }

    // Get or create platform admin role
    log('Setting up platform admin role...', 'info');
    const platformRole = await getOrCreatePlatformAdminRole(orm);

    // Get or create admin system role (for company-level access)
    log('Setting up admin system role...', 'info');
    const adminRole = await getOrCreateAdminRole(orm);

    // Create company
    log('Creating platform company...', 'info');
    const company = await createCompany(orm, seedConfig);
    log(`Company created: ${company.name}`, 'success');

    // Create office
    log('Creating office...', 'info');
    const office = await createOffice(orm, company, seedConfig);
    log(`Office created: ${office.name}`, 'success');

    // Create internal platform user
    log('Creating internal platform user...', 'info');
    const user = await createInternalUser(orm, company, seedConfig);
    log(`Internal user created: ${user.email}`, 'success');

    // Assign platform role to user (for platform operations)
    log('Assigning platform admin role...', 'info');
    await assignPlatformRole(orm, user, platformRole);
    log('Platform role assigned', 'success');

    // Assign admin role to user within their company (for company-level access)
    log('Assigning admin role for company access...', 'info');
    await assignCompanyRole(orm, user, adminRole, company);
    log('Admin role assigned for company', 'success');

    // Assign user to office
    log('Assigning user to office...', 'info');
    await assignUserToOffice(orm, user, office);
    log('User assigned to office', 'success');

    // Print summary
    printSummary(company, office, user, platformRole, adminRole, seedConfig);
  } catch (error) {
    log(
      `Seeding failed: ${error instanceof Error ? error.message : String(error)}`,
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
seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  });
