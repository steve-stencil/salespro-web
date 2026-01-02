import { Migration } from '@mikro-orm/migrations';

/**
 * Migration: Add MEASURE_SHEET_ITEM to taggable entity type check constraint.
 *
 * This migration updates the item_tag table's entity_type check constraint
 * to include MEASURE_SHEET_ITEM, allowing MSIs to be tagged.
 */
export class Migration20251230200000_add_msi_to_taggable_entity_type extends Migration {
  override up(): void {
    // Drop the existing check constraint
    this.addSql(`
      ALTER TABLE "item_tag" 
      DROP CONSTRAINT IF EXISTS "item_tag_entity_type_check";
    `);

    // Add updated check constraint with MEASURE_SHEET_ITEM
    this.addSql(`
      ALTER TABLE "item_tag" 
      ADD CONSTRAINT "item_tag_entity_type_check" 
      CHECK ("entity_type" IN ('OPTION', 'UPCHARGE', 'ADDITIONAL_DETAIL', 'MEASURE_SHEET_ITEM'));
    `);
  }

  override down(): void {
    // First delete any MEASURE_SHEET_ITEM entries (if reverting)
    this.addSql(`
      DELETE FROM "item_tag" 
      WHERE "entity_type" = 'MEASURE_SHEET_ITEM';
    `);

    // Drop the updated constraint
    this.addSql(`
      ALTER TABLE "item_tag" 
      DROP CONSTRAINT IF EXISTS "item_tag_entity_type_check";
    `);

    // Restore original check constraint
    this.addSql(`
      ALTER TABLE "item_tag" 
      ADD CONSTRAINT "item_tag_entity_type_check" 
      CHECK ("entity_type" IN ('OPTION', 'UPCHARGE', 'ADDITIONAL_DETAIL'));
    `);
  }
}
