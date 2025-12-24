import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create the DocumentTemplateCategory and DocumentTemplate tables.
 *
 * This migration creates:
 * 1. document_template_category - Categories for grouping templates
 * 2. document_template - Read-only document templates from ETL
 * 3. document_template_office - Many-to-many join table for template-office relationships
 *
 * @see readonlytemplatesschema_08cb2e06.plan.md for full schema rationale
 */
export class Migration20251219000001 extends Migration {
  override up(): void {
    // ==========================================================================
    // 1. Create document_template_category table
    // ==========================================================================
    this.addSql(`
      create table "document_template_category" (
        "id" uuid not null default gen_random_uuid(),
        "company_id" uuid not null,
        "source_category_id" varchar(255) null,
        "name" varchar(255) not null,
        "sort_order" int not null default 0,
        "is_imported" boolean not null default false,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "document_template_category_pkey" primary key ("id")
      );
    `);

    // Add foreign key to company
    this.addSql(`
      alter table "document_template_category"
        add constraint "document_template_category_company_id_foreign"
        foreign key ("company_id") references "company" ("id")
        on update cascade on delete cascade;
    `);

    // Create indexes for category
    this.addSql(
      `create index "document_template_category_company_id_index" on "document_template_category" ("company_id");`,
    );
    this.addSql(
      `create index "document_template_category_source_category_id_index" on "document_template_category" ("source_category_id");`,
    );
    this.addSql(
      `create index "document_template_category_name_index" on "document_template_category" ("name");`,
    );
    this.addSql(
      `create index "document_template_category_sort_order_index" on "document_template_category" ("sort_order");`,
    );

    // Unique constraint for company + name (categories should be unique per company)
    this.addSql(`
      create unique index "document_template_category_company_name_unique"
        on "document_template_category" ("company_id", "name")
        where "deleted_at" is null;
    `);

    // ==========================================================================
    // 2. Create document_template table
    // ==========================================================================
    this.addSql(`
      create table "document_template" (
        "id" uuid not null default gen_random_uuid(),
        "company_id" uuid not null,
        "source_template_id" varchar(255) null,

        -- Catalog fields (indexed for fast filtering)
        "type" varchar(255) not null,
        "page_id" varchar(255) not null,
        "category_id" uuid not null,
        "display_name" varchar(255) not null,
        "sort_order" int not null,
        "can_add_multiple_pages" boolean not null default false,
        "is_template" boolean not null default false,

        -- State filtering (GIN indexed array, empty = no states)
        "included_states" text[] not null default '{}',

        -- Layout fields
        "page_size_str" varchar(255) not null,
        "page_width" int not null,
        "page_height" int not null,
        "h_margin" int not null,
        "w_margin" int not null,
        "photos_per_page" int not null default 1,

        -- Watermark fields
        "use_watermark" boolean not null default false,
        "watermark_width_percent" real not null default 100,
        "watermark_alpha" real not null default 0.05,

        -- Asset references (FK to file table)
        "pdf_file_id" uuid null,
        "icon_file_id" uuid null,
        "watermark_file_id" uuid null,

        -- Payload fields (JSONB)
        "document_data_json" jsonb not null,
        "images_json" jsonb null,
        "icon_background_color" jsonb null,

        -- Derived fields (computed during ingest)
        "has_user_input" boolean not null default false,
        "signature_field_count" int not null default 0,
        "initials_field_count" int not null default 0,

        -- Operational fields
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,

        constraint "document_template_pkey" primary key ("id")
      );
    `);

    // Add foreign key to company
    this.addSql(`
      alter table "document_template"
        add constraint "document_template_company_id_foreign"
        foreign key ("company_id") references "company" ("id")
        on update cascade on delete cascade;
    `);

    // Add foreign key to category
    this.addSql(`
      alter table "document_template"
        add constraint "document_template_category_id_foreign"
        foreign key ("category_id") references "document_template_category" ("id")
        on update cascade on delete restrict;
    `);

    // Add foreign keys to file table
    this.addSql(`
      alter table "document_template"
        add constraint "document_template_pdf_file_id_foreign"
        foreign key ("pdf_file_id") references "file" ("id")
        on update cascade on delete set null;
    `);

    this.addSql(`
      alter table "document_template"
        add constraint "document_template_icon_file_id_foreign"
        foreign key ("icon_file_id") references "file" ("id")
        on update cascade on delete set null;
    `);

    this.addSql(`
      alter table "document_template"
        add constraint "document_template_watermark_file_id_foreign"
        foreign key ("watermark_file_id") references "file" ("id")
        on update cascade on delete set null;
    `);

    // Create indexes for catalog/filter fields
    this.addSql(
      `create index "document_template_company_id_index" on "document_template" ("company_id");`,
    );
    this.addSql(
      `create index "document_template_source_template_id_index" on "document_template" ("source_template_id");`,
    );
    this.addSql(
      `create index "document_template_type_index" on "document_template" ("type");`,
    );
    this.addSql(
      `create index "document_template_page_id_index" on "document_template" ("page_id");`,
    );
    this.addSql(
      `create index "document_template_category_id_index" on "document_template" ("category_id");`,
    );
    this.addSql(
      `create index "document_template_sort_order_index" on "document_template" ("sort_order");`,
    );

    // GIN indexes for state array columns
    this.addSql(
      `create index "document_template_included_states_index" on "document_template" using gin ("included_states");`,
    );
    this.addSql();

    // Unique constraint for company + source_template_id (for upsert)
    this.addSql(`
      create unique index "document_template_company_source_template_unique"
        on "document_template" ("company_id", "source_template_id")
        where "source_template_id" is not null;
    `);

    // ==========================================================================
    // 3. Create document_template_office pivot table (many-to-many)
    // ==========================================================================
    this.addSql(`
      create table "document_template_office" (
        "document_template_id" uuid not null,
        "office_id" uuid not null,
        constraint "document_template_office_pkey" primary key ("document_template_id", "office_id")
      );
    `);

    // Add foreign keys for the pivot table
    this.addSql(`
      alter table "document_template_office"
        add constraint "document_template_office_document_template_id_foreign"
        foreign key ("document_template_id") references "document_template" ("id")
        on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "document_template_office"
        add constraint "document_template_office_office_id_foreign"
        foreign key ("office_id") references "office" ("id")
        on update cascade on delete cascade;
    `);

    // Create indexes for the pivot table
    this.addSql(
      `create index "document_template_office_document_template_id_index" on "document_template_office" ("document_template_id");`,
    );
    this.addSql(
      `create index "document_template_office_office_id_index" on "document_template_office" ("office_id");`,
    );
  }

