import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to refactor platform roles from companyAccessLevel enum to explicit companyPermissions array.
 *
 * This migration:
 * 1. Adds the company_permissions JSON column to the role table
 * 2. Migrates existing platform roles based on their companyAccessLevel:
 *    - FULL → ['*'] (full access)
 *    - READ_ONLY → explicit list of all :read permissions
 *    - CUSTOM → non-platform permissions from the role's permissions array
 * 3. Drops the company_access_level column
 */
export class Migration20251218000000_PlatformRoleCompanyPermissions extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Step 1: Add company_permissions column with default empty array
    this.addSql(
      `alter table "role" add column "company_permissions" jsonb not null default '[]';`,
    );

    // Step 2: Migrate existing platform roles based on companyAccessLevel

    // FULL access → ['*'] (superuser access)
    this.addSql(
      `update "role" set "company_permissions" = '["*"]'
       where "type" = 'platform' and "company_access_level" = 'full';`,
    );

    // READ_ONLY access → all :read permissions
    this.addSql(
      `update "role" set "company_permissions" = '["customer:read", "user:read", "office:read", "role:read", "report:read", "settings:read", "company:read", "file:read"]'
       where "type" = 'platform' and "company_access_level" = 'read_only';`,
    );

    // CUSTOM access → non-platform permissions from the role's permissions array
    // Filter out platform: permissions, keeping only company-level permissions
    this.addSql(
      `update "role" set "company_permissions" = (
         select coalesce(
           jsonb_agg(elem),
           '[]'::jsonb
         )
         from jsonb_array_elements_text("permissions") as elem
         where elem not like 'platform:%'
       )
       where "type" = 'platform' and "company_access_level" = 'custom';`,
    );

    // Step 3: Drop the old company_access_level column
    this.addSql(`alter table "role" drop column "company_access_level";`);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Step 1: Re-add company_access_level column
    this.addSql(
      `alter table "role" add column "company_access_level" varchar(255) null;`,
    );

    // Step 2: Reverse migrate based on companyPermissions content

    // ['*'] → FULL access
    this.addSql(
      `update "role" set "company_access_level" = 'full'
       where "type" = 'platform' and "company_permissions" = '["*"]';`,
    );

    // Explicit read permissions → READ_ONLY access
    // Check if it contains only :read permissions
    this.addSql(
      `update "role" set "company_access_level" = 'read_only'
       where "type" = 'platform' 
         and "company_access_level" is null
         and "company_permissions" != '["*"]'
         and "company_permissions" != '[]'
         and (
           select bool_and(elem like '%:read')
           from jsonb_array_elements_text("company_permissions") as elem
         ) = true;`,
    );

    // Everything else → CUSTOM access
    this.addSql(
      `update "role" set "company_access_level" = 'custom'
       where "type" = 'platform' and "company_access_level" is null;`,
    );

    // Step 3: Drop the company_permissions column
    this.addSql(`alter table "role" drop column "company_permissions";`);
  }
}
