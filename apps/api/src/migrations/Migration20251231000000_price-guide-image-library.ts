import { Migration } from '@mikro-orm/migrations';

/**
 * Migration for Price Guide shared image library.
 *
 * Creates:
 * - price_guide_image: Shared product image library entity
 * - Adds thumbnail_image_id FK to measure_sheet_item
 * - Adds thumbnail_image_id FK to up_charge
 *
 * Design: Each MSI and UpCharge can have ONE thumbnail image (simple FK).
 * An image can be used as thumbnail by multiple MSIs/UpCharges.
 */
export class Migration20251231000000_PriceGuideImageLibrary extends Migration {
  override up(): void {
    // ========================================================================
    // Create price_guide_image table
    // ========================================================================
    this.addSql(`
      create table if not exists "price_guide_image" (
        "id" uuid not null,
        "company_id" uuid not null,
        "name" varchar(255) not null,
        "description" text null,
        "file_id" uuid not null,
        "search_vector" text null,
        "is_active" boolean not null default true,
        "version" int not null default 1,
        "last_modified_by_id" uuid null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        constraint "price_guide_image_pkey" primary key ("id")
      );
    `);

    // Indexes for price_guide_image
    this.addSql(`
      create index if not exists "price_guide_image_company_id_index" 
      on "price_guide_image" ("company_id");
    `);
    this.addSql(`
      create index if not exists "price_guide_image_file_id_index" 
      on "price_guide_image" ("file_id");
    `);
    this.addSql(`
      create index if not exists "price_guide_image_company_id_is_active_index" 
      on "price_guide_image" ("company_id", "is_active");
    `);
    this.addSql(`
      create index if not exists "price_guide_image_company_id_name_index" 
      on "price_guide_image" ("company_id", "name");
    `);

    // Full-text search index
    this.addSql(`
      DO $$ BEGIN
        CREATE INDEX "price_guide_image_search_vector_index" 
        ON "price_guide_image" USING gin(to_tsvector('simple', "search_vector"));
      EXCEPTION WHEN duplicate_table THEN NULL;
      END $$;
    `);

    // Foreign key constraints for price_guide_image
    this.addSql(`
      DO $$ BEGIN
        alter table "price_guide_image" 
        add constraint "price_guide_image_company_id_foreign" 
        foreign key ("company_id") references "company" ("id") 
        on update cascade on delete cascade;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        alter table "price_guide_image" 
        add constraint "price_guide_image_file_id_foreign" 
        foreign key ("file_id") references "file" ("id") 
        on update cascade on delete cascade;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        alter table "price_guide_image" 
        add constraint "price_guide_image_last_modified_by_id_foreign" 
        foreign key ("last_modified_by_id") references "user" ("id") 
        on update cascade on delete set null;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ========================================================================
    // Add thumbnail_image_id to measure_sheet_item
    // ========================================================================
    this.addSql(`
      alter table "measure_sheet_item" 
      add column if not exists "thumbnail_image_id" uuid null;
    `);
    this.addSql(`
      create index if not exists "measure_sheet_item_thumbnail_image_id_index" 
      on "measure_sheet_item" ("thumbnail_image_id");
    `);
    this.addSql(`
      DO $$ BEGIN
        alter table "measure_sheet_item" 
        add constraint "measure_sheet_item_thumbnail_image_id_foreign" 
        foreign key ("thumbnail_image_id") references "price_guide_image" ("id") 
        on update cascade on delete set null;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ========================================================================
    // Add thumbnail_image_id to up_charge
    // ========================================================================
    this.addSql(`
      alter table "up_charge" 
      add column if not exists "thumbnail_image_id" uuid null;
    `);
    this.addSql(`
      create index if not exists "up_charge_thumbnail_image_id_index" 
      on "up_charge" ("thumbnail_image_id");
    `);
    this.addSql(`
      DO $$ BEGIN
        alter table "up_charge" 
        add constraint "up_charge_thumbnail_image_id_foreign" 
        foreign key ("thumbnail_image_id") references "price_guide_image" ("id") 
        on update cascade on delete set null;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ========================================================================
    // Drop old image_id columns if they exist (replaced by thumbnail_image_id)
    // ========================================================================
    this.addSql(`
      alter table "measure_sheet_item" 
      drop constraint if exists "measure_sheet_item_image_id_foreign";
    `);
    this.addSql(`
      drop index if exists "measure_sheet_item_image_id_index";
    `);
    this.addSql(`
      alter table "measure_sheet_item" 
      drop column if exists "image_id";
    `);

    this.addSql(`
      alter table "up_charge" 
      drop constraint if exists "up_charge_image_id_foreign";
    `);
    this.addSql(`
      drop index if exists "up_charge_image_id_index";
    `);
    this.addSql(`
      alter table "up_charge" 
      drop column if exists "image_id";
    `);

    // ========================================================================
    // Drop junction tables if they exist (from previous migration attempts)
    // ========================================================================
    this.addSql(
      `DROP TRIGGER IF EXISTS trg_measure_sheet_item_image_count ON measure_sheet_item_image;`,
    );
    this.addSql(
      `DROP FUNCTION IF EXISTS update_price_guide_image_linked_msi_count();`,
    );
    this.addSql(
      `DROP TRIGGER IF EXISTS trg_up_charge_image_count ON up_charge_image;`,
    );
    this.addSql(
      `DROP FUNCTION IF EXISTS update_price_guide_image_linked_upcharge_count();`,
    );
    this.addSql(`drop table if exists "measure_sheet_item_image" cascade;`);
    this.addSql(`drop table if exists "up_charge_image" cascade;`);

    // Drop linked count columns if they exist (we compute them dynamically now)
    this.addSql(`
      alter table "price_guide_image" 
      drop column if exists "linked_msi_count";
    `);
    this.addSql(`
      alter table "price_guide_image" 
      drop column if exists "linked_upcharge_count";
    `);
  }

  override down(): void {
    // ========================================================================
    // Drop thumbnail FKs from measure_sheet_item
    // ========================================================================
    this.addSql(`
      alter table "measure_sheet_item" 
      drop constraint if exists "measure_sheet_item_thumbnail_image_id_foreign";
    `);
    this.addSql(`
      drop index if exists "measure_sheet_item_thumbnail_image_id_index";
    `);
    this.addSql(`
      alter table "measure_sheet_item" 
      drop column if exists "thumbnail_image_id";
    `);

    // ========================================================================
    // Drop thumbnail FKs from up_charge
    // ========================================================================
    this.addSql(`
      alter table "up_charge" 
      drop constraint if exists "up_charge_thumbnail_image_id_foreign";
    `);
    this.addSql(`
      drop index if exists "up_charge_thumbnail_image_id_index";
    `);
    this.addSql(`
      alter table "up_charge" 
      drop column if exists "thumbnail_image_id";
    `);

    // ========================================================================
    // Drop price_guide_image table
    // ========================================================================
    this.addSql(`drop table if exists "price_guide_image" cascade;`);

    // ========================================================================
    // Restore image_id on measure_sheet_item
    // ========================================================================
    this.addSql(`
      alter table "measure_sheet_item" 
      add column "image_id" uuid null;
    `);
    this.addSql(`
      alter table "measure_sheet_item" 
      add constraint "measure_sheet_item_image_id_foreign" 
      foreign key ("image_id") references "file" ("id") 
      on update cascade on delete set null;
    `);
    this.addSql(`
      create index "measure_sheet_item_image_id_index" 
      on "measure_sheet_item" ("image_id");
    `);

    // ========================================================================
    // Restore image_id on up_charge
    // ========================================================================
    this.addSql(`
      alter table "up_charge" 
      add column "image_id" uuid null;
    `);
    this.addSql(`
      alter table "up_charge" 
      add constraint "up_charge_image_id_foreign" 
      foreign key ("image_id") references "file" ("id") 
      on update cascade on delete set null;
    `);
    this.addSql(`
      create index "up_charge_image_id_index" 
      on "up_charge" ("image_id");
    `);
  }
}
