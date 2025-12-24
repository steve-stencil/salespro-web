import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create the DocumentDraft table.
 *
 * This table stores user-entered values and draft state for document workflows.
 * Templates are read-only, but drafts track:
 * - Which templates were selected
 * - User-entered values from form filling
 * - Photos, signatures, and initials
 * - Draft status through the workflow
 *
 * @see readonlytemplatesschema_08cb2e06.plan.md for rationale
 */
export class Migration20251219000002 extends Migration {
  override up(): void {
    // Create the document_draft_status enum
    this.addSql(`
      create type "document_draft_status" as enum (
        'draft', 'ready', 'sent', 'completed', 'cancelled'
      );
    `);

    // Create the document_draft table
    this.addSql(`
      create table "document_draft" (
        "id" uuid not null default gen_random_uuid(),
        "company_id" uuid not null,
        "office_id" uuid null,
        "created_by_id" uuid not null,
        "estimate_id" varchar(255) null,
        "status" "document_draft_status" not null default 'draft',
        "name" varchar(255) null,

        -- JSON payload fields
        "selected_templates" jsonb not null default '[]',
        "values_json" jsonb not null default '{"values":{}}',
        "customer_info" jsonb null,
        "metadata" jsonb null,

        -- Timestamps
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        "sent_at" timestamptz null,
        "completed_at" timestamptz null,

        constraint "document_draft_pkey" primary key ("id")
      );
    `);

    // Add foreign key to company
    this.addSql(`
      alter table "document_draft"
        add constraint "document_draft_company_id_foreign"
        foreign key ("company_id") references "company" ("id")
        on update cascade on delete cascade;
    `);

    // Add foreign key to office
    this.addSql(`
      alter table "document_draft"
        add constraint "document_draft_office_id_foreign"
        foreign key ("office_id") references "office" ("id")
        on update cascade on delete set null;
    `);

    // Add foreign key to user (created_by)
    this.addSql(`
      alter table "document_draft"
        add constraint "document_draft_created_by_id_foreign"
        foreign key ("created_by_id") references "user" ("id")
        on update cascade on delete cascade;
    `);

    // Create indexes
    this.addSql(
      `create index "document_draft_company_id_index" on "document_draft" ("company_id");`,
    );
    this.addSql(
      `create index "document_draft_office_id_index" on "document_draft" ("office_id");`,
    );
    this.addSql(
      `create index "document_draft_created_by_id_index" on "document_draft" ("created_by_id");`,
    );
    this.addSql(
      `create index "document_draft_estimate_id_index" on "document_draft" ("estimate_id");`,
    );
    this.addSql(
      `create index "document_draft_status_index" on "document_draft" ("status");`,
    );
  }

  override down(): void {
    // Drop indexes
    this.addSql(`drop index if exists "document_draft_status_index";`);
    this.addSql(`drop index if exists "document_draft_estimate_id_index";`);
    this.addSql(`drop index if exists "document_draft_created_by_id_index";`);
    this.addSql(`drop index if exists "document_draft_office_id_index";`);
    this.addSql(`drop index if exists "document_draft_company_id_index";`);

    // Drop foreign key constraints
    this.addSql(
      `alter table "document_draft" drop constraint if exists "document_draft_created_by_id_foreign";`,
    );
    this.addSql(
      `alter table "document_draft" drop constraint if exists "document_draft_office_id_foreign";`,
    );
    this.addSql(
      `alter table "document_draft" drop constraint if exists "document_draft_company_id_foreign";`,
    );

    // Drop the table
    this.addSql(`drop table if exists "document_draft";`);

    // Drop the enum
    this.addSql(`drop type if exists "document_draft_status";`);
  }
}
