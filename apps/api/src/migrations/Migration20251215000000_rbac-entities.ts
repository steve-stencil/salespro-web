import { Migration } from '@mikro-orm/migrations';

export class Migration20251215000000_RbacEntities extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Create role table
    this.addSql(
      `create table "role" ("id" uuid not null, "name" varchar(255) not null, "display_name" varchar(255) not null, "description" varchar(255) null, "type" text check ("type" in ('system', 'company')) not null default 'company', "company_id" uuid null, "permissions" jsonb not null default '[]', "is_default" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "role_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "role_name_index" on "role" ("name");`);
    this.addSql(
      `create index "role_company_id_index" on "role" ("company_id");`,
    );

    // Create user_role junction table
    this.addSql(
      `create table "user_role" ("id" uuid not null, "user_id" uuid not null, "role_id" uuid not null, "company_id" uuid not null, "assigned_at" timestamptz not null, "assigned_by_id" uuid null, constraint "user_role_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "user_role_user_id_index" on "user_role" ("user_id");`,
    );
    this.addSql(
      `create index "user_role_role_id_index" on "user_role" ("role_id");`,
    );
    this.addSql(
      `create index "user_role_company_id_index" on "user_role" ("company_id");`,
    );
    this.addSql(
      `alter table "user_role" add constraint "user_role_user_id_role_id_company_id_unique" unique ("user_id", "role_id", "company_id");`,
    );

    // Create office table
    this.addSql(
      `create table "office" ("id" uuid not null, "name" varchar(255) not null, "company_id" uuid not null, "address1" varchar(255) null, "address2" varchar(255) null, "city" varchar(255) null, "state" varchar(255) null, "postal_code" varchar(255) null, "country" varchar(255) null, "phone" varchar(255) null, "email" varchar(255) null, "is_active" boolean not null default true, "settings" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "office_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "office_company_id_index" on "office" ("company_id");`,
    );

    // Add foreign key constraints
    this.addSql(
      `alter table "role" add constraint "role_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "user_role" add constraint "user_role_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "user_role" add constraint "user_role_role_id_foreign" foreign key ("role_id") references "role" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "user_role" add constraint "user_role_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "user_role" add constraint "user_role_assigned_by_id_foreign" foreign key ("assigned_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "office" add constraint "office_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete cascade;`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop foreign key constraints first
    this.addSql(
      `alter table "office" drop constraint "office_company_id_foreign";`,
    );

    this.addSql(
      `alter table "user_role" drop constraint "user_role_assigned_by_id_foreign";`,
    );
    this.addSql(
      `alter table "user_role" drop constraint "user_role_company_id_foreign";`,
    );
    this.addSql(
      `alter table "user_role" drop constraint "user_role_role_id_foreign";`,
    );
    this.addSql(
      `alter table "user_role" drop constraint "user_role_user_id_foreign";`,
    );

    this.addSql(
      `alter table "role" drop constraint "role_company_id_foreign";`,
    );

    // Drop tables
    this.addSql(`drop table if exists "office" cascade;`);
    this.addSql(`drop table if exists "user_role" cascade;`);
    this.addSql(`drop table if exists "role" cascade;`);
  }
}
