import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create DocumentType entity and update DocumentTemplate.
 *
 * This migration:
 * 1. Creates document_type table with M2M to offices
 * 2. Creates document_type_office pivot table
 * 3. Updates document_template to use document_type_id FK instead of type string
 * 4. Removes deprecated columns from document_template
 * 5. Adds CHECK constraint on watermark_alpha
 * 6. Seeds default document types (contract, proposal) for existing companies
 */
export class Migration20251220000000 extends Migration {
  override up(): void {
    // ==========================================================================
    // 1. Create document_type table
    // ==========================================================================
    this.addSql(`
      create table "document_type" (
        "id" uuid not null default gen_random_uuid(),
        "company_id" uuid not null,
        "name" varchar(255) not null,
        "is_default" boolean not null default false,
        "sort_order" int not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "document_type_pkey" primary key ("id")
      );
    `);

    // Add foreign key to company
    this.addSql(`
      alter table "document_type"
        add constraint "document_type_company_id_foreign"
        foreign key ("company_id") references "company" ("id")
        on update cascade on delete cascade;
    `);

    // Create indexes for document_type
    this.addSql(
      `create index "document_type_company_id_index" on "document_type" ("company_id");`,
    );
    this.addSql(
      `create index "document_type_name_index" on "document_type" ("name");`,
    );
    this.addSql(
      `create index "document_type_sort_order_index" on "document_type" ("sort_order");`,
    );

    // Unique constraint for company + name (types should be unique per company)
    this.addSql(`
      create unique index "document_type_company_name_unique"
        on "document_type" ("company_id", "name")
        where "deleted_at" is null;
    `);

    // ==========================================================================
    // 2. Create document_type_office pivot table (many-to-many)
    // ==========================================================================
    this.addSql(`
      create table "document_type_office" (
        "document_type_id" uuid not null,
        "office_id" uuid not null,
        constraint "document_type_office_pkey" primary key ("document_type_id", "office_id")
      );
    `);

    // Add foreign keys for the pivot table
    this.addSql(`
      alter table "document_type_office"
        add constraint "document_type_office_document_type_id_foreign"
        foreign key ("document_type_id") references "document_type" ("id")
        on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "document_type_office"
        add constraint "document_type_office_office_id_foreign"
        foreign key ("office_id") references "office" ("id")
        on update cascade on delete cascade;
    `);

    // Create indexes for the pivot table
    this.addSql(
      `create index "document_type_office_document_type_id_index" on "document_type_office" ("document_type_id");`,
    );
    this.addSql(
      `create index "document_type_office_office_id_index" on "document_type_office" ("office_id");`,
    );

    // ==========================================================================
    // 3. Seed default document types for all existing companies
    // ==========================================================================
    this.addSql(`
      insert into "document_type" ("company_id", "name", "is_default", "sort_order")
      select "id", 'contract', true, 0 from "company";
    `);

    this.addSql(`
      insert into "document_type" ("company_id", "name", "is_default", "sort_order")
      select "id", 'proposal', true, 1 from "company";
    `);

    // ==========================================================================
    // 4. Add document_type_id column to document_template (nullable initially)
    // ==========================================================================
    this.addSql(`
      alter table "document_template"
        add column "document_type_id" uuid null;
    `);

    // ==========================================================================
    // 5. Migrate existing templates: set document_type_id based on "type" column
    // ==========================================================================
    this.addSql(`
      update "document_template" dt
      set "document_type_id" = (
        select dty.id
        from "document_type" dty
        where dty.company_id = dt.company_id
          and dty.name = dt.type
        limit 1
      );
    `);

    // For any templates with type values that don't match existing types,
    // create new document types and assign them
    this.addSql(`
      insert into "document_type" ("company_id", "name", "is_default", "sort_order")
      select distinct dt."company_id", dt."type", false, 100
      from "document_template" dt
      where dt."document_type_id" is null
        and dt."type" is not null
        and not exists (
          select 1 from "document_type" dty
          where dty.company_id = dt.company_id and dty.name = dt.type
        );
    `);

    // Update any remaining null document_type_id
    this.addSql(`
      update "document_template" dt
      set "document_type_id" = (
        select dty.id
        from "document_type" dty
        where dty.company_id = dt.company_id
          and dty.name = dt.type
        limit 1
      )
      where dt."document_type_id" is null;
    `);

    // If still null (shouldn't happen), default to 'contract' type
    this.addSql(`
      update "document_template" dt
      set "document_type_id" = (
        select dty.id
        from "document_type" dty
        where dty.company_id = dt.company_id
          and dty.name = 'contract'
        limit 1
      )
      where dt."document_type_id" is null;
    `);

    // ==========================================================================
    // 6. Make document_type_id NOT NULL and add FK constraint
    // ==========================================================================
    this.addSql(`
      alter table "document_template"
        alter column "document_type_id" set not null;
    `);

    this.addSql(`
      alter table "document_template"
        add constraint "document_template_document_type_id_foreign"
        foreign key ("document_type_id") references "document_type" ("id")
        on update cascade on delete restrict;
    `);

    this.addSql(
      `create index "document_template_document_type_id_index" on "document_template" ("document_type_id");`,
    );

    // ==========================================================================
    // 7. Drop deprecated columns and indexes from document_template
    // ==========================================================================

    // Drop the type index
    this.addSql(`drop index if exists "document_template_type_index";`);

    // Drop columns
    this.addSql(`
      alter table "document_template"
        drop column "type",
        drop column "page_size_str",
        drop column "icon_background_color";
    `);

    // ==========================================================================
    // 8. Add CHECK constraint on watermark_alpha
    // ==========================================================================
    this.addSql(`
      alter table "document_template"
        add constraint "document_template_watermark_alpha_range"
        check ("watermark_alpha" >= 0 and "watermark_alpha" <= 1);
    `);
  }

