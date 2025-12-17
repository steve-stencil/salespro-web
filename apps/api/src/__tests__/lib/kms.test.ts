/**
 * Unit tests for AWS KMS service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { KmsError, KmsErrorCode } from '../../lib/kms';

// Store mock send function at module level
const mockSend = vi.fn();

// Mock the AWS SDK before importing kms module
vi.mock('@aws-sdk/client-kms', () => {
  return {
    KMSClient: class MockKMSClient {
      send = mockSend;
    },
    GenerateDataKeyCommand: vi.fn(),
    DecryptCommand: vi.fn(),
  };
});

vi.mock('@aws-sdk/credential-providers', () => ({
  fromIni: vi.fn(),
}));

// Mock env before importing kms
vi.mock('../../config/env', () => ({
  env: {
    AWS_REGION: 'us-east-1',
    AWS_PROFILE: undefined,
    KMS_KEY_ID: 'alias/test-key',
  },
}));

describe('KMS Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the KMS client so each test gets a fresh one
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isKmsConfigured', () => {
    it('should return true when KMS_KEY_ID is set', async () => {
      const { isKmsConfigured } = await import('../../lib/kms');
      expect(isKmsConfigured()).toBe(true);
    });
  });

  describe('generateDataKey', () => {
    it('should generate a data key successfully', async () => {
      const mockPlaintext = Buffer.from('mock-plaintext-key-32-bytes-long');
      const mockCiphertext = Buffer.from('mock-encrypted-key');

      mockSend.mockResolvedValueOnce({
        Plaintext: mockPlaintext,
        CiphertextBlob: mockCiphertext,
      });

      const { generateDataKey } = await import('../../lib/kms');
      const result = await generateDataKey();

      expect(result.plaintextKey).toBeInstanceOf(Buffer);
      expect(result.encryptedKey).toBe(mockCiphertext.toString('base64'));
    });

    it('should throw KmsError when KMS returns no data', async () => {
      mockSend.mockResolvedValueOnce({
        Plaintext: null,
        CiphertextBlob: null,
      });

      const { generateDataKey, KmsErrorCode } = await import('../../lib/kms');
      try {
        await generateDataKey();
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as KmsError).code).toBe(KmsErrorCode.SERVICE_ERROR);
      }
    });

    it('should throw KmsError with KEY_NOT_FOUND for NotFoundException', async () => {
      const error = new Error('Key not found');
      error.name = 'NotFoundException';
      mockSend.mockRejectedValueOnce(error);

      const { generateDataKey, KmsErrorCode } = await import('../../lib/kms');
      try {
        await generateDataKey();
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as KmsError).code).toBe(KmsErrorCode.KEY_NOT_FOUND);
      }
    });

    it('should throw KmsError with ACCESS_DENIED for AccessDeniedException', async () => {
      const error = new Error('Access denied');
      error.name = 'AccessDeniedException';
      mockSend.mockRejectedValueOnce(error);

      const { generateDataKey, KmsErrorCode } = await import('../../lib/kms');
      try {
        await generateDataKey();
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as KmsError).code).toBe(KmsErrorCode.ACCESS_DENIED);
      }
    });

    it('should throw KmsError with SERVICE_ERROR for unknown errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Unknown error'));

      const { generateDataKey, KmsErrorCode } = await import('../../lib/kms');
      try {
        await generateDataKey();
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as KmsError).code).toBe(KmsErrorCode.SERVICE_ERROR);
      }
    });
  });

  describe('decryptDataKey', () => {
    it('should decrypt a data key successfully', async () => {
      const mockPlaintext = Buffer.from('decrypted-key-32-bytes-long!!!!');
      const encryptedKey = Buffer.from('encrypted-key').toString('base64');

      mockSend.mockResolvedValueOnce({
        Plaintext: mockPlaintext,
      });

      const { decryptDataKey } = await import('../../lib/kms');
      const result = await decryptDataKey(encryptedKey);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe(mockPlaintext.toString());
    });

    it('should throw KmsError when KMS returns no plaintext', async () => {
      mockSend.mockResolvedValueOnce({
        Plaintext: null,
      });

      const { decryptDataKey, KmsErrorCode } = await import('../../lib/kms');
      const encryptedKey = Buffer.from('test').toString('base64');

      try {
        await decryptDataKey(encryptedKey);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as KmsError).code).toBe(KmsErrorCode.SERVICE_ERROR);
      }
    });

    it('should throw KmsError with INVALID_CIPHERTEXT for InvalidCiphertextException', async () => {
      const error = new Error('Invalid ciphertext');
      error.name = 'InvalidCiphertextException';
      mockSend.mockRejectedValueOnce(error);

      const { decryptDataKey, KmsErrorCode } = await import('../../lib/kms');
      const encryptedKey = Buffer.from('invalid').toString('base64');

      try {
        await decryptDataKey(encryptedKey);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as KmsError).code).toBe(KmsErrorCode.INVALID_CIPHERTEXT);
      }
    });

    it('should throw KmsError with ACCESS_DENIED for UnauthorizedException', async () => {
      const error = new Error('Unauthorized');
      error.name = 'UnauthorizedException';
      mockSend.mockRejectedValueOnce(error);

      const { decryptDataKey, KmsErrorCode } = await import('../../lib/kms');
      const encryptedKey = Buffer.from('test').toString('base64');

      try {
        await decryptDataKey(encryptedKey);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as KmsError).code).toBe(KmsErrorCode.ACCESS_DENIED);
      }
    });
  });

  describe('KmsError', () => {
    it('should have correct name and code', () => {
      const error = new KmsError('Test error', KmsErrorCode.MISSING_KEY_ID);

      expect(error.name).toBe('KmsError');
      expect(error.code).toBe(KmsErrorCode.MISSING_KEY_ID);
      expect(error.message).toBe('Test error');
    });

    it('should be instanceof Error', () => {
      const error = new KmsError('Test', KmsErrorCode.SERVICE_ERROR);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(KmsError);
    });

    it('should include cause when provided', () => {
      const cause = new Error('Original error');
      const error = new KmsError(
        'Wrapped error',
        KmsErrorCode.SERVICE_ERROR,
        cause,
      );

      expect(error.cause).toBe(cause);
    });
  });
});
