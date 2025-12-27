import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create price guide entities.
 *
 * Creates:
 * - price_change_job: Background job tracking for bulk price changes
 * - price_object_type: Price type definitions (e.g., Retail, Wholesale)
 * - price_guide_option: Product/material options
 * - up_charge: Upcharge definitions
 * - price_guide_category: Category hierarchy for measure sheet items
 * - option_price: Price matrix for options by office/price type
 * - up_charge_price: Price matrix for upcharges
 * - up_charge_price_percentage_base: Percentage-based upcharge base prices
 * - up_charge_disabled_option: Junction table for disabled option/upcharge combos
 * - price_change_log: Audit log for price changes
 * - measure_sheet_item: MSI definitions
 * - measure_sheet_item_option: MSI-to-option junction
 * - measure_sheet_item_up_charge: MSI-to-upcharge junction
 * - measure_sheet_item_office: MSI-to-office junction
 * - additional_detail_field: Custom field definitions
 * - up_charge_additional_detail_field: Upcharge-to-ADF junction
 * - measure_sheet_item_additional_detail_field: MSI-to-ADF junction
 */
export class Migration20251227171327 extends Migration {
  override up(): void {
    // ============================================================
    // Price Change Job
    // ============================================================
    this.addSql(
      `create table if not exists "price_change_job" ("id" uuid not null, "status" text check ("status" in ('pending', 'running', 'completed', 'failed')) not null default 'pending', "target_type" text check ("target_type" in ('options', 'upcharges')) not null, "target_ids" jsonb not null, "operation" jsonb not null, "total_records" int not null, "processed_records" int not null default 0, "failed_records" int not null default 0, "errors" jsonb null, "created_by_id" uuid not null, "created_at" timestamptz not null, "completed_at" timestamptz null, constraint "price_change_job_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "price_change_job_created_by_id_created_at_index" on "price_change_job" ("created_by_id", "created_at");`,
    );
    this.addSql(
      `create index if not exists "price_change_job_status_created_at_index" on "price_change_job" ("status", "created_at");`,
    );

    // ============================================================
    // Price Object Type
    // ============================================================
    this.addSql(
      `create table if not exists "price_object_type" ("id" uuid not null, "company_id" uuid null, "code" varchar(50) not null, "name" varchar(255) not null, "description" text null, "sort_order" int not null default 0, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "price_object_type_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "price_object_type_company_id_index" on "price_object_type" ("company_id");`,
    );
    this.addSql(
      `create index if not exists "price_object_type_company_id_is_active_sort_order_index" on "price_object_type" ("company_id", "is_active", "sort_order");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_object_type" ADD CONSTRAINT "price_object_type_company_id_code_unique" UNIQUE ("company_id", "code");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Up Charge
    // ============================================================
    this.addSql(
      `create table if not exists "up_charge" ("id" uuid not null, "company_id" uuid not null, "name" varchar(255) not null, "note" text null, "measurement_type" varchar(50) null, "identifier" varchar(255) null, "image_url" varchar(255) null, "linked_msi_count" int not null default 0, "source_id" varchar(255) null, "is_active" boolean not null default true, "version" int not null default 1, "last_modified_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "up_charge_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "up_charge_company_id_index" on "up_charge" ("company_id");`,
    );
    this.addSql(
      `create index if not exists "up_charge_source_id_index" on "up_charge" ("source_id");`,
    );
    this.addSql(
      `create index if not exists "up_charge_company_id_name_index" on "up_charge" ("company_id", "name");`,
    );
    this.addSql(
      `create index if not exists "up_charge_company_id_is_active_index" on "up_charge" ("company_id", "is_active");`,
    );

    // ============================================================
    // Price Guide Option
    // ============================================================
    this.addSql(
      `create table if not exists "price_guide_option" ("id" uuid not null, "company_id" uuid not null, "brand" varchar(255) null, "name" varchar(255) not null, "item_code" varchar(255) null, "measurement_type" varchar(50) null, "search_vector" text null, "linked_msi_count" int not null default 0, "source_id" varchar(255) null, "is_active" boolean not null default true, "version" int not null default 1, "last_modified_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "price_guide_option_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "price_guide_option_company_id_index" on "price_guide_option" ("company_id");`,
    );
    this.addSql(
      `create index if not exists "price_guide_option_source_id_index" on "price_guide_option" ("source_id");`,
    );
    this.addSql(`
      DO $$ BEGIN
        CREATE INDEX "price_guide_option_search_vector_index" ON "public"."price_guide_option" USING gin(to_tsvector('simple', "search_vector"));
      EXCEPTION WHEN duplicate_table THEN NULL;
      END $$;
    `);
    this.addSql(
      `create index if not exists "price_guide_option_company_id_name_index" on "price_guide_option" ("company_id", "name");`,
    );
    this.addSql(
      `create index if not exists "price_guide_option_company_id_is_active_index" on "price_guide_option" ("company_id", "is_active");`,
    );

    // ============================================================
    // Up Charge Disabled Option
    // ============================================================
    this.addSql(
      `create table if not exists "up_charge_disabled_option" ("id" uuid not null, "up_charge_id" uuid not null, "option_id" uuid not null, "created_at" timestamptz not null, constraint "up_charge_disabled_option_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "up_charge_disabled_option_option_id_index" on "up_charge_disabled_option" ("option_id");`,
    );
    this.addSql(
      `create index if not exists "up_charge_disabled_option_up_charge_id_index" on "up_charge_disabled_option" ("up_charge_id");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_disabled_option" ADD CONSTRAINT "up_charge_disabled_option_up_charge_id_option_id_unique" UNIQUE ("up_charge_id", "option_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Price Guide Category
    // ============================================================
    this.addSql(
      `create table if not exists "price_guide_category" ("id" uuid not null, "company_id" uuid not null, "parent_id" uuid null, "name" varchar(255) not null, "sort_order" int not null default 0, "depth" int not null default 0, "is_active" boolean not null default true, "version" int not null default 1, "last_modified_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "price_guide_category_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "price_guide_category_company_id_index" on "price_guide_category" ("company_id");`,
    );
    this.addSql(
      `create index if not exists "price_guide_category_company_id_name_index" on "price_guide_category" ("company_id", "name");`,
    );
    this.addSql(
      `create index if not exists "price_guide_category_company_id_parent_id_index" on "price_guide_category" ("company_id", "parent_id");`,
    );

    // ============================================================
    // Up Charge Price
    // ============================================================
    this.addSql(
      `create table if not exists "up_charge_price" ("id" uuid not null, "up_charge_id" uuid not null, "option_id" uuid null, "office_id" uuid not null, "price_type_id" uuid not null, "amount" numeric(12,2) not null default 0, "is_percentage" boolean not null default false, "version" int not null default 1, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "up_charge_price_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "up_charge_price_up_charge_id_office_id_price_type_id_index" on "up_charge_price" ("up_charge_id", "office_id", "price_type_id");`,
    );
    this.addSql(
      `create index if not exists "up_charge_price_up_charge_id_option_id_office_id_p_41026_index" on "up_charge_price" ("up_charge_id", "option_id", "office_id", "price_type_id");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_price" ADD CONSTRAINT "up_charge_price_up_charge_id_option_id_office_id__4b77f_unique" UNIQUE ("up_charge_id", "option_id", "office_id", "price_type_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Up Charge Price Percentage Base
    // ============================================================
    this.addSql(
      `create table if not exists "up_charge_price_percentage_base" ("id" uuid not null, "up_charge_price_id" uuid not null, "price_type_id" uuid not null, "created_at" timestamptz not null, constraint "up_charge_price_percentage_base_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "up_charge_price_percentage_base_up_charge_price_id_index" on "up_charge_price_percentage_base" ("up_charge_price_id");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_price_percentage_base" ADD CONSTRAINT "up_charge_price_percentage_base_up_charge_price_i_06eb8_unique" UNIQUE ("up_charge_price_id", "price_type_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Option Price
    // ============================================================
    this.addSql(
      `create table if not exists "option_price" ("id" uuid not null, "option_id" uuid not null, "office_id" uuid not null, "price_type_id" uuid not null, "amount" numeric(12,2) not null default 0, "effective_date" timestamptz null, "version" int not null default 1, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "option_price_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "option_price_office_id_price_type_id_index" on "option_price" ("office_id", "price_type_id");`,
    );
    this.addSql(
      `create index if not exists "option_price_option_id_office_id_price_type_id_index" on "option_price" ("option_id", "office_id", "price_type_id");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "option_price" ADD CONSTRAINT "option_price_option_id_office_id_price_type_id_ef_cf185_unique" UNIQUE ("option_id", "office_id", "price_type_id", "effective_date");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Price Change Log
    // ============================================================
    this.addSql(
      `create table if not exists "price_change_log" ("id" uuid not null, "option_price_id" uuid null, "up_charge_price_id" uuid null, "old_amount" numeric(12,2) not null, "new_amount" numeric(12,2) not null, "changed_by_id" uuid not null, "changed_at" timestamptz not null, constraint "price_change_log_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "price_change_log_changed_by_id_changed_at_index" on "price_change_log" ("changed_by_id", "changed_at");`,
    );
    this.addSql(
      `create index if not exists "price_change_log_up_charge_price_id_changed_at_index" on "price_change_log" ("up_charge_price_id", "changed_at");`,
    );
    this.addSql(
      `create index if not exists "price_change_log_option_price_id_changed_at_index" on "price_change_log" ("option_price_id", "changed_at");`,
    );

    // ============================================================
    // Measure Sheet Item
    // ============================================================
    this.addSql(
      `create table if not exists "measure_sheet_item" ("id" uuid not null, "company_id" uuid not null, "category_id" uuid not null, "name" varchar(255) not null, "note" text null, "measurement_type" varchar(50) not null, "image_url" varchar(255) null, "formula_id" varchar(255) null, "qty_formula" varchar(255) null, "default_qty" numeric(12,4) not null default 1, "show_switch" boolean not null default false, "sort_order" numeric(18,8) not null default 0, "tag_title" varchar(255) null, "tag_required" boolean not null default false, "tag_picker_options" jsonb null, "tag_params" jsonb null, "search_vector" text null, "source_id" varchar(255) null, "is_active" boolean not null default true, "version" int not null default 1, "last_modified_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "measure_sheet_item_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_company_id_index" on "measure_sheet_item" ("company_id");`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_source_id_index" on "measure_sheet_item" ("source_id");`,
    );
    this.addSql(`
      DO $$ BEGIN
        CREATE INDEX "measure_sheet_item_search_vector_index" ON "public"."measure_sheet_item" USING gin(to_tsvector('simple', "search_vector"));
      EXCEPTION WHEN duplicate_table THEN NULL;
      END $$;
    `);
    this.addSql(
      `create index if not exists "measure_sheet_item_company_id_is_active_sort_order_index" on "measure_sheet_item" ("company_id", "is_active", "sort_order");`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_company_id_category_id_index" on "measure_sheet_item" ("company_id", "category_id");`,
    );

    // ============================================================
    // Measure Sheet Item Up Charge
    // ============================================================
    this.addSql(
      `create table if not exists "measure_sheet_item_up_charge" ("id" uuid not null, "measure_sheet_item_id" uuid not null, "up_charge_id" uuid not null, "sort_order" int not null default 0, "created_at" timestamptz not null, constraint "measure_sheet_item_up_charge_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_up_charge_up_charge_id_index" on "measure_sheet_item_up_charge" ("up_charge_id");`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_up_charge_measure_sheet_item_id_284d4_index" on "measure_sheet_item_up_charge" ("measure_sheet_item_id", "sort_order");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_up_charge" ADD CONSTRAINT "measure_sheet_item_up_charge_measure_sheet_item_i_baac8_unique" UNIQUE ("measure_sheet_item_id", "up_charge_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Measure Sheet Item Option
    // ============================================================
    this.addSql(
      `create table if not exists "measure_sheet_item_option" ("id" uuid not null, "measure_sheet_item_id" uuid not null, "option_id" uuid not null, "sort_order" int not null default 0, "created_at" timestamptz not null, constraint "measure_sheet_item_option_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_option_option_id_index" on "measure_sheet_item_option" ("option_id");`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_option_measure_sheet_item_id_so_1b7d4_index" on "measure_sheet_item_option" ("measure_sheet_item_id", "sort_order");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_option" ADD CONSTRAINT "measure_sheet_item_option_measure_sheet_item_id_o_eb9a1_unique" UNIQUE ("measure_sheet_item_id", "option_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Measure Sheet Item Office
    // ============================================================
    this.addSql(
      `create table if not exists "measure_sheet_item_office" ("id" uuid not null, "measure_sheet_item_id" uuid not null, "office_id" uuid not null, "created_at" timestamptz not null, constraint "measure_sheet_item_office_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_office_office_id_index" on "measure_sheet_item_office" ("office_id");`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_office_measure_sheet_item_id_index" on "measure_sheet_item_office" ("measure_sheet_item_id");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_office" ADD CONSTRAINT "measure_sheet_item_office_measure_sheet_item_id_o_c7b9b_unique" UNIQUE ("measure_sheet_item_id", "office_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Additional Detail Field
    // ============================================================
    this.addSql(
      `create table if not exists "additional_detail_field" ("id" uuid not null, "company_id" uuid not null, "title" varchar(255) not null, "input_type" text check ("input_type" in ('text', 'textarea', 'number', 'currency', 'picker', 'size_picker', 'size_picker_3d', 'date', 'time', 'datetime', 'united_inch')) not null, "cell_type" text check ("cell_type" in ('text', 'photos')) null, "placeholder" varchar(255) null, "note" varchar(255) null, "default_value" varchar(255) null, "is_required" boolean not null default false, "should_copy" boolean not null default false, "picker_values" jsonb null, "size_picker_config" jsonb null, "united_inch_config" jsonb null, "photo_config" jsonb null, "allow_decimal" boolean not null default false, "date_display_format" varchar(255) null, "not_added_replacement" varchar(255) null, "linked_msi_count" int not null default 0, "linked_up_charge_count" int not null default 0, "source_id" varchar(255) null, "is_active" boolean not null default true, "version" int not null default 1, "last_modified_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "additional_detail_field_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "additional_detail_field_company_id_index" on "additional_detail_field" ("company_id");`,
    );
    this.addSql(
      `create index if not exists "additional_detail_field_source_id_index" on "additional_detail_field" ("source_id");`,
    );
    this.addSql(
      `create index if not exists "additional_detail_field_company_id_title_index" on "additional_detail_field" ("company_id", "title");`,
    );
    this.addSql(
      `create index if not exists "additional_detail_field_company_id_is_active_index" on "additional_detail_field" ("company_id", "is_active");`,
    );

    // ============================================================
    // Up Charge Additional Detail Field
    // ============================================================
    this.addSql(
      `create table if not exists "up_charge_additional_detail_field" ("id" uuid not null, "up_charge_id" uuid not null, "additional_detail_field_id" uuid not null, "sort_order" int not null default 0, "created_at" timestamptz not null, constraint "up_charge_additional_detail_field_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "up_charge_additional_detail_field_additional_detai_fd25c_index" on "up_charge_additional_detail_field" ("additional_detail_field_id");`,
    );
    this.addSql(
      `create index if not exists "up_charge_additional_detail_field_up_charge_id_sort_order_index" on "up_charge_additional_detail_field" ("up_charge_id", "sort_order");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_additional_detail_field" ADD CONSTRAINT "up_charge_additional_detail_field_up_charge_id_ad_ab1a0_unique" UNIQUE ("up_charge_id", "additional_detail_field_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Measure Sheet Item Additional Detail Field
    // ============================================================
    this.addSql(
      `create table if not exists "measure_sheet_item_additional_detail_field" ("id" uuid not null, "measure_sheet_item_id" uuid not null, "additional_detail_field_id" uuid not null, "sort_order" int not null default 0, "created_at" timestamptz not null, constraint "measure_sheet_item_additional_detail_field_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_additional_detail_field_additio_ece74_index" on "measure_sheet_item_additional_detail_field" ("additional_detail_field_id");`,
    );
    this.addSql(
      `create index if not exists "measure_sheet_item_additional_detail_field_measure_a2ca6_index" on "measure_sheet_item_additional_detail_field" ("measure_sheet_item_id", "sort_order");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_additional_detail_field" ADD CONSTRAINT "measure_sheet_item_additional_detail_field_measur_7db3c_unique" UNIQUE ("measure_sheet_item_id", "additional_detail_field_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Foreign Keys
    // ============================================================

    // price_change_job
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_change_job" ADD CONSTRAINT "price_change_job_created_by_id_foreign" FOREIGN KEY ("created_by_id") REFERENCES "user" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // up_charge
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge" ADD CONSTRAINT "up_charge_company_id_foreign" FOREIGN KEY ("company_id") REFERENCES "company" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge" ADD CONSTRAINT "up_charge_last_modified_by_id_foreign" FOREIGN KEY ("last_modified_by_id") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // price_object_type
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_object_type" ADD CONSTRAINT "price_object_type_company_id_foreign" FOREIGN KEY ("company_id") REFERENCES "company" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // price_guide_option
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_guide_option" ADD CONSTRAINT "price_guide_option_company_id_foreign" FOREIGN KEY ("company_id") REFERENCES "company" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_guide_option" ADD CONSTRAINT "price_guide_option_last_modified_by_id_foreign" FOREIGN KEY ("last_modified_by_id") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // up_charge_disabled_option
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_disabled_option" ADD CONSTRAINT "up_charge_disabled_option_up_charge_id_foreign" FOREIGN KEY ("up_charge_id") REFERENCES "up_charge" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_disabled_option" ADD CONSTRAINT "up_charge_disabled_option_option_id_foreign" FOREIGN KEY ("option_id") REFERENCES "price_guide_option" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // price_guide_category
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_guide_category" ADD CONSTRAINT "price_guide_category_company_id_foreign" FOREIGN KEY ("company_id") REFERENCES "company" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_guide_category" ADD CONSTRAINT "price_guide_category_parent_id_foreign" FOREIGN KEY ("parent_id") REFERENCES "price_guide_category" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_guide_category" ADD CONSTRAINT "price_guide_category_last_modified_by_id_foreign" FOREIGN KEY ("last_modified_by_id") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // up_charge_price
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_price" ADD CONSTRAINT "up_charge_price_up_charge_id_foreign" FOREIGN KEY ("up_charge_id") REFERENCES "up_charge" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_price" ADD CONSTRAINT "up_charge_price_option_id_foreign" FOREIGN KEY ("option_id") REFERENCES "price_guide_option" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_price" ADD CONSTRAINT "up_charge_price_office_id_foreign" FOREIGN KEY ("office_id") REFERENCES "office" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_price" ADD CONSTRAINT "up_charge_price_price_type_id_foreign" FOREIGN KEY ("price_type_id") REFERENCES "price_object_type" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // up_charge_price_percentage_base
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_price_percentage_base" ADD CONSTRAINT "up_charge_price_percentage_base_up_charge_price_id_foreign" FOREIGN KEY ("up_charge_price_id") REFERENCES "up_charge_price" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_price_percentage_base" ADD CONSTRAINT "up_charge_price_percentage_base_price_type_id_foreign" FOREIGN KEY ("price_type_id") REFERENCES "price_object_type" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // option_price
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "option_price" ADD CONSTRAINT "option_price_option_id_foreign" FOREIGN KEY ("option_id") REFERENCES "price_guide_option" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "option_price" ADD CONSTRAINT "option_price_office_id_foreign" FOREIGN KEY ("office_id") REFERENCES "office" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "option_price" ADD CONSTRAINT "option_price_price_type_id_foreign" FOREIGN KEY ("price_type_id") REFERENCES "price_object_type" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // price_change_log
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_change_log" ADD CONSTRAINT "price_change_log_option_price_id_foreign" FOREIGN KEY ("option_price_id") REFERENCES "option_price" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_change_log" ADD CONSTRAINT "price_change_log_up_charge_price_id_foreign" FOREIGN KEY ("up_charge_price_id") REFERENCES "up_charge_price" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "price_change_log" ADD CONSTRAINT "price_change_log_changed_by_id_foreign" FOREIGN KEY ("changed_by_id") REFERENCES "user" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // measure_sheet_item
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item" ADD CONSTRAINT "measure_sheet_item_company_id_foreign" FOREIGN KEY ("company_id") REFERENCES "company" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item" ADD CONSTRAINT "measure_sheet_item_category_id_foreign" FOREIGN KEY ("category_id") REFERENCES "price_guide_category" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item" ADD CONSTRAINT "measure_sheet_item_last_modified_by_id_foreign" FOREIGN KEY ("last_modified_by_id") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // measure_sheet_item_up_charge
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_up_charge" ADD CONSTRAINT "measure_sheet_item_up_charge_measure_sheet_item_id_foreign" FOREIGN KEY ("measure_sheet_item_id") REFERENCES "measure_sheet_item" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_up_charge" ADD CONSTRAINT "measure_sheet_item_up_charge_up_charge_id_foreign" FOREIGN KEY ("up_charge_id") REFERENCES "up_charge" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // measure_sheet_item_option
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_option" ADD CONSTRAINT "measure_sheet_item_option_measure_sheet_item_id_foreign" FOREIGN KEY ("measure_sheet_item_id") REFERENCES "measure_sheet_item" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_option" ADD CONSTRAINT "measure_sheet_item_option_option_id_foreign" FOREIGN KEY ("option_id") REFERENCES "price_guide_option" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // measure_sheet_item_office
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_office" ADD CONSTRAINT "measure_sheet_item_office_measure_sheet_item_id_foreign" FOREIGN KEY ("measure_sheet_item_id") REFERENCES "measure_sheet_item" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_office" ADD CONSTRAINT "measure_sheet_item_office_office_id_foreign" FOREIGN KEY ("office_id") REFERENCES "office" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // additional_detail_field
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "additional_detail_field" ADD CONSTRAINT "additional_detail_field_company_id_foreign" FOREIGN KEY ("company_id") REFERENCES "company" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "additional_detail_field" ADD CONSTRAINT "additional_detail_field_last_modified_by_id_foreign" FOREIGN KEY ("last_modified_by_id") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // up_charge_additional_detail_field
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_additional_detail_field" ADD CONSTRAINT "up_charge_additional_detail_field_up_charge_id_foreign" FOREIGN KEY ("up_charge_id") REFERENCES "up_charge" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "up_charge_additional_detail_field" ADD CONSTRAINT "up_charge_additional_detail_field_additional_det_ff6fb_foreign" FOREIGN KEY ("additional_detail_field_id") REFERENCES "additional_detail_field" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // measure_sheet_item_additional_detail_field
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_additional_detail_field" ADD CONSTRAINT "measure_sheet_item_additional_detail_field_measu_66466_foreign" FOREIGN KEY ("measure_sheet_item_id") REFERENCES "measure_sheet_item" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "measure_sheet_item_additional_detail_field" ADD CONSTRAINT "measure_sheet_item_additional_detail_field_addit_f44b4_foreign" FOREIGN KEY ("additional_detail_field_id") REFERENCES "additional_detail_field" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  override down(): void {
    // Drop foreign key constraints first
    this.addSql(
      `ALTER TABLE "measure_sheet_item_additional_detail_field" DROP CONSTRAINT IF EXISTS "measure_sheet_item_additional_detail_field_addit_f44b4_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_additional_detail_field" DROP CONSTRAINT IF EXISTS "measure_sheet_item_additional_detail_field_measu_66466_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge_additional_detail_field" DROP CONSTRAINT IF EXISTS "up_charge_additional_detail_field_additional_det_ff6fb_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge_additional_detail_field" DROP CONSTRAINT IF EXISTS "up_charge_additional_detail_field_up_charge_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "additional_detail_field" DROP CONSTRAINT IF EXISTS "additional_detail_field_last_modified_by_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "additional_detail_field" DROP CONSTRAINT IF EXISTS "additional_detail_field_company_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_office" DROP CONSTRAINT IF EXISTS "measure_sheet_item_office_office_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_office" DROP CONSTRAINT IF EXISTS "measure_sheet_item_office_measure_sheet_item_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_option" DROP CONSTRAINT IF EXISTS "measure_sheet_item_option_option_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_option" DROP CONSTRAINT IF EXISTS "measure_sheet_item_option_measure_sheet_item_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_up_charge" DROP CONSTRAINT IF EXISTS "measure_sheet_item_up_charge_up_charge_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item_up_charge" DROP CONSTRAINT IF EXISTS "measure_sheet_item_up_charge_measure_sheet_item_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" DROP CONSTRAINT IF EXISTS "measure_sheet_item_last_modified_by_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" DROP CONSTRAINT IF EXISTS "measure_sheet_item_category_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "measure_sheet_item" DROP CONSTRAINT IF EXISTS "measure_sheet_item_company_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "price_change_log" DROP CONSTRAINT IF EXISTS "price_change_log_changed_by_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "price_change_log" DROP CONSTRAINT IF EXISTS "price_change_log_up_charge_price_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "price_change_log" DROP CONSTRAINT IF EXISTS "price_change_log_option_price_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "option_price" DROP CONSTRAINT IF EXISTS "option_price_price_type_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "option_price" DROP CONSTRAINT IF EXISTS "option_price_office_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "option_price" DROP CONSTRAINT IF EXISTS "option_price_option_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge_price_percentage_base" DROP CONSTRAINT IF EXISTS "up_charge_price_percentage_base_price_type_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge_price_percentage_base" DROP CONSTRAINT IF EXISTS "up_charge_price_percentage_base_up_charge_price_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge_price" DROP CONSTRAINT IF EXISTS "up_charge_price_price_type_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge_price" DROP CONSTRAINT IF EXISTS "up_charge_price_office_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge_price" DROP CONSTRAINT IF EXISTS "up_charge_price_option_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge_price" DROP CONSTRAINT IF EXISTS "up_charge_price_up_charge_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_category" DROP CONSTRAINT IF EXISTS "price_guide_category_last_modified_by_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_category" DROP CONSTRAINT IF EXISTS "price_guide_category_parent_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_category" DROP CONSTRAINT IF EXISTS "price_guide_category_company_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge_disabled_option" DROP CONSTRAINT IF EXISTS "up_charge_disabled_option_option_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge_disabled_option" DROP CONSTRAINT IF EXISTS "up_charge_disabled_option_up_charge_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_option" DROP CONSTRAINT IF EXISTS "price_guide_option_last_modified_by_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "price_guide_option" DROP CONSTRAINT IF EXISTS "price_guide_option_company_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "price_object_type" DROP CONSTRAINT IF EXISTS "price_object_type_company_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge" DROP CONSTRAINT IF EXISTS "up_charge_last_modified_by_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "up_charge" DROP CONSTRAINT IF EXISTS "up_charge_company_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "price_change_job" DROP CONSTRAINT IF EXISTS "price_change_job_created_by_id_foreign";`,
    );

    // Drop tables
    this.addSql(
      `DROP TABLE IF EXISTS "measure_sheet_item_additional_detail_field" CASCADE;`,
    );
    this.addSql(
      `DROP TABLE IF EXISTS "up_charge_additional_detail_field" CASCADE;`,
    );
    this.addSql(`DROP TABLE IF EXISTS "additional_detail_field" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "measure_sheet_item_office" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "measure_sheet_item_option" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "measure_sheet_item_up_charge" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "measure_sheet_item" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "price_change_log" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "option_price" CASCADE;`);
    this.addSql(
      `DROP TABLE IF EXISTS "up_charge_price_percentage_base" CASCADE;`,
    );
    this.addSql(`DROP TABLE IF EXISTS "up_charge_price" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "price_guide_category" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "up_charge_disabled_option" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "price_guide_option" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "price_object_type" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "up_charge" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "price_change_job" CASCADE;`);
  }
}
