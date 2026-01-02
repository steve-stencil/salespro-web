#!/usr/bin/env tsx
/**
 * System Merge Fields Seeding Script
 *
 * Creates the default SYSTEM merge fields for the Merge Field system.
 * These are global fields shared across all companies.
 *
 * Run with: pnpm --filter api db:seed-merge-fields
 *
 * Options:
 *   --force    Clear existing system merge fields before seeding
 *
 * @see ADR-010-merge-field-system.md for design rationale
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
  PricingImportJob,
  Tag,
  ItemTag,
  OfficePriceType,
  PriceGuideImage,
  // Merge Field entities
  MergeField,
  MergeFieldCategory,
  MergeFieldDataType,
  CustomMergeFieldDefinition,
  MsiCustomMergeField,
  OptionCustomMergeField,
  UpChargeCustomMergeField,
} from '../src/entities';

/**
 * System merge field configuration.
 */
type SystemMergeFieldConfig = {
  key: string;
  displayName: string;
  category: MergeFieldCategory;
  dataType: MergeFieldDataType;
  description: string;
};

/**
 * Default SYSTEM merge fields configuration.
 * These are global fields shared across all companies.
 */
const SYSTEM_MERGE_FIELDS: SystemMergeFieldConfig[] = [
  // ============ ITEM Fields ============
  {
    key: 'item.quantity',
    displayName: 'Quantity',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.NUMBER,
    description: 'The quantity/count of this line item',
  },
  {
    key: 'item.name',
    displayName: 'Item Name',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'The name of the measure sheet item',
  },
  {
    key: 'item.note',
    displayName: 'Item Note',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'Notes/description for the item',
  },
  {
    key: 'item.category',
    displayName: 'Category',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'The category this item belongs to',
  },
  {
    key: 'item.measurementType',
    displayName: 'Measurement Type',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'Unit of measure (e.g., sqft, each, linft)',
  },
  {
    key: 'item.tag',
    displayName: 'Tag Value',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'Value from the tag field (if configured)',
  },

  // ============ OPTION Fields ============
  {
    key: 'option.selected.name',
    displayName: 'Selected Option Name',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.TEXT,
    description: 'Name of the selected product option',
  },
  {
    key: 'option.selected.brand',
    displayName: 'Selected Option Brand',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.TEXT,
    description: 'Brand/manufacturer of the selected option',
  },
  {
    key: 'option.selected.unitPrice',
    displayName: 'Unit Price',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.CURRENCY,
    description: 'Price per unit for the selected option',
  },
  {
    key: 'option.selected.totalPrice',
    displayName: 'Total Price',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.CURRENCY,
    description: 'Total price (unit price × quantity)',
  },
  {
    key: 'option.selected.itemCode',
    displayName: 'Item Code',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.TEXT,
    description: 'SKU/product code for the selected option',
  },

  // ============ CUSTOMER Fields ============
  {
    key: 'customer.name',
    displayName: 'Customer Name',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Full name of the customer',
  },
  {
    key: 'customer.firstName',
    displayName: 'Customer First Name',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'First name of the customer',
  },
  {
    key: 'customer.lastName',
    displayName: 'Customer Last Name',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Last name of the customer',
  },
  {
    key: 'customer.email',
    displayName: 'Customer Email',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Email address of the customer',
  },
  {
    key: 'customer.phone',
    displayName: 'Customer Phone',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Phone number of the customer',
  },
  {
    key: 'customer.address',
    displayName: 'Job Address',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Full address of the job site',
  },
  {
    key: 'customer.city',
    displayName: 'City',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'City of the job site',
  },
  {
    key: 'customer.state',
    displayName: 'State',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'State/province of the job site',
  },
  {
    key: 'customer.zip',
    displayName: 'ZIP Code',
    category: MergeFieldCategory.CUSTOMER,
    dataType: MergeFieldDataType.TEXT,
    description: 'ZIP/postal code of the job site',
  },

  // ============ USER (Sales Rep) Fields ============
  {
    key: 'user.name',
    displayName: 'Sales Rep Name',
    category: MergeFieldCategory.USER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Full name of the sales representative',
  },
  {
    key: 'user.email',
    displayName: 'Sales Rep Email',
    category: MergeFieldCategory.USER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Email address of the sales representative',
  },
  {
    key: 'user.phone',
    displayName: 'Sales Rep Phone',
    category: MergeFieldCategory.USER,
    dataType: MergeFieldDataType.TEXT,
    description: 'Phone number of the sales representative',
  },

  // ============ COMPANY Fields ============
  {
    key: 'company.name',
    displayName: 'Company Name',
    category: MergeFieldCategory.COMPANY,
    dataType: MergeFieldDataType.TEXT,
    description: 'Name of the company',
  },
  {
    key: 'company.phone',
    displayName: 'Company Phone',
    category: MergeFieldCategory.COMPANY,
    dataType: MergeFieldDataType.TEXT,
    description: 'Main phone number of the company',
  },
  {
    key: 'company.email',
    displayName: 'Company Email',
    category: MergeFieldCategory.COMPANY,
    dataType: MergeFieldDataType.TEXT,
    description: 'Main email address of the company',
  },
  {
    key: 'company.address',
    displayName: 'Company Address',
    category: MergeFieldCategory.COMPANY,
    dataType: MergeFieldDataType.TEXT,
    description: 'Physical address of the company',
  },
  {
    key: 'company.website',
    displayName: 'Company Website',
    category: MergeFieldCategory.COMPANY,
    dataType: MergeFieldDataType.TEXT,
    description: 'Website URL of the company',
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
 * Get database configuration with all entities
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
      PricingImportJob,
      Tag,
      ItemTag,
      OfficePriceType,
      PriceGuideImage,
      // Merge Field entities
      MergeField,
      CustomMergeFieldDefinition,
      MsiCustomMergeField,
      OptionCustomMergeField,
      UpChargeCustomMergeField,
    ],
    debug: false,
    allowGlobalContext: true,
  };
}

