import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to implement the Company Logo Library system.
 *
 * Changes:
 * - Creates `company_logo` table for storing logo library entries
 * - Adds `default_logo_id` column to `company` table
 * - Renames `logo_file_id` column in `office_settings` to `logo_id` (now references company_logo)
 * - Migrates existing company logos to the library structure
 * - Migrates existing office logos to reference company_logo entries
 *
 * Data migration strategy:
 * 1. Company's existing logo_file_id → Create CompanyLogo entry → Set as default_logo_id
 * 2. Office's existing logo_file_id → Create CompanyLogo entry → Set as logo_id
 */
export class Migration20251219000000 extends Migration {
  override up(): void {
    // 1. Create company_logo table
    this.addSql(`
      CREATE TABLE "company_logo" (
        "id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "company_id" uuid NOT NULL,
        "file_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "company_logo_pkey" PRIMARY KEY ("id")
      );
    `);

    // Add foreign key constraints for company_logo
    this.addSql(`
      ALTER TABLE "company_logo"
      ADD CONSTRAINT "company_logo_company_id_foreign"
      FOREIGN KEY ("company_id")
      REFERENCES "company" ("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
    `);

    this.addSql(`
      ALTER TABLE "company_logo"
      ADD CONSTRAINT "company_logo_file_id_foreign"
      FOREIGN KEY ("file_id")
      REFERENCES "file" ("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
    `);

    // Create indexes for company_logo
    this.addSql(
      `CREATE INDEX "company_logo_company_id_index" ON "company_logo" ("company_id");`,
    );
    this.addSql(
      `CREATE INDEX "company_logo_file_id_index" ON "company_logo" ("file_id");`,
    );

    // 2. Add default_logo_id column to company table
    this.addSql(
      `ALTER TABLE "company" ADD COLUMN "default_logo_id" uuid NULL;`,
    );

    this.addSql(`
      ALTER TABLE "company"
      ADD CONSTRAINT "company_default_logo_id_foreign"
      FOREIGN KEY ("default_logo_id")
      REFERENCES "company_logo" ("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
    `);

    this.addSql(
      `CREATE INDEX "company_default_logo_id_index" ON "company" ("default_logo_id");`,
    );

    // 3. Migrate existing company logos to company_logo table
    // For each company with a logo_file_id, create a CompanyLogo entry and set it as default
    this.addSql(`
      INSERT INTO "company_logo" ("id", "name", "company_id", "file_id", "created_at", "updated_at")
      SELECT 
        gen_random_uuid(),
        'Company Logo',
        c."id",
        c."logo_file_id",
        COALESCE(f."created_at", now()),
        now()
      FROM "company" c
      INNER JOIN "file" f ON f."id" = c."logo_file_id"
      WHERE c."logo_file_id" IS NOT NULL;
    `);

    // Update company.default_logo_id to reference the newly created company_logo entries
    this.addSql(`
      UPDATE "company" c
      SET "default_logo_id" = cl."id"
      FROM "company_logo" cl
      WHERE cl."company_id" = c."id"
        AND cl."file_id" = c."logo_file_id"
        AND c."logo_file_id" IS NOT NULL;
    `);

    // 4. Create company_logo entries for existing office logos (if not already in library)
    this.addSql(`
      INSERT INTO "company_logo" ("id", "name", "company_id", "file_id", "created_at", "updated_at")
      SELECT DISTINCT ON (os."logo_file_id")
        gen_random_uuid(),
        CONCAT('Office Logo - ', o."name"),
        o."company_id",
        os."logo_file_id",
        COALESCE(f."created_at", now()),
        now()
      FROM "office_settings" os
      INNER JOIN "office" o ON o."id" = os."office_id"
      INNER JOIN "file" f ON f."id" = os."logo_file_id"
      WHERE os."logo_file_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "company_logo" cl 
          WHERE cl."file_id" = os."logo_file_id"
        );
    `);

    // 5. Add new logo_id column to office_settings (references company_logo)
    this.addSql(
      `ALTER TABLE "office_settings" ADD COLUMN "logo_id" uuid NULL;`,
    );

    this.addSql(`
      ALTER TABLE "office_settings"
      ADD CONSTRAINT "office_settings_logo_id_foreign"
      FOREIGN KEY ("logo_id")
      REFERENCES "company_logo" ("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
    `);

    this.addSql(
      `CREATE INDEX "office_settings_logo_id_index" ON "office_settings" ("logo_id");`,
    );

    // 6. Migrate office_settings.logo_file_id to office_settings.logo_id
    this.addSql(`
      UPDATE "office_settings" os
      SET "logo_id" = cl."id"
      FROM "company_logo" cl
      WHERE cl."file_id" = os."logo_file_id"
        AND os."logo_file_id" IS NOT NULL;
    `);

    // 7. Drop old columns and constraints
    // Drop old foreign key constraint from company.logo_file_id
    this.addSql(
      `ALTER TABLE "company" DROP CONSTRAINT IF EXISTS "company_logo_file_id_foreign";`,
    );

    // Drop old index from company.logo_file_id
    this.addSql(`DROP INDEX IF EXISTS "company_logo_file_id_index";`);

    // Drop old column from company
    this.addSql(`ALTER TABLE "company" DROP COLUMN IF EXISTS "logo_file_id";`);

    // Drop old foreign key constraint from office_settings.logo_file_id
    this.addSql(
      `ALTER TABLE "office_settings" DROP CONSTRAINT IF EXISTS "office_settings_logo_file_id_foreign";`,
    );

    // Drop old index from office_settings.logo_file_id
    this.addSql(`DROP INDEX IF EXISTS "office_settings_logo_file_id_index";`);

    // Drop old column from office_settings
    this.addSql(
      `ALTER TABLE "office_settings" DROP COLUMN IF EXISTS "logo_file_id";`,
    );
  }

