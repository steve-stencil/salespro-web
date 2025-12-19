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
 *   --offices <n>        Number of offices to create per company (default: 0)
 *   --users <n>          Number of additional users to create per company (default: 0)
 *   --roles <n>          Number of custom roles to create per company (default: 0)
 *
 * Environment Variables:
 *   SEED_ADMIN_EMAIL     Admin user email (default: admin@salespro.dev)
 *   SEED_ADMIN_PASSWORD  Admin user password (default: SalesProAdmin123!)
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

/**
 * Parse command line arguments
 */
function parseCliArgs(): {
  email: string | undefined;
  password: string | undefined;
  offices: number;
  users: number;
  roles: number;
} {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let password: string | undefined;
  let offices = 0;
  let users = 0;
  let roles = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1];
      i++;
    } else if (args[i] === '--offices' && args[i + 1]) {
      offices = parseInt(args[i + 1]!, 10) || 0;
      i++;
    } else if (args[i] === '--users' && args[i + 1]) {
      users = parseInt(args[i + 1]!, 10) || 0;
      i++;
    } else if (args[i] === '--roles' && args[i + 1]) {
      roles = parseInt(args[i + 1]!, 10) || 0;
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
};

/** Seed configuration type */
type SeedConfig = {
  companies: CompanyConfig[];
  user: {
    email: string;
    password: string;
    nameFirst: string;
    nameLast: string;
    emailVerified: boolean;
    maxSessions: number;
  };
  officeCount: number;
  userCount: number;
  roleCount: number;
};

/**
 * Get seed configuration with CLI args and env vars taking precedence
 */
