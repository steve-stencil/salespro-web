import { beforeAll, afterAll, vi } from 'vitest';

// Mock KMS module BEFORE any imports that use it
// Note: crypto.randomBytes is called inside the factory to avoid hoisting issues
vi.mock('../../lib/kms', async () => {
  const crypto = await import('crypto');
  const mockPlaintextKey = crypto.randomBytes(32);
  const mockEncryptedKey = crypto.randomBytes(64).toString('base64');

  return {
    generateDataKey: vi.fn().mockResolvedValue({
      plaintextKey: mockPlaintextKey,
      encryptedKey: mockEncryptedKey,
    }),
    decryptDataKey: vi.fn().mockResolvedValue(mockPlaintextKey),
    isKmsConfigured: vi.fn().mockReturnValue(true),
    KmsError: class KmsError extends Error {},
  };
});

// Mock sharp for image processing (office logo tests)
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 256, height: 256 }),
    resize: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('thumbnail')),
  })),
}));

// Mock email service BEFORE any imports that use it to prevent SES API calls
vi.mock('../../lib/email', () => ({
  isEmailServiceConfigured: vi.fn(() => true),
  emailService: {
    sendEmail: vi
      .fn()
      .mockResolvedValue({ messageId: 'test-id', success: true }),
    sendPasswordResetEmail: vi
      .fn()
      .mockResolvedValue({ messageId: 'test-id', success: true }),
    sendMfaCodeEmail: vi
      .fn()
      .mockResolvedValue({ messageId: 'test-id', success: true }),
    sendInviteEmail: vi
      .fn()
      .mockResolvedValue({ messageId: 'test-id', success: true }),
    isConfigured: vi.fn(() => true),
  },
  EmailServiceError: class EmailServiceError extends Error {},
}));

// Mock storage service to enable S3 presigned URL tests without actual S3 config
vi.mock('../../lib/storage', async importOriginal => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const original = await importOriginal<typeof import('../../lib/storage')>();
  return {
    ...original,
    isS3Configured: vi.fn(() => true),
    getStorageAdapter: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({
        key: 'test-key',
        size: 1000,
        etag: '"abc123"',
      }),
      download: vi.fn().mockResolvedValue({
        // eslint-disable-next-line @typescript-eslint/require-await
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('test content');
        },
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      getSignedDownloadUrl: vi
        .fn()
        .mockResolvedValue('https://example.com/signed-url'),
      generatePresignedUpload: vi.fn().mockResolvedValue({
        url: 'https://example.com/upload-url',
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        expiresAt: new Date(Date.now() + 900000),
      }),
    })),
  };
});

// Mock ETL queries to avoid needing actual MongoDB connection for migration tests
vi.mock('../../services/etl/queries/office.queries', () => ({
  queryOffices: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  countOffices: vi.fn().mockResolvedValue(5),
  queryAllOffices: vi.fn().mockResolvedValue([]),
  queryOfficesByIds: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/etl/queries/user.queries', () => ({
  getSourceCompanyIdByEmail: vi.fn().mockResolvedValue('source-company-123'),
}));

vi.mock('../../services/etl/source-client', () => ({
  isSourceConfigured: vi.fn().mockReturnValue(true),
  closeSourceConnection: vi.fn(),
  isConnectedToReplicaSet: vi.fn().mockReturnValue(false),
  parsePointer: vi.fn(),
  createPointer: vi.fn(),
  getCollection: vi.fn(),
}));

import { initORM, closeORM, getORM } from '../../lib/db';
import { createServer } from '../../server';

import type { Server } from 'http';
import type { AddressInfo } from 'net';

let server: Server | undefined;
let baseUrl: string;
let setupError: Error | undefined;

export function getTestServer() {
  if (setupError) {
    throw setupError;
  }
  return { server: server!, baseUrl };
}

beforeAll(async () => {
  try {
    // Connect to the test PostgreSQL instance
    await initORM();

    // Create database schema for tests
    const orm = getORM();
    const generator = orm.getSchemaGenerator();
    await generator.refreshDatabase();

    // Start the actual server
    server = await createServer();

    const address = server.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;

    console.log(`Test server running on ${baseUrl}`);
  } catch (error) {
    // Store the error so tests can be skipped
    setupError = error instanceof Error ? error : new Error(String(error));
    console.error(
      'Failed to setup integration test server:',
      setupError.message,
    );
    console.error(
      'Make sure PostgreSQL is running (docker-compose -f docker-compose.test.yml up)',
    );
  }
});

afterAll(async () => {
  // Clean up server and database connection
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  await closeORM();
});
