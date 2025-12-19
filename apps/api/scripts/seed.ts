#!/usr/bin/env tsx
/**
 * Database Seeding Script
 *
 * Creates initial database records for development and testing.
 * Run with: pnpm --filter api db:seed
 *
 * Options:
 *   --force              Clear existing seed data before seeding
 *   --email <email>      Set admin user email (or use SEED_ADMIN_EMAIL env var)
 *   --password <pass>    Set admin user password (or use SEED_ADMIN_PASSWORD env var)
 *   --offices <n>        Number of offices for primary company (default: 1)
 *   --users <n>          Number of additional users for primary company (default: 0)
 *   --roles <n>          Number of additional custom roles for primary company (default: 0)
 *
 * Environment Variables:
 *   SEED_ADMIN_EMAIL     Admin user email (default: admin@salespro.dev)
 *   SEED_ADMIN_PASSWORD  Admin user password (default: SalesProAdmin123!)
 *   SEED_OFFICES         Number of offices for primary company (default: 1)
 *   SEED_USERS           Number of additional users for primary company (default: 0)
 *   SEED_ROLES           Number of additional custom roles for primary company (default: 0)
 *
 * Examples:
 *   pnpm db:seed --email user@example.com --password MySecurePass123!
 *   pnpm db:seed --offices 5 --users 20 --roles 3
 *   SEED_ADMIN_EMAIL=user@example.com SEED_ADMIN_PASSWORD=pass pnpm db:seed
 */

import 'dotenv/config';

import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

import {
  Company,
  User,
  Session,
  Role,
  UserRole,
  Office,
  UserOffice,
  UserCompany,
  File,
  OfficeSettings,
  OfficeIntegration,
  SubscriptionTier,
  SessionLimitStrategy,
  DEFAULT_PASSWORD_POLICY,
  RoleType,
  UserType,
} from '../src/entities';
import { hashPassword } from '../src/lib/crypto';
import { PERMISSIONS } from '../src/lib/permissions';

/** Sample first and last names for generating seed users */
const SAMPLE_NAMES = {
  first: [
    'James',
    'Mary',
    'Robert',
    'Patricia',
    'Michael',
    'Jennifer',
    'David',
    'Linda',
    'William',
    'Elizabeth',
    'Richard',
    'Barbara',
    'Joseph',
    'Susan',
    'Thomas',
    'Jessica',
    'Christopher',
    'Sarah',
    'Daniel',
    'Karen',
    'Matthew',
    'Lisa',
    'Anthony',
    'Nancy',
  ],
  last: [
    'Smith',
    'Johnson',
    'Williams',
    'Brown',
    'Jones',
    'Garcia',
    'Miller',
    'Davis',
    'Rodriguez',
    'Martinez',
    'Hernandez',
    'Lopez',
    'Gonzalez',
    'Wilson',
    'Anderson',
    'Thomas',
    'Taylor',
    'Moore',
    'Jackson',
    'Martin',
    'Lee',
    'Perez',
    'Thompson',
    'White',
  ],
};

/** Sample permission sets for custom roles */
const SAMPLE_ROLE_CONFIGS = [
  {
    name: 'sales_rep',
    displayName: 'Sales Representative',
    permissions: ['customer:read', 'customer:create', 'customer:update'],
  },
  {
    name: 'sales_manager',
    displayName: 'Sales Manager',
    permissions: ['customer:*', 'report:read', 'report:export'],
  },
  {
    name: 'support',
    displayName: 'Support Staff',
    permissions: ['customer:read', 'customer:update'],
  },
  {
    name: 'analyst',
    displayName: 'Data Analyst',
    permissions: ['report:read', 'report:export', 'customer:read'],
  },
  {
    name: 'office_manager',
    displayName: 'Office Manager',
    permissions: ['office:read', 'office:update', 'user:read'],
  },
  {
    name: 'hr_admin',
    displayName: 'HR Administrator',
    permissions: ['user:read', 'user:create', 'user:update'],
  },
  {
    name: 'viewer',
    displayName: 'Read-Only User',
    permissions: ['customer:read', 'report:read'],
  },
];

