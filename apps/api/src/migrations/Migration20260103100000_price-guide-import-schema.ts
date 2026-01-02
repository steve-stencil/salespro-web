import { Migration } from '@mikro-orm/migrations';

/**
 * Migration for Price Guide Import Schema changes.
 *
 * This migration prepares the database for the Price Guide ETL import system.
 *
 * Changes:
 * 1. Add `is_tag` to junction table (replaces legacy tag fields on MSI)
 * 2. Add `migration_session_id` to all price-guide entities for rollback support
 * 3. Add `quantity_mode` enum and column to MSI
 * 4. Convert `sort_order` from numeric to varchar(50) for fractional indexing
 * 5. Add new statuses to MigrationSessionStatus enum
 * 6. Remove legacy tag fields from MSI (tagTitle, tagRequired, tagPickerOptions, tagParams)
 */
export class Migration20260103100000_price_guide_import_schema extends Migration {
  override up(): void {
    // ============================================================
    // 1. Create QuantityMode enum type
    // ============================================================
    this.addSql(`
      DO $$ BEGIN
        CREATE TYPE "quantity_mode" AS ENUM ('MANUAL', 'FORMULA');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // 2. Add quantity_mode to measure_sheet_item
    // ============================================================
    this.addSql(`
      ALTER TABLE "measure_sheet_item"
      ADD COLUMN IF NOT EXISTS "quantity_mode" "quantity_mode" NOT NULL DEFAULT 'MANUAL';
    `);

    // ============================================================
    // 3. Add migration_session_id to all price-guide entities
    // ============================================================
    const tablesNeedingMigrationSessionId = [
      'additional_detail_field',
      'measure_sheet_item',
      'measure_sheet_item_additional_detail_field',
      'measure_sheet_item_office',
      'measure_sheet_item_option',
      'measure_sheet_item_up_charge',
      'option_price',
      'price_guide_category',
      'price_guide_image',
      'price_guide_option',
      'up_charge',
      'up_charge_additional_detail_field',
      'up_charge_disabled_option',
      'up_charge_price',
    ];

    for (const table of tablesNeedingMigrationSessionId) {
      this.addSql(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "migration_session_id" uuid NULL;
      `);
      this.addSql(`
        CREATE INDEX IF NOT EXISTS "idx_${table}_migration_session_id"
        ON "${table}" ("migration_session_id");
      `);
    }

    // ============================================================
    // 4. Add is_tag to measure_sheet_item_additional_detail_field
    // ============================================================
    this.addSql(`
      ALTER TABLE "measure_sheet_item_additional_detail_field"
      ADD COLUMN IF NOT EXISTS "is_tag" boolean NOT NULL DEFAULT false;
    `);

