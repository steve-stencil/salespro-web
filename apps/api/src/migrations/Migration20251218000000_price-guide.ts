import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create price guide tables.
 *
 * - price_guide: Main price guide/catalog entity for companies
 * - price_guide_category: Categories for organizing items hierarchically
 * - price_guide_item: Individual items with pricing information
 */
export class Migration20251218000000_PriceGuide extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Create price_guide table
    this.addSql(`
      create table "price_guide" (
        "id" uuid not null,
        "name" varchar(255) not null,
        "description" text null,
        "company_id" uuid not null,
        "status" varchar(20) not null default 'draft',
        "is_default" boolean not null default false,
        "effective_from" timestamptz null,
        "effective_until" timestamptz null,
        "currency" varchar(3) not null default 'USD',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "price_guide_pkey" primary key ("id"),
        constraint "price_guide_status_check" check ("status" in ('draft', 'active', 'archived'))
      );
    `);

    // Add foreign key constraint for company
    this.addSql(`
      alter table "price_guide"
      add constraint "price_guide_company_id_foreign"
      foreign key ("company_id")
      references "company" ("id")
      on update cascade on delete cascade;
    `);

    // Create indexes for price_guide
    this.addSql(
      `create index "price_guide_company_id_index" on "price_guide" ("company_id");`,
    );
    this.addSql(
      `create index "price_guide_is_default_index" on "price_guide" ("is_default");`,
    );

    // Create price_guide_category table
    this.addSql(`
      create table "price_guide_category" (
        "id" uuid not null,
        "name" varchar(255) not null,
        "description" text null,
        "price_guide_id" uuid not null,
        "parent_category_id" uuid null,
        "sort_order" integer not null default 0,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "price_guide_category_pkey" primary key ("id")
      );
    `);

    // Add foreign key constraints for price_guide_category
    this.addSql(`
      alter table "price_guide_category"
      add constraint "price_guide_category_price_guide_id_foreign"
      foreign key ("price_guide_id")
      references "price_guide" ("id")
      on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "price_guide_category"
      add constraint "price_guide_category_parent_category_id_foreign"
      foreign key ("parent_category_id")
      references "price_guide_category" ("id")
      on update cascade on delete set null;
    `);

    // Create indexes for price_guide_category
    this.addSql(
      `create index "price_guide_category_price_guide_id_index" on "price_guide_category" ("price_guide_id");`,
    );
    this.addSql(
      `create index "price_guide_category_parent_category_id_index" on "price_guide_category" ("parent_category_id");`,
    );

    // Create price_guide_item table
    this.addSql(`
      create table "price_guide_item" (
        "id" uuid not null,
        "name" varchar(255) not null,
        "description" text null,
        "sku" varchar(100) null,
        "category_id" uuid not null,
        "pricing_type" varchar(20) not null default 'fixed',
        "price" numeric(12, 4) not null,
        "min_price" numeric(12, 4) null,
        "max_price" numeric(12, 4) null,
        "cost" numeric(12, 4) null,
        "unit" varchar(50) null,
        "taxable" boolean not null default true,
        "status" varchar(20) not null default 'active',
        "sort_order" integer not null default 0,
        "internal_notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "price_guide_item_pkey" primary key ("id"),
        constraint "price_guide_item_pricing_type_check" check ("pricing_type" in ('fixed', 'hourly', 'per_unit', 'variable')),
        constraint "price_guide_item_status_check" check ("status" in ('active', 'inactive', 'discontinued'))
      );
    `);

    // Add foreign key constraint for price_guide_item
    this.addSql(`
      alter table "price_guide_item"
      add constraint "price_guide_item_category_id_foreign"
      foreign key ("category_id")
      references "price_guide_category" ("id")
      on update cascade on delete cascade;
    `);

    // Create indexes for price_guide_item
    this.addSql(
      `create index "price_guide_item_sku_index" on "price_guide_item" ("sku");`,
    );
    this.addSql(
      `create index "price_guide_item_category_id_index" on "price_guide_item" ("category_id");`,
    );
    this.addSql(
      `create index "price_guide_item_status_index" on "price_guide_item" ("status");`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop indexes for price_guide_item
    this.addSql(`drop index if exists "price_guide_item_status_index";`);
    this.addSql(`drop index if exists "price_guide_item_category_id_index";`);
    this.addSql(`drop index if exists "price_guide_item_sku_index";`);

    // Drop price_guide_item table
    this.addSql(`drop table if exists "price_guide_item";`);

    // Drop indexes for price_guide_category
    this.addSql(
      `drop index if exists "price_guide_category_parent_category_id_index";`,
    );
    this.addSql(
      `drop index if exists "price_guide_category_price_guide_id_index";`,
    );

    // Drop price_guide_category table
    this.addSql(`drop table if exists "price_guide_category";`);

    // Drop indexes for price_guide
    this.addSql(`drop index if exists "price_guide_is_default_index";`);
    this.addSql(`drop index if exists "price_guide_company_id_index";`);

    // Drop price_guide table
    this.addSql(`drop table if exists "price_guide";`);
  }
}