/** Seed counts configuration for primary company */
type SeedCounts = {
  offices: number;
  users: number;
  roles: number;
};

/**
 * Parse command line arguments for seeding options
 */
function parseCliArgs(): {
  email: string | undefined;
  password: string | undefined;
  offices: number | undefined;
  users: number | undefined;
  roles: number | undefined;
} {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let password: string | undefined;
  let offices: number | undefined;
  let users: number | undefined;
  let roles: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1];
      i++;
    } else if (args[i] === '--offices' && args[i + 1]) {
      offices = Math.max(1, parseInt(args[i + 1]!, 10) || 1);
      i++;
    } else if (args[i] === '--users' && args[i + 1]) {
      users = Math.max(0, parseInt(args[i + 1]!, 10) || 0);
      i++;
    } else if (args[i] === '--roles' && args[i + 1]) {
      roles = Math.max(0, parseInt(args[i + 1]!, 10) || 0);
      i++;
    }
  }

  return { email, password, offices, users, roles };
}

/** Company configuration type */
type CompanyConfig = {
  name: string;
  maxSeats: number;
  maxSessionsPerUser: number;
  tier: SubscriptionTier;
  sessionLimitStrategy: SessionLimitStrategy;
  mfaRequired: boolean;
  /** Number of offices to create for this company */
  officeCount: number;
  /** Default office names (will generate more if officeCount exceeds this) */
  defaultOfficeNames: string[];
};

/**
 * Get seed configuration with CLI args and env vars taking precedence
 */