    // Add partial unique index (only one tag per MSI)
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_msi_adf_single_tag"
      ON "measure_sheet_item_additional_detail_field" ("measure_sheet_item_id")
      WHERE "is_tag" = true;
    `);

    // ============================================================
    // 5. Convert sort_order from numeric to varchar(50) for fractional indexing
    // ============================================================

    // 5a. measure_sheet_item: decimal(18,8) -> varchar(50)
    this.addSql(`
      ALTER TABLE "measure_sheet_item"
      ADD COLUMN IF NOT EXISTS "sort_order_new" varchar(50);
    `);
    // Convert existing numeric values to fractional index strings
    // Using 'a' prefix + row_number to create initial fractional keys
    this.addSql(`
      UPDATE "measure_sheet_item"
      SET "sort_order_new" = 'a' || LPAD(ROW_NUMBER() OVER (PARTITION BY "category_id" ORDER BY "sort_order" NULLS LAST, "id")::text, 3, '0')
      FROM (SELECT id, sort_order, category_id FROM "measure_sheet_item") AS sub
      WHERE "measure_sheet_item"."id" = sub."id"
      AND "sort_order_new" IS NULL;
    `);
    // Set default for any remaining nulls
    this.addSql(`
      UPDATE "measure_sheet_item"
      SET "sort_order_new" = 'a0'
      WHERE "sort_order_new" IS NULL;
    `);
    // Drop old column and rename new
    this.addSql(
      `ALTER TABLE "measure_sheet_item" DROP COLUMN IF EXISTS "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" RENAME COLUMN "sort_order_new" TO "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" ALTER COLUMN "sort_order" SET NOT NULL;`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" ALTER COLUMN "sort_order" SET DEFAULT 'a0';`,
    );
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_measure_sheet_item_sort_order"
      ON "measure_sheet_item" ("sort_order");
    `);

    // 5b. price_guide_category: integer -> varchar(50)
    this.addSql(`
      ALTER TABLE "price_guide_category"
      ADD COLUMN IF NOT EXISTS "sort_order_new" varchar(50);
    `);
    this.addSql(`
      UPDATE "price_guide_category"
      SET "sort_order_new" = 'a' || LPAD(ROW_NUMBER() OVER (PARTITION BY "parent_id" ORDER BY "sort_order" NULLS LAST, "id")::text, 3, '0')
      FROM (SELECT id, sort_order, parent_id FROM "price_guide_category") AS sub
      WHERE "price_guide_category"."id" = sub."id"
      AND "sort_order_new" IS NULL;
    `);
    this.addSql(`
      UPDATE "price_guide_category"
      SET "sort_order_new" = 'a0'
      WHERE "sort_order_new" IS NULL;
    `);
    this.addSql(
      `ALTER TABLE "price_guide_category" DROP COLUMN IF EXISTS "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_category" RENAME COLUMN "sort_order_new" TO "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_category" ALTER COLUMN "sort_order" SET NOT NULL;`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_category" ALTER COLUMN "sort_order" SET DEFAULT 'a0';`,
    );
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_price_guide_category_sort_order"
      ON "price_guide_category" ("sort_order");
    `);

    // 5c. measure_sheet_item_additional_detail_field: integer -> varchar(50)
    this.addSql(`
      ALTER TABLE "measure_sheet_item_additional_detail_field"
      ADD COLUMN IF NOT EXISTS "sort_order_new" varchar(50);
    `);
    this.addSql(`
      UPDATE "measure_sheet_item_additional_detail_field"
      SET "sort_order_new" = 'a' || LPAD(ROW_NUMBER() OVER (PARTITION BY "measure_sheet_item_id" ORDER BY "sort_order" NULLS LAST, "id")::text, 3, '0')
      FROM (SELECT id, sort_order, measure_sheet_item_id FROM "measure_sheet_item_additional_detail_field") AS sub
      WHERE "measure_sheet_item_additional_detail_field"."id" = sub."id"
      AND "sort_order_new" IS NULL;
    `);
    this.addSql(`
      UPDATE "measure_sheet_item_additional_detail_field"
      SET "sort_order_new" = 'a0'
      WHERE "sort_order_new" IS NULL;
    `);
    this.addSql(
      `ALTER TABLE "measure_sheet_item_additional_detail_field" DROP COLUMN IF EXISTS "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_additional_detail_field" RENAME COLUMN "sort_order_new" TO "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_additional_detail_field" ALTER COLUMN "sort_order" SET NOT NULL;`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_additional_detail_field" ALTER COLUMN "sort_order" SET DEFAULT 'a0';`,
    );
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_msi_adf_sort_order"
      ON "measure_sheet_item_additional_detail_field" ("sort_order");
    `);

    // ============================================================
    // 6. Remove legacy tag fields from measure_sheet_item
    // ============================================================
    this.addSql(
      `ALTER TABLE "measure_sheet_item" DROP COLUMN IF EXISTS "tag_title";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" DROP COLUMN IF EXISTS "tag_required";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" DROP COLUMN IF EXISTS "tag_picker_options";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" DROP COLUMN IF EXISTS "tag_params";`,
    );

    // ============================================================
    // 7. Update MigrationSessionStatus enum (if using native enum)
    // Note: MikroORM uses text with check constraint, not native enum
    // The entity change handles this automatically
    // ============================================================
  }

  override down(): void {
    // ============================================================
    // Reverse: Add back legacy tag fields to measure_sheet_item
    // ============================================================
    this.addSql(`
      ALTER TABLE "measure_sheet_item"
      ADD COLUMN IF NOT EXISTS "tag_title" varchar(255) NULL;
    `);
    this.addSql(`
      ALTER TABLE "measure_sheet_item"
      ADD COLUMN IF NOT EXISTS "tag_required" boolean NOT NULL DEFAULT false;
    `);
    this.addSql(`
      ALTER TABLE "measure_sheet_item"
      ADD COLUMN IF NOT EXISTS "tag_picker_options" jsonb NULL;
    `);
    this.addSql(`
      ALTER TABLE "measure_sheet_item"
      ADD COLUMN IF NOT EXISTS "tag_params" jsonb NULL;
    `);

    // ============================================================
    // Reverse: Convert sort_order back to numeric types
    // ============================================================

    // measure_sheet_item: varchar(50) -> decimal(18,8)
    this.addSql(`DROP INDEX IF EXISTS "idx_measure_sheet_item_sort_order";`);
    this.addSql(`
      ALTER TABLE "measure_sheet_item"
      ADD COLUMN IF NOT EXISTS "sort_order_old" decimal(18,8);
    `);
    this.addSql(`
      UPDATE "measure_sheet_item"
      SET "sort_order_old" = ROW_NUMBER() OVER (PARTITION BY "category_id" ORDER BY "sort_order", "id");
    `);
    this.addSql(
      `ALTER TABLE "measure_sheet_item" DROP COLUMN IF EXISTS "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" RENAME COLUMN "sort_order_old" TO "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" ALTER COLUMN "sort_order" SET NOT NULL;`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" ALTER COLUMN "sort_order" SET DEFAULT 0;`,
    );

    // price_guide_category: varchar(50) -> integer
    this.addSql(`DROP INDEX IF EXISTS "idx_price_guide_category_sort_order";`);
    this.addSql(`
      ALTER TABLE "price_guide_category"
      ADD COLUMN IF NOT EXISTS "sort_order_old" integer;
    `);
    this.addSql(`
      UPDATE "price_guide_category"
      SET "sort_order_old" = ROW_NUMBER() OVER (PARTITION BY "parent_id" ORDER BY "sort_order", "id");
    `);
    this.addSql(
      `ALTER TABLE "price_guide_category" DROP COLUMN IF EXISTS "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_category" RENAME COLUMN "sort_order_old" TO "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_category" ALTER COLUMN "sort_order" SET NOT NULL;`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_category" ALTER COLUMN "sort_order" SET DEFAULT 0;`,
    );

    // measure_sheet_item_additional_detail_field: varchar(50) -> integer
    this.addSql(`DROP INDEX IF EXISTS "idx_msi_adf_sort_order";`);
    this.addSql(`
      ALTER TABLE "measure_sheet_item_additional_detail_field"
      ADD COLUMN IF NOT EXISTS "sort_order_old" integer;
    `);
    this.addSql(`
      UPDATE "measure_sheet_item_additional_detail_field"
      SET "sort_order_old" = ROW_NUMBER() OVER (PARTITION BY "measure_sheet_item_id" ORDER BY "sort_order", "id");
    `);
    this.addSql(
      `ALTER TABLE "measure_sheet_item_additional_detail_field" DROP COLUMN IF EXISTS "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_additional_detail_field" RENAME COLUMN "sort_order_old" TO "sort_order";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_additional_detail_field" ALTER COLUMN "sort_order" SET NOT NULL;`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_additional_detail_field" ALTER COLUMN "sort_order" SET DEFAULT 0;`,
    );

    // ============================================================
    // Reverse: Remove is_tag from junction table
    // ============================================================
    this.addSql(`DROP INDEX IF EXISTS "idx_msi_adf_single_tag";`);
    this.addSql(`
      ALTER TABLE "measure_sheet_item_additional_detail_field"
      DROP COLUMN IF EXISTS "is_tag";
    `);

    // ============================================================
    // Reverse: Remove migration_session_id from all tables
    // ============================================================
    const tablesWithMigrationSessionId = [
      'additional_detail_field',
      'measure_sheet_item',
      'measure_sheet_item_additional_detail_field',
      'measure_sheet_item_office',
      'measure_sheet_item_option',
      'measure_sheet_item_up_charge',
      'option_price',
      'price_guide_category',
      'price_guide_image',
      'price_guide_option',
      'up_charge',
      'up_charge_additional_detail_field',
      'up_charge_disabled_option',
      'up_charge_price',
    ];

    for (const table of tablesWithMigrationSessionId) {
      this.addSql(`DROP INDEX IF EXISTS "idx_${table}_migration_session_id";`);
      this.addSql(`
        ALTER TABLE "${table}"
        DROP COLUMN IF EXISTS "migration_session_id";
      `);
    }

    // ============================================================
    // Reverse: Remove quantity_mode from measure_sheet_item
    // ============================================================
    this.addSql(`
      ALTER TABLE "measure_sheet_item"
      DROP COLUMN IF EXISTS "quantity_mode";
    `);

    // Note: We don't drop the enum type as it may be used elsewhere
    // and dropping it would require checking all usages
  }
}
