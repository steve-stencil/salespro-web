import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add office assignment columns to user_invite table.
 * - current_office_id: The office the user will be assigned to as their current office
 * - allowed_offices: Array of office IDs the user will have access to
 */
export class Migration20251215000004_InviteOffices extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Add current_office_id column (NOT NULL, FK to office)
    this.addSql(
      `alter table "user_invite" add column "current_office_id" uuid not null;`,
    );

    // Add allowed_offices column (NOT NULL, jsonb array)
    this.addSql(
      `alter table "user_invite" add column "allowed_offices" jsonb not null default '[]';`,
    );

    // Add foreign key constraint for current_office_id
    this.addSql(
      `alter table "user_invite" add constraint "user_invite_current_office_id_foreign" foreign key ("current_office_id") references "office" ("id") on update cascade on delete cascade;`,
    );

    // Add index for current_office_id
    this.addSql(
      `create index "user_invite_current_office_id_index" on "user_invite" ("current_office_id");`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop foreign key constraint
    this.addSql(
      `alter table "user_invite" drop constraint "user_invite_current_office_id_foreign";`,
    );

    // Drop index
    this.addSql(`drop index if exists "user_invite_current_office_id_index";`);

    // Drop columns
    this.addSql(`alter table "user_invite" drop column "current_office_id";`);
    this.addSql(`alter table "user_invite" drop column "allowed_offices";`);
  }
}
