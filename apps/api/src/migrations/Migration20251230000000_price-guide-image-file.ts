import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add proper File entity references for MSI and UpCharge thumbnails.
 *
 * Changes:
 * - Replaces imageUrl (string) with image_id (FK to file) on measure_sheet_item
 * - Replaces imageUrl (string) with image_id (FK to file) on up_charge
 *
 * Benefits of File entity reference:
 * - Company-scoped S3 storage keys ({companyId}/files/{uuid}.{ext})
 * - Presigned URLs with expiration for security
 * - Automatic thumbnail generation
 * - CDN/storage provider flexibility
 * - Audit trail (uploadedBy, createdAt)
 */
export class Migration20251230000000 extends Migration {
  override up(): void {
    // ========================================================================
    // MeasureSheetItem: Replace imageUrl with image (File reference)
    // ========================================================================

    // Drop the old imageUrl column
    this.addSql(
      `alter table "measure_sheet_item" drop column if exists "image_url";`,
    );

    // Add image_id column (FK to file table)
    this.addSql(
      `alter table "measure_sheet_item" add column "image_id" uuid null;`,
    );

    // Add foreign key constraint
    this.addSql(
      `alter table "measure_sheet_item" add constraint "measure_sheet_item_image_id_foreign" foreign key ("image_id") references "file" ("id") on update cascade on delete set null;`,
    );

    // Add index for image_id
    this.addSql(
      `create index "measure_sheet_item_image_id_index" on "measure_sheet_item" ("image_id");`,
    );

    // ========================================================================
    // UpCharge: Replace imageUrl with image (File reference)
    // ========================================================================

    // Drop the old imageUrl column
    this.addSql(`alter table "up_charge" drop column if exists "image_url";`);

    // Add image_id column (FK to file table)
    this.addSql(`alter table "up_charge" add column "image_id" uuid null;`);

    // Add foreign key constraint
    this.addSql(
      `alter table "up_charge" add constraint "up_charge_image_id_foreign" foreign key ("image_id") references "file" ("id") on update cascade on delete set null;`,
    );

    // Add index for image_id
    this.addSql(
      `create index "up_charge_image_id_index" on "up_charge" ("image_id");`,
    );
  }

  override down(): void {
    // ========================================================================
    // MeasureSheetItem: Restore imageUrl, remove image_id
    // ========================================================================

    // Drop foreign key constraint
    this.addSql(
      `alter table "measure_sheet_item" drop constraint if exists "measure_sheet_item_image_id_foreign";`,
    );

    // Drop index
    this.addSql(`drop index if exists "measure_sheet_item_image_id_index";`);

    // Drop image_id column
    this.addSql(
      `alter table "measure_sheet_item" drop column if exists "image_id";`,
    );

    // Restore imageUrl column
    this.addSql(
      `alter table "measure_sheet_item" add column "image_url" varchar(255) null;`,
    );

    // ========================================================================
    // UpCharge: Restore imageUrl, remove image_id
    // ========================================================================

    // Drop foreign key constraint
    this.addSql(
      `alter table "up_charge" drop constraint if exists "up_charge_image_id_foreign";`,
    );

    // Drop index
    this.addSql(`drop index if exists "up_charge_image_id_index";`);

    // Drop image_id column
    this.addSql(`alter table "up_charge" drop column if exists "image_id";`);

    // Restore imageUrl column
    this.addSql(
      `alter table "up_charge" add column "image_url" varchar(255) null;`,
    );
  }
}
