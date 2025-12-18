import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add company logo support.
 *
 * Changes:
 * - Adds logo_file_id column to company table
 * - Creates foreign key relationship to files table
 */
export class Migration20251218000000 extends Migration {
  override up(): void {
    // Add logo_file_id column to company table
    this.addSql(`alter table "company" add column "logo_file_id" uuid null;`);

    // Add foreign key constraint
    this.addSql(
      `alter table "company" add constraint "company_logo_file_id_foreign" foreign key ("logo_file_id") references "file" ("id") on update cascade on delete set null;`,
    );

    // Add index for logo_file_id
    this.addSql(
      `create index "company_logo_file_id_index" on "company" ("logo_file_id");`,
    );
  }

  override down(): void {
    // Drop foreign key constraint
    this.addSql(
      `alter table "company" drop constraint if exists "company_logo_file_id_foreign";`,
    );

    // Drop index
    this.addSql(`drop index if exists "company_logo_file_id_index";`);

    // Drop column
    this.addSql(`alter table "company" drop column if exists "logo_file_id";`);
  }
}
