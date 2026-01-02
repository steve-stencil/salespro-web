import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create the Merge Field system tables.
 *
 * Creates:
 * - merge_field: Global SYSTEM merge fields (shared across all companies)
 * - custom_merge_field_definition: Per-company custom field library
 * - msi_custom_merge_field: Links MSIs to custom merge field definitions
 * - option_custom_merge_field: Links Options to custom merge field definitions
 * - up_charge_custom_merge_field: Links UpCharges to custom merge field definitions
 *
 * Also updates:
 * - item_tag entity_type check constraint to include 'CUSTOM_MERGE_FIELD'
 *
 * @see ADR-010-merge-field-system.md for design rationale
 */
export class Migration20260103000000_merge_field_system extends Migration {
  override up(): void {
    // ============================================================
    // MergeField (SYSTEM merge fields)
    // ============================================================
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "merge_field" (
        "id" uuid NOT NULL,
        "key" varchar(100) NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "description" text,
        "category" text CHECK ("category" IN ('ITEM', 'OPTION', 'UPCHARGE', 'CUSTOMER', 'USER', 'COMPANY')) NOT NULL,
        "data_type" text CHECK ("data_type" IN ('TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'BOOLEAN', 'IMAGE')) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL,
        "updated_at" timestamptz NOT NULL,
        CONSTRAINT "merge_field_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "merge_field_key_unique" ON "merge_field" ("key");
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "merge_field_category_index" ON "merge_field" ("category");
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "merge_field_category_is_active_index" ON "merge_field" ("category", "is_active");
    `);

    // ============================================================
    // CustomMergeFieldDefinition (per-company custom fields)
    // ============================================================
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "custom_merge_field_definition" (
        "id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "key" varchar(100) NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "description" text,
        "data_type" text CHECK ("data_type" IN ('TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'BOOLEAN', 'IMAGE')) NOT NULL DEFAULT 'TEXT',
        "is_active" boolean NOT NULL DEFAULT true,
        "source_id" varchar(255),
        "last_modified_by_id" uuid,
        "created_at" timestamptz NOT NULL,
        "updated_at" timestamptz NOT NULL,
        CONSTRAINT "custom_merge_field_definition_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "custom_merge_field_definition_company_id_index" ON "custom_merge_field_definition" ("company_id");
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "custom_merge_field_definition_company_id_is_active_index" ON "custom_merge_field_definition" ("company_id", "is_active");
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "custom_merge_field_definition_source_id_index" ON "custom_merge_field_definition" ("source_id");
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "custom_merge_field_definition" ADD CONSTRAINT "custom_merge_field_definition_company_id_key_unique" UNIQUE ("company_id", "key");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // MsiCustomMergeField (junction: MSI -> CustomMergeFieldDefinition)
    // ============================================================
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "msi_custom_merge_field" (
        "id" uuid NOT NULL,
        "measure_sheet_item_id" uuid NOT NULL,
        "field_definition_id" uuid NOT NULL,
        "default_value" text,
        "created_at" timestamptz NOT NULL,
        CONSTRAINT "msi_custom_merge_field_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "msi_custom_merge_field_field_definition_id_index" ON "msi_custom_merge_field" ("field_definition_id");
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "msi_custom_merge_field" ADD CONSTRAINT "msi_custom_merge_field_msi_field_unique" UNIQUE ("measure_sheet_item_id", "field_definition_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // OptionCustomMergeField (junction: Option -> CustomMergeFieldDefinition)
    // ============================================================
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "option_custom_merge_field" (
        "id" uuid NOT NULL,
        "option_id" uuid NOT NULL,
        "field_definition_id" uuid NOT NULL,
        "default_value" text,
        "created_at" timestamptz NOT NULL,
        CONSTRAINT "option_custom_merge_field_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "option_custom_merge_field_field_definition_id_index" ON "option_custom_merge_field" ("field_definition_id");
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "option_custom_merge_field" ADD CONSTRAINT "option_custom_merge_field_option_field_unique" UNIQUE ("option_id", "field_definition_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // UpChargeCustomMergeField (junction: UpCharge -> CustomMergeFieldDefinition)
    // ============================================================
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "up_charge_custom_merge_field" (
        "id" uuid NOT NULL,
        "up_charge_id" uuid NOT NULL,
        "field_definition_id" uuid NOT NULL,
        "default_value" text,
        "created_at" timestamptz NOT NULL,
        CONSTRAINT "up_charge_custom_merge_field_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "up_charge_custom_merge_field_field_definition_id_index" ON "up_charge_custom_merge_field" ("field_definition_id");
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_custom_merge_field" ADD CONSTRAINT "up_charge_custom_merge_field_upcharge_field_unique" UNIQUE ("up_charge_id", "field_definition_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Foreign Keys
    // ============================================================

    // custom_merge_field_definition -> company
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "custom_merge_field_definition" ADD CONSTRAINT "custom_merge_field_definition_company_id_foreign" FOREIGN KEY ("company_id") REFERENCES "company" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // custom_merge_field_definition -> user (last_modified_by)
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "custom_merge_field_definition" ADD CONSTRAINT "custom_merge_field_definition_last_modified_by_id_foreign" FOREIGN KEY ("last_modified_by_id") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // msi_custom_merge_field -> measure_sheet_item
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "msi_custom_merge_field" ADD CONSTRAINT "msi_custom_merge_field_measure_sheet_item_id_foreign" FOREIGN KEY ("measure_sheet_item_id") REFERENCES "measure_sheet_item" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // msi_custom_merge_field -> custom_merge_field_definition
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "msi_custom_merge_field" ADD CONSTRAINT "msi_custom_merge_field_field_definition_id_foreign" FOREIGN KEY ("field_definition_id") REFERENCES "custom_merge_field_definition" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // option_custom_merge_field -> price_guide_option
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "option_custom_merge_field" ADD CONSTRAINT "option_custom_merge_field_option_id_foreign" FOREIGN KEY ("option_id") REFERENCES "price_guide_option" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // option_custom_merge_field -> custom_merge_field_definition
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "option_custom_merge_field" ADD CONSTRAINT "option_custom_merge_field_field_definition_id_foreign" FOREIGN KEY ("field_definition_id") REFERENCES "custom_merge_field_definition" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // up_charge_custom_merge_field -> up_charge
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_custom_merge_field" ADD CONSTRAINT "up_charge_custom_merge_field_up_charge_id_foreign" FOREIGN KEY ("up_charge_id") REFERENCES "up_charge" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // up_charge_custom_merge_field -> custom_merge_field_definition
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_custom_merge_field" ADD CONSTRAINT "up_charge_custom_merge_field_field_definition_id_foreign" FOREIGN KEY ("field_definition_id") REFERENCES "custom_merge_field_definition" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Update item_tag entity_type check constraint
    // ============================================================
    this.addSql(`
      ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_entity_type_check";
    `);
    this.addSql(`
      ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_entity_type_check" CHECK ("entity_type" IN ('OPTION', 'UPCHARGE', 'ADDITIONAL_DETAIL', 'MEASURE_SHEET_ITEM', 'PRICE_GUIDE_IMAGE', 'CUSTOM_MERGE_FIELD'));
    `);
  }

  override down(): void {
    // Drop foreign key constraints first
    this.addSql(`
      ALTER TABLE "up_charge_custom_merge_field" DROP CONSTRAINT IF EXISTS "up_charge_custom_merge_field_field_definition_id_foreign";
    `);
    this.addSql(`
      ALTER TABLE "up_charge_custom_merge_field" DROP CONSTRAINT IF EXISTS "up_charge_custom_merge_field_up_charge_id_foreign";
    `);
    this.addSql(`
      ALTER TABLE "option_custom_merge_field" DROP CONSTRAINT IF EXISTS "option_custom_merge_field_field_definition_id_foreign";
    `);
    this.addSql(`
      ALTER TABLE "option_custom_merge_field" DROP CONSTRAINT IF EXISTS "option_custom_merge_field_option_id_foreign";
    `);
    this.addSql(`
      ALTER TABLE "msi_custom_merge_field" DROP CONSTRAINT IF EXISTS "msi_custom_merge_field_field_definition_id_foreign";
    `);
    this.addSql(`
      ALTER TABLE "msi_custom_merge_field" DROP CONSTRAINT IF EXISTS "msi_custom_merge_field_measure_sheet_item_id_foreign";
    `);
    this.addSql(`
      ALTER TABLE "custom_merge_field_definition" DROP CONSTRAINT IF EXISTS "custom_merge_field_definition_last_modified_by_id_foreign";
    `);
    this.addSql(`
      ALTER TABLE "custom_merge_field_definition" DROP CONSTRAINT IF EXISTS "custom_merge_field_definition_company_id_foreign";
    `);

    // Drop tables
    this.addSql(`DROP TABLE IF EXISTS "up_charge_custom_merge_field" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "option_custom_merge_field" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "msi_custom_merge_field" CASCADE;`);
    this.addSql(
      `DROP TABLE IF EXISTS "custom_merge_field_definition" CASCADE;`,
    );
    this.addSql(`DROP TABLE IF EXISTS "merge_field" CASCADE;`);

    // Restore original item_tag entity_type check constraint
    this.addSql(`
      ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_entity_type_check";
    `);
    this.addSql(`
      ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_entity_type_check" CHECK ("entity_type" IN ('OPTION', 'UPCHARGE', 'ADDITIONAL_DETAIL', 'MEASURE_SHEET_ITEM', 'PRICE_GUIDE_IMAGE'));
    `);
  }
}
