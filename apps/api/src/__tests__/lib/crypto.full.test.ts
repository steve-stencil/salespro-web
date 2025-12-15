import { describe, it, expect } from 'vitest';

import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  generateBackupCode,
  generateSecureId,
  getTokenPrefix,
} from '../../lib/crypto';

describe('Crypto Library (Full)', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce argon2id hash', async () => {
      const hash = await hashPassword('test');
      expect(hash.startsWith('$argon2id$')).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await hashPassword('CorrectPassword');

      const isValid = await verifyPassword('WrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should handle invalid hash gracefully', async () => {
      const isValid = await verifyPassword('password', 'invalid-hash');
      expect(isValid).toBe(false);
    });

    it('should handle empty hash', async () => {
      const isValid = await verifyPassword('password', '');
      expect(isValid).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token of default length', () => {
      const token = generateSecureToken();
      // 32 bytes = 64 hex chars
      expect(token.length).toBe(64);
    });

    it('should generate token of specified length', () => {
      const token = generateSecureToken(16);
      // 16 bytes = 32 hex chars
      expect(token.length).toBe(32);
    });

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();

      expect(token1).not.toBe(token2);
    });

    it('should only contain hex characters', () => {
      const token = generateSecureToken();
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });

  describe('hashToken', () => {
    it('should hash a token', () => {
      const token = 'test-token-123';
      const hash = hashToken(token);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(token);
    });

    it('should produce consistent hash for same token', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce SHA-256 hash (64 hex chars)', () => {
      const hash = hashToken('test');
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe('generateBackupCode', () => {
    it('should generate backup code in correct format', () => {
      const code = generateBackupCode();
      // Format: XXXX-XXXX-XXXX
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should not contain confusing characters', () => {
      const code = generateBackupCode();
      // Should not contain: 0, O, I, 1
      expect(code).not.toMatch(/[0OI1]/);
    });

    it('should generate unique codes', () => {
      const code1 = generateBackupCode();
      const code2 = generateBackupCode();

      expect(code1).not.toBe(code2);
    });

    it('should be 14 characters (including dashes)', () => {
      const code = generateBackupCode();
      expect(code.length).toBe(14);
    });
  });

  describe('generateSecureId', () => {
    it('should generate ID of default length', () => {
      const id = generateSecureId();
      expect(id.length).toBe(24);
    });

    it('should generate ID of specified length', () => {
      const id = generateSecureId(16);
      expect(id.length).toBe(16);
    });

    it('should generate unique IDs', () => {
      const id1 = generateSecureId();
      const id2 = generateSecureId();

      expect(id1).not.toBe(id2);
    });

    it('should be URL-safe base64', () => {
      const id = generateSecureId();
      // URL-safe base64: A-Z, a-z, 0-9, -, _
      expect(/^[A-Za-z0-9_-]+$/.test(id)).toBe(true);
    });
  });

  describe('getTokenPrefix', () => {
    it('should return default prefix of 8 chars', () => {
      const token = 'abcdefghijklmnop';
      const prefix = getTokenPrefix(token);

      expect(prefix).toBe('abcdefgh');
      expect(prefix.length).toBe(8);
    });

    it('should return prefix of specified length', () => {
      const token = 'abcdefghijklmnop';
      const prefix = getTokenPrefix(token, 4);

      expect(prefix).toBe('abcd');
    });

    it('should handle short tokens', () => {
      const token = 'abc';
      const prefix = getTokenPrefix(token, 8);

      expect(prefix).toBe('abc');
    });

    it('should handle empty token', () => {
      const prefix = getTokenPrefix('', 8);
      expect(prefix).toBe('');
    });
  });
});