function getSeedConfig(): {
  companies: CompanyConfig[];
  user: {
    email: string;
    password: string;
    nameFirst: string;
    nameLast: string;
    emailVerified: boolean;
    maxSessions: number;
  };
  seedCounts: SeedCounts;
} {
  const cliArgs = parseCliArgs();

  // Priority: CLI args > Environment variables > Defaults
  const email =
    cliArgs.email ?? process.env['SEED_ADMIN_EMAIL'] ?? 'admin@salespro.dev';

  const password =
    cliArgs.password ??
    process.env['SEED_ADMIN_PASSWORD'] ??
    'SalesProAdmin123!';

  // Seed counts for primary company
  const primaryOffices =
    cliArgs.offices ??
    (process.env['SEED_OFFICES']
      ? parseInt(process.env['SEED_OFFICES'], 10)
      : 1);
  const primaryUsers =
    cliArgs.users ??
    (process.env['SEED_USERS'] ? parseInt(process.env['SEED_USERS'], 10) : 0);
  const primaryRoles =
    cliArgs.roles ??
    (process.env['SEED_ROLES'] ? parseInt(process.env['SEED_ROLES'], 10) : 0);

  const seedCounts: SeedCounts = {
    offices: Math.max(1, primaryOffices),
    users: Math.max(0, primaryUsers),
    roles: Math.max(0, primaryRoles),
  };

  return {
    // Two companies for multi-company switching demo
    companies: [
      {
        name: 'SalesPro Demo Company',
        maxSeats: Math.max(100, seedCounts.users + 1), // Ensure enough seats
        maxSessionsPerUser: 3,
        tier: SubscriptionTier.PROFESSIONAL,
        sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
        mfaRequired: false,
        officeCount: seedCounts.offices,
        defaultOfficeNames: [
          'Main Office',
          'West Coast',
          'East Coast',
          'Central',
          'Remote',
        ],
      },
      {
        name: 'Acme Corporation',
        maxSeats: 100,
        maxSessionsPerUser: 5,
        tier: SubscriptionTier.ENTERPRISE,
        sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
        mfaRequired: false,
        officeCount: 1, // Secondary company gets 1 office by default
        defaultOfficeNames: ['Headquarters'],
      },
    ],
    user: {
      email,
      password,
      nameFirst: 'Admin',
      nameLast: 'User',
      emailVerified: true,
      maxSessions: 5,
    },
    seedCounts,
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
    entities: [
      Company,
      User,
      Session,
      Role,
      UserRole,
      Office,
      UserOffice,
      UserCompany,
      File,
      OfficeSettings,
      OfficeIntegration,
    ],
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
): Promise<{ companies: Company[]; user: User | null }> {
  const em = orm.em.fork();

  const companyNames = seedConfig.companies.map(c => c.name);
  const companies = await em.find(Company, {
    name: { $in: companyNames },
  });

  const user = await em.findOne(User, {
    email: seedConfig.user.email,
  });

  return { companies, user };
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
    // Remove user office assignments first
    await em.nativeDelete(UserOffice, { user: user.id });
    log('Removed user office assignments', 'warn');

    // Remove user role assignments (FK constraint)
    await em.nativeDelete(UserRole, { user: user.id });
    log('Removed user role assignments', 'warn');

    // Remove user company memberships
    await em.nativeDelete(UserCompany, { user: user.id });
    log('Removed user company memberships', 'warn');

    // Remove sessions
    await em.nativeDelete(Session, { user: user.id });
    log('Removed user sessions', 'warn');

    // Remove user
    em.remove(user);
    log(`Removed existing user: ${user.email}`, 'warn');
  }

  // Then remove the companies (need to delete related records first due to FK)
  for (const companyConfig of seedConfig.companies) {
    const company = await em.findOne(Company, { name: companyConfig.name });
    if (company) {
      // Find all users in this company (including additional seeded users)
      const companyUsers = await em.find(User, { company: company.id });
      for (const companyUser of companyUsers) {
        // Remove user office assignments
        await em.nativeDelete(UserOffice, { user: companyUser.id });
        // Remove user role assignments
        await em.nativeDelete(UserRole, { user: companyUser.id });
        // Remove user company memberships
        await em.nativeDelete(UserCompany, { user: companyUser.id });
        // Remove sessions
        await em.nativeDelete(Session, { user: companyUser.id });
        em.remove(companyUser);
      }
      if (companyUsers.length > 0) {
        log(
          `Removed ${companyUsers.length} user(s) from: ${company.name}`,
          'warn',
        );
      }

      // Delete all UserCompany records for this company (from any user)
      const ucDeleted = await em.nativeDelete(UserCompany, {
        company: company.id,
      });
      if (ucDeleted > 0) {
        log(
          `Removed ${ucDeleted} user-company memberships for: ${company.name}`,
          'warn',
        );
      }

      // Delete custom roles for this company (COMPANY type roles with a company reference)
      const rolesDeleted = await em.nativeDelete(Role, {
        company: company.id,
        type: RoleType.COMPANY,
      });
      if (rolesDeleted > 0) {
        log(
          `Removed ${rolesDeleted} custom role(s) for: ${company.name}`,
          'warn',
        );
      }

      // Delete user office assignments for offices in this company
      const offices = await em.find(Office, { company: company.id });
      for (const office of offices) {
        await em.nativeDelete(UserOffice, { office: office.id });
      }

      // Delete offices associated with this company
      const officesDeleted = await em.nativeDelete(Office, {
        company: company.id,
      });
      if (officesDeleted > 0) {
        log(
          `Removed ${officesDeleted} offices for company: ${company.name}`,
          'warn',
        );
      }

      em.remove(company);
      log(`Removed existing company: ${company.name}`, 'warn');
    }
  }

  await em.flush();
}

/**
 * Create a company from config
 */
async function createCompany(
  orm: MikroORM,
  companyConfig: CompanyConfig,
): Promise<Company> {
  const em = orm.em.fork();

  const company = new Company();
  company.name = companyConfig.name;
  company.maxSeats = companyConfig.maxSeats;
  company.maxSessionsPerUser = companyConfig.maxSessionsPerUser;
  company.tier = companyConfig.tier;
  company.sessionLimitStrategy = companyConfig.sessionLimitStrategy;
  company.passwordPolicy = { ...DEFAULT_PASSWORD_POLICY };
  company.mfaRequired = companyConfig.mfaRequired;
  company.isActive = true;

  await em.persistAndFlush(company);
  return company;
}

