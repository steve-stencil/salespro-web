import { Migration } from '@mikro-orm/migrations';

/**
 * Migration for Office ETL support.
 *
 * Changes:
 * - Adds source_id column to office table for tracking Parse objectId
 * - Creates migration_session table for tracking migration progress
 */
export class Migration20251224000000 extends Migration {
  override up(): void {
    // Add source_id column to office table
    this.addSql(
      `alter table "office" add column "source_id" varchar(255) null;`,
    );

    // Add index for source_id (for deduplication lookups)
    this.addSql(
      `create index "office_source_id_index" on "office" ("source_id");`,
    );

    // Create migration_session table
    this.addSql(`
      create table "migration_session" (
        "id" uuid not null,
        "company_id" uuid not null,
        "created_by_id" uuid not null,
        "status" varchar(50) not null default 'pending',
        "total_count" int not null default 0,
        "imported_count" int not null default 0,
        "skipped_count" int not null default 0,
        "error_count" int not null default 0,
        "errors" jsonb not null default '[]',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "completed_at" timestamptz null,
        constraint "migration_session_pkey" primary key ("id")
      );
    `);

    // Add foreign key constraints
    this.addSql(`
      alter table "migration_session" 
        add constraint "migration_session_company_id_foreign" 
        foreign key ("company_id") references "company" ("id") 
        on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "migration_session" 
        add constraint "migration_session_created_by_id_foreign" 
        foreign key ("created_by_id") references "user" ("id") 
        on update cascade on delete cascade;
    `);

    // Add indexes
    this.addSql(
      `create index "migration_session_company_id_index" on "migration_session" ("company_id");`,
    );
    this.addSql(
      `create index "migration_session_created_by_id_index" on "migration_session" ("created_by_id");`,
    );
    this.addSql(
      `create index "migration_session_status_index" on "migration_session" ("status");`,
    );
  }

  override down(): void {
    // Drop migration_session table
    this.addSql(`drop table if exists "migration_session" cascade;`);

    // Drop source_id column from office
    this.addSql(`drop index if exists "office_source_id_index";`);
    this.addSql(`alter table "office" drop column if exists "source_id";`);
  }
}
