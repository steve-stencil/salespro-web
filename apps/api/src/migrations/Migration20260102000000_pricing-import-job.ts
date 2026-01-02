import { Migration } from '@mikro-orm/migrations';

/**
 * Creates the pricing_import_job table for tracking background pricing import operations.
 * Also creates the pgboss schema if it doesn't exist (pg-boss will handle its own tables).
 */
export class Migration20260102000000 extends Migration {
  override up(): void {
    // Create pgboss schema for pg-boss job queue (if not exists)
    this.addSql('CREATE SCHEMA IF NOT EXISTS pgboss');

    // Create pricing_import_job table
    this.addSql(`
      CREATE TABLE "pricing_import_job" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "filename" varchar(255) NOT NULL,
        "file_key" varchar(500) NOT NULL,
        "total_rows" integer,
        "processed_rows" integer NOT NULL DEFAULT 0,
        "created_count" integer NOT NULL DEFAULT 0,
        "updated_count" integer NOT NULL DEFAULT 0,
        "skipped_count" integer NOT NULL DEFAULT 0,
        "error_count" integer NOT NULL DEFAULT 0,
        "errors" jsonb,
        "email_sent" boolean NOT NULL DEFAULT false,
        "created_by_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz,
        CONSTRAINT "pricing_import_job_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pricing_import_job_company_fkey" 
          FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE,
        CONSTRAINT "pricing_import_job_created_by_fkey" 
          FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT
      )
    `);

    // Create indexes for efficient queries
    this.addSql(`
      CREATE INDEX "pricing_import_job_status_created_at_idx" 
        ON "pricing_import_job" ("status", "created_at")
    `);

    this.addSql(`
      CREATE INDEX "pricing_import_job_created_by_created_at_idx" 
        ON "pricing_import_job" ("created_by_id", "created_at")
    `);

    this.addSql(`
      CREATE INDEX "pricing_import_job_company_created_at_idx" 
        ON "pricing_import_job" ("company_id", "created_at")
    `);
  }

  override down(): void {
    // Drop indexes first
    this.addSql(
      'DROP INDEX IF EXISTS "pricing_import_job_status_created_at_idx"',
    );
    this.addSql(
      'DROP INDEX IF EXISTS "pricing_import_job_created_by_created_at_idx"',
    );
    this.addSql(
      'DROP INDEX IF EXISTS "pricing_import_job_company_created_at_idx"',
    );

    // Drop the table
    this.addSql('DROP TABLE IF EXISTS "pricing_import_job"');

    // Note: Not dropping pgboss schema as it may be used by other parts of the app
  }
}
