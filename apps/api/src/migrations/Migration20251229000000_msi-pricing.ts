import { Migration } from '@mikro-orm/migrations';

/**
 * Migration: Add MeasureSheetItemPrice table for base MSI pricing
 *
 * Creates the measure_sheet_item_price table that stores base prices
 * for measure sheet items per office × price type combination.
 */
export class Migration20251229000000 extends Migration {
  override up(): void {
    // Create measure_sheet_item_price table
    this.addSql(`
      create table if not exists "measure_sheet_item_price" (
        "id" uuid not null,
        "measure_sheet_item_id" uuid not null,
        "office_id" uuid not null,
        "price_type_id" uuid not null,
        "amount" numeric(12, 2) not null default 0,
        "effective_date" timestamptz null,
        "version" int not null default 1,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        constraint "measure_sheet_item_price_pkey" primary key ("id")
      );
    `);

    // Add unique constraint for MSI × office × priceType × effectiveDate
    this.addSql(`
      alter table "measure_sheet_item_price"
      add constraint "measure_sheet_item_price_unique"
      unique ("measure_sheet_item_id", "office_id", "price_type_id", "effective_date");
    `);

    // Add index for common query patterns
    this.addSql(`
      create index "measure_sheet_item_price_msi_office_type_idx"
      on "measure_sheet_item_price" ("measure_sheet_item_id", "office_id", "price_type_id");
    `);

    this.addSql(`
      create index "measure_sheet_item_price_office_type_idx"
      on "measure_sheet_item_price" ("office_id", "price_type_id");
    `);

    // Add foreign key constraints
    this.addSql(`
      alter table "measure_sheet_item_price"
      add constraint "measure_sheet_item_price_msi_fk"
      foreign key ("measure_sheet_item_id")
      references "measure_sheet_item" ("id")
      on delete cascade;
    `);

    this.addSql(`
      alter table "measure_sheet_item_price"
      add constraint "measure_sheet_item_price_office_fk"
      foreign key ("office_id")
      references "office" ("id")
      on delete cascade;
    `);

    this.addSql(`
      alter table "measure_sheet_item_price"
      add constraint "measure_sheet_item_price_type_fk"
      foreign key ("price_type_id")
      references "price_object_type" ("id")
      on delete cascade;
    `);
  }

  override down(): void {
    this.addSql(`drop table if exists "measure_sheet_item_price";`);
  }
}