/**
 * Create UserCompany membership record
 */
async function createUserCompanyMembership(
  orm: MikroORM,
  user: User,
  company: Company,
  isPinned = false,
): Promise<UserCompany> {
  const em = orm.em.fork();

  const userRef = em.getReference(User, user.id);
  const companyRef = em.getReference(Company, company.id);

  const userCompany = new UserCompany();
  userCompany.user = userRef;
  userCompany.company = companyRef;
  userCompany.isActive = true;
  userCompany.isPinned = isPinned;
  userCompany.joinedAt = new Date();
  userCompany.lastAccessedAt = new Date();

  await em.persistAndFlush(userCompany);
  return userCompany;
}

/**
 * Create the seed admin user
 */
async function createUser(
  orm: MikroORM,
  homeCompany: Company,
  seedConfig: ReturnType<typeof getSeedConfig>,
): Promise<User> {
  const em = orm.em.fork();

  // Re-fetch company in this context
  const companyRef = em.getReference(Company, homeCompany.id);

  const passwordHash = await hashPassword(seedConfig.user.password);

  const user = new User();
  user.email = seedConfig.user.email;
  user.passwordHash = passwordHash;
  user.nameFirst = seedConfig.user.nameFirst;
  user.nameLast = seedConfig.user.nameLast;
  user.company = companyRef; // Home company (for backward compatibility)
  user.isActive = true;
  user.emailVerified = seedConfig.user.emailVerified;
  user.maxSessions = seedConfig.user.maxSessions;
  user.mfaEnabled = false;
  user.needsResetPassword = false;
  user.failedLoginAttempts = 0;
  // COMPANY user type enables multi-company switching via CompanySwitcher
  user.userType = UserType.COMPANY;

  await em.persistAndFlush(user);
  return user;
}

/**
 * Get or create the platform admin role
 */
async function getOrCreatePlatformAdminRole(orm: MikroORM): Promise<Role> {
  const em = orm.em.fork();

  let role = await em.findOne(Role, {
    name: 'platformAdmin',
    type: RoleType.PLATFORM,
  });

  if (!role) {
    role = new Role();
    role.name = 'platformAdmin';
    role.displayName = 'Platform Administrator';
    role.description =
      'Full platform access. Can manage all companies and internal users.';
    role.type = RoleType.PLATFORM;
    role.permissions = [
      PERMISSIONS.PLATFORM_ADMIN,
      PERMISSIONS.PLATFORM_VIEW_COMPANIES,
      PERMISSIONS.PLATFORM_SWITCH_COMPANY,
      PERMISSIONS.PLATFORM_VIEW_AUDIT_LOGS,
      PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS,
    ];
    role.companyPermissions = ['*']; // Full access in any company
    role.isDefault = false;

    await em.persistAndFlush(role);
    log('Created platformAdmin role', 'success');
  } else {
    log('Found existing platformAdmin role', 'info');
  }

  return role;
}

/**
 * Get or create the admin system role
 */
