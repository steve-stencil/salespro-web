import { defineConfig } from '@mikro-orm/postgresql';

import {
  Company,
  User,
  Session,
  Role,
  UserRole,
  Office,
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
    User,
    Session,
    Role,
    UserRole,
    Office,
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
