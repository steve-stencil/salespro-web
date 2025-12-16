import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to create user_invite table for email invitation system.
 * Allows admins to invite new users to join a company via email.
 */
export class Migration20251215000003_UserInvite extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    // Create user_invite table
    this.addSql(
      `create table "user_invite" (
        "id" uuid not null,
        "email" varchar(255) not null,
        "token_hash" varchar(255) not null,
        "company_id" uuid not null,
        "invited_by_id" uuid not null,
        "roles" jsonb not null default '[]',
        "expires_at" timestamptz not null,
        "status" varchar(50) not null default 'pending',
        "created_at" timestamptz not null,
        "accepted_at" timestamptz null,
        constraint "user_invite_pkey" primary key ("id")
      );`,
    );

    // Create indexes for efficient queries
    this.addSql(
      `create index "user_invite_token_hash_index" on "user_invite" ("token_hash");`,
    );
    this.addSql(
      `create index "user_invite_email_index" on "user_invite" ("email");`,
    );
    this.addSql(
      `create index "user_invite_status_index" on "user_invite" ("status");`,
    );
    this.addSql(
      `create index "user_invite_company_id_index" on "user_invite" ("company_id");`,
    );

    // Add foreign key constraints
    this.addSql(
      `alter table "user_invite" add constraint "user_invite_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "user_invite" add constraint "user_invite_invited_by_id_foreign" foreign key ("invited_by_id") references "user" ("id") on update cascade on delete cascade;`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    // Drop foreign key constraints
    this.addSql(
      `alter table "user_invite" drop constraint "user_invite_invited_by_id_foreign";`,
    );
    this.addSql(
      `alter table "user_invite" drop constraint "user_invite_company_id_foreign";`,
    );

    // Drop user_invite table
    this.addSql(`drop table if exists "user_invite" cascade;`);
  }
}
