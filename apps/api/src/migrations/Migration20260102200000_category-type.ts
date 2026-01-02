import { Migration } from '@mikro-orm/migrations';

/**
 * Adds categoryType and sourceId columns to price_guide_category table.
 * - categoryType: Controls navigation behavior in mobile app (default/detail/deep_drill_down)
 * - sourceId: Used for tracking imported categories from legacy system
 */
export class Migration20260102200000 extends Migration {
  override up(): void {
    // Add category_type enum column with default value
    this.addSql(`
      ALTER TABLE "price_guide_category" 
      ADD COLUMN "category_type" varchar(20) NOT NULL DEFAULT 'default'
    `);

    // Add source_id column for migration tracking
    this.addSql(`
      ALTER TABLE "price_guide_category" 
      ADD COLUMN "source_id" varchar(255) NULL
    `);

    // Add index on source_id for efficient lookups during import
    this.addSql(`
      CREATE INDEX "price_guide_category_source_id_index" 
      ON "price_guide_category" ("source_id")
    `);
  }

  override down(): void {
    this.addSql('DROP INDEX IF EXISTS "price_guide_category_source_id_index"');
    this.addSql(
      'ALTER TABLE "price_guide_category" DROP COLUMN IF EXISTS "source_id"',
    );
    this.addSql(
      'ALTER TABLE "price_guide_category" DROP COLUMN IF EXISTS "category_type"',
    );
  }
}
