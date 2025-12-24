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
export type TestCompanyData = {
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
};

export type TestUserData = {
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
};

export type TestOAuthClientData = {
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
};

export type TestLoginParams = {
  email: string;
  password: string;
  source: SessionSource;
  ipAddress: string;
  userAgent: string;
  rememberMe?: boolean;
  deviceId?: string;
};

// ============================================================================
// Document Type Factories
// ============================================================================

/**
 * Create a test document type fixture
 */
export function createDocumentTypeData(
  overrides: Partial<TestDocumentTypeData> = {},
): TestDocumentTypeData {
  return {
    id: uuid(),
    name: `Type ${Date.now()}`,
    isDefault: false,
    sortOrder: 0,
    officeIds: [],
    ...overrides,
  };
}

export type TestDocumentTypeData = {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  companyId?: string;
  officeIds: string[];
};

// ============================================================================
// Import Session Factories
// ============================================================================

/**
 * Create a test import session fixture
 */
export function createImportSessionData(
  overrides: Partial<TestImportSessionData> = {},
): TestImportSessionData {
  return {
    id: uuid(),
    status: 'pending',
    officeMapping: {},
    typeMapping: {},
    totalCount: 0,
    importedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
    ...overrides,
  };
}

export type TestImportSessionData = {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  officeMapping: Record<string, string>;
  typeMapping: Record<string, string>;
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ templateId: string; error: string }>;
  companyId?: string;
  createdById?: string;
};

// ============================================================================
// Document Template Factories
// ============================================================================

/**
 * Create a test document template fixture
 */
export function createDocumentTemplateData(
  overrides: Partial<TestDocumentTemplateData> = {},
): TestDocumentTemplateData {
  return {
    id: uuid(),
    displayName: `Template ${Date.now()}`,
    pageId: 'singlePage',
    pageWidth: 612,
    pageHeight: 792,
    hMargin: 35,
    wMargin: 20,
    sortOrder: 0,
    canAddMultiplePages: false,
    isTemplate: true,
    includedStates: [],
    useWatermark: false,
    watermarkWidthPercent: 100,
    watermarkAlpha: 0.05,
    photosPerPage: 1,
    documentDataJson: [{ groupType: 'body', data: [] }],
    hasUserInput: false,
    signatureFieldCount: 0,
    initialsFieldCount: 0,
    includedOfficeIds: [],
    ...overrides,
  };
}

export type TestDocumentTemplateData = {
  id: string;
  displayName: string;
  pageId: string;
  pageWidth: number;
  pageHeight: number;
  hMargin: number;
  wMargin: number;
  sortOrder: number;
  canAddMultiplePages: boolean;
  isTemplate: boolean;
  includedStates: string[];
  useWatermark: boolean;
  watermarkWidthPercent: number;
  watermarkAlpha: number;
  photosPerPage: number;
  documentDataJson: unknown[];
  hasUserInput: boolean;
  signatureFieldCount: number;
  initialsFieldCount: number;
  companyId?: string;
  categoryId?: string;
  documentTypeId?: string;
  sourceTemplateId?: string;
  includedOfficeIds: string[];
};

// ============================================================================
// Document Template Category Factories
// ============================================================================

/**
 * Create a test document template category fixture
 */
export function createDocumentTemplateCategoryData(
  overrides: Partial<TestDocumentTemplateCategoryData> = {},
): TestDocumentTemplateCategoryData {
  return {
    id: uuid(),
    name: `Category ${Date.now()}`,
    sortOrder: 0,
    isImported: false,
    ...overrides,
  };
}

export type TestDocumentTemplateCategoryData = {
  id: string;
  name: string;
  sortOrder: number;
  isImported: boolean;
  companyId?: string;
  sourceCategoryId?: string;
};

// ============================================================================
// Raw Parse Document Factories (for ETL testing)
// ============================================================================

/**
 * Create a raw Parse document object for ETL testing
 */
export function createRawParseDocumentData(
  overrides: Partial<TestRawParseDocumentData> = {},
): TestRawParseDocumentData {
  return {
    objectId: uuid(),
    type: 'contract',
    pageId: 'singlePage',
    category: 'Contracts',
    displayName: `Test Document ${Date.now()}`,
    order: 0,
    canAddMultiplePages: false,
    isTemplate: true,
    includedStates: [],
    includedOffices: [],
    pageSize: '612,792',
    hMargin: 35,
    wMargin: 20,
    photosPerPage: 1,
    useWatermark: false,
    watermarkWidthPercent: 100,
    watermarkAlpha: 0.05,
    contractData: [{ groupType: 'body', data: [] }],
    images: [],
    ...overrides,
  };
}

export type TestRawParseDocumentData = {
  objectId: string;
  type?: string;
  pageId?: string;
  category?: string;
  displayName?: string;
  order?: number;
  canAddMultiplePages?: boolean;
  isTemplate?: boolean;
  includedStates?: string[];
  includedOffices?: Array<{
    objectId: string;
    className?: string;
    __type?: string;
  }>;
  pageSize?: string;
  hMargin?: number;
  wMargin?: number;
  photosPerPage?: number;
  useWatermark?: boolean;
  watermarkWidthPercent?: number;
  watermarkAlpha?: number;
  contractData?: unknown[];
  images?: unknown[];
  iconBackgroundColor?: number[];
  iconImage?: { url: string; name: string; __type?: string };
  pdf?: { url: string; name: string; __type?: string };
  watermark?: { url: string; name: string; __type?: string };
  company?: { objectId: string; className?: string; __type?: string };
  createdAt?: string;
  updatedAt?: string;
};
