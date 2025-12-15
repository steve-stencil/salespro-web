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
 *
 * Environment Variables:
 *   SEED_ADMIN_EMAIL     Admin user email (default: admin@salespro.dev)
 *   SEED_ADMIN_PASSWORD  Admin user password (default: SalesProAdmin123!)
 *
 * Examples:
 *   pnpm db:seed --email user@example.com --password MySecurePass123!
 *   SEED_ADMIN_EMAIL=user@example.com SEED_ADMIN_PASSWORD=pass pnpm db:seed
 */

import 'dotenv/config';

import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

import {
  Company,
  User,
  Session,
  SubscriptionTier,
  SessionLimitStrategy,
  DEFAULT_PASSWORD_POLICY,
} from '../src/entities';
import { hashPassword } from '../src/lib/crypto';

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
    cliArgs.email ?? process.env['SEED_ADMIN_EMAIL'] ?? 'admin@salespro.dev';

  const password =
    cliArgs.password ??
    process.env['SEED_ADMIN_PASSWORD'] ??
    'SalesProAdmin123!';

  return {
    company: {
      name: 'SalesPro Demo Company',
      maxSeats: 10,
      maxSessionsPerUser: 3,
      tier: SubscriptionTier.PROFESSIONAL,
      sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
      mfaRequired: false,
    },
    user: {
      email,
      password,
      nameFirst: 'Admin',
      nameLast: 'User',
      emailVerified: true,
      maxSessions: 5,
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
    entities: [Company, User, Session],
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
): Promise<{ company: Company | null; user: User | null }> {
  const em = orm.em.fork();

  const company = await em.findOne(Company, {
    name: seedConfig.company.name,
  });

  const user = await em.findOne(User, {
    email: seedConfig.user.email,
  });

  return { company, user };
}

/**
 * Clear existing seed data
 */
async function clearSeedData(
  orm: MikroORM,
  seedConfig: ReturnType<typeof getSeedConfig>,
): Promise<void> {
  const em = orm.em.fork();

  // Find and remove the seed user first (due to FK constraint)
  const user = await em.findOne(User, { email: seedConfig.user.email });
  if (user) {
    em.remove(user);
    log(`Removed existing user: ${user.email}`, 'warn');
  }

  // Then remove the company
  const company = await em.findOne(Company, { name: seedConfig.company.name });
  if (company) {
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
 * Create the seed admin user
 */
async function createUser(
  orm: MikroORM,
  company: Company,
  seedConfig: ReturnType<typeof getSeedConfig>,
): Promise<User> {
  const em = orm.em.fork();

  // Re-fetch company in this context
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

  await em.persistAndFlush(user);
  return user;
}

/**
 * Print seed summary
 */
function printSummary(
  company: Company,
  user: User,
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
  console.log(`${colors.cyan}Company:${colors.reset}`);
  console.log(`  Name: ${company.name}`);
  console.log(`  Tier: ${company.tier}`);
  console.log(`  Max Seats: ${company.maxSeats}`);
  console.log(`  ID: ${company.id}`);
  console.log('');
  console.log(`${colors.cyan}Admin User:${colors.reset}`);
  console.log(`  Email: ${seedConfig.user.email}`);
  console.log(`  Password: ${seedConfig.user.password}`);
  console.log(`  Name: ${user.fullName}`);
  console.log(`  ID: ${user.id}`);
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

    // Create company
    log('Creating company...', 'info');
    const company = await createCompany(orm, seedConfig);
    log(`Company created: ${company.name}`, 'success');

    // Create admin user
    log('Creating admin user...', 'info');
    const user = await createUser(orm, company, seedConfig);
    log(`User created: ${user.email}`, 'success');

    // Print summary
    printSummary(company, user, seedConfig);
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