  override down(): void {
    // ==========================================================================
    // Reverse in opposite order
    // ==========================================================================

    // Remove CHECK constraint
    this.addSql(`
      alter table "document_template"
        drop constraint if exists "document_template_watermark_alpha_range";
    `);

    // Re-add dropped columns
    this.addSql(`
      alter table "document_template"
        add column "type" varchar(255),
        add column "page_size_str" varchar(255),
        add column "icon_background_color" jsonb null;
    `);

    // Migrate data back: set type from document_type
    this.addSql(`
      update "document_template" dt
      set "type" = (
        select dty.name
        from "document_type" dty
        where dty.id = dt.document_type_id
      ),
      "page_size_str" = dt.page_width || ',' || dt.page_height;
    `);

    // Make type NOT NULL
    this.addSql(`
      alter table "document_template"
        alter column "type" set not null,
        alter column "page_size_str" set not null;
    `);

    // Re-create type index
    this.addSql(
      `create index "document_template_type_index" on "document_template" ("type");`,
    );

    // Drop document_type_id FK and column
    this.addSql(
      `drop index if exists "document_template_document_type_id_index";`,
    );
    this.addSql(`
      alter table "document_template"
        drop constraint if exists "document_template_document_type_id_foreign";
    `);
    this.addSql(`
      alter table "document_template"
        drop column "document_type_id";
    `);

    // Drop document_type_office pivot table
    this.addSql(`drop index if exists "document_type_office_office_id_index";`);
    this.addSql(
      `drop index if exists "document_type_office_document_type_id_index";`,
    );
    this.addSql(`
      alter table "document_type_office"
        drop constraint if exists "document_type_office_office_id_foreign";
    `);
    this.addSql(`
      alter table "document_type_office"
        drop constraint if exists "document_type_office_document_type_id_foreign";
    `);
    this.addSql(`drop table if exists "document_type_office";`);

    // Drop document_type table
    this.addSql(`drop index if exists "document_type_company_name_unique";`);
    this.addSql(`drop index if exists "document_type_sort_order_index";`);
    this.addSql(`drop index if exists "document_type_name_index";`);
    this.addSql(`drop index if exists "document_type_company_id_index";`);
    this.addSql(`
      alter table "document_type"
        drop constraint if exists "document_type_company_id_foreign";
    `);
    this.addSql(`drop table if exists "document_type";`);
  }
}
