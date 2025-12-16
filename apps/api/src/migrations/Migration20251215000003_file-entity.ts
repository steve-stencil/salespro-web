import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create the file entity table for file uploads.
 * - Creates the file table with all metadata columns
 * - Adds foreign keys to company and user tables
 * - Creates indexes for efficient querying
 */
export class Migration20251215000003_FileEntity extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Create file table
    this.addSql(`
      create table "file" (
        "id" uuid not null,
        "filename" varchar(255) not null,
        "storage_key" varchar(500) not null,
        "mime_type" varchar(255) not null,
        "size" bigint not null,
        "visibility" varchar(255) not null default 'company',
        "status" varchar(255) not null default 'active',
        "company_id" uuid not null,
        "uploaded_by_id" uuid not null,
        "thumbnail_key" varchar(500) null,
        "description" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "file_pkey" primary key ("id"),
        constraint "file_visibility_check" check ("visibility" in ('private', 'company', 'public')),
        constraint "file_status_check" check ("status" in ('pending', 'active', 'deleted'))
      );
    `);

    // Add foreign key constraints
    this.addSql(`
      alter table "file" 
      add constraint "file_company_id_foreign" 
      foreign key ("company_id") 
      references "company" ("id") 
      on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "file" 
      add constraint "file_uploaded_by_id_foreign" 
      foreign key ("uploaded_by_id") 
      references "user" ("id") 
      on update cascade on delete cascade;
    `);

    // Create indexes for efficient querying
    this.addSql(
      `create index "file_storage_key_index" on "file" ("storage_key");`,
    );
    this.addSql(
      `create index "file_company_id_index" on "file" ("company_id");`,
    );
    this.addSql(
      `create index "file_uploaded_by_id_index" on "file" ("uploaded_by_id");`,
    );
    this.addSql(`create index "file_status_index" on "file" ("status");`);
    this.addSql(
      `create index "file_created_at_index" on "file" ("created_at");`,
    );

    // Composite index for common query patterns
    this.addSql(
      `create index "file_company_status_index" on "file" ("company_id", "status");`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop indexes
    this.addSql(`drop index if exists "file_company_status_index";`);
    this.addSql(`drop index if exists "file_created_at_index";`);
    this.addSql(`drop index if exists "file_status_index";`);
    this.addSql(`drop index if exists "file_uploaded_by_id_index";`);
    this.addSql(`drop index if exists "file_company_id_index";`);
    this.addSql(`drop index if exists "file_storage_key_index";`);

    // Drop table (constraints will be dropped automatically)
    this.addSql(`drop table if exists "file";`);
  }
}
