import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add user-office access management.
 * - Creates user_office join table for tracking which offices a user can access
 * - Adds current_office_id column to user table for the active office
 */
export class Migration20251215000001_UserOffice extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Create user_office junction table
    this.addSql(
      `create table "user_office" (
        "id" uuid not null,
        "user_id" uuid not null,
        "office_id" uuid not null,
        "assigned_at" timestamptz not null,
        "assigned_by_id" uuid null,
        constraint "user_office_pkey" primary key ("id")
      );`,
    );

    // Create indexes for efficient queries
    this.addSql(
      `create index "user_office_user_id_index" on "user_office" ("user_id");`,
    );
    this.addSql(
      `create index "user_office_office_id_index" on "user_office" ("office_id");`,
    );

    // Unique constraint to prevent duplicate user-office assignments
    this.addSql(
      `alter table "user_office" add constraint "user_office_user_id_office_id_unique" unique ("user_id", "office_id");`,
    );

    // Add foreign key constraints for user_office table
    this.addSql(
      `alter table "user_office" add constraint "user_office_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "user_office" add constraint "user_office_office_id_foreign" foreign key ("office_id") references "office" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "user_office" add constraint "user_office_assigned_by_id_foreign" foreign key ("assigned_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    // Add current_office_id column to user table
    this.addSql(`alter table "user" add column "current_office_id" uuid null;`);
    this.addSql(
      `alter table "user" add constraint "user_current_office_id_foreign" foreign key ("current_office_id") references "office" ("id") on update cascade on delete set null;`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop current_office_id from user table
    this.addSql(
      `alter table "user" drop constraint "user_current_office_id_foreign";`,
    );
    this.addSql(`alter table "user" drop column "current_office_id";`);

    // Drop foreign key constraints from user_office
    this.addSql(
      `alter table "user_office" drop constraint "user_office_assigned_by_id_foreign";`,
    );
    this.addSql(
      `alter table "user_office" drop constraint "user_office_office_id_foreign";`,
    );
    this.addSql(
      `alter table "user_office" drop constraint "user_office_user_id_foreign";`,
    );

    // Drop user_office table
    this.addSql(`drop table if exists "user_office" cascade;`);
  }
}