  override down(): void {
    // Drop pivot table first (has foreign keys to document_template)
    this.addSql(
      `drop index if exists "document_template_office_office_id_index";`,
    );
    this.addSql(
      `drop index if exists "document_template_office_document_template_id_index";`,
    );
    this.addSql(
      `alter table "document_template_office" drop constraint if exists "document_template_office_office_id_foreign";`,
    );
    this.addSql(
      `alter table "document_template_office" drop constraint if exists "document_template_office_document_template_id_foreign";`,
    );
    this.addSql(`drop table if exists "document_template_office";`);

    // Drop document_template table
    this.addSql(
      `drop index if exists "document_template_company_source_template_unique";`,
    );
    this.addSql();
    this.addSql(
      `drop index if exists "document_template_included_states_index";`,
    );
    this.addSql(`drop index if exists "document_template_sort_order_index";`);
    this.addSql(`drop index if exists "document_template_category_id_index";`);
    this.addSql(`drop index if exists "document_template_page_id_index";`);
    this.addSql(`drop index if exists "document_template_type_index";`);
    this.addSql(
      `drop index if exists "document_template_source_template_id_index";`,
    );
    this.addSql(`drop index if exists "document_template_company_id_index";`);
    this.addSql(
      `alter table "document_template" drop constraint if exists "document_template_watermark_file_id_foreign";`,
    );
    this.addSql(
      `alter table "document_template" drop constraint if exists "document_template_icon_file_id_foreign";`,
    );
    this.addSql(
      `alter table "document_template" drop constraint if exists "document_template_pdf_file_id_foreign";`,
    );
    this.addSql(
      `alter table "document_template" drop constraint if exists "document_template_category_id_foreign";`,
    );
    this.addSql(
      `alter table "document_template" drop constraint if exists "document_template_company_id_foreign";`,
    );
    this.addSql(`drop table if exists "document_template";`);

    // Drop document_template_category table
    this.addSql(
      `drop index if exists "document_template_category_company_name_unique";`,
    );
    this.addSql(
      `drop index if exists "document_template_category_sort_order_index";`,
    );
    this.addSql(
      `drop index if exists "document_template_category_name_index";`,
    );
    this.addSql(
      `drop index if exists "document_template_category_source_category_id_index";`,
    );
    this.addSql(
      `drop index if exists "document_template_category_company_id_index";`,
    );
    this.addSql(
      `alter table "document_template_category" drop constraint if exists "document_template_category_company_id_foreign";`,
    );
    this.addSql(`drop table if exists "document_template_category";`);
  }
}
