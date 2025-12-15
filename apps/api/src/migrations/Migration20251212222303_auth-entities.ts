import { Migration } from '@mikro-orm/migrations';

export class Migration20251212222303_AuthEntities extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    this.addSql(
      `create table "company" ("id" uuid not null, "name" varchar(255) not null, "max_seats" int not null default 5, "max_sessions_per_user" int not null default 2, "tier" text check ("tier" in ('free', 'starter', 'professional', 'enterprise')) not null default 'free', "session_limit_strategy" text check ("session_limit_strategy" in ('block_new', 'revoke_oldest', 'revoke_lru', 'prompt_user')) not null default 'revoke_oldest', "password_policy" jsonb not null, "mfa_required" boolean not null default false, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "company_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "login_attempt" ("id" uuid not null, "email" varchar(255) not null, "ip_address" varchar(255) not null, "success" boolean not null, "failure_reason" varchar(255) null, "user_agent" varchar(255) null, "created_at" timestamptz not null, constraint "login_attempt_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "login_attempt_created_at_index" on "login_attempt" ("created_at");`,
    );
    this.addSql(
      `create index "login_attempt_ip_address_index" on "login_attempt" ("ip_address");`,
    );
    this.addSql(
      `create index "login_attempt_email_index" on "login_attempt" ("email");`,
    );

    this.addSql(
      `create table "user" ("id" uuid not null, "email" varchar(255) not null, "password_hash" varchar(255) not null, "name_first" varchar(255) null, "name_last" varchar(255) null, "is_active" boolean not null default true, "needs_reset_password" boolean not null default false, "last_login_date" timestamptz null, "company_id" uuid not null, "max_sessions" int not null default 2, "failed_login_attempts" int not null default 0, "locked_until" timestamptz null, "last_failed_login_at" timestamptz null, "email_verified" boolean not null default false, "email_verified_at" timestamptz null, "force_logout_at" timestamptz null, "mfa_enabled" boolean not null default false, "mfa_secret" varchar(255) null, "mfa_enabled_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "user_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "user_email_index" on "user" ("email");`);

    this.addSql(
      `create table "trusted_device" ("id" uuid not null, "user_id" uuid not null, "device_fingerprint" varchar(255) not null, "device_name" varchar(255) not null, "last_ip_address" varchar(255) null, "last_seen_at" timestamptz not null, "trust_expires_at" timestamptz null, "created_at" timestamptz not null, constraint "trusted_device_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "trusted_device_device_fingerprint_index" on "trusted_device" ("device_fingerprint");`,
    );
    this.addSql(
      `create index "trusted_device_user_id_index" on "trusted_device" ("user_id");`,
    );

    this.addSql(
      `create table "session" ("sid" uuid not null, "data" jsonb not null, "expires_at" timestamptz not null, "absolute_expires_at" timestamptz not null, "user_id" uuid null, "company_id" uuid null, "source" text check ("source" in ('web', 'ios', 'android', 'api')) null, "device_id" varchar(255) null, "user_agent" varchar(255) null, "ip_address" varchar(255) null, "source_user_id" uuid null, "mfa_verified" boolean not null default false, "created_at" timestamptz not null, "last_activity_at" timestamptz not null, constraint "session_pkey" primary key ("sid"));`,
    );
    this.addSql(
      `create index "session_absolute_expires_at_index" on "session" ("absolute_expires_at");`,
    );
    this.addSql(
      `create index "session_expires_at_index" on "session" ("expires_at");`,
    );
    this.addSql(
      `create index "session_company_id_index" on "session" ("company_id");`,
    );
    this.addSql(
      `create index "session_user_id_index" on "session" ("user_id");`,
    );
    this.addSql(
      `create index "session_user_id_source_index" on "session" ("user_id", "source");`,
    );

    this.addSql(
      `create table "remember_me_token" ("id" uuid not null, "token_hash" varchar(255) not null, "token_prefix" varchar(255) not null, "user_id" uuid not null, "expires_at" timestamptz not null, "device_fingerprint" varchar(255) null, "user_agent" varchar(255) null, "created_at" timestamptz not null, "last_used_at" timestamptz null, constraint "remember_me_token_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "remember_me_token_expires_at_index" on "remember_me_token" ("expires_at");`,
    );
    this.addSql(
      `create index "remember_me_token_user_id_index" on "remember_me_token" ("user_id");`,
    );
    this.addSql(
      `create index "remember_me_token_token_hash_index" on "remember_me_token" ("token_hash");`,
    );

    this.addSql(
      `create table "password_reset_token" ("id" uuid not null, "token_hash" varchar(255) not null, "user_id" uuid not null, "expires_at" timestamptz not null, "used_at" timestamptz null, "created_at" timestamptz not null, constraint "password_reset_token_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "password_reset_token_user_id_index" on "password_reset_token" ("user_id");`,
    );
    this.addSql(
      `create index "password_reset_token_token_hash_index" on "password_reset_token" ("token_hash");`,
    );

    this.addSql(
      `create table "password_history" ("id" uuid not null, "user_id" uuid not null, "password_hash" varchar(255) not null, "created_at" timestamptz not null, constraint "password_history_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "password_history_created_at_index" on "password_history" ("created_at");`,
    );
    this.addSql(
      `create index "password_history_user_id_index" on "password_history" ("user_id");`,
    );

    this.addSql(
      `create table "oauth_client" ("id" uuid not null, "client_id" varchar(255) not null, "client_secret_hash" varchar(255) null, "redirect_uris" text[] not null, "grants" text[] not null, "access_token_lifetime" int not null default 3600, "refresh_token_lifetime" int not null default 1209600, "owner_id" uuid not null, "company_id" uuid not null, "client_type" text check ("client_type" in ('confidential', 'public')) not null default 'confidential', "require_pkce" boolean not null default false, "allowed_scopes" text[] not null, "name" varchar(255) not null, "description" varchar(255) null, "logo_url" varchar(255) null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "oauth_client_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "oauth_client" add constraint "oauth_client_client_id_unique" unique ("client_id");`,
    );

    this.addSql(
      `create table "oauth_token" ("id" uuid not null, "access_token_hash" varchar(255) not null, "access_token_prefix" varchar(255) not null, "access_token_expires_at" timestamptz not null, "refresh_token_hash" varchar(255) null, "refresh_token_prefix" varchar(255) null, "refresh_token_expires_at" timestamptz null, "refresh_token_family" varchar(255) null, "replaced_by_token_id" varchar(255) null, "revoked_at" timestamptz null, "revoked_reason" varchar(255) null, "scope" text[] not null, "client_id" uuid not null, "user_id" uuid not null, "created_at" timestamptz not null, constraint "oauth_token_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "oauth_token_refresh_token_family_index" on "oauth_token" ("refresh_token_family");`,
    );
    this.addSql(
      `create index "oauth_token_refresh_token_hash_index" on "oauth_token" ("refresh_token_hash");`,
    );
    this.addSql(
      `create index "oauth_token_access_token_hash_index" on "oauth_token" ("access_token_hash");`,
    );

    this.addSql(
      `create table "oauth_authorization_code" ("id" uuid not null, "code_hash" varchar(255) not null, "expires_at" timestamptz not null, "redirect_uri" varchar(255) not null, "scope" text[] not null, "client_id" uuid not null, "user_id" uuid not null, "code_challenge" varchar(255) null, "code_challenge_method" varchar(255) null, "state" varchar(255) null, "created_at" timestamptz not null, "used_at" timestamptz null, constraint "oauth_authorization_code_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "oauth_authorization_code_code_hash_index" on "oauth_authorization_code" ("code_hash");`,
    );

    this.addSql(
      `create table "mfa_recovery_code" ("id" uuid not null, "user_id" uuid not null, "code_hash" varchar(255) not null, "used_at" timestamptz null, "created_at" timestamptz not null, constraint "mfa_recovery_code_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "mfa_recovery_code_code_hash_index" on "mfa_recovery_code" ("code_hash");`,
    );
    this.addSql(
      `create index "mfa_recovery_code_user_id_index" on "mfa_recovery_code" ("user_id");`,
    );

    this.addSql(
      `create table "login_event" ("id" uuid not null, "user_id" uuid null, "email" varchar(255) not null, "event_type" text check ("event_type" in ('login_success', 'login_failed', 'logout', 'session_expired', 'session_revoked', 'password_reset_requested', 'password_reset_completed', 'password_changed', 'account_locked', 'account_unlocked', 'account_deactivated', 'account_reactivated', 'invite_sent', 'invite_accepted', 'mfa_enabled', 'mfa_disabled', 'mfa_backup_code_used', 'trusted_device_added', 'trusted_device_removed', 'api_key_created', 'api_key_revoked')) not null, "ip_address" varchar(255) not null, "user_agent" varchar(255) not null, "location" varchar(255) null, "source" text check ("source" in ('web', 'ios', 'android', 'api')) not null, "metadata" jsonb null, "created_at" timestamptz not null, constraint "login_event_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "login_event_created_at_index" on "login_event" ("created_at");`,
    );
    this.addSql(
      `create index "login_event_event_type_index" on "login_event" ("event_type");`,
    );
    this.addSql(
      `create index "login_event_user_id_index" on "login_event" ("user_id");`,
    );

    this.addSql(
      `create table "email_verification_token" ("id" uuid not null, "token_hash" varchar(255) not null, "user_id" uuid not null, "email" varchar(255) not null, "expires_at" timestamptz not null, "created_at" timestamptz not null, constraint "email_verification_token_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "email_verification_token_user_id_index" on "email_verification_token" ("user_id");`,
    );
    this.addSql(
      `create index "email_verification_token_token_hash_index" on "email_verification_token" ("token_hash");`,
    );

    this.addSql(
      `create table "api_key" ("id" uuid not null, "key_hash" varchar(255) not null, "key_prefix" varchar(255) not null, "name" varchar(255) not null, "company_id" uuid not null, "created_by_id" uuid not null, "scopes" text[] not null, "last_used_at" timestamptz null, "last_used_ip" varchar(255) null, "expires_at" timestamptz null, "is_active" boolean not null default true, "created_at" timestamptz not null, "revoked_at" timestamptz null, "revoked_by" varchar(255) null, constraint "api_key_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "api_key_key_prefix_index" on "api_key" ("key_prefix");`,
    );
    this.addSql(
      `create index "api_key_company_id_index" on "api_key" ("company_id");`,
    );
    this.addSql(
      `create index "api_key_key_hash_index" on "api_key" ("key_hash");`,
    );

    this.addSql(
      `create table "user_invite" ("id" uuid not null, "email" varchar(255) not null, "token_hash" varchar(255) not null, "company_id" uuid not null, "invited_by_id" uuid not null, "roles" text[] not null, "expires_at" timestamptz not null, "status" text check ("status" in ('pending', 'accepted', 'expired', 'revoked')) not null default 'pending', "created_at" timestamptz not null, "accepted_at" timestamptz null, constraint "user_invite_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "user_invite_status_index" on "user_invite" ("status");`,
    );
    this.addSql(
      `create index "user_invite_email_index" on "user_invite" ("email");`,
    );
    this.addSql(
      `create index "user_invite_token_hash_index" on "user_invite" ("token_hash");`,
    );

    this.addSql(
      `alter table "user" add constraint "user_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "trusted_device" add constraint "trusted_device_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "session" add constraint "session_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "session" add constraint "session_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "session" add constraint "session_source_user_id_foreign" foreign key ("source_user_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "remember_me_token" add constraint "remember_me_token_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "password_reset_token" add constraint "password_reset_token_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "password_history" add constraint "password_history_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "oauth_client" add constraint "oauth_client_owner_id_foreign" foreign key ("owner_id") references "user" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "oauth_client" add constraint "oauth_client_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "oauth_token" add constraint "oauth_token_client_id_foreign" foreign key ("client_id") references "oauth_client" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "oauth_token" add constraint "oauth_token_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "oauth_authorization_code" add constraint "oauth_authorization_code_client_id_foreign" foreign key ("client_id") references "oauth_client" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "oauth_authorization_code" add constraint "oauth_authorization_code_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "mfa_recovery_code" add constraint "mfa_recovery_code_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "login_event" add constraint "login_event_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "email_verification_token" add constraint "email_verification_token_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "api_key" add constraint "api_key_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "api_key" add constraint "api_key_created_by_id_foreign" foreign key ("created_by_id") references "user" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table "user_invite" add constraint "user_invite_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "user_invite" add constraint "user_invite_invited_by_id_foreign" foreign key ("invited_by_id") references "user" ("id") on update cascade;`,
    );
  }
}
