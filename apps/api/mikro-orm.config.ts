import { defineConfig } from '@mikro-orm/postgresql';

import {
  Company,
  CompanyLogo,
  User,
  Session,
  Role,
  UserRole,
  Office,
  UserOffice,
  UserCompany,
  OAuthClient,
  OAuthToken,
  OAuthAuthorizationCode,
  LoginAttempt,
  LoginEvent,
  PasswordResetToken,
  PasswordHistory,
  UserInvite,
  EmailVerificationToken,
  MfaRecoveryCode,
  TrustedDevice,
  RememberMeToken,
  ApiKey,
  File,
  OfficeSettings,
  OfficeIntegration,
  MigrationSession,
} from './src/entities';

/**
 * MikroORM configuration for CLI and migrations
 * Used by: mikro-orm CLI commands (migrations, schema generation, etc.)
 */
export default defineConfig({
  clientUrl:
    process.env['DATABASE_URL'] ??
    'postgresql://postgres:postgres@localhost:5432/salespro_dev',
  entities: [
    Company,
    CompanyLogo,
    User,
    Session,
    Role,
    UserRole,
    Office,
    UserOffice,
    UserCompany,
    OAuthClient,
    OAuthToken,
    OAuthAuthorizationCode,
    LoginAttempt,
    LoginEvent,
    PasswordResetToken,
    PasswordHistory,
    UserInvite,
    EmailVerificationToken,
    MfaRecoveryCode,
    TrustedDevice,
    RememberMeToken,
    ApiKey,
    File,
    OfficeSettings,
    OfficeIntegration,
    MigrationSession,
  ],
  migrations: {
    path: './src/migrations',
    pathTs: './src/migrations',
    glob: '!(*.d).{js,ts}',
    transactional: true,
    disableForeignKeys: false,
    allOrNothing: true,
    snapshot: true,
  },
  debug: process.env['NODE_ENV'] === 'development',
});
