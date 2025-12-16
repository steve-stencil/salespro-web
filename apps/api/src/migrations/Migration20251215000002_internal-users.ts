import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add internal user support.
 * - Adds user_type column to user table (company vs internal)
 * - Makes company_id nullable in user table (internal users don't belong to a company)
 * - Adds active_company_id to session table (for internal users to switch companies)
 * - Adds company_access_level to role table (for platform roles)
 * - Updates role.type check constraint to include 'platform'
 * - Makes user_role.company_id nullable (platform roles don't have a company)
 */
export class Migration20251215000002_InternalUsers extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Add user_type column to user table with default 'company'
    this.addSql(
      `alter table "user" add column "user_type" varchar(255) not null default 'company';`,
    );

    // Make company_id nullable in user table (internal users don't need a company)
    this.addSql(`alter table "user" alter column "company_id" drop not null;`);

    // Add active_company_id column to session table for internal user company switching
    this.addSql(
      `alter table "session" add column "active_company_id" uuid null;`,
    );
    this.addSql(
      `alter table "session" add constraint "session_active_company_id_foreign" foreign key ("active_company_id") references "company" ("id") on update cascade on delete set null;`,
    );

    // Add company_access_level column to role table for platform roles
    this.addSql(
      `alter table "role" add column "company_access_level" varchar(255) null;`,
    );

    // Update role.type check constraint to include 'platform'
    this.addSql(`alter table "role" drop constraint "role_type_check";`);
    this.addSql(
      `alter table "role" add constraint "role_type_check" check ("type" in ('platform', 'system', 'company'));`,
    );

    // Make user_role.company_id nullable (platform roles for internal users don't have a company)
    this.addSql(
      `alter table "user_role" alter column "company_id" drop not null;`,
    );

    // Create index on user_type for efficient filtering
    this.addSql(`create index "user_user_type_index" on "user" ("user_type");`);

    // Create index on session.active_company_id for efficient lookups
    this.addSql(
      `create index "session_active_company_id_index" on "session" ("active_company_id");`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop indexes
    this.addSql(`drop index if exists "session_active_company_id_index";`);
    this.addSql(`drop index if exists "user_user_type_index";`);

    // Restore user_role.company_id NOT NULL constraint
    // Note: This will fail if there are platform roles without a company
    this.addSql(
      `alter table "user_role" alter column "company_id" set not null;`,
    );

    // Restore role.type check constraint to original (system, company only)
    this.addSql(`alter table "role" drop constraint "role_type_check";`);
    this.addSql(
      `alter table "role" add constraint "role_type_check" check ("type" in ('system', 'company'));`,
    );

    // Drop company_access_level from role table
    this.addSql(`alter table "role" drop column "company_access_level";`);

    // Drop active_company_id from session table
    this.addSql(
      `alter table "session" drop constraint if exists "session_active_company_id_foreign";`,
    );
    this.addSql(`alter table "session" drop column "active_company_id";`);

    // Make company_id NOT NULL again (requires all users to have a company)
    // Note: This will fail if there are internal users without a company
    this.addSql(`alter table "user" alter column "company_id" set not null;`);

    // Drop user_type column from user table
    this.addSql(`alter table "user" drop column "user_type";`);
  }
}
