import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

import { env } from '../config/env';
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
  DocumentTemplate,
  DocumentTemplateCategory,
  DocumentDraft,
  DocumentType,
  ImportSession,
} from '../entities';

import type { Options } from '@mikro-orm/core';

let orm: MikroORM | null = null;

/**
 * All entity classes for MikroORM registration.
 * This is the SINGLE SOURCE OF TRUTH for entity registration.
 * Used by both runtime (db.ts) and CLI tools (mikro-orm.config.ts).
 *
 * When adding a new entity:
 * 1. Create entity file in entities/
 * 2. Export from entities/index.ts
 * 3. Add to this array
 */
export const entities = [
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
  DocumentTemplate,
  DocumentTemplateCategory,
  DocumentDraft,
  DocumentType,
  ImportSession,
];

/**
 * Get MikroORM configuration options
 */
export function getORMConfig(): Options<PostgreSqlDriver> {
  return {
    clientUrl: env.DATABASE_URL,
    driver: PostgreSqlDriver,
    entities,
    debug: env.NODE_ENV === 'development',
    allowGlobalContext: true,
  };
}

/**
 * Initialize MikroORM connection to PostgreSQL
 * Returns existing instance if already initialized
 */
export async function initORM(): Promise<MikroORM> {
  if (orm) return orm;

  orm = await MikroORM.init<PostgreSqlDriver>(getORMConfig());

  return orm;
}

/**
 * Get the current ORM instance
 * @throws Error if ORM is not initialized
 */
export function getORM(): MikroORM {
  if (!orm) {
    throw new Error('ORM not initialized. Call initORM() first.');
  }
  return orm;
}

/**
 * Close the ORM connection
 */
export async function closeORM(): Promise<void> {
  if (orm) {
    await orm.close();
    orm = null;
  }
}

/**
 * Connect to database (alias for initORM for backward compatibility)
 */
export async function connectDB(): Promise<MikroORM> {
  return initORM();
}
