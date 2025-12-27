import { Migration } from '@mikro-orm/migrations';

export class Migration20251227171327 extends Migration {
  override up(): void {
    this.addSql(
      `create table "price_change_job" ("id" uuid not null, "status" text check ("status" in ('pending', 'running', 'completed', 'failed')) not null default 'pending', "target_type" text check ("target_type" in ('options', 'upcharges')) not null, "target_ids" jsonb not null, "operation" jsonb not null, "total_records" int not null, "processed_records" int not null default 0, "failed_records" int not null default 0, "errors" jsonb null, "created_by_id" uuid not null, "created_at" timestamptz not null, "completed_at" timestamptz null, constraint "price_change_job_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "price_change_job_created_by_id_created_at_index" on "price_change_job" ("created_by_id", "created_at");`,
    );
    this.addSql(
      `create index "price_change_job_status_created_at_index" on "price_change_job" ("status", "created_at");`,
    );

    this.addSql(
      `create table "file" ("id" uuid not null, "filename" varchar(255) not null, "storage_key" varchar(255) not null, "mime_type" varchar(255) not null, "size" bigint not null, "visibility" text check ("visibility" in ('private', 'company', 'public')) not null default 'company', "status" text check ("status" in ('pending', 'active', 'deleted')) not null default 'active', "company_id" uuid not null, "uploaded_by_id" uuid not null, "thumbnail_key" varchar(255) null, "description" varchar(255) null, "metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "file_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "file_storage_key_index" on "file" ("storage_key");`,
    );
    this.addSql(`create index "file_status_index" on "file" ("status");`);
    this.addSql(
      `create index "file_company_id_index" on "file" ("company_id");`,
    );
    this.addSql(
      `create index "file_uploaded_by_id_index" on "file" ("uploaded_by_id");`,
    );
    this.addSql(
      `create index "file_created_at_index" on "file" ("created_at");`,
    );

    this.addSql(
      `create table "up_charge" ("id" uuid not null, "company_id" uuid not null, "name" varchar(255) not null, "note" text null, "measurement_type" varchar(50) null, "identifier" varchar(255) null, "image_url" varchar(255) null, "linked_msi_count" int not null default 0, "source_id" varchar(255) null, "is_active" boolean not null default true, "version" int not null default 1, "last_modified_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "up_charge_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "up_charge_company_id_index" on "up_charge" ("company_id");`,
    );
    this.addSql(
      `create index "up_charge_source_id_index" on "up_charge" ("source_id");`,
    );
    this.addSql(
      `create index "up_charge_company_id_name_index" on "up_charge" ("company_id", "name");`,
    );
    this.addSql(
      `create index "up_charge_company_id_is_active_index" on "up_charge" ("company_id", "is_active");`,
    );

    this.addSql(
      `create table "role" ("id" uuid not null, "name" varchar(255) not null, "display_name" varchar(255) not null, "description" varchar(255) null, "type" text check ("type" in ('platform', 'system', 'company')) not null default 'company', "company_permissions" jsonb not null, "company_id" uuid null, "permissions" jsonb not null, "is_default" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "role_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "role_name_index" on "role" ("name");`);
    this.addSql(
      `create index "role_company_id_index" on "role" ("company_id");`,
    );

    this.addSql(
      `create table "price_object_type" ("id" uuid not null, "company_id" uuid null, "code" varchar(50) not null, "name" varchar(255) not null, "description" text null, "sort_order" int not null default 0, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "price_object_type_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "price_object_type_company_id_index" on "price_object_type" ("company_id");`,
    );
    this.addSql(
      `create index "price_object_type_company_id_is_active_sort_order_index" on "price_object_type" ("company_id", "is_active", "sort_order");`,
    );
    this.addSql(
      `alter table "price_object_type" add constraint "price_object_type_company_id_code_unique" unique ("company_id", "code");`,
    );

    this.addSql(
      `create table "price_guide_option" ("id" uuid not null, "company_id" uuid not null, "brand" varchar(255) null, "name" varchar(255) not null, "item_code" varchar(255) null, "measurement_type" varchar(50) null, "search_vector" text null, "linked_msi_count" int not null default 0, "source_id" varchar(255) null, "is_active" boolean not null default true, "version" int not null default 1, "last_modified_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "price_guide_option_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "price_guide_option_company_id_index" on "price_guide_option" ("company_id");`,
    );
    this.addSql(
      `create index "price_guide_option_source_id_index" on "price_guide_option" ("source_id");`,
    );
    this.addSql(
      `create index "price_guide_option_search_vector_index" on "public"."price_guide_option" using gin(to_tsvector('simple', "search_vector"));`,
    );
    this.addSql(
      `create index "price_guide_option_company_id_name_index" on "price_guide_option" ("company_id", "name");`,
    );
    this.addSql(
      `create index "price_guide_option_company_id_is_active_index" on "price_guide_option" ("company_id", "is_active");`,
    );

    this.addSql(
      `create table "up_charge_disabled_option" ("id" uuid not null, "up_charge_id" uuid not null, "option_id" uuid not null, "created_at" timestamptz not null, constraint "up_charge_disabled_option_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "up_charge_disabled_option_option_id_index" on "up_charge_disabled_option" ("option_id");`,
    );
    this.addSql(
      `create index "up_charge_disabled_option_up_charge_id_index" on "up_charge_disabled_option" ("up_charge_id");`,
    );
    this.addSql(
      `alter table "up_charge_disabled_option" add constraint "up_charge_disabled_option_up_charge_id_option_id_unique" unique ("up_charge_id", "option_id");`,
    );

    this.addSql(
      `create table "price_guide_category" ("id" uuid not null, "company_id" uuid not null, "parent_id" uuid null, "name" varchar(255) not null, "sort_order" int not null default 0, "depth" int not null default 0, "is_active" boolean not null default true, "version" int not null default 1, "last_modified_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "price_guide_category_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "price_guide_category_company_id_index" on "price_guide_category" ("company_id");`,
    );
    this.addSql(
      `create index "price_guide_category_company_id_name_index" on "price_guide_category" ("company_id", "name");`,
    );
    this.addSql(
      `create index "price_guide_category_company_id_parent_id_index" on "price_guide_category" ("company_id", "parent_id");`,
    );

    this.addSql(
      `create table "office" ("id" uuid not null, "name" varchar(255) not null, "company_id" uuid not null, "source_id" varchar(255) null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "office_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "office_company_id_index" on "office" ("company_id");`,
    );
    this.addSql(
      `create index "office_source_id_index" on "office" ("source_id");`,
    );

    this.addSql(
      `create table "up_charge_price" ("id" uuid not null, "up_charge_id" uuid not null, "option_id" uuid null, "office_id" uuid not null, "price_type_id" uuid not null, "amount" numeric(12,2) not null default 0, "is_percentage" boolean not null default false, "version" int not null default 1, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "up_charge_price_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "up_charge_price_up_charge_id_office_id_price_type_id_index" on "up_charge_price" ("up_charge_id", "office_id", "price_type_id");`,
    );
    this.addSql(
      `create index "up_charge_price_up_charge_id_option_id_office_id_p_41026_index" on "up_charge_price" ("up_charge_id", "option_id", "office_id", "price_type_id");`,
    );
    this.addSql(
      `alter table "up_charge_price" add constraint "up_charge_price_up_charge_id_option_id_office_id__4b77f_unique" unique ("up_charge_id", "option_id", "office_id", "price_type_id");`,
    );

    this.addSql(
      `create table "up_charge_price_percentage_base" ("id" uuid not null, "up_charge_price_id" uuid not null, "price_type_id" uuid not null, "created_at" timestamptz not null, constraint "up_charge_price_percentage_base_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "up_charge_price_percentage_base_up_charge_price_id_index" on "up_charge_price_percentage_base" ("up_charge_price_id");`,
    );
    this.addSql(
      `alter table "up_charge_price_percentage_base" add constraint "up_charge_price_percentage_base_up_charge_price_i_06eb8_unique" unique ("up_charge_price_id", "price_type_id");`,
    );

    this.addSql(
      `create table "option_price" ("id" uuid not null, "option_id" uuid not null, "office_id" uuid not null, "price_type_id" uuid not null, "amount" numeric(12,2) not null default 0, "effective_date" timestamptz null, "version" int not null default 1, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "option_price_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "option_price_office_id_price_type_id_index" on "option_price" ("office_id", "price_type_id");`,
    );
    this.addSql(
      `create index "option_price_option_id_office_id_price_type_id_index" on "option_price" ("option_id", "office_id", "price_type_id");`,
    );
    this.addSql(
      `alter table "option_price" add constraint "option_price_option_id_office_id_price_type_id_ef_cf185_unique" unique ("option_id", "office_id", "price_type_id", "effective_date");`,
    );

    this.addSql(
      `create table "price_change_log" ("id" uuid not null, "option_price_id" uuid null, "up_charge_price_id" uuid null, "old_amount" numeric(12,2) not null, "new_amount" numeric(12,2) not null, "changed_by_id" uuid not null, "changed_at" timestamptz not null, constraint "price_change_log_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "price_change_log_changed_by_id_changed_at_index" on "price_change_log" ("changed_by_id", "changed_at");`,
    );
    this.addSql(
      `create index "price_change_log_up_charge_price_id_changed_at_index" on "price_change_log" ("up_charge_price_id", "changed_at");`,
    );
    this.addSql(
      `create index "price_change_log_option_price_id_changed_at_index" on "price_change_log" ("option_price_id", "changed_at");`,
    );

    this.addSql(
      `create table "office_integration" ("id" uuid not null, "office_id" uuid not null, "integration_key" varchar(100) not null, "display_name" varchar(255) not null, "encrypted_credentials" text null, "encrypted_data_key" text null, "config" jsonb null, "is_enabled" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "office_integration_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "office_integration_office_id_index" on "office_integration" ("office_id");`,
    );
    this.addSql(
      `create index "office_integration_integration_key_index" on "office_integration" ("integration_key");`,
    );
    this.addSql(
      `alter table "office_integration" add constraint "office_integration_office_id_integration_key_unique" unique ("office_id", "integration_key");`,
    );

    this.addSql(
      `create table "migration_session" ("id" uuid not null, "company_id" uuid not null, "created_by_id" uuid not null, "source_company_id" varchar(255) not null, "status" text check ("status" in ('pending', 'in_progress', 'completed', 'failed')) not null default 'pending', "total_count" int not null default 0, "imported_count" int not null default 0, "skipped_count" int not null default 0, "error_count" int not null default 0, "errors" jsonb not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "completed_at" timestamptz null, constraint "migration_session_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "migration_session_company_id_index" on "migration_session" ("company_id");`,
    );
    this.addSql(
      `create index "migration_session_created_by_id_index" on "migration_session" ("created_by_id");`,
    );
    this.addSql(
      `create index "migration_session_source_company_id_index" on "migration_session" ("source_company_id");`,
    );
    this.addSql(
      `create index "migration_session_status_index" on "migration_session" ("status");`,
    );

    this.addSql(
      `create table "measure_sheet_item" ("id" uuid not null, "company_id" uuid not null, "category_id" uuid not null, "name" varchar(255) not null, "note" text null, "measurement_type" varchar(50) not null, "image_url" varchar(255) null, "formula_id" varchar(255) null, "qty_formula" varchar(255) null, "default_qty" numeric(12,4) not null default 1, "show_switch" boolean not null default false, "sort_order" numeric(18,8) not null default 0, "tag_title" varchar(255) null, "tag_required" boolean not null default false, "tag_picker_options" jsonb null, "tag_params" jsonb null, "search_vector" text null, "source_id" varchar(255) null, "is_active" boolean not null default true, "version" int not null default 1, "last_modified_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "measure_sheet_item_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "measure_sheet_item_company_id_index" on "measure_sheet_item" ("company_id");`,
    );
    this.addSql(
      `create index "measure_sheet_item_source_id_index" on "measure_sheet_item" ("source_id");`,
    );
    this.addSql(
      `create index "measure_sheet_item_search_vector_index" on "public"."measure_sheet_item" using gin(to_tsvector('simple', "search_vector"));`,
    );
    this.addSql(
      `create index "measure_sheet_item_company_id_is_active_sort_order_index" on "measure_sheet_item" ("company_id", "is_active", "sort_order");`,
    );
    this.addSql(
      `create index "measure_sheet_item_company_id_category_id_index" on "measure_sheet_item" ("company_id", "category_id");`,
    );

    this.addSql(
      `create table "measure_sheet_item_up_charge" ("id" uuid not null, "measure_sheet_item_id" uuid not null, "up_charge_id" uuid not null, "sort_order" int not null default 0, "created_at" timestamptz not null, constraint "measure_sheet_item_up_charge_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "measure_sheet_item_up_charge_up_charge_id_index" on "measure_sheet_item_up_charge" ("up_charge_id");`,
    );
    this.addSql(
      `create index "measure_sheet_item_up_charge_measure_sheet_item_id_284d4_index" on "measure_sheet_item_up_charge" ("measure_sheet_item_id", "sort_order");`,
    );
    this.addSql(
      `alter table "measure_sheet_item_up_charge" add constraint "measure_sheet_item_up_charge_measure_sheet_item_i_baac8_unique" unique ("measure_sheet_item_id", "up_charge_id");`,
    );

    this.addSql(
      `create table "measure_sheet_item_option" ("id" uuid not null, "measure_sheet_item_id" uuid not null, "option_id" uuid not null, "sort_order" int not null default 0, "created_at" timestamptz not null, constraint "measure_sheet_item_option_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "measure_sheet_item_option_option_id_index" on "measure_sheet_item_option" ("option_id");`,
    );
    this.addSql(
      `create index "measure_sheet_item_option_measure_sheet_item_id_so_1b7d4_index" on "measure_sheet_item_option" ("measure_sheet_item_id", "sort_order");`,
    );
    this.addSql(
      `alter table "measure_sheet_item_option" add constraint "measure_sheet_item_option_measure_sheet_item_id_o_eb9a1_unique" unique ("measure_sheet_item_id", "option_id");`,
    );

    this.addSql(
      `create table "measure_sheet_item_office" ("id" uuid not null, "measure_sheet_item_id" uuid not null, "office_id" uuid not null, "created_at" timestamptz not null, constraint "measure_sheet_item_office_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "measure_sheet_item_office_office_id_index" on "measure_sheet_item_office" ("office_id");`,
    );
    this.addSql(
      `create index "measure_sheet_item_office_measure_sheet_item_id_index" on "measure_sheet_item_office" ("measure_sheet_item_id");`,
    );
    this.addSql(
      `alter table "measure_sheet_item_office" add constraint "measure_sheet_item_office_measure_sheet_item_id_o_c7b9b_unique" unique ("measure_sheet_item_id", "office_id");`,
    );

    this.addSql(
      `create table "company_logo" ("id" uuid not null, "name" varchar(255) not null, "company_id" uuid not null, "file_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "company_logo_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "company_logo_company_id_index" on "company_logo" ("company_id");`,
    );
    this.addSql(
      `create index "company_logo_file_id_index" on "company_logo" ("file_id");`,
    );

    this.addSql(
      `create table "office_settings" ("id" uuid not null, "office_id" uuid not null, "logo_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "office_settings_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "office_settings_office_id_index" on "office_settings" ("office_id");`,
    );
    this.addSql(
      `alter table "office_settings" add constraint "office_settings_office_id_unique" unique ("office_id");`,
    );

    this.addSql(
      `create table "additional_detail_field" ("id" uuid not null, "company_id" uuid not null, "title" varchar(255) not null, "input_type" text check ("input_type" in ('text', 'textarea', 'number', 'currency', 'picker', 'size_picker', 'size_picker_3d', 'date', 'time', 'datetime', 'united_inch')) not null, "cell_type" text check ("cell_type" in ('text', 'photos')) null, "placeholder" varchar(255) null, "note" varchar(255) null, "default_value" varchar(255) null, "is_required" boolean not null default false, "should_copy" boolean not null default false, "picker_values" jsonb null, "size_picker_config" jsonb null, "united_inch_config" jsonb null, "photo_config" jsonb null, "allow_decimal" boolean not null default false, "date_display_format" varchar(255) null, "not_added_replacement" varchar(255) null, "linked_msi_count" int not null default 0, "linked_up_charge_count" int not null default 0, "source_id" varchar(255) null, "is_active" boolean not null default true, "version" int not null default 1, "last_modified_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "additional_detail_field_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "additional_detail_field_company_id_index" on "additional_detail_field" ("company_id");`,
    );
    this.addSql(
      `create index "additional_detail_field_source_id_index" on "additional_detail_field" ("source_id");`,
    );
    this.addSql(
      `create index "additional_detail_field_company_id_title_index" on "additional_detail_field" ("company_id", "title");`,
    );
    this.addSql(
      `create index "additional_detail_field_company_id_is_active_index" on "additional_detail_field" ("company_id", "is_active");`,
    );

    this.addSql(
      `create table "up_charge_additional_detail_field" ("id" uuid not null, "up_charge_id" uuid not null, "additional_detail_field_id" uuid not null, "sort_order" int not null default 0, "created_at" timestamptz not null, constraint "up_charge_additional_detail_field_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "up_charge_additional_detail_field_additional_detai_fd25c_index" on "up_charge_additional_detail_field" ("additional_detail_field_id");`,
    );
    this.addSql(
      `create index "up_charge_additional_detail_field_up_charge_id_sort_order_index" on "up_charge_additional_detail_field" ("up_charge_id", "sort_order");`,
    );
    this.addSql(
      `alter table "up_charge_additional_detail_field" add constraint "up_charge_additional_detail_field_up_charge_id_ad_ab1a0_unique" unique ("up_charge_id", "additional_detail_field_id");`,
    );

    this.addSql(
      `create table "measure_sheet_item_additional_detail_field" ("id" uuid not null, "measure_sheet_item_id" uuid not null, "additional_detail_field_id" uuid not null, "sort_order" int not null default 0, "created_at" timestamptz not null, constraint "measure_sheet_item_additional_detail_field_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "measure_sheet_item_additional_detail_field_additio_ece74_index" on "measure_sheet_item_additional_detail_field" ("additional_detail_field_id");`,
    );
    this.addSql(
      `create index "measure_sheet_item_additional_detail_field_measure_a2ca6_index" on "measure_sheet_item_additional_detail_field" ("measure_sheet_item_id", "sort_order");`,
    );
    this.addSql(
      `alter table "measure_sheet_item_additional_detail_field" add constraint "measure_sheet_item_additional_detail_field_measur_7db3c_unique" unique ("measure_sheet_item_id", "additional_detail_field_id");`,
    );

    this.addSql(
      `create table "user_company" ("id" uuid not null, "user_id" uuid not null, "company_id" uuid not null, "is_active" boolean not null default true, "is_pinned" boolean not null default false, "joined_at" timestamptz not null, "last_accessed_at" timestamptz null, "deactivated_at" timestamptz null, "deactivated_by_id" uuid null, constraint "user_company_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "user_company_user_id_index" on "user_company" ("user_id");`,
    );
    this.addSql(
      `create index "user_company_company_id_index" on "user_company" ("company_id");`,
    );
    this.addSql(
      `create index "user_company_last_accessed_at_index" on "user_company" ("last_accessed_at");`,
    );
    this.addSql(
      `alter table "user_company" add constraint "user_company_user_id_company_id_unique" unique ("user_id", "company_id");`,
    );

    this.addSql(
      `create table "user_office" ("id" uuid not null, "user_id" uuid not null, "office_id" uuid not null, "assigned_at" timestamptz not null, "assigned_by_id" uuid null, constraint "user_office_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "user_office_user_id_index" on "user_office" ("user_id");`,
    );
    this.addSql(
      `create index "user_office_office_id_index" on "user_office" ("office_id");`,
    );
    this.addSql(
      `alter table "user_office" add constraint "user_office_user_id_office_id_unique" unique ("user_id", "office_id");`,
    );

    this.addSql(
      `create table "user_role" ("id" uuid not null, "user_id" uuid not null, "role_id" uuid not null, "company_id" uuid null, "assigned_at" timestamptz not null, "assigned_by_id" uuid null, constraint "user_role_pkey" primary key ("id"));`,
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

    this.addSql(
      `alter table "price_change_job" add constraint "price_change_job_created_by_id_foreign" foreign key ("created_by_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "file" add constraint "file_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "file" add constraint "file_uploaded_by_id_foreign" foreign key ("uploaded_by_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "up_charge" add constraint "up_charge_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "up_charge" add constraint "up_charge_last_modified_by_id_foreign" foreign key ("last_modified_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "role" add constraint "role_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "price_object_type" add constraint "price_object_type_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "price_guide_option" add constraint "price_guide_option_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "price_guide_option" add constraint "price_guide_option_last_modified_by_id_foreign" foreign key ("last_modified_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "up_charge_disabled_option" add constraint "up_charge_disabled_option_up_charge_id_foreign" foreign key ("up_charge_id") references "up_charge" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "up_charge_disabled_option" add constraint "up_charge_disabled_option_option_id_foreign" foreign key ("option_id") references "price_guide_option" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "price_guide_category" add constraint "price_guide_category_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "price_guide_category" add constraint "price_guide_category_parent_id_foreign" foreign key ("parent_id") references "price_guide_category" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "price_guide_category" add constraint "price_guide_category_last_modified_by_id_foreign" foreign key ("last_modified_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "office" add constraint "office_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "up_charge_price" add constraint "up_charge_price_up_charge_id_foreign" foreign key ("up_charge_id") references "up_charge" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "up_charge_price" add constraint "up_charge_price_option_id_foreign" foreign key ("option_id") references "price_guide_option" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "up_charge_price" add constraint "up_charge_price_office_id_foreign" foreign key ("office_id") references "office" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "up_charge_price" add constraint "up_charge_price_price_type_id_foreign" foreign key ("price_type_id") references "price_object_type" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "up_charge_price_percentage_base" add constraint "up_charge_price_percentage_base_up_charge_price_id_foreign" foreign key ("up_charge_price_id") references "up_charge_price" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "up_charge_price_percentage_base" add constraint "up_charge_price_percentage_base_price_type_id_foreign" foreign key ("price_type_id") references "price_object_type" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "option_price" add constraint "option_price_option_id_foreign" foreign key ("option_id") references "price_guide_option" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "option_price" add constraint "option_price_office_id_foreign" foreign key ("office_id") references "office" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "option_price" add constraint "option_price_price_type_id_foreign" foreign key ("price_type_id") references "price_object_type" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "price_change_log" add constraint "price_change_log_option_price_id_foreign" foreign key ("option_price_id") references "option_price" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "price_change_log" add constraint "price_change_log_up_charge_price_id_foreign" foreign key ("up_charge_price_id") references "up_charge_price" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "price_change_log" add constraint "price_change_log_changed_by_id_foreign" foreign key ("changed_by_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "office_integration" add constraint "office_integration_office_id_foreign" foreign key ("office_id") references "office" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "migration_session" add constraint "migration_session_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "migration_session" add constraint "migration_session_created_by_id_foreign" foreign key ("created_by_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "measure_sheet_item" add constraint "measure_sheet_item_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "measure_sheet_item" add constraint "measure_sheet_item_category_id_foreign" foreign key ("category_id") references "price_guide_category" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "measure_sheet_item" add constraint "measure_sheet_item_last_modified_by_id_foreign" foreign key ("last_modified_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "measure_sheet_item_up_charge" add constraint "measure_sheet_item_up_charge_measure_sheet_item_id_foreign" foreign key ("measure_sheet_item_id") references "measure_sheet_item" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "measure_sheet_item_up_charge" add constraint "measure_sheet_item_up_charge_up_charge_id_foreign" foreign key ("up_charge_id") references "up_charge" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "measure_sheet_item_option" add constraint "measure_sheet_item_option_measure_sheet_item_id_foreign" foreign key ("measure_sheet_item_id") references "measure_sheet_item" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "measure_sheet_item_option" add constraint "measure_sheet_item_option_option_id_foreign" foreign key ("option_id") references "price_guide_option" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "measure_sheet_item_office" add constraint "measure_sheet_item_office_measure_sheet_item_id_foreign" foreign key ("measure_sheet_item_id") references "measure_sheet_item" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "measure_sheet_item_office" add constraint "measure_sheet_item_office_office_id_foreign" foreign key ("office_id") references "office" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "company_logo" add constraint "company_logo_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "company_logo" add constraint "company_logo_file_id_foreign" foreign key ("file_id") references "file" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "office_settings" add constraint "office_settings_office_id_foreign" foreign key ("office_id") references "office" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "office_settings" add constraint "office_settings_logo_id_foreign" foreign key ("logo_id") references "company_logo" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "additional_detail_field" add constraint "additional_detail_field_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "additional_detail_field" add constraint "additional_detail_field_last_modified_by_id_foreign" foreign key ("last_modified_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "up_charge_additional_detail_field" add constraint "up_charge_additional_detail_field_up_charge_id_foreign" foreign key ("up_charge_id") references "up_charge" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "up_charge_additional_detail_field" add constraint "up_charge_additional_detail_field_additional_det_ff6fb_foreign" foreign key ("additional_detail_field_id") references "additional_detail_field" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "measure_sheet_item_additional_detail_field" add constraint "measure_sheet_item_additional_detail_field_measu_66466_foreign" foreign key ("measure_sheet_item_id") references "measure_sheet_item" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "measure_sheet_item_additional_detail_field" add constraint "measure_sheet_item_additional_detail_field_addit_f44b4_foreign" foreign key ("additional_detail_field_id") references "additional_detail_field" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "user_company" add constraint "user_company_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "user_company" add constraint "user_company_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "user_company" add constraint "user_company_deactivated_by_id_foreign" foreign key ("deactivated_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "user_office" add constraint "user_office_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "user_office" add constraint "user_office_office_id_foreign" foreign key ("office_id") references "office" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "user_office" add constraint "user_office_assigned_by_id_foreign" foreign key ("assigned_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "user_role" add constraint "user_role_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "user_role" add constraint "user_role_role_id_foreign" foreign key ("role_id") references "role" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "user_role" add constraint "user_role_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "user_role" add constraint "user_role_assigned_by_id_foreign" foreign key ("assigned_by_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "user" drop constraint "user_company_id_foreign";`,
    );

    this.addSql(
      `alter table "session" alter column "sid" type text using ("sid"::text);`,
    );

    this.addSql(
      `alter table "user" add column "user_type" text check ("user_type" in ('company', 'internal')) not null default 'company', add column "current_office_id" uuid null, add column "deleted_at" timestamptz null;`,
    );
    this.addSql(`alter table "user" alter column "company_id" drop default;`);
    this.addSql(
      `alter table "user" alter column "company_id" type uuid using ("company_id"::text::uuid);`,
    );
    this.addSql(`alter table "user" alter column "company_id" drop not null;`);
    this.addSql(
      `alter table "user" add constraint "user_current_office_id_foreign" foreign key ("current_office_id") references "office" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "user" add constraint "user_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `create index "user_deleted_at_index" on "user" ("deleted_at");`,
    );

    this.addSql(
      `alter table "company" add column "default_logo_id" uuid null;`,
    );
    this.addSql(
      `alter table "company" add constraint "company_default_logo_id_foreign" foreign key ("default_logo_id") references "company_logo" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "session" add column "active_company_id" uuid null;`,
    );
    this.addSql(
      `alter table "session" alter column "sid" type varchar(64) using ("sid"::varchar(64));`,
    );
    this.addSql(
      `alter table "session" add constraint "session_active_company_id_foreign" foreign key ("active_company_id") references "company" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "user_invite" add column "is_existing_user_invite" boolean not null default false, add column "existing_user_id" uuid null, add column "current_office_id" uuid not null, add column "allowed_offices" text[] not null;`,
    );
    this.addSql(
      `alter table "user_invite" add constraint "user_invite_existing_user_id_foreign" foreign key ("existing_user_id") references "user" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "user_invite" add constraint "user_invite_current_office_id_foreign" foreign key ("current_office_id") references "office" ("id") on update cascade;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "company_logo" drop constraint "company_logo_file_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_disabled_option" drop constraint "up_charge_disabled_option_up_charge_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_price" drop constraint "up_charge_price_up_charge_id_foreign";`,
    );

    this.addSql(
      `alter table "measure_sheet_item_up_charge" drop constraint "measure_sheet_item_up_charge_up_charge_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_additional_detail_field" drop constraint "up_charge_additional_detail_field_up_charge_id_foreign";`,
    );

    this.addSql(
      `alter table "user_role" drop constraint "user_role_role_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_price" drop constraint "up_charge_price_price_type_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_price_percentage_base" drop constraint "up_charge_price_percentage_base_price_type_id_foreign";`,
    );

    this.addSql(
      `alter table "option_price" drop constraint "option_price_price_type_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_disabled_option" drop constraint "up_charge_disabled_option_option_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_price" drop constraint "up_charge_price_option_id_foreign";`,
    );

    this.addSql(
      `alter table "option_price" drop constraint "option_price_option_id_foreign";`,
    );

    this.addSql(
      `alter table "measure_sheet_item_option" drop constraint "measure_sheet_item_option_option_id_foreign";`,
    );

    this.addSql(
      `alter table "price_guide_category" drop constraint "price_guide_category_parent_id_foreign";`,
    );

    this.addSql(
      `alter table "measure_sheet_item" drop constraint "measure_sheet_item_category_id_foreign";`,
    );

    this.addSql(
      `alter table "user" drop constraint "user_current_office_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_price" drop constraint "up_charge_price_office_id_foreign";`,
    );

    this.addSql(
      `alter table "option_price" drop constraint "option_price_office_id_foreign";`,
    );

    this.addSql(
      `alter table "office_integration" drop constraint "office_integration_office_id_foreign";`,
    );

    this.addSql(
      `alter table "measure_sheet_item_office" drop constraint "measure_sheet_item_office_office_id_foreign";`,
    );

    this.addSql(
      `alter table "office_settings" drop constraint "office_settings_office_id_foreign";`,
    );

    this.addSql(
      `alter table "user_invite" drop constraint "user_invite_current_office_id_foreign";`,
    );

    this.addSql(
      `alter table "user_office" drop constraint "user_office_office_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_price_percentage_base" drop constraint "up_charge_price_percentage_base_up_charge_price_id_foreign";`,
    );

    this.addSql(
      `alter table "price_change_log" drop constraint "price_change_log_up_charge_price_id_foreign";`,
    );

    this.addSql(
      `alter table "price_change_log" drop constraint "price_change_log_option_price_id_foreign";`,
    );

    this.addSql(
      `alter table "measure_sheet_item_up_charge" drop constraint "measure_sheet_item_up_charge_measure_sheet_item_id_foreign";`,
    );

    this.addSql(
      `alter table "measure_sheet_item_option" drop constraint "measure_sheet_item_option_measure_sheet_item_id_foreign";`,
    );

    this.addSql(
      `alter table "measure_sheet_item_office" drop constraint "measure_sheet_item_office_measure_sheet_item_id_foreign";`,
    );

    this.addSql(
      `alter table "measure_sheet_item_additional_detail_field" drop constraint "measure_sheet_item_additional_detail_field_measu_66466_foreign";`,
    );

    this.addSql(
      `alter table "company" drop constraint "company_default_logo_id_foreign";`,
    );

    this.addSql(
      `alter table "office_settings" drop constraint "office_settings_logo_id_foreign";`,
    );

    this.addSql(
      `alter table "up_charge_additional_detail_field" drop constraint "up_charge_additional_detail_field_additional_det_ff6fb_foreign";`,
    );

    this.addSql(
      `alter table "measure_sheet_item_additional_detail_field" drop constraint "measure_sheet_item_additional_detail_field_addit_f44b4_foreign";`,
    );

    this.addSql(`drop table if exists "price_change_job" cascade;`);

    this.addSql(`drop table if exists "file" cascade;`);

    this.addSql(`drop table if exists "up_charge" cascade;`);

    this.addSql(`drop table if exists "role" cascade;`);

    this.addSql(`drop table if exists "price_object_type" cascade;`);

    this.addSql(`drop table if exists "price_guide_option" cascade;`);

    this.addSql(`drop table if exists "up_charge_disabled_option" cascade;`);

    this.addSql(`drop table if exists "price_guide_category" cascade;`);

    this.addSql(`drop table if exists "office" cascade;`);

    this.addSql(`drop table if exists "up_charge_price" cascade;`);

    this.addSql(
      `drop table if exists "up_charge_price_percentage_base" cascade;`,
    );

    this.addSql(`drop table if exists "option_price" cascade;`);

    this.addSql(`drop table if exists "price_change_log" cascade;`);

    this.addSql(`drop table if exists "office_integration" cascade;`);

    this.addSql(`drop table if exists "migration_session" cascade;`);

    this.addSql(`drop table if exists "measure_sheet_item" cascade;`);

    this.addSql(`drop table if exists "measure_sheet_item_up_charge" cascade;`);

    this.addSql(`drop table if exists "measure_sheet_item_option" cascade;`);

    this.addSql(`drop table if exists "measure_sheet_item_office" cascade;`);

    this.addSql(`drop table if exists "company_logo" cascade;`);

    this.addSql(`drop table if exists "office_settings" cascade;`);

    this.addSql(`drop table if exists "additional_detail_field" cascade;`);

    this.addSql(
      `drop table if exists "up_charge_additional_detail_field" cascade;`,
    );

    this.addSql(
      `drop table if exists "measure_sheet_item_additional_detail_field" cascade;`,
    );

    this.addSql(`drop table if exists "user_company" cascade;`);

    this.addSql(`drop table if exists "user_office" cascade;`);

    this.addSql(`drop table if exists "user_role" cascade;`);

    this.addSql(
      `alter table "user" drop constraint "user_company_id_foreign";`,
    );

    this.addSql(
      `alter table "session" drop constraint "session_active_company_id_foreign";`,
    );

    this.addSql(
      `alter table "user_invite" drop constraint "user_invite_existing_user_id_foreign";`,
    );

    this.addSql(`alter table "company" drop column "default_logo_id";`);

    this.addSql(`drop index "user_deleted_at_index";`);
    this.addSql(
      `alter table "user" drop column "user_type", drop column "current_office_id", drop column "deleted_at";`,
    );

    this.addSql(`alter table "user" alter column "company_id" drop default;`);
    this.addSql(
      `alter table "user" alter column "company_id" type uuid using ("company_id"::text::uuid);`,
    );
    this.addSql(`alter table "user" alter column "company_id" set not null;`);
    this.addSql(
      `alter table "user" add constraint "user_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );

    this.addSql(`alter table "session" drop column "active_company_id";`);

    this.addSql(`alter table "session" alter column "sid" drop default;`);
    this.addSql(
      `alter table "session" alter column "sid" type uuid using ("sid"::text::uuid);`,
    );

    this.addSql(
      `alter table "user_invite" drop column "is_existing_user_invite", drop column "existing_user_id", drop column "current_office_id", drop column "allowed_offices";`,
    );
  }
}
