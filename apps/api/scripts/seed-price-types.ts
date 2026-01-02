#!/usr/bin/env tsx
/**
 * Price Type Seeding Script
 *
 * Creates default global price types for the Price Guide system.
 * Run with: pnpm --filter api db:seed-price-types
 *
 * Options:
 *   --force    Clear existing global price types before seeding
 *
 * This script creates the following global price types:
 *   - MATERIAL: Materials cost
 *   - LABOR: Labor cost
 *   - TAX: Tax amount
 *   - OTHER: Other costs
 */

import 'dotenv/config';

import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

import {
  Company,
  CompanyLogo,
  User,
  UserCompany,
  Session,
  Office,
  UserOffice,
  UserRole,
  Role,
  OAuthClient,
  OAuthToken,
  OAuthAuthorizationCode,
  LoginAttempt,
  LoginEvent,
  PasswordResetToken,
  PasswordHistory,
  UserInvite,
  EmailVerificationToken,
  MfaRecoveryCode,
  TrustedDevice,
  RememberMeToken,
  ApiKey,
  File,
  OfficeSettings,
  OfficeIntegration,
  MigrationSession,
  // Price Guide entities
  PriceGuideCategory,
  MeasureSheetItem,
  PriceGuideOption,
  UpCharge,
  AdditionalDetailField,
  PriceObjectType,
  MeasureSheetItemOffice,
  MeasureSheetItemOption,
  MeasureSheetItemUpCharge,
  MeasureSheetItemAdditionalDetailField,
  UpChargeAdditionalDetailField,
  UpChargeDisabledOption,
  OptionPrice,
  UpChargePrice,
  UpChargePricePercentageBase,
  PriceChangeLog,
  PriceChangeJob,
} from '../src/entities';

/**
 * Default global price types configuration
 * These are shared across all companies (company_id = null)
 */
const DEFAULT_PRICE_TYPES = [
  {
    code: 'MATERIAL',
    name: 'Materials',
    description: 'Cost of materials and products',
    sortOrder: 1,
  },
  {
    code: 'LABOR',
    name: 'Labor',
    description: 'Labor and installation costs',
    sortOrder: 2,
  },
  {
    code: 'TAX',
    name: 'Tax',
    description: 'Sales tax and other taxes',
    sortOrder: 3,
  },
  {
    code: 'OTHER',
    name: 'Other',
    description: 'Miscellaneous costs',
    sortOrder: 4,
  },
] as const;

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
    entities: [
      Company,
      CompanyLogo,
      User,
      UserCompany,
      Session,
      Office,
      UserOffice,
      UserRole,
      Role,
      OAuthClient,
      OAuthToken,
      OAuthAuthorizationCode,
      LoginAttempt,
      LoginEvent,
      PasswordResetToken,
      PasswordHistory,
      UserInvite,
      EmailVerificationToken,
      MfaRecoveryCode,
      TrustedDevice,
      RememberMeToken,
      ApiKey,
      File,
      OfficeSettings,
      OfficeIntegration,
      MigrationSession,
      // Price Guide entities
      PriceGuideCategory,
      MeasureSheetItem,
      PriceGuideOption,
      UpCharge,
      AdditionalDetailField,
      PriceObjectType,
      MeasureSheetItemOffice,
      MeasureSheetItemOption,
      MeasureSheetItemUpCharge,
      MeasureSheetItemAdditionalDetailField,
      UpChargeAdditionalDetailField,
      UpChargeDisabledOption,
      OptionPrice,
      UpChargePrice,
      UpChargePricePercentageBase,
      PriceChangeLog,
      PriceChangeJob,
    ],
    debug: false,
    allowGlobalContext: true,
  };
}

/**
 * Check if global price types already exist
 */
async function checkExistingPriceTypes(
  orm: MikroORM,
): Promise<PriceObjectType[]> {
  const em = orm.em.fork();
  // Global price types have company_id = null
  return em.find(PriceObjectType, { company: null });
}

/**
 * Clear existing global price types
 */
async function clearGlobalPriceTypes(orm: MikroORM): Promise<void> {
  const em = orm.em.fork();
  const existingTypes = await em.find(PriceObjectType, { company: null });

  if (existingTypes.length > 0) {
    for (const priceType of existingTypes) {
      em.remove(priceType);
      log(`Removed existing price type: ${priceType.code}`, 'warn');
    }
    await em.flush();
  }
}

/**
 * Create or update global price types
 */
async function seedPriceTypes(orm: MikroORM): Promise<PriceObjectType[]> {
  const em = orm.em.fork();
  const createdTypes: PriceObjectType[] = [];

  for (const typeConfig of DEFAULT_PRICE_TYPES) {
    // Check if price type already exists
    let priceType = await em.findOne(PriceObjectType, {
      code: typeConfig.code,
      company: null,
    });

    if (priceType) {
      // Update existing price type
      priceType.name = typeConfig.name;
      priceType.description = typeConfig.description;
      priceType.sortOrder = typeConfig.sortOrder;
      log(`Updated existing price type: ${priceType.code}`, 'info');
    } else {
      // Create new price type
      priceType = new PriceObjectType();
      priceType.code = typeConfig.code;
      priceType.name = typeConfig.name;
      priceType.description = typeConfig.description;
      priceType.sortOrder = typeConfig.sortOrder;
      // company is undefined/null for global price types
      em.persist(priceType);
      log(`Created new price type: ${priceType.code}`, 'success');
    }

    createdTypes.push(priceType);
  }

  await em.flush();
  return createdTypes;
}

/**
 * Print summary of seeded price types
 */
function printSummary(priceTypes: PriceObjectType[]): void {
  console.log('');
  console.log(
    `${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.green}  PRICE TYPES SEEDED SUCCESSFULLY!${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log('');

  console.log(
    `${colors.bright}Global Price Types (shared across all companies):${colors.reset}`,
  );
  console.log('');

  for (const priceType of priceTypes) {
    console.log(`${colors.cyan}${priceType.name}${colors.reset}`);
    console.log(`  Code: ${priceType.code}`);
    console.log(`  Description: ${priceType.description ?? 'N/A'}`);
    console.log(`  Sort Order: ${priceType.sortOrder}`);
    console.log('');
  }
}

/**
 * Main seeding function
 */
async function seedPriceTypesMain(): Promise<void> {
  const forceFlag = process.argv.includes('--force');

  log('Starting price type seeding...', 'info');
  log(
    `Database: ${process.env['DATABASE_URL'] ?? 'using default URL'}`,
    'info',
  );

  let orm: MikroORM | null = null;

  try {
    // Initialize ORM
    orm = await MikroORM.init<PostgreSqlDriver>(getORMConfig());
    log('Database connection established', 'success');

    // Check for existing price types
    const existingTypes = await checkExistingPriceTypes(orm);

    if (existingTypes.length > 0) {
      if (forceFlag) {
        log(
          'Force flag detected, clearing existing global price types...',
          'warn',
        );
        await clearGlobalPriceTypes(orm);
      } else {
        log(
          `Found ${existingTypes.length} existing global price type(s)`,
          'info',
        );
        log(
          'Price types will be updated in place (use --force to recreate)',
          'info',
        );
      }
    }

    // Seed price types
    const priceTypes = await seedPriceTypes(orm);

    // Print summary
    printSummary(priceTypes);
  } catch (error) {
    log(
      `Price type seeding failed: ${error instanceof Error ? error.message : String(error)}`,
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
seedPriceTypesMain()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Fatal error during price type seeding:', error);
    process.exit(1);
  });
