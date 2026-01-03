import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add existing user invite fields to user_invite table.
 *
 * These fields support multi-company invites where an existing user
 * is invited to join an additional company (vs creating a new account).
 *
 * - is_existing_user_invite: Flag indicating this is an invite for an existing user
 * - existing_user_id: Reference to the existing user (for validation when accepting)
 */
export class Migration20260103200000_InviteExistingUserFields extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Add is_existing_user_invite column (boolean, defaults to false)
    this.addSql(
      `alter table "user_invite" add column "is_existing_user_invite" boolean not null default false;`,
    );

    // Add existing_user_id column (nullable FK to user)
    this.addSql(
      `alter table "user_invite" add column "existing_user_id" uuid null;`,
    );

    // Add foreign key constraint for existing_user_id
    this.addSql(
      `alter table "user_invite" add constraint "user_invite_existing_user_id_foreign" foreign key ("existing_user_id") references "user" ("id") on update cascade on delete set null;`,
    );

    // Add index for existing_user_id
    this.addSql(
      `create index "user_invite_existing_user_id_index" on "user_invite" ("existing_user_id");`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop index
    this.addSql(`drop index if exists "user_invite_existing_user_id_index";`);

    // Drop foreign key constraint
    this.addSql(
      `alter table "user_invite" drop constraint if exists "user_invite_existing_user_id_foreign";`,
    );

    // Drop columns
    this.addSql(
      `alter table "user_invite" drop column "is_existing_user_invite";`,
    );
    this.addSql(`alter table "user_invite" drop column "existing_user_id";`);
  }
}
