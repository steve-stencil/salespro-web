import { Migration } from '@mikro-orm/migrations';

export class Migration20251229233352 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "up_charge_price" drop constraint "up_charge_price_office_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_price" drop constraint "up_charge_price_up_charge_id_option_id_office_id__4b77f_unique";`,
    );

    this.addSql(
      `alter table "up_charge_price" add column "measure_sheet_item_id" uuid null;`,
    );
    this.addSql(
      `alter table "up_charge_price" alter column "office_id" drop default;`,
    );
    this.addSql(
      `alter table "up_charge_price" alter column "office_id" type uuid using ("office_id"::text::uuid);`,
    );
    this.addSql(
      `alter table "up_charge_price" alter column "office_id" drop not null;`,
    );
    this.addSql(
      `alter table "up_charge_price" add constraint "up_charge_price_measure_sheet_item_id_foreign" foreign key ("measure_sheet_item_id") references "measure_sheet_item" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "up_charge_price" add constraint "up_charge_price_office_id_foreign" foreign key ("office_id") references "office" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `create index "up_charge_price_measure_sheet_item_id_index" on "up_charge_price" ("measure_sheet_item_id");`,
    );
    this.addSql(
      `create index "up_charge_price_up_charge_id_option_id_measure_she_d81d9_index" on "up_charge_price" ("up_charge_id", "option_id", "measure_sheet_item_id", "office_id", "price_type_id");`,
    );
    this.addSql(
      `alter table "up_charge_price" add constraint "up_charge_price_up_charge_id_option_id_measure_sh_7fdec_unique" unique ("up_charge_id", "option_id", "measure_sheet_item_id", "office_id", "price_type_id");`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "up_charge_price" drop constraint "up_charge_price_measure_sheet_item_id_foreign";`,
    );
    this.addSql(
      `alter table "up_charge_price" drop constraint "up_charge_price_office_id_foreign";`,
    );

    this.addSql(`drop index "up_charge_price_measure_sheet_item_id_index";`);
    this.addSql(
      `drop index "up_charge_price_up_charge_id_option_id_measure_she_d81d9_index";`,
    );
    this.addSql(
      `alter table "up_charge_price" drop constraint "up_charge_price_up_charge_id_option_id_measure_sh_7fdec_unique";`,
    );
    this.addSql(
      `alter table "up_charge_price" drop column "measure_sheet_item_id";`,
    );

    this.addSql(
      `alter table "up_charge_price" alter column "office_id" drop default;`,
    );
    this.addSql(
      `alter table "up_charge_price" alter column "office_id" type uuid using ("office_id"::text::uuid);`,
    );
    this.addSql(
      `alter table "up_charge_price" alter column "office_id" set not null;`,
    );
    this.addSql(
      `alter table "up_charge_price" add constraint "up_charge_price_office_id_foreign" foreign key ("office_id") references "office" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "up_charge_price" add constraint "up_charge_price_up_charge_id_option_id_office_id__4b77f_unique" unique ("up_charge_id", "option_id", "office_id", "price_type_id");`,
    );
  }
}
