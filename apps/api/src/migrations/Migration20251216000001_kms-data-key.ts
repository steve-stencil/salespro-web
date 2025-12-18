import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add encrypted_data_key column to office_integration table.
 * This column stores the KMS-encrypted data key used for envelope encryption.
 */
export class Migration20251216000001_KmsDataKey extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Add encrypted_data_key column for storing KMS-encrypted data keys
    this.addSql(`
      alter table "office_integration"
      add column "encrypted_data_key" text null;
    `);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    this.addSql(`
      alter table "office_integration"
      drop column "encrypted_data_key";
    `);
  }
}
