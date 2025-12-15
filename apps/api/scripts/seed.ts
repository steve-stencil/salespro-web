#!/usr/bin/env tsx
/**
 * Database Seeding Script
 *
 * Creates initial database records for development and testing.
 * Run with: pnpm --filter api db:seed
 *
 * Options:
 *   --force  Clear existing seed data before seeding
 */

import 'dotenv/config';

import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

import {
  Company,
  User,
  SubscriptionTier,
  SessionLimitStrategy,
  DEFAULT_PASSWORD_POLICY,
} from '../src/entities';
import { hashPassword } from '../src/lib/crypto';

/** Default seed user credentials - change these in production! */
const SEED_CONFIG = {
  company: {
    name: 'SalesPro Demo Company',
    maxSeats: 10,
    maxSessionsPerUser: 3,
    tier: SubscriptionTier.PROFESSIONAL,
    sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
    mfaRequired: false,
  },
  user: {
    email: 'admin@salespro.dev',
    password: 'SalesProAdmin123!',
    nameFirst: 'Admin',
    nameLast: 'User',
    emailVerified: true,
    maxSessions: 5,
  },
} as const;

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
    entities: [Company, User],
    debug: false,
    allowGlobalContext: true,
  };
}

/**
 * Check if seed data already exists
 */
async function checkExistingData(
  orm: MikroORM,
): Promise<{ company: Company | null; user: User | null }> {
  const em = orm.em.fork();

  const company = await em.findOne(Company, {
    name: SEED_CONFIG.company.name,
  });

  const user = await em.findOne(User, {
    email: SEED_CONFIG.user.email,
  });

  return { company, user };
}

/**
 * Clear existing seed data
 */
async function clearSeedData(orm: MikroORM): Promise<void> {
  const em = orm.em.fork();

  // Find and remove the seed user first (due to FK constraint)
  const user = await em.findOne(User, { email: SEED_CONFIG.user.email });
  if (user) {
    em.remove(user);
    log(`Removed existing user: ${user.email}`, 'warn');
  }

  // Then remove the company
  const company = await em.findOne(Company, { name: SEED_CONFIG.company.name });
  if (company) {
    em.remove(company);
    log(`Removed existing company: ${company.name}`, 'warn');
  }

  await em.flush();
}

/**
 * Create the seed company
 */
async function createCompany(orm: MikroORM): Promise<Company> {
  const em = orm.em.fork();

  const company = new Company();
  company.name = SEED_CONFIG.company.name;
  company.maxSeats = SEED_CONFIG.company.maxSeats;
  company.maxSessionsPerUser = SEED_CONFIG.company.maxSessionsPerUser;
  company.tier = SEED_CONFIG.company.tier;
  company.sessionLimitStrategy = SEED_CONFIG.company.sessionLimitStrategy;
  company.passwordPolicy = { ...DEFAULT_PASSWORD_POLICY };
  company.mfaRequired = SEED_CONFIG.company.mfaRequired;
  company.isActive = true;

  await em.persistAndFlush(company);
  return company;
}

/**
 * Create the seed admin user
 */
async function createUser(orm: MikroORM, company: Company): Promise<User> {
  const em = orm.em.fork();

  // Re-fetch company in this context
  const companyRef = em.getReference(Company, company.id);

  const passwordHash = await hashPassword(SEED_CONFIG.user.password);

  const user = new User();
  user.email = SEED_CONFIG.user.email;
  user.passwordHash = passwordHash;
  user.nameFirst = SEED_CONFIG.user.nameFirst;
  user.nameLast = SEED_CONFIG.user.nameLast;
  user.company = companyRef;
  user.isActive = true;
  user.emailVerified = SEED_CONFIG.user.emailVerified;
  user.maxSessions = SEED_CONFIG.user.maxSessions;
  user.mfaEnabled = false;
  user.needsResetPassword = false;
  user.failedLoginAttempts = 0;

  await em.persistAndFlush(user);
  return user;
}

/**
 * Print seed summary
 */
function printSummary(company: Company, user: User): void {
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
  console.log(`  Email: ${SEED_CONFIG.user.email}`);
  console.log(`  Password: ${SEED_CONFIG.user.password}`);
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

  log('Starting database seeding...', 'info');
  log(
    `Database: ${process.env['DATABASE_URL'] ?? 'using default URL'}`,
    'info',
  );

  let orm: MikroORM | null = null;

  try {
    // Initialize ORM
    orm = await MikroORM.init<PostgreSqlDriver>(getORMConfig());
    log('Database connection established', 'success');

    // Check for existing data
    const existing = await checkExistingData(orm);

    if (existing.company || existing.user) {
      if (forceFlag) {
        log('Force flag detected, clearing existing seed data...', 'warn');
        await clearSeedData(orm);
      } else {
        if (existing.company) {
          log(`Company "${SEED_CONFIG.company.name}" already exists`, 'warn');
        }
        if (existing.user) {
          log(`User "${SEED_CONFIG.user.email}" already exists`, 'warn');
        }
        log('Use --force flag to clear existing data and reseed', 'info');
        log('Seeding skipped - data already exists', 'warn');
        return;
      }
    }

    // Create company
    log('Creating company...', 'info');
    const company = await createCompany(orm);
    log(`Company created: ${company.name}`, 'success');

    // Create admin user
    log('Creating admin user...', 'info');
    const user = await createUser(orm, company);
    log(`User created: ${user.email}`, 'success');

    // Print summary
    printSummary(company, user);
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