function getSeedConfig(): SeedConfig {
  const cliArgs = parseCliArgs();

  // Priority: CLI args > Environment variables > Defaults
  const email =
    cliArgs.email ?? process.env['SEED_ADMIN_EMAIL'] ?? 'admin@salespro.dev';

  const password =
    cliArgs.password ??
    process.env['SEED_ADMIN_PASSWORD'] ??
    'SalesProAdmin123!';

  return {
    // Two companies for multi-company switching demo
    companies: [
      {
        name: 'SalesPro Demo Company',
        maxSeats: 100,
        maxSessionsPerUser: 3,
        tier: SubscriptionTier.PROFESSIONAL,
        sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
        mfaRequired: false,
      },
      {
        name: 'Acme Corporation',
        maxSeats: 100,
        maxSessionsPerUser: 5,
        tier: SubscriptionTier.ENTERPRISE,
        sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
        mfaRequired: false,
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
    officeCount: cliArgs.offices,
    userCount: cliArgs.users,
    roleCount: cliArgs.roles,
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
    // Remove user role assignments first (FK constraint)
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

// Sample data for generating realistic seed data
const FIRST_NAMES = [
  'James',
  'Mary',
  'Robert',
  'Patricia',
  'John',
  'Jennifer',
  'Michael',
  'Linda',
  'David',
  'Elizabeth',
  'William',
  'Barbara',
  'Richard',
  'Susan',
  'Joseph',
  'Jessica',
  'Thomas',
  'Sarah',
  'Christopher',
  'Karen',
  'Charles',
  'Lisa',
  'Daniel',
  'Nancy',
  'Matthew',
  'Betty',
  'Anthony',
  'Margaret',
  'Mark',
  'Sandra',
  'Donald',
  'Ashley',
  'Steven',
  'Kimberly',
  'Paul',
  'Emily',
  'Andrew',
  'Donna',
  'Joshua',
  'Michelle',
];

const LAST_NAMES = [
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
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
];

const OFFICE_LOCATIONS = [
  'Downtown',
  'Midtown',
  'Uptown',
  'Westside',
  'Eastside',
  'Northside',
  'Southside',
  'Central',
  'Harbor',
  'Riverside',
  'Lakeside',
  'Hillside',
  'Valley',
  'Heights',
  'Park',
  'Plaza',
  'Square',
  'Commons',
  'Gateway',
  'Crossing',
  'Junction',
  'Station',
  'Metro',
  'Urban',
  'Suburban',
  'Regional',
  'Main Street',
  'Corporate',
  'Tech Hub',
];

const ROLE_NAMES = [
  {
    name: 'salesRep',
    displayName: 'Sales Representative',
    permissions: ['customer:read', 'customer:create', 'customer:update'],
  },
  {
    name: 'salesManager',
    displayName: 'Sales Manager',
    permissions: ['customer:*', 'user:read', 'report:read'],
  },
  {
    name: 'accountManager',
    displayName: 'Account Manager',
    permissions: ['customer:*', 'report:read', 'report:export'],
  },
  {
    name: 'teamLead',
    displayName: 'Team Lead',
    permissions: ['customer:*', 'user:read', 'user:update', 'report:read'],
  },
  {
    name: 'analyst',
    displayName: 'Business Analyst',
    permissions: ['customer:read', 'report:*'],
  },
  {
    name: 'support',
    displayName: 'Support Specialist',
    permissions: ['customer:read', 'customer:update'],
  },
  {
    name: 'coordinator',
    displayName: 'Sales Coordinator',
    permissions: ['customer:read', 'office:read'],
  },
  {
    name: 'trainer',
    displayName: 'Training Specialist',
    permissions: ['user:read', 'customer:read'],
  },
  {
    name: 'qualityAssurance',
    displayName: 'QA Specialist',
    permissions: ['customer:read', 'report:read'],
  },
  {
    name: 'regional',
    displayName: 'Regional Manager',
    permissions: ['customer:*', 'user:*', 'office:read', 'report:*'],
  },
];

/**
 * Get a random element from an array
 */
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Create an office for a company
 */
async function createOffice(
  orm: MikroORM,
  company: Company,
  name: string,
): Promise<Office> {
  const em = orm.em.fork();

  const companyRef = em.getReference(Company, company.id);

  const office = new Office();
  office.name = name;
  office.company = companyRef;
  office.isActive = true;

  await em.persistAndFlush(office);
  return office;
}

/**
 * Create an additional user for a company
 * Returns null if user with that email already exists
 */
async function createAdditionalUser(
  orm: MikroORM,
  company: Company,
  index: number,
  defaultPassword: string,
): Promise<User | null> {
  const em = orm.em.fork();

  const companyRef = em.getReference(Company, company.id);
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  // Include company short name in email to make it unique across companies
  const companySlug = company.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}.${companySlug}@example.com`;

  // Check if user already exists
  const existing = await em.findOne(User, { email });
  if (existing) {
    return null;
  }

  const passwordHash = await hashPassword(defaultPassword);

  const user = new User();
  user.email = email;
  user.passwordHash = passwordHash;
  user.nameFirst = firstName;
  user.nameLast = lastName;
  user.company = companyRef;
  user.isActive = Math.random() > 0.1; // 90% active
  user.emailVerified = Math.random() > 0.2; // 80% verified
  user.maxSessions = 3;
  user.mfaEnabled = false;
  user.needsResetPassword = false;
  user.failedLoginAttempts = 0;
  user.userType = UserType.COMPANY;

  await em.persistAndFlush(user);
  return user;
}

/**
 * Create a custom role for a company
 */
async function createCustomRole(
  orm: MikroORM,
  company: Company,
  roleConfig: (typeof ROLE_NAMES)[number],
): Promise<Role> {
  const em = orm.em.fork();

  const companyRef = em.getReference(Company, company.id);

  // Check if role already exists for this company
  const existing = await em.findOne(Role, {
    name: roleConfig.name,
    company: company.id,
  });

  if (existing) {
    return existing;
  }

  const role = new Role();
  role.name = roleConfig.name;
  role.displayName = roleConfig.displayName;
  role.description = `${roleConfig.displayName} role with standard permissions.`;
  role.type = RoleType.COMPANY;
  role.company = companyRef;
  role.permissions = roleConfig.permissions;
  role.isDefault = roleConfig.name === 'salesRep';

  await em.persistAndFlush(role);
  return role;
}

/**
 * Assign user to an office
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

/** Summary statistics type */
type SeedSummary = {
  officesCreated: number;
  usersCreated: number;
  rolesCreated: number;
};

/**
 * Print seed summary
 */
function printSummary(
  companies: Company[],
  user: User,
  seedConfig: SeedConfig,
  summary: SeedSummary,
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
  console.log(`${colors.cyan}Companies (${companies.length}):${colors.reset}`);
  companies.forEach((company, index) => {
    console.log(`  ${index + 1}. ${company.name}`);
    console.log(`     Tier: ${company.tier}`);
    console.log(`     Max Seats: ${company.maxSeats}`);
    console.log(`     ID: ${company.id}`);
  });
  console.log('');
  console.log(`${colors.cyan}Admin User:${colors.reset}`);
  console.log(`  Email: ${seedConfig.user.email}`);
  console.log(`  Password: ${seedConfig.user.password}`);
  console.log(`  Name: ${user.fullName}`);
  console.log(`  User Type: ${user.userType}`);
  console.log(`  ID: ${user.id}`);
  console.log('');
  console.log(`${colors.cyan}Assigned Roles:${colors.reset}`);
  console.log(`  1. Platform Administrator (platform-level operations)`);
  console.log(`  2. Administrator (in each company)`);
  console.log('');

  if (
    summary.officesCreated > 0 ||
    summary.usersCreated > 0 ||
    summary.rolesCreated > 0
  ) {
    console.log(`${colors.cyan}Additional Seed Data:${colors.reset}`);
    if (summary.officesCreated > 0) {
      console.log(`  Offices created: ${summary.officesCreated}`);
    }
    if (summary.usersCreated > 0) {
      console.log(`  Users created: ${summary.usersCreated}`);
    }
    if (summary.rolesCreated > 0) {
      console.log(`  Custom roles created: ${summary.rolesCreated}`);
    }
    console.log('');
  }

  console.log(
    `${colors.green}✓ This user can SWITCH between ${companies.length} companies!${colors.reset}`,
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

  if (seedConfig.officeCount > 0) {
    log(`Offices per company: ${seedConfig.officeCount}`, 'info');
  }
  if (seedConfig.userCount > 0) {
    log(`Users per company: ${seedConfig.userCount}`, 'info');
  }
  if (seedConfig.roleCount > 0) {
    log(`Custom roles per company: ${seedConfig.roleCount}`, 'info');
  }

  let orm: MikroORM | null = null;
  const summary: SeedSummary = {
    officesCreated: 0,
    usersCreated: 0,
    rolesCreated: 0,
  };

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

    // Create all companies
    const companies: Company[] = [];
    for (const companyConfig of seedConfig.companies) {
      log(`Creating company: ${companyConfig.name}...`, 'info');
      const company = await createCompany(orm, companyConfig);
      companies.push(company);
      log(`Company created: ${company.name}`, 'success');
    }

    // Create admin user (first company is the home company)
    log('Creating admin user...', 'info');
    const user = await createUser(orm, companies[0]!, seedConfig);
    log(`User created: ${user.email}`, 'success');

    // Create UserCompany memberships for all companies
    log('Creating company memberships...', 'info');
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i]!;
      // Pin the first company
      await createUserCompanyMembership(orm, user, company, i === 0);
      log(`Added user to company: ${company.name}`, 'success');
    }

    // Assign platform role to user (for platform operations)
    log('Assigning platform admin role...', 'info');
    await assignPlatformRole(orm, user, platformRole);
    log('Platform role assigned', 'success');

    // Assign admin role to user within each company
    for (const company of companies) {
      log(`Assigning admin role for ${company.name}...`, 'info');
      await assignCompanyRole(orm, user, adminRole, company);
      log(`Admin role assigned for ${company.name}`, 'success');
    }

    // Create additional seed data for each company
    for (const company of companies) {
      // Create offices
      const officesForCompany: Office[] = [];
      if (seedConfig.officeCount > 0) {
        log(
          `Creating ${seedConfig.officeCount} offices for ${company.name}...`,
          'info',
        );
        for (let i = 0; i < seedConfig.officeCount; i++) {
          const locationName = OFFICE_LOCATIONS[i % OFFICE_LOCATIONS.length]!;
          const officeName = `${locationName} Office`;
          const office = await createOffice(orm, company, officeName);
          officesForCompany.push(office);
          summary.officesCreated++;
        }
        log(
          `Created ${seedConfig.officeCount} offices for ${company.name}`,
          'success',
        );
      }

      // Create custom roles
      const rolesForCompany: Role[] = [];
      if (seedConfig.roleCount > 0) {
        log(
          `Creating ${seedConfig.roleCount} custom roles for ${company.name}...`,
          'info',
        );
        const rolesToCreate = Math.min(seedConfig.roleCount, ROLE_NAMES.length);
        for (let i = 0; i < rolesToCreate; i++) {
          const roleConfig = ROLE_NAMES[i]!;
          const role = await createCustomRole(orm, company, roleConfig);
          rolesForCompany.push(role);
          summary.rolesCreated++;
        }
        log(
          `Created ${rolesToCreate} custom roles for ${company.name}`,
          'success',
        );
      }

      // Create additional users
      if (seedConfig.userCount > 0) {
        log(
          `Creating ${seedConfig.userCount} users for ${company.name}...`,
          'info',
        );
        const defaultPassword = 'Password123!';
        let skippedUsers = 0;

        for (let i = 0; i < seedConfig.userCount; i++) {
          const newUser = await createAdditionalUser(
            orm,
            company,
            i,
            defaultPassword,
          );

          // Skip if user already exists
          if (!newUser) {
            skippedUsers++;
            continue;
          }

          // Add user to company membership
          await createUserCompanyMembership(orm, newUser, company, false);

          // Assign to a random office if offices exist
          if (officesForCompany.length > 0) {
            const randomOffice = randomElement(officesForCompany);
            await assignUserToOffice(orm, newUser, randomOffice);
          }

          // Assign a random role if custom roles exist, otherwise assign admin role
          if (rolesForCompany.length > 0) {
            const randomRole = randomElement(rolesForCompany);
            await assignCompanyRole(orm, newUser, randomRole, company);
          } else {
            await assignCompanyRole(orm, newUser, adminRole, company);
          }

          summary.usersCreated++;

          // Log progress every 10 users
          if ((i + 1) % 10 === 0) {
            log(`  Created ${i + 1}/${seedConfig.userCount} users...`, 'info');
          }
        }

        if (skippedUsers > 0) {
          log(
            `Skipped ${skippedUsers} users (already exist) for ${company.name}`,
            'warn',
          );
        }
        log(
          `Created ${seedConfig.userCount - skippedUsers} users for ${company.name}`,
          'success',
        );
      }
    }

    // Print summary
    printSummary(companies, user, seedConfig, summary);
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
