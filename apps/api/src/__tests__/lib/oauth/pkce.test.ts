import { describe, it, expect } from 'vitest';

import {
  verifyCodeChallenge,
  generateCodeChallenge,
  generateCodeVerifier,
  isValidChallengeMethod,
} from '../../../lib/oauth/pkce';

describe('PKCE utilities', () => {
  describe('generateCodeVerifier', () => {
    it('should generate a verifier of specified length', () => {
      const verifier = generateCodeVerifier(43);
      expect(verifier.length).toBeGreaterThanOrEqual(43);
    });

    it('should use default length of 43', () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
    });

    it('should generate unique verifiers', () => {
      const verifiers = new Set<string>();
      for (let i = 0; i < 50; i++) {
        verifiers.add(generateCodeVerifier());
      }
      expect(verifiers.size).toBe(50);
    });

    it('should only contain base64url safe characters', () => {
      const verifier = generateCodeVerifier(64);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate S256 challenge by default', () => {
      const verifier = 'test-verifier-12345678901234567890123456789012345';
      const challenge = generateCodeChallenge(verifier);

      expect(challenge).toBeDefined();
      expect(challenge).not.toBe(verifier);
    });

    it('should return verifier as-is for plain method', () => {
      const verifier = 'test-verifier-12345678901234567890123456789012345';
      const challenge = generateCodeChallenge(verifier, 'plain');

      expect(challenge).toBe(verifier);
    });

    it('should produce consistent challenges for same verifier', () => {
      const verifier = 'test-verifier-12345678901234567890123456789012345';
      const challenge1 = generateCodeChallenge(verifier, 'S256');
      const challenge2 = generateCodeChallenge(verifier, 'S256');

      expect(challenge1).toBe(challenge2);
    });

    it('should produce different challenges for different verifiers', () => {
      const challenge1 = generateCodeChallenge(
        'verifier1-12345678901234567890',
      );
      const challenge2 = generateCodeChallenge(
        'verifier2-12345678901234567890',
      );

      expect(challenge1).not.toBe(challenge2);
    });

    it('should produce base64url encoded challenge for S256', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier, 'S256');

      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('verifyCodeChallenge', () => {
    it('should verify valid S256 challenge', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier, 'S256');

      const isValid = verifyCodeChallenge(verifier, challenge, 'S256');
      expect(isValid).toBe(true);
    });

    it('should verify valid plain challenge', () => {
      const verifier = 'plain-verifier-test-12345678901234567890';

      const isValid = verifyCodeChallenge(verifier, verifier, 'plain');
      expect(isValid).toBe(true);
    });

    it('should reject invalid S256 challenge', () => {
      const verifier = generateCodeVerifier();
      const wrongChallenge = 'invalid-challenge-that-does-not-match';

      const isValid = verifyCodeChallenge(verifier, wrongChallenge, 'S256');
      expect(isValid).toBe(false);
    });

    it('should reject invalid plain challenge', () => {
      const verifier = 'plain-verifier-test';
      const wrongChallenge = 'different-verifier';

      const isValid = verifyCodeChallenge(verifier, wrongChallenge, 'plain');
      expect(isValid).toBe(false);
    });

    it('should use S256 as default method', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier, 'S256');

      const isValid = verifyCodeChallenge(verifier, challenge);
      expect(isValid).toBe(true);
    });

    it('should reject mismatched method', () => {
      const verifier = generateCodeVerifier();
      // Generate challenge with plain but verify with S256
      const plainChallenge = verifier;

      const isValid = verifyCodeChallenge(verifier, plainChallenge, 'S256');
      expect(isValid).toBe(false);
    });
  });

  describe('isValidChallengeMethod', () => {
    it('should accept S256', () => {
      expect(isValidChallengeMethod('S256')).toBe(true);
    });

    it('should accept plain', () => {
      expect(isValidChallengeMethod('plain')).toBe(true);
    });

    it('should reject invalid methods', () => {
      expect(isValidChallengeMethod('SHA256')).toBe(false);
      expect(isValidChallengeMethod('s256')).toBe(false);
      expect(isValidChallengeMethod('PLAIN')).toBe(false);
      expect(isValidChallengeMethod('')).toBe(false);
      expect(isValidChallengeMethod('invalid')).toBe(false);
    });
  });
});
