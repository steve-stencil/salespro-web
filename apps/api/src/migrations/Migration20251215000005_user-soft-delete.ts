import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add soft delete support to the user table.
 * Adds deleted_at timestamp column to track when users are soft deleted.
 */
export class Migration20251215000005_UserSoftDelete extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Add deleted_at column (nullable timestamp)
    this.addSql(`alter table "user" add column "deleted_at" timestamptz null;`);

    // Add index for efficient filtering of non-deleted users
    this.addSql(
      `create index "user_deleted_at_index" on "user" ("deleted_at");`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop index
    this.addSql(`drop index if exists "user_deleted_at_index";`);

    // Drop column
    this.addSql(`alter table "user" drop column "deleted_at";`);
  }
}
