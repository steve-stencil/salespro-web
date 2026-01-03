import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to fix the allowed_offices column type from jsonb to text[].
 *
 * The UserInvite entity defines allowed_offices as type: 'array' which
 * MikroORM expects to be a PostgreSQL array (text[]), not jsonb.
 */
export class Migration20260103200001_FixAllowedOfficesColumnType extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Convert allowed_offices from jsonb to text[]
    // First create a temporary column with the correct type
    this.addSql(
      `alter table "user_invite" add column "allowed_offices_new" text[] not null default '{}';`,
    );

    // Migrate any existing data (convert jsonb array to text array)
    // This handles the case where there might be existing data in jsonb format
    this.addSql(
      `update "user_invite" set "allowed_offices_new" = 
        CASE 
          WHEN "allowed_offices"::text = '[]' THEN '{}'::text[]
          ELSE (
            SELECT array_agg(elem::text)
            FROM jsonb_array_elements_text("allowed_offices") AS elem
          )
        END;`,
    );

    // Drop the old column
    this.addSql(`alter table "user_invite" drop column "allowed_offices";`);

    // Rename the new column
    this.addSql(
      `alter table "user_invite" rename column "allowed_offices_new" to "allowed_offices";`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Convert allowed_offices from text[] to jsonb
    this.addSql(
      `alter table "user_invite" add column "allowed_offices_new" jsonb not null default '[]';`,
    );

    // Migrate data back (convert text array to jsonb array)
    this.addSql(
      `update "user_invite" set "allowed_offices_new" = to_jsonb("allowed_offices");`,
    );

    // Drop the old column
    this.addSql(`alter table "user_invite" drop column "allowed_offices";`);

    // Rename the new column
    this.addSql(
      `alter table "user_invite" rename column "allowed_offices_new" to "allowed_offices";`,
    );
  }
}