/**
 * Check if system merge fields already exist
 */
async function checkExistingMergeFields(orm: MikroORM): Promise<MergeField[]> {
  const em = orm.em.fork();
  return em.find(MergeField, {});
}

/**
 * Clear existing system merge fields
 */
async function clearMergeFields(orm: MikroORM): Promise<void> {
  const em = orm.em.fork();
  const existingFields = await em.find(MergeField, {});

  if (existingFields.length > 0) {
    for (const field of existingFields) {
      em.remove(field);
      log(`Removed existing merge field: ${field.key}`, 'warn');
    }
    await em.flush();
  }
}

/**
 * Create or update system merge fields
 */
async function seedMergeFields(orm: MikroORM): Promise<MergeField[]> {
  const em = orm.em.fork();
  const createdFields: MergeField[] = [];

  for (const fieldConfig of SYSTEM_MERGE_FIELDS) {
    // Check if field already exists
    let field = await em.findOne(MergeField, { key: fieldConfig.key });

    if (field) {
      // Update existing field
      field.displayName = fieldConfig.displayName;
      field.description = fieldConfig.description;
      field.category = fieldConfig.category;
      field.dataType = fieldConfig.dataType;
      field.isActive = true;
      log(`Updated existing merge field: ${field.key}`, 'info');
    } else {
      // Create new field
      field = new MergeField();
      field.key = fieldConfig.key;
      field.displayName = fieldConfig.displayName;
      field.description = fieldConfig.description;
      field.category = fieldConfig.category;
      field.dataType = fieldConfig.dataType;
      em.persist(field);
      log(`Created new merge field: ${field.key}`, 'success');
    }

    createdFields.push(field);
  }

  await em.flush();
  return createdFields;
}

/**
 * Print summary of seeded merge fields grouped by category
 */
function printSummary(mergeFields: MergeField[]): void {
  console.log('');
  console.log(
    `${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.green}  SYSTEM MERGE FIELDS SEEDED SUCCESSFULLY!${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log('');

  // Group by category
  const byCategory = new Map<MergeFieldCategory, MergeField[]>();
  for (const field of mergeFields) {
    const list = byCategory.get(field.category) ?? [];
    list.push(field);
    byCategory.set(field.category, list);
  }

  for (const [category, fields] of byCategory) {
    console.log(
      `${colors.bright}${category} Fields (${fields.length}):${colors.reset}`,
    );
    console.log('');

    for (const field of fields) {
      console.log(`  ${colors.cyan}{{${field.key}}}${colors.reset}`);
      console.log(`    Display: ${field.displayName}`);
      console.log(`    Type: ${field.dataType}`);
      if (field.description) {
        console.log(`    Desc: ${field.description}`);
      }
    }
    console.log('');
  }

  console.log(
    `${colors.bright}Total: ${mergeFields.length} fields${colors.reset}`,
  );
}

/**
 * Main seeding function
 */
async function seedMergeFieldsMain(): Promise<void> {
  const forceFlag = process.argv.includes('--force');

  log('Starting system merge field seeding...', 'info');
  log(
    `Database: ${process.env['DATABASE_URL'] ?? 'using default URL'}`,
    'info',
  );

  let orm: MikroORM | null = null;

  try {
    // Initialize ORM
    orm = await MikroORM.init<PostgreSqlDriver>(getORMConfig());
    log('Database connection established', 'success');

    // Check for existing merge fields
    const existingFields = await checkExistingMergeFields(orm);

    if (existingFields.length > 0) {
      if (forceFlag) {
        log(
          'Force flag detected, clearing existing system merge fields...',
          'warn',
        );
        await clearMergeFields(orm);
      } else {
        log(
          `Found ${existingFields.length} existing system merge field(s)`,
          'info',
        );
        log(
          'Merge fields will be updated in place (use --force to recreate)',
          'info',
        );
      }
    }

    // Seed merge fields
    const mergeFields = await seedMergeFields(orm);

    // Print summary
    printSummary(mergeFields);
  } catch (error) {
    log(
      `Merge field seeding failed: ${error instanceof Error ? error.message : String(error)}`,
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
seedMergeFieldsMain()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Fatal error during merge field seeding:', error);
    process.exit(1);
  });
