import { describe, it, expect } from 'vitest';

import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  getTokenPrefix,
  generateSecureId,
} from '../../lib/crypto';

describe('crypto utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password using argon2id', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).toContain('$argon2id$');
      expect(hash).not.toBe(password);
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
      expect(hash).toContain('$argon2id$');
    });

    it('should handle unicode passwords', async () => {
      const password = '密码Testing123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('WrongPassword456!', hash);
      expect(isValid).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const isValid = await verifyPassword('password', 'invalid-hash');
      expect(isValid).toBe(false);
    });

    it('should return false for empty password against valid hash', async () => {
      const hash = await hashPassword('TestPassword123!');
      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(false);
    });

    it('should be case sensitive', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('testpassword123!', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate a token of specified length', () => {
      const token = generateSecureToken(32);
      // Base64url encoding increases length, so we check minimum
      expect(token.length).toBeGreaterThanOrEqual(32);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken(32));
      }
      expect(tokens.size).toBe(100);
    });

    it('should use default length of 32 bytes', () => {
      const token = generateSecureToken();
      expect(token.length).toBeGreaterThanOrEqual(32);
    });

    it('should only contain base64url safe characters', () => {
      const token = generateSecureToken(64);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('hashToken', () => {
    it('should produce consistent hash for same token', () => {
      const token = 'test-token-12345';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce a hex string', () => {
      const hash = hashToken('test-token');
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should produce SHA-256 hash (64 characters)', () => {
      const hash = hashToken('test-token');
      expect(hash.length).toBe(64);
    });
  });

  describe('getTokenPrefix', () => {
    it('should return first 8 characters by default', () => {
      const token = 'abcdefghijklmnop';
      const prefix = getTokenPrefix(token);

      expect(prefix).toBe('abcdefgh');
    });

    it('should return specified prefix length', () => {
      const token = 'abcdefghijklmnop';
      const prefix = getTokenPrefix(token, 4);

      expect(prefix).toBe('abcd');
    });

    it('should handle tokens shorter than prefix length', () => {
      const token = 'abc';
      const prefix = getTokenPrefix(token, 8);

      expect(prefix).toBe('abc');
    });
  });

  describe('generateSecureId', () => {
    it('should generate ID of specified length', () => {
      const id = generateSecureId(16);
      expect(id.length).toBe(16);
    });

    it('should use default length of 24', () => {
      const id = generateSecureId();
      expect(id.length).toBe(24);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSecureId());
      }
      expect(ids.size).toBe(100);
    });

    it('should only contain base64url safe characters', () => {
      const id = generateSecureId(32);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });
});
