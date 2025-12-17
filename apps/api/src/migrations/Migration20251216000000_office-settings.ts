import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create office_settings and office_integration tables.
 *
 * - office_settings: Core office settings (logo, branding)
 * - office_integration: Flexible integration credentials with encryption
 */
export class Migration20251216000000_OfficeSettings extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Create office_settings table
    this.addSql(`
      create table "office_settings" (
        "id" uuid not null,
        "office_id" uuid not null,
        "logo_file_id" uuid null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "office_settings_pkey" primary key ("id")
      );
    `);

    // Add foreign key constraints for office_settings
    this.addSql(`
      alter table "office_settings"
      add constraint "office_settings_office_id_foreign"
      foreign key ("office_id")
      references "office" ("id")
      on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "office_settings"
      add constraint "office_settings_logo_file_id_foreign"
      foreign key ("logo_file_id")
      references "file" ("id")
      on update cascade on delete set null;
    `);

    // Create unique index for one-to-one relationship with office
    this.addSql(
      `create unique index "office_settings_office_id_unique" on "office_settings" ("office_id");`,
    );

    // Create index for logo file lookups
    this.addSql(
      `create index "office_settings_logo_file_id_index" on "office_settings" ("logo_file_id");`,
    );

    // Create office_integration table
    this.addSql(`
      create table "office_integration" (
        "id" uuid not null,
        "office_id" uuid not null,
        "integration_key" varchar(100) not null,
        "display_name" varchar(255) not null,
        "encrypted_credentials" text null,
        "config" jsonb null,
        "is_enabled" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "office_integration_pkey" primary key ("id")
      );
    `);

    // Add foreign key constraint for office_integration
    this.addSql(`
      alter table "office_integration"
      add constraint "office_integration_office_id_foreign"
      foreign key ("office_id")
      references "office" ("id")
      on update cascade on delete cascade;
    `);

    // Create unique constraint for (office_id, integration_key)
    this.addSql(
      `create unique index "office_integration_office_id_integration_key_unique" on "office_integration" ("office_id", "integration_key");`,
    );

    // Create indexes for efficient querying
    this.addSql(
      `create index "office_integration_office_id_index" on "office_integration" ("office_id");`,
    );
    this.addSql(
      `create index "office_integration_integration_key_index" on "office_integration" ("integration_key");`,
    );
    this.addSql(
      `create index "office_integration_is_enabled_index" on "office_integration" ("is_enabled");`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop indexes for office_integration
    this.addSql(`drop index if exists "office_integration_is_enabled_index";`);
    this.addSql(
      `drop index if exists "office_integration_integration_key_index";`,
    );
    this.addSql(`drop index if exists "office_integration_office_id_index";`);
    this.addSql(
      `drop index if exists "office_integration_office_id_integration_key_unique";`,
    );

    // Drop office_integration table
    this.addSql(`drop table if exists "office_integration";`);

    // Drop indexes for office_settings
    this.addSql(`drop index if exists "office_settings_logo_file_id_index";`);
    this.addSql(`drop index if exists "office_settings_office_id_unique";`);

    // Drop office_settings table
    this.addSql(`drop table if exists "office_settings";`);
  }
}
