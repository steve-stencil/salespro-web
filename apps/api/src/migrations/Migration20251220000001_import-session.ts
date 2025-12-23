import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create the ImportSession table for ETL progress tracking.
 */
export class Migration20251220000001 extends Migration {
  override up(): void {
    this.addSql(`
      create table "import_session" (
        "id" uuid not null default gen_random_uuid(),
        "company_id" uuid not null,
        "created_by_id" uuid not null,
        "status" varchar(255) not null default 'pending',
        "office_mapping" jsonb not null default '{}',
        "type_mapping" jsonb not null default '{}',
        "total_count" int not null default 0,
        "imported_count" int not null default 0,
        "skipped_count" int not null default 0,
        "error_count" int not null default 0,
        "errors" jsonb not null default '[]',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "completed_at" timestamptz null,
        constraint "import_session_pkey" primary key ("id")
      );
    `);

    // Add foreign key to company
    this.addSql(`
      alter table "import_session"
        add constraint "import_session_company_id_foreign"
        foreign key ("company_id") references "company" ("id")
        on update cascade on delete cascade;
    `);

    // Add foreign key to user
    this.addSql(`
      alter table "import_session"
        add constraint "import_session_created_by_id_foreign"
        foreign key ("created_by_id") references "user" ("id")
        on update cascade on delete cascade;
    `);

    // Create indexes
    this.addSql(
      `create index "import_session_company_id_index" on "import_session" ("company_id");`,
    );
    this.addSql(
      `create index "import_session_created_by_id_index" on "import_session" ("created_by_id");`,
    );
    this.addSql(
      `create index "import_session_status_index" on "import_session" ("status");`,
    );
  }

  override down(): void {
    this.addSql(`drop index if exists "import_session_status_index";`);
    this.addSql(`drop index if exists "import_session_created_by_id_index";`);
    this.addSql(`drop index if exists "import_session_company_id_index";`);
    this.addSql(`
      alter table "import_session"
        drop constraint if exists "import_session_created_by_id_foreign";
    `);
    this.addSql(`
      alter table "import_session"
        drop constraint if exists "import_session_company_id_foreign";
    `);
    this.addSql(`drop table if exists "import_session";`);
  }
}
