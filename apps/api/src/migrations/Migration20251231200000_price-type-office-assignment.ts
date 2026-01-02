import { Migration } from '@mikro-orm/migrations';

/**
 * Migration for price type office assignment system.
 *
 * Changes:
 * 1. Removes global price types (company_id IS NULL) - all price types are now company-specific
 * 2. Adds parent_code column to price_object_type for cross-company aggregation
 * 3. Makes company_id NOT NULL on price_object_type
 * 4. Creates office_price_type junction table for per-office price type assignments
 *
 * Parent codes (hardcoded): MATERIAL, LABOR, MATERIAL_LABOR, TAX, OTHER
 * Each company creates their own price types that map to these parent codes.
 */
export class Migration20251231200000_PriceTypeOfficeAssignment extends Migration {
  override up(): void {
    // ========================================================================
    // Step 1: Delete global price types (company_id IS NULL)
    // These will be replaced by company-specific price types
    // Order matters: delete children before parents due to FK constraints
    // ========================================================================

    // First delete percentage base records that reference global types directly
    this.addSql(`
      DELETE FROM "up_charge_price_percentage_base" 
      WHERE "price_type_id" IN (
        SELECT "id" FROM "price_object_type" WHERE "company_id" IS NULL
      );
    `);

    // Delete percentage base records that reference up_charge_price records
    // which themselves reference global types
    this.addSql(`
      DELETE FROM "up_charge_price_percentage_base" 
      WHERE "up_charge_price_id" IN (
        SELECT "id" FROM "up_charge_price" 
        WHERE "price_type_id" IN (
          SELECT "id" FROM "price_object_type" WHERE "company_id" IS NULL
        )
      );
    `);

    // Now safe to delete up_charge_price records referencing global types
    this.addSql(`
      DELETE FROM "up_charge_price" 
      WHERE "price_type_id" IN (
        SELECT "id" FROM "price_object_type" WHERE "company_id" IS NULL
      );
    `);

    // Delete option_price records referencing global types
    this.addSql(`
      DELETE FROM "option_price" 
      WHERE "price_type_id" IN (
        SELECT "id" FROM "price_object_type" WHERE "company_id" IS NULL
      );
    `);

    // Now delete the global price types themselves
    this.addSql(`
      DELETE FROM "price_object_type" WHERE "company_id" IS NULL;
    `);

    // ========================================================================
    // Step 2: Add parent_code column to price_object_type
    // Default to 'OTHER' for any existing company-specific types
    // ========================================================================
    this.addSql(`
      ALTER TABLE "price_object_type" 
      ADD COLUMN IF NOT EXISTS "parent_code" varchar(20) NOT NULL DEFAULT 'OTHER';
    `);

    // Remove the default after adding the column
    this.addSql(`
      ALTER TABLE "price_object_type" 
      ALTER COLUMN "parent_code" DROP DEFAULT;
    `);

    // ========================================================================
    // Step 3: Make company_id NOT NULL
    // At this point all global types are deleted, so this should be safe
    // ========================================================================
    this.addSql(`
      ALTER TABLE "price_object_type" 
      ALTER COLUMN "company_id" SET NOT NULL;
    `);

    // Update the foreign key constraint to CASCADE on delete (company deletion)
    this.addSql(`
      ALTER TABLE "price_object_type" 
      DROP CONSTRAINT IF EXISTS "price_object_type_company_id_foreign";
    `);

    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_object_type" 
        ADD CONSTRAINT "price_object_type_company_id_foreign" 
        FOREIGN KEY ("company_id") REFERENCES "company" ("id") 
        ON UPDATE CASCADE ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ========================================================================
    // Step 4: Create office_price_type junction table
    // Row existence = enabled, row deletion = disabled (no isActive flag needed)
    // ========================================================================
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "office_price_type" (
        "id" uuid NOT NULL,
        "office_id" uuid NOT NULL,
        "price_type_id" uuid NOT NULL,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL,
        "updated_at" timestamptz NOT NULL,
        CONSTRAINT "office_price_type_pkey" PRIMARY KEY ("id")
      );
    `);

    // Unique constraint: one assignment per office + price_type combination
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "office_price_type" 
        ADD CONSTRAINT "office_price_type_office_id_price_type_id_unique" 
        UNIQUE ("office_id", "price_type_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Index for efficient office lookups
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "office_price_type_office_id_index" 
      ON "office_price_type" ("office_id");
    `);

    // Index for price_type lookups
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "office_price_type_price_type_id_index" 
      ON "office_price_type" ("price_type_id");
    `);

    // Foreign key to office
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "office_price_type" 
        ADD CONSTRAINT "office_price_type_office_id_foreign" 
        FOREIGN KEY ("office_id") REFERENCES "office" ("id") 
        ON UPDATE CASCADE ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Foreign key to price_object_type
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "office_price_type" 
        ADD CONSTRAINT "office_price_type_price_type_id_foreign" 
        FOREIGN KEY ("price_type_id") REFERENCES "price_object_type" ("id") 
        ON UPDATE CASCADE ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  override down(): void {
    // ========================================================================
    // Drop office_price_type table
    // ========================================================================
    this.addSql(`
      ALTER TABLE "office_price_type" 
      DROP CONSTRAINT IF EXISTS "office_price_type_price_type_id_foreign";
    `);

    this.addSql(`
      ALTER TABLE "office_price_type" 
      DROP CONSTRAINT IF EXISTS "office_price_type_office_id_foreign";
    `);

    this.addSql(`
      DROP TABLE IF EXISTS "office_price_type" CASCADE;
    `);

    // ========================================================================
    // Revert company_id to nullable
    // ========================================================================
    this.addSql(`
      ALTER TABLE "price_object_type" 
      ALTER COLUMN "company_id" DROP NOT NULL;
    `);

    // Revert FK constraint to SET NULL on delete
    this.addSql(`
      ALTER TABLE "price_object_type" 
      DROP CONSTRAINT IF EXISTS "price_object_type_company_id_foreign";
    `);

    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_object_type" 
        ADD CONSTRAINT "price_object_type_company_id_foreign" 
        FOREIGN KEY ("company_id") REFERENCES "company" ("id") 
        ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ========================================================================
    // Drop parent_code column
    // ========================================================================
    this.addSql(`
      ALTER TABLE "price_object_type" 
      DROP COLUMN IF EXISTS "parent_code";
    `);

    // Note: We cannot restore deleted global price types in the down migration.
    // They would need to be re-seeded manually if needed.
  }
}
