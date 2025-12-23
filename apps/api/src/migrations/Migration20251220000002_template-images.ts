import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to:
 * 1. Create document_template_image pivot table for M2M with File
 * 2. Remove images_json column from document_template
 */
export class Migration20251220000002 extends Migration {
  override up(): void {
    // Create pivot table for template images (M2M with File)
    this.addSql(`
      create table "document_template_image" (
        "document_template_id" uuid not null,
        "file_id" uuid not null,
        constraint "document_template_image_pkey" 
          primary key ("document_template_id", "file_id")
      );
    `);

    // Add foreign keys
    this.addSql(`
      alter table "document_template_image"
        add constraint "document_template_image_document_template_id_fk"
        foreign key ("document_template_id") 
        references "document_template" ("id")
        on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "document_template_image"
        add constraint "document_template_image_file_id_fk"
        foreign key ("file_id") 
        references "file" ("id")
        on update cascade on delete cascade;
    `);

    // Add indexes for query performance
    this.addSql(
      `create index "document_template_image_document_template_id_idx" 
       on "document_template_image" ("document_template_id");`,
    );
    this.addSql(
      `create index "document_template_image_file_id_idx" 
       on "document_template_image" ("file_id");`,
    );

    // Remove the old images_json column
    this.addSql(`
      alter table "document_template" drop column if exists "images_json";
    `);
  }

  override down(): void {
    // Re-add images_json column
    this.addSql(`
      alter table "document_template" 
        add column "images_json" jsonb null;
    `);

    // Drop pivot table
    this.addSql(`drop table if exists "document_template_image";`);
  }
}
