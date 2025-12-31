import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create Tag and ItemTag tables for the polymorphic tagging system.
 *
 * Creates:
 * - tag: Reusable labels for organizing library items (Options, UpCharges, Additional Details)
 * - item_tag: Polymorphic junction table linking tags to any taggable entity
 *
 * Design Notes:
 * - Tags are company-scoped for multi-tenant isolation
 * - ItemTag uses a polymorphic design (entityType + entityId) for extensibility
 * - No FK constraint on entityId (can't reference multiple tables)
 * - Application-level integrity relies on soft deletes on parent entities
 */
export class Migration20251230100000_tags extends Migration {
  override up(): void {
    // ============================================================
    // Tag
    // ============================================================
    this.addSql(
      `create table if not exists "tag" ("id" uuid not null, "company_id" uuid not null, "name" varchar(100) not null, "color" varchar(7) not null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "tag_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "tag_company_id_index" on "tag" ("company_id");`,
    );
    this.addSql(
      `create index if not exists "tag_company_id_name_index" on "tag" ("company_id", "name");`,
    );
    this.addSql(
      `create index if not exists "tag_company_id_is_active_index" on "tag" ("company_id", "is_active");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "tag" ADD CONSTRAINT "tag_company_id_name_unique" UNIQUE ("company_id", "name");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Item Tag (Polymorphic Junction)
    // ============================================================
    this.addSql(
      `create table if not exists "item_tag" ("id" uuid not null, "tag_id" uuid not null, "entity_type" text check ("entity_type" in ('OPTION', 'UPCHARGE', 'ADDITIONAL_DETAIL')) not null, "entity_id" uuid not null, "created_at" timestamptz not null, constraint "item_tag_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "item_tag_tag_id_index" on "item_tag" ("tag_id");`,
    );
    this.addSql(
      `create index if not exists "item_tag_entity_id_index" on "item_tag" ("entity_id");`,
    );
    this.addSql(
      `create index if not exists "item_tag_entity_type_entity_id_index" on "item_tag" ("entity_type", "entity_id");`,
    );
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_tag_id_entity_type_entity_id_unique" UNIQUE ("tag_id", "entity_type", "entity_id");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ============================================================
    // Foreign Keys
    // ============================================================

    // tag -> company
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "tag" ADD CONSTRAINT "tag_company_id_foreign" FOREIGN KEY ("company_id") REFERENCES "company" ("id") ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // item_tag -> tag
    this.addSql(`
      DO $$ BEGIN
        ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_tag_id_foreign" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  override down(): void {
    // Drop foreign key constraints first
    this.addSql(
      `ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_tag_id_foreign";`,
    );
    this.addSql(
      `ALTER TABLE "tag" DROP CONSTRAINT IF EXISTS "tag_company_id_foreign";`,
    );

    // Drop tables
    this.addSql(`DROP TABLE IF EXISTS "item_tag" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "tag" CASCADE;`);
  }
}
