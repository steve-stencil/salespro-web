/**
 * Test data factories for creating consistent test fixtures
 */
import { v4 as uuid } from 'uuid';

import { hashPassword, hashToken, generateSecureToken } from '../../lib/crypto';

import type { SessionSource } from '../../entities';

/**
 * Create a test company fixture
 */
export function createCompanyData(
  overrides: Partial<TestCompanyData> = {},
): TestCompanyData {
  return {
    id: uuid(),
    name: `Test Company ${Date.now()}`,
    maxSessionsPerUser: 5,
    mfaRequired: false,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      historyCount: 3,
      expirationDays: 90,
    },
    ...overrides,
  };
}

/**
 * Create a test user fixture
 */
export async function createUserData(
  overrides: Partial<TestUserData> = {},
): Promise<TestUserData> {
  const password = overrides.password ?? 'TestPassword123!';
  const passwordHash = await hashPassword(password);

  return {
    id: uuid(),
    email: `test-${Date.now()}@example.com`,
    passwordHash,
    nameFirst: 'Test',
    nameLast: 'User',
    isActive: true,
    emailVerified: true,
    mfaEnabled: false,
    failedLoginAttempts: 0,
    needsResetPassword: false,
    ...overrides,
    password, // Keep original password for testing
  };
}

/**
 * Create a test OAuth client fixture
 */
export function createOAuthClientData(
  overrides: Partial<TestOAuthClientData> = {},
): TestOAuthClientData {
  const clientId = `client_${Date.now()}`;
  const clientSecret = generateSecureToken(32);

  return {
    id: uuid(),
    clientId,
    clientSecret,
    clientSecretHash: hashToken(clientSecret),
    name: 'Test OAuth App',
    redirectUris: ['http://localhost:3000/callback'],
    grants: ['authorization_code', 'refresh_token'],
    allowedScopes: ['openid', 'profile', 'email', 'read:user'],
    isActive: true,
    requirePkce: false,
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 86400 * 14,
    ...overrides,
  };
}

/**
 * Create test login params
 */
export function createLoginParams(
  overrides: Partial<TestLoginParams> = {},
): TestLoginParams {
  return {
    email: 'test@example.com',
    password: 'TestPassword123!',
    source: 'web' as SessionSource,
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent/1.0',
    rememberMe: false,
    ...overrides,
  };
}

/**
 * Generate a valid password that meets default policy
 */
export function generateValidPassword(): string {
  return 'ValidPass123!';
}

/**
 * Generate various invalid passwords for testing
 */
export function getInvalidPasswords(): Array<{
  password: string;
  reason: string;
}> {
  return [
    { password: 'short', reason: 'too short' },
    { password: 'nouppercase123', reason: 'no uppercase' },
    { password: 'NOLOWERCASE123', reason: 'no lowercase' },
    { password: 'NoNumbersHere!', reason: 'no numbers' },
  ];
}

// Type definitions for test data
export interface TestCompanyData {
  id: string;
  name: string;
  maxSessionsPerUser: number;
  mfaRequired: boolean;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    historyCount: number;
    expirationDays: number;
  };
}

export interface TestUserData {
  id: string;
  email: string;
  passwordHash: string;
  password: string;
  nameFirst: string;
  nameLast: string;
  isActive: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  failedLoginAttempts: number;
  needsResetPassword: boolean;
  lockedUntil?: Date;
  companyId?: string;
}

export interface TestOAuthClientData {
  id: string;
  clientId: string;
  clientSecret: string;
  clientSecretHash: string;
  name: string;
  redirectUris: string[];
  grants: string[];
  allowedScopes: string[];
  isActive: boolean;
  requirePkce: boolean;
  accessTokenLifetime: number;
  refreshTokenLifetime: number;
}

export interface TestLoginParams {
  email: string;
  password: string;
  source: SessionSource;
  ipAddress: string;
  userAgent: string;
  rememberMe?: boolean;
  deviceId?: string;
}