async function getOrCreateAdminRole(orm: MikroORM): Promise<Role> {
  const em = orm.em.fork();

  let role = await em.findOne(Role, {
    name: 'admin',
    type: RoleType.SYSTEM,
  });

  if (!role) {
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
  userRole.assignedAt = new Date();

  await em.persistAndFlush(userRole);
  return userRole;
}

/**
 * Assign company role to user
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
  userRole.company = companyRef;
  userRole.assignedAt = new Date();

  await em.persistAndFlush(userRole);
  return userRole;
}

/**
 * Generate office name based on index and available defaults
 */
function getOfficeName(index: number, defaultNames: string[]): string {
  if (index < defaultNames.length) {
    return defaultNames[index]!;
  }
  return `Office ${index + 1}`;
}

/**
 * Create offices for a company
 */
async function createOfficesForCompany(
  orm: MikroORM,
  company: Company,
  companyConfig: CompanyConfig,
): Promise<Office[]> {
  const em = orm.em.fork();
  const offices: Office[] = [];

  const companyRef = em.getReference(Company, company.id);

  for (let i = 0; i < companyConfig.officeCount; i++) {
    const office = new Office();
    office.name = getOfficeName(i, companyConfig.defaultOfficeNames);
    office.company = companyRef;
    office.isActive = true;

    em.persist(office);
    offices.push(office);
  }

  await em.flush();
  return offices;
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
 * Create custom roles for a company
 */
async function createCustomRoles(
  orm: MikroORM,
  company: Company,
  count: number,
): Promise<Role[]> {
  const em = orm.em.fork();
  const roles: Role[] = [];
  const companyRef = em.getReference(Company, company.id);

  for (let i = 0; i < count && i < SAMPLE_ROLE_CONFIGS.length; i++) {
    const config = SAMPLE_ROLE_CONFIGS[i]!;

    // Check if role already exists
    const existing = await em.findOne(Role, {
      name: config.name,
      company: company.id,
    });

    if (existing) {
      roles.push(existing);
      continue;
    }

    const role = new Role();
    role.name = config.name;
    role.displayName = config.displayName;
    role.description = `${config.displayName} with predefined permissions.`;
    role.type = RoleType.COMPANY;
    role.permissions = config.permissions;
    role.isDefault = false;
    role.company = companyRef;

    em.persist(role);
    roles.push(role);
  }

  await em.flush();
  return roles;
}

/**
 * Create additional users for a company
 */
async function createAdditionalUsers(
  orm: MikroORM,
  company: Company,
  count: number,
  offices: Office[],
  roles: Role[],
  defaultPassword: string,
): Promise<User[]> {
  const em = orm.em.fork();
  const users: User[] = [];
  const companyRef = em.getReference(Company, company.id);
  const passwordHash = await hashPassword(defaultPassword);

  for (let i = 0; i < count; i++) {
    const firstName = SAMPLE_NAMES.first[i % SAMPLE_NAMES.first.length]!;
    const lastName = SAMPLE_NAMES.last[i % SAMPLE_NAMES.last.length]!;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@salespro.dev`;

    // Check if user already exists
    const existing = await em.findOne(User, { email });
    if (existing) {
      users.push(existing);
      continue;
    }

    const user = new User();
    user.email = email;
    user.passwordHash = passwordHash;
    user.nameFirst = firstName;
    user.nameLast = lastName;
    user.company = companyRef;
    user.isActive = true;
    user.emailVerified = true;
    user.maxSessions = 3;
    user.mfaEnabled = false;
    user.needsResetPassword = false;
    user.failedLoginAttempts = 0;
    user.userType = UserType.COMPANY;

    em.persist(user);
    users.push(user);
  }

  await em.flush();

  // Assign users to offices and roles
  for (let i = 0; i < users.length; i++) {
    const user = users[i]!;

    // Create UserCompany membership
    const ucEm = orm.em.fork();
    const userRef = ucEm.getReference(User, user.id);
    const ucCompanyRef = ucEm.getReference(Company, company.id);

    const userCompany = new UserCompany();
    userCompany.user = userRef;
    userCompany.company = ucCompanyRef;
    userCompany.isActive = true;
    userCompany.isPinned = false;
    userCompany.joinedAt = new Date();
    userCompany.lastAccessedAt = new Date();
    await ucEm.persistAndFlush(userCompany);

    // Assign to an office (round-robin)
    if (offices.length > 0) {
      const office = offices[i % offices.length]!;
      await assignUserToOffice(orm, user, office);
    }

    // Assign a role (round-robin, or admin if no custom roles)
    if (roles.length > 0) {
      const role = roles[i % roles.length]!;
      await assignCompanyRole(orm, user, role, company);
    }
  }

  return users;
}

/** Seeding result for summary display */
type SeedResult = {
  companies: Company[];
  offices: Map<string, Office[]>;
  users: User[];
  additionalUsers: User[];
  customRoles: Role[];
};

/**
 * Print seed summary
 */
function printSummary(
  result: SeedResult,
  seedConfig: ReturnType<typeof getSeedConfig>,
): void {
  console.log('');
  console.log(
    `${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.green}  DATABASE SEEDED SUCCESSFULLY!${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log('');

  // Companies and Offices
  console.log(
    `${colors.cyan}Companies (${result.companies.length}):${colors.reset}`,
  );
  result.companies.forEach((company, index) => {
    const companyOffices = result.offices.get(company.id) ?? [];
    console.log(`  ${index + 1}. ${company.name}`);
    console.log(`     Tier: ${company.tier}`);
    console.log(`     Max Seats: ${company.maxSeats}`);
    console.log(`     ID: ${company.id}`);
    console.log(`     Offices (${companyOffices.length}):`);
    companyOffices.forEach(office => {
      console.log(`       - ${office.name} (${office.id})`);
    });
  });
  console.log('');

  // Admin User
  const adminUser = result.users[0]!;
  console.log(`${colors.cyan}Admin User:${colors.reset}`);
  console.log(`  Email: ${seedConfig.user.email}`);
  console.log(`  Password: ${seedConfig.user.password}`);
  console.log(`  Name: ${adminUser.fullName}`);
  console.log(`  User Type: ${adminUser.userType}`);
  console.log(`  ID: ${adminUser.id}`);
  console.log('');

  // Custom Roles
  if (result.customRoles.length > 0) {
    console.log(
      `${colors.cyan}Custom Roles (${result.customRoles.length}):${colors.reset}`,
    );
    result.customRoles.forEach((role, index) => {
      console.log(`  ${index + 1}. ${role.displayName} (${role.name})`);
      console.log(`     Permissions: ${role.permissions.join(', ')}`);
    });
    console.log('');
  }

  // Additional Users
  if (result.additionalUsers.length > 0) {
    console.log(
      `${colors.cyan}Additional Users (${result.additionalUsers.length}):${colors.reset}`,
    );
    result.additionalUsers.slice(0, 5).forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.fullName} (${user.email})`);
    });
    if (result.additionalUsers.length > 5) {
      console.log(`  ... and ${result.additionalUsers.length - 5} more`);
    }
    console.log(
      `  ${colors.yellow}Password: ${seedConfig.user.password}${colors.reset}`,
    );
    console.log('');
  }

  // Assigned Roles
  console.log(`${colors.cyan}Admin User Roles:${colors.reset}`);
  console.log(`  1. Platform Administrator (platform-level operations)`);
  console.log(`  2. Administrator (in each company)`);
  console.log('');

  console.log(
    `${colors.green}✓ This user can SWITCH between ${result.companies.length} companies!${colors.reset}`,
  );
  console.log(
    `${colors.green}✓ Look for the CompanySwitcher in the top app bar.${colors.reset}`,
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

  log('Starting database seeding...', 'info');
  log(
    `Database: ${process.env['DATABASE_URL'] ?? 'using default URL'}`,
    'info',
  );
  log(`Admin Email: ${seedConfig.user.email}`, 'info');
  log(`Companies to create: ${seedConfig.companies.length}`, 'info');
  log(
    `Primary company: ${seedConfig.seedCounts.offices} office(s), ${seedConfig.seedCounts.users} additional user(s), ${seedConfig.seedCounts.roles} custom role(s)`,
    'info',
  );

  let orm: MikroORM | null = null;

  try {
    // Initialize ORM
    orm = await MikroORM.init<PostgreSqlDriver>(getORMConfig());
    log('Database connection established', 'success');

    // Check for existing data
    const existing = await checkExistingData(orm, seedConfig);

    if (existing.companies.length > 0 || existing.user) {
      if (forceFlag) {
        log('Force flag detected, clearing existing seed data...', 'warn');
        await clearSeedData(orm, seedConfig);
      } else {
        if (existing.companies.length > 0) {
          existing.companies.forEach(c => {
            log(`Company "${c.name}" already exists`, 'warn');
          });
        }
        if (existing.user) {
          log(`User "${seedConfig.user.email}" already exists`, 'warn');
        }
        log('Use --force flag to clear existing data and reseed', 'info');
        log('Seeding skipped - data already exists', 'warn');
        return;
      }
    }

    // Get or create roles
    log('Setting up platform admin role...', 'info');
    const platformRole = await getOrCreatePlatformAdminRole(orm);

    log('Setting up admin system role...', 'info');
    const adminRole = await getOrCreateAdminRole(orm);

    // Create all companies and their offices
    const companies: Company[] = [];
    const officesByCompany = new Map<string, Office[]>();

    for (let i = 0; i < seedConfig.companies.length; i++) {
      const companyConfig = seedConfig.companies[i]!;
      log(`Creating company: ${companyConfig.name}...`, 'info');
      const company = await createCompany(orm, companyConfig);
      companies.push(company);
      log(`Company created: ${company.name}`, 'success');

      // Create offices for this company
      log(
        `Creating ${companyConfig.officeCount} office(s) for ${company.name}...`,
        'info',
      );
      const offices = await createOfficesForCompany(
        orm,
        company,
        companyConfig,
      );
      officesByCompany.set(company.id, offices);
      offices.forEach(office => {
        log(`Office created: ${office.name}`, 'success');
      });
    }

    // Create custom roles for primary company
    const primaryCompany = companies[0]!;
    let customRoles: Role[] = [];
    if (seedConfig.seedCounts.roles > 0) {
      log(
        `Creating ${seedConfig.seedCounts.roles} custom role(s) for ${primaryCompany.name}...`,
        'info',
      );
      customRoles = await createCustomRoles(
        orm,
        primaryCompany,
        seedConfig.seedCounts.roles,
      );
      customRoles.forEach(role => {
        log(`Custom role created: ${role.displayName}`, 'success');
      });
    }

    // Create admin user (first company is the home company)
    log('Creating admin user...', 'info');
    const adminUser = await createUser(orm, primaryCompany, seedConfig);
    log(`User created: ${adminUser.email}`, 'success');

    // Create UserCompany memberships for all companies
    log('Creating company memberships...', 'info');
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i]!;
      // Pin the first company
      await createUserCompanyMembership(orm, adminUser, company, i === 0);
      log(`Added user to company: ${company.name}`, 'success');
    }

    // Assign admin user to first office of each company
    log('Assigning admin user to offices...', 'info');
    for (const company of companies) {
      const companyOffices = officesByCompany.get(company.id) ?? [];
      if (companyOffices.length > 0) {
        await assignUserToOffice(orm, adminUser, companyOffices[0]!);
        log(`Admin assigned to office: ${companyOffices[0]!.name}`, 'success');
      }
    }

    // Assign platform role to user (for platform operations)
    log('Assigning platform admin role...', 'info');
    await assignPlatformRole(orm, adminUser, platformRole);
    log('Platform role assigned', 'success');

    // Assign admin role to user within each company
    for (const company of companies) {
      log(`Assigning admin role for ${company.name}...`, 'info');
      await assignCompanyRole(orm, adminUser, adminRole, company);
      log(`Admin role assigned for ${company.name}`, 'success');
    }

    // Create additional users for primary company
    let additionalUsers: User[] = [];
    if (seedConfig.seedCounts.users > 0) {
      log(
        `Creating ${seedConfig.seedCounts.users} additional user(s) for ${primaryCompany.name}...`,
        'info',
      );
      const primaryOffices = officesByCompany.get(primaryCompany.id) ?? [];
      // Use custom roles if available, otherwise use admin role
      const rolesToAssign = customRoles.length > 0 ? customRoles : [adminRole];
      additionalUsers = await createAdditionalUsers(
        orm,
        primaryCompany,
        seedConfig.seedCounts.users,
        primaryOffices,
        rolesToAssign,
        seedConfig.user.password,
      );
      log(`Created ${additionalUsers.length} additional user(s)`, 'success');
    }

    // Print summary
    const result: SeedResult = {
      companies,
      offices: officesByCompany,
      users: [adminUser],
      additionalUsers,
      customRoles,
    };
    printSummary(result, seedConfig);
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
