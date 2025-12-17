import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add multi-company user access.
 *
 * Creates two new tables:
 * - user_company: Junction table for company user multi-company memberships
 * - internal_user_company: Restricts which companies internal users can access
 *
 * Also includes backfill logic to migrate existing User.company relationships
 * to UserCompany entries.
 */
export class Migration20251217000000_MultiCompanyAccess extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Create user_company junction table
    this.addSql(
      `create table "user_company" (
        "id" uuid not null,
        "user_id" uuid not null,
        "company_id" uuid not null,
        "is_active" boolean not null default true,
        "is_pinned" boolean not null default false,
        "joined_at" timestamptz not null,
        "last_accessed_at" timestamptz null,
        "deactivated_at" timestamptz null,
        "deactivated_by_id" uuid null,
        constraint "user_company_pkey" primary key ("id")
      );`,
    );

    // Create indexes for user_company
    this.addSql(
      `create index "user_company_user_id_index" on "user_company" ("user_id");`,
    );
    this.addSql(
      `create index "user_company_company_id_index" on "user_company" ("company_id");`,
    );
    this.addSql(
      `create index "user_company_last_accessed_at_index" on "user_company" ("last_accessed_at");`,
    );

    // Unique constraint to prevent duplicate user-company assignments
    this.addSql(
      `alter table "user_company" add constraint "user_company_user_id_company_id_unique" unique ("user_id", "company_id");`,
    );

    // Add foreign key constraints for user_company table
    this.addSql(
      `alter table "user_company" add constraint "user_company_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "user_company" add constraint "user_company_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "user_company" add constraint "user_company_deactivated_by_id_foreign" foreign key ("deactivated_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    // Create internal_user_company junction table
    this.addSql(
      `create table "internal_user_company" (
        "id" uuid not null,
        "user_id" uuid not null,
        "company_id" uuid not null,
        "is_pinned" boolean not null default false,
        "granted_at" timestamptz not null,
        "last_accessed_at" timestamptz null,
        "granted_by_id" uuid null,
        constraint "internal_user_company_pkey" primary key ("id")
      );`,
    );

    // Create indexes for internal_user_company
    this.addSql(
      `create index "internal_user_company_user_id_index" on "internal_user_company" ("user_id");`,
    );
    this.addSql(
      `create index "internal_user_company_company_id_index" on "internal_user_company" ("company_id");`,
    );
    this.addSql(
      `create index "internal_user_company_last_accessed_at_index" on "internal_user_company" ("last_accessed_at");`,
    );

    // Unique constraint to prevent duplicate assignments
    this.addSql(
      `alter table "internal_user_company" add constraint "internal_user_company_user_id_company_id_unique" unique ("user_id", "company_id");`,
    );

    // Add foreign key constraints for internal_user_company table
    this.addSql(
      `alter table "internal_user_company" add constraint "internal_user_company_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "internal_user_company" add constraint "internal_user_company_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "internal_user_company" add constraint "internal_user_company_granted_by_id_foreign" foreign key ("granted_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    // Backfill: Create UserCompany entries for existing company users
    // This ensures existing users continue to work with the new system
    this.addSql(
      `insert into "user_company" ("id", "user_id", "company_id", "is_active", "is_pinned", "joined_at", "last_accessed_at")
       select gen_random_uuid(), "id", "company_id", true, false, "created_at", "last_login_date"
       from "user"
       where "company_id" is not null
         and "user_type" = 'company'
         and "deleted_at" is null;`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop foreign key constraints from internal_user_company
    this.addSql(
      `alter table "internal_user_company" drop constraint if exists "internal_user_company_granted_by_id_foreign";`,
    );
    this.addSql(
      `alter table "internal_user_company" drop constraint if exists "internal_user_company_company_id_foreign";`,
    );
    this.addSql(
      `alter table "internal_user_company" drop constraint if exists "internal_user_company_user_id_foreign";`,
    );

    // Drop internal_user_company table
    this.addSql(`drop table if exists "internal_user_company" cascade;`);

    // Drop foreign key constraints from user_company
    this.addSql(
      `alter table "user_company" drop constraint if exists "user_company_deactivated_by_id_foreign";`,
    );
    this.addSql(
      `alter table "user_company" drop constraint if exists "user_company_company_id_foreign";`,
    );
    this.addSql(
      `alter table "user_company" drop constraint if exists "user_company_user_id_foreign";`,
    );

    // Drop user_company table
    this.addSql(`drop table if exists "user_company" cascade;`);
  }
}
