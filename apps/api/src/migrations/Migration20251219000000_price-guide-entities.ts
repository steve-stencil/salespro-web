import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create price guide category and measure sheet item tables.
 *
 * Changes:
 * - Creates price_guide_category table with self-referential parent-child relationship
 * - Creates measure_sheet_item table with foreign key to category
 */
export class Migration20251219000000 extends Migration {
  override up(): void {
    // Create price_guide_category table
    this.addSql(`
      create table "price_guide_category" (
        "id" uuid not null,
        "name" varchar(255) not null,
        "parent_id" uuid null,
        "company_id" uuid not null,
        "sort_order" int not null default 0,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        constraint "price_guide_category_pkey" primary key ("id")
      );
    `);

    // Add indexes for price_guide_category
    this.addSql(
      `create index "price_guide_category_parent_id_index" on "price_guide_category" ("parent_id");`,
    );
    this.addSql(
      `create index "price_guide_category_company_id_index" on "price_guide_category" ("company_id");`,
    );

    // Add foreign key constraints for price_guide_category
    this.addSql(`
      alter table "price_guide_category"
        add constraint "price_guide_category_parent_id_foreign"
        foreign key ("parent_id") references "price_guide_category" ("id")
        on update cascade on delete set null;
    `);
    this.addSql(`
      alter table "price_guide_category"
        add constraint "price_guide_category_company_id_foreign"
        foreign key ("company_id") references "company" ("id")
        on update cascade on delete cascade;
    `);

    // Create measure_sheet_item table
    this.addSql(`
      create table "measure_sheet_item" (
        "id" uuid not null,
        "name" varchar(255) not null,
        "description" text null,
        "category_id" uuid not null,
        "company_id" uuid not null,
        "sort_order" int not null default 0,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        constraint "measure_sheet_item_pkey" primary key ("id")
      );
    `);

    // Add indexes for measure_sheet_item
    this.addSql(
      `create index "measure_sheet_item_category_id_index" on "measure_sheet_item" ("category_id");`,
    );
    this.addSql(
      `create index "measure_sheet_item_company_id_index" on "measure_sheet_item" ("company_id");`,
    );

    // Add foreign key constraints for measure_sheet_item
    this.addSql(`
      alter table "measure_sheet_item"
        add constraint "measure_sheet_item_category_id_foreign"
        foreign key ("category_id") references "price_guide_category" ("id")
        on update cascade on delete cascade;
    `);
    this.addSql(`
      alter table "measure_sheet_item"
        add constraint "measure_sheet_item_company_id_foreign"
        foreign key ("company_id") references "company" ("id")
        on update cascade on delete cascade;
    `);
  }

  override down(): void {
    // Drop measure_sheet_item table first (has FK to price_guide_category)
    this.addSql(`drop table if exists "measure_sheet_item" cascade;`);

    // Drop price_guide_category table
    this.addSql(`drop table if exists "price_guide_category" cascade;`);
  }
}