  override down(): void {
    // 1. Add back the old columns
    this.addSql(`ALTER TABLE "company" ADD COLUMN "logo_file_id" uuid NULL;`);
    this.addSql(`
      ALTER TABLE "company"
      ADD CONSTRAINT "company_logo_file_id_foreign"
      FOREIGN KEY ("logo_file_id")
      REFERENCES "file" ("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    this.addSql(
      `CREATE INDEX "company_logo_file_id_index" ON "company" ("logo_file_id");`,
    );

    this.addSql(
      `ALTER TABLE "office_settings" ADD COLUMN "logo_file_id" uuid NULL;`,
    );
    this.addSql(`
      ALTER TABLE "office_settings"
      ADD CONSTRAINT "office_settings_logo_file_id_foreign"
      FOREIGN KEY ("logo_file_id")
      REFERENCES "file" ("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    this.addSql(
      `CREATE INDEX "office_settings_logo_file_id_index" ON "office_settings" ("logo_file_id");`,
    );

    // 2. Migrate data back
    // Restore company.logo_file_id from default_logo
    this.addSql(`
      UPDATE "company" c
      SET "logo_file_id" = cl."file_id"
      FROM "company_logo" cl
      WHERE cl."id" = c."default_logo_id"
        AND c."default_logo_id" IS NOT NULL;
    `);

    // Restore office_settings.logo_file_id from logo
    this.addSql(`
      UPDATE "office_settings" os
      SET "logo_file_id" = cl."file_id"
      FROM "company_logo" cl
      WHERE cl."id" = os."logo_id"
        AND os."logo_id" IS NOT NULL;
    `);

    // 3. Drop new columns and constraints from office_settings
    this.addSql(
      `ALTER TABLE "office_settings" DROP CONSTRAINT IF EXISTS "office_settings_logo_id_foreign";`,
    );
    this.addSql(`DROP INDEX IF EXISTS "office_settings_logo_id_index";`);
    this.addSql(
      `ALTER TABLE "office_settings" DROP COLUMN IF EXISTS "logo_id";`,
    );

    // 4. Drop new columns and constraints from company
    this.addSql(
      `ALTER TABLE "company" DROP CONSTRAINT IF EXISTS "company_default_logo_id_foreign";`,
    );
    this.addSql(`DROP INDEX IF EXISTS "company_default_logo_id_index";`);
    this.addSql(
      `ALTER TABLE "company" DROP COLUMN IF EXISTS "default_logo_id";`,
    );

    // 5. Drop company_logo table
    this.addSql(`DROP TABLE IF EXISTS "company_logo";`);
  }
}
