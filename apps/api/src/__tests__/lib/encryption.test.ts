/**
 * Unit tests for encryption utilities.
 */

import crypto from 'crypto';

import { describe, it, expect } from 'vitest';

import {
  encrypt,
  decrypt,
  generateRandomKey,
  EncryptionError,
  EncryptionErrorCode,
} from '../../lib/encryption';

describe('Encryption Utilities', () => {
  // Generate a valid test key
  const validKey = generateRandomKey();

  describe('encrypt', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'Hello, World!';
      const ciphertext = encrypt(plaintext, validKey);

      expect(ciphertext).toBeDefined();
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'Same message';
      const ciphertext1 = encrypt(plaintext, validKey);
      const ciphertext2 = encrypt(plaintext, validKey);

      expect(ciphertext1).not.toBe(ciphertext2);
    });

    it('should produce ciphertext in correct format (iv:authTag:encrypted)', () => {
      const plaintext = 'Test message';
      const ciphertext = encrypt(plaintext, validKey);
      const parts = ciphertext.split(':');

      expect(parts).toHaveLength(3);

      // Validate base64 format
      const iv = parts[0]!;
      const authTag = parts[1]!;
      const encrypted = parts[2]!;
      expect(() => Buffer.from(iv, 'base64')).not.toThrow();
      expect(() => Buffer.from(authTag, 'base64')).not.toThrow();
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });

    it('should throw EncryptionError with invalid key (wrong length)', () => {
      const invalidKey = crypto.randomBytes(16); // Should be 32 bytes

      expect(() => encrypt('test', invalidKey)).toThrow(EncryptionError);
      expect(() => encrypt('test', invalidKey)).toThrow(
        'Encryption key must be exactly 32 bytes',
      );
    });

    it('should throw EncryptionError with empty key', () => {
      const emptyKey = Buffer.alloc(0);

      expect(() => encrypt('test', emptyKey)).toThrow(EncryptionError);
    });

    it('should handle empty string', () => {
      const ciphertext = encrypt('', validKey);
      expect(ciphertext).toBeDefined();

      const decrypted = decrypt(ciphertext, validKey);
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = '日本語 🎉 émojis and ñ';
      const ciphertext = encrypt(plaintext, validKey);
      const decrypted = decrypt(ciphertext, validKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle large data', () => {
      const plaintext = 'x'.repeat(100000);
      const ciphertext = encrypt(plaintext, validKey);
      const decrypted = decrypt(ciphertext, validKey);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext successfully', () => {
      const plaintext = 'Hello, World!';
      const ciphertext = encrypt(plaintext, validKey);
      const decrypted = decrypt(ciphertext, validKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw EncryptionError with invalid key (wrong length)', () => {
      const ciphertext = encrypt('test', validKey);
      const invalidKey = crypto.randomBytes(16);

      expect(() => decrypt(ciphertext, invalidKey)).toThrow(EncryptionError);
    });

    it('should throw EncryptionError with wrong key (authentication fail)', () => {
      const ciphertext = encrypt('test', validKey);
      const wrongKey = crypto.randomBytes(32);

      expect(() => decrypt(ciphertext, wrongKey)).toThrow(EncryptionError);
      try {
        decrypt(ciphertext, wrongKey);
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
        expect((error as EncryptionError).code).toBe(
          EncryptionErrorCode.DECRYPTION_FAILED,
        );
      }
    });

    it('should throw EncryptionError with invalid ciphertext format', () => {
      expect(() => decrypt('invalid-ciphertext', validKey)).toThrow(
        EncryptionError,
      );
      expect(() => decrypt('invalid-ciphertext', validKey)).toThrow(
        'Invalid ciphertext format',
      );
    });

    it('should throw EncryptionError with only two parts', () => {
      expect(() => decrypt('part1:part2', validKey)).toThrow(EncryptionError);
    });

    it('should throw EncryptionError with tampered ciphertext', () => {
      const ciphertext = encrypt('test', validKey);
      const parts = ciphertext.split(':');
      parts[2] = Buffer.from('tampered').toString('base64');
      const tampered = parts.join(':');

      expect(() => decrypt(tampered, validKey)).toThrow(EncryptionError);
    });

    it('should throw EncryptionError with invalid IV length', () => {
      const shortIv = Buffer.from([1, 2, 3]).toString('base64');
      const authTag = crypto.randomBytes(16).toString('base64');
      const encrypted = Buffer.from('test').toString('base64');
      const invalidCiphertext = `${shortIv}:${authTag}:${encrypted}`;

      expect(() => decrypt(invalidCiphertext, validKey)).toThrow(
        EncryptionError,
      );
    });
  });

  describe('generateRandomKey', () => {
    it('should generate a 32-byte key', () => {
      const key = generateRandomKey();

      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generateRandomKey().toString('hex'));
      }

      expect(keys.size).toBe(100);
    });
  });

  describe('round-trip encryption/decryption', () => {
    it('should encrypt and decrypt JSON data', () => {
      const data = {
        clientId: 'abc123',
        clientSecret: 'super-secret-value',
        refreshToken: 'token123',
        nested: { value: 42 },
      };

      const json = JSON.stringify(data);
      const ciphertext = encrypt(json, validKey);
      const decrypted = decrypt(ciphertext, validKey);
      const parsed = JSON.parse(decrypted);

      expect(parsed).toEqual(data);
    });

    it('should handle special characters in JSON', () => {
      const data = {
        password: 'p@$$w0rd!#$%^&*()',
        unicode: '日本語テスト',
        newlines: 'line1\nline2\r\nline3',
      };

      const json = JSON.stringify(data);
      const ciphertext = encrypt(json, validKey);
      const decrypted = decrypt(ciphertext, validKey);
      const parsed = JSON.parse(decrypted);

      expect(parsed).toEqual(data);
    });
  });

  describe('EncryptionError', () => {
    it('should have correct name and code', () => {
      const error = new EncryptionError(
        'Test error',
        EncryptionErrorCode.INVALID_KEY,
      );

      expect(error.name).toBe('EncryptionError');
      expect(error.code).toBe(EncryptionErrorCode.INVALID_KEY);
      expect(error.message).toBe('Test error');
    });

    it('should be instanceof Error', () => {
      const error = new EncryptionError(
        'Test',
        EncryptionErrorCode.ENCRYPTION_FAILED,
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(EncryptionError);
    });
  });
});
