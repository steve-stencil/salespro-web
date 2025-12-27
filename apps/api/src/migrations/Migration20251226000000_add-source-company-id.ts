import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add source_company_id column to migration_session table.
 *
 * This column stores the source company objectId from the legacy system
 * to ensure all queries are scoped correctly during ETL.
 */
export class Migration20251226000000 extends Migration {
  override up(): void {
    this.addSql(`
      alter table "migration_session" 
        add column "source_company_id" varchar(255) not null default '';
    `);
  }

  override down(): void {
    this.addSql(`
      alter table "migration_session" 
        drop column if exists "source_company_id";
    `);
  }
}
