import { Migration } from '@mikro-orm/migrations';

/**
 * Migration: Add PRICE_GUIDE_IMAGE to taggable entity type check constraint.
 *
 * This migration updates the item_tag table's entity_type check constraint
 * to include PRICE_GUIDE_IMAGE, allowing images to be tagged.
 */
export class Migration20251231100000_add_price_guide_image_to_taggable_entity_type extends Migration {
  override up(): void {
    // Drop the existing check constraint
    this.addSql(`
      ALTER TABLE "item_tag" 
      DROP CONSTRAINT IF EXISTS "item_tag_entity_type_check";
    `);

    // Add updated check constraint with PRICE_GUIDE_IMAGE
    this.addSql(`
      ALTER TABLE "item_tag" 
      ADD CONSTRAINT "item_tag_entity_type_check" 
      CHECK ("entity_type" IN ('OPTION', 'UPCHARGE', 'ADDITIONAL_DETAIL', 'MEASURE_SHEET_ITEM', 'PRICE_GUIDE_IMAGE'));
    `);
  }

  override down(): void {
    // First delete any PRICE_GUIDE_IMAGE entries (if reverting)
    this.addSql(`
      DELETE FROM "item_tag" 
      WHERE "entity_type" = 'PRICE_GUIDE_IMAGE';
    `);

    // Drop the updated constraint
    this.addSql(`
      ALTER TABLE "item_tag" 
      DROP CONSTRAINT IF EXISTS "item_tag_entity_type_check";
    `);

    // Restore previous check constraint (without PRICE_GUIDE_IMAGE)
    this.addSql(`
      ALTER TABLE "item_tag" 
      ADD CONSTRAINT "item_tag_entity_type_check" 
      CHECK ("entity_type" IN ('OPTION', 'UPCHARGE', 'ADDITIONAL_DETAIL', 'MEASURE_SHEET_ITEM'));
    `);
  }
}
