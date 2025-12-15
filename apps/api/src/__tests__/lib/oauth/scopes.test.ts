import { describe, it, expect } from 'vitest';

import {
  OAUTH_SCOPES,
  validateScopes,
  parseScopes,
  formatScopes,
} from '../../../lib/oauth/scopes';

describe('OAuth scopes utilities', () => {
  describe('OAUTH_SCOPES', () => {
    it('should define required scopes', () => {
      expect(OAUTH_SCOPES).toHaveProperty('read:profile');
      expect(OAUTH_SCOPES).toHaveProperty('write:profile');
      expect(OAUTH_SCOPES).toHaveProperty('read:data');
      expect(OAUTH_SCOPES).toHaveProperty('offline_access');
    });

    it('should have descriptions for all scopes', () => {
      for (const [scope, definition] of Object.entries(OAUTH_SCOPES)) {
        expect(definition.description).toBeDefined();
        expect(typeof definition.description).toBe('string');
        expect(definition.description.length).toBeGreaterThan(0);
        expect(scope).toBeDefined();
      }
    });

    it('should have categories for all scopes', () => {
      for (const definition of Object.values(OAUTH_SCOPES)) {
        expect(definition.category).toBeDefined();
        expect(typeof definition.category).toBe('string');
      }
    });
  });

  describe('parseScopes', () => {
    it('should parse space-separated scope string', () => {
      const scopes = parseScopes('read:profile write:profile read:data');
      expect(scopes).toEqual(['read:profile', 'write:profile', 'read:data']);
    });

    it('should return empty array for undefined', () => {
      const scopes = parseScopes(undefined);
      expect(scopes).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const scopes = parseScopes('');
      expect(scopes).toEqual([]);
    });

    it('should handle single scope', () => {
      const scopes = parseScopes('read:profile');
      expect(scopes).toEqual(['read:profile']);
    });

    it('should trim whitespace', () => {
      const scopes = parseScopes('  read:profile   write:profile  ');
      expect(scopes).toEqual(['read:profile', 'write:profile']);
    });

    it('should filter empty strings from result', () => {
      const scopes = parseScopes('read:profile  write:profile');
      expect(scopes).not.toContain('');
    });
  });

  describe('formatScopes', () => {
    it('should join scopes with spaces', () => {
      const formatted = formatScopes([
        'read:profile',
        'write:profile',
        'read:data',
      ]);
      expect(formatted).toBe('read:profile write:profile read:data');
    });

    it('should handle single scope', () => {
      const formatted = formatScopes(['read:profile']);
      expect(formatted).toBe('read:profile');
    });

    it('should handle empty array', () => {
      const formatted = formatScopes([]);
      expect(formatted).toBe('');
    });
  });

  describe('validateScopes', () => {
    it('should validate all requested scopes are allowed', () => {
      const allowedScopes = ['read:profile', 'write:profile', 'read:data'];
      const result = validateScopes(
        ['read:profile', 'write:profile'],
        allowedScopes,
      );

      expect(result.valid).toBe(true);
      expect(result.invalidScopes).toEqual([]);
    });

    it('should detect invalid scopes not defined in system', () => {
      const allowedScopes = ['read:profile', 'write:profile'];
      const result = validateScopes(
        ['read:profile', 'nonexistent:scope'],
        allowedScopes,
      );

      expect(result.valid).toBe(false);
      expect(result.invalidScopes).toContain('nonexistent:scope');
    });

    it('should detect scopes not in allowed list', () => {
      const allowedScopes = ['read:profile'];
      // read:data is a valid scope but not in allowedScopes
      const result = validateScopes(
        ['read:profile', 'read:data'],
        allowedScopes,
      );

      expect(result.valid).toBe(false);
      expect(result.invalidScopes).toContain('read:data');
    });

    it('should handle empty requested scopes', () => {
      const allowedScopes = ['read:profile', 'write:profile'];
      const result = validateScopes([], allowedScopes);

      expect(result.valid).toBe(true);
      expect(result.invalidScopes).toEqual([]);
    });

    it('should return multiple invalid scopes', () => {
      const allowedScopes = ['read:profile', 'write:profile', 'read:data'];
      const result = validateScopes(
        ['read:profile', 'invalid1', 'invalid2'],
        allowedScopes,
      );

      expect(result.valid).toBe(false);
      expect(result.invalidScopes).toHaveLength(2);
      expect(result.invalidScopes).toContain('invalid1');
      expect(result.invalidScopes).toContain('invalid2');
    });

    it('should validate against OAUTH_SCOPES definition', () => {
      const allDefinedScopes = Object.keys(OAUTH_SCOPES);
      const result = validateScopes(allDefinedScopes, allDefinedScopes);

      expect(result.valid).toBe(true);
      expect(result.invalidScopes).toEqual([]);
    });
  });
});
