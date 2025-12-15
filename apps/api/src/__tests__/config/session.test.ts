import { describe, it, expect } from 'vitest';

import {
  SESSION_DURATIONS,
  CLEANUP_INTERVALS,
  getSessionOptions,
  getRememberMeCookieOptions,
} from '../../config/session';

describe('Session Configuration', () => {
  describe('SESSION_DURATIONS', () => {
    it('should have SHORT duration of 2 hours', () => {
      expect(SESSION_DURATIONS.SHORT).toBe(2 * 60 * 60 * 1000);
    });

    it('should have DEFAULT duration of 7 days', () => {
      expect(SESSION_DURATIONS.DEFAULT).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should have REMEMBER_ME duration of 30 days', () => {
      expect(SESSION_DURATIONS.REMEMBER_ME).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should have ABSOLUTE_MAX duration of 30 days', () => {
      expect(SESSION_DURATIONS.ABSOLUTE_MAX).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });

  describe('CLEANUP_INTERVALS', () => {
    it('should have SESSION_CLEANUP interval of 15 minutes', () => {
      expect(CLEANUP_INTERVALS.SESSION_CLEANUP).toBe(15 * 60 * 1000);
    });
  });

  describe('getSessionOptions', () => {
    it('should return session options with correct name', () => {
      const options = getSessionOptions();
      expect(options.name).toBe('sid');
    });

    it('should set resave to false', () => {
      const options = getSessionOptions();
      expect(options.resave).toBe(false);
    });

    it('should set saveUninitialized to false', () => {
      const options = getSessionOptions();
      expect(options.saveUninitialized).toBe(false);
    });

    it('should enable rolling sessions', () => {
      const options = getSessionOptions();
      expect(options.rolling).toBe(true);
    });

    it('should set httpOnly cookie', () => {
      const options = getSessionOptions();
      expect(options.cookie?.httpOnly).toBe(true);
    });

    it('should set sameSite to lax', () => {
      const options = getSessionOptions();
      expect(options.cookie?.sameSite).toBe('lax');
    });

    it('should set cookie path to /', () => {
      const options = getSessionOptions();
      expect(options.cookie?.path).toBe('/');
    });

    it('should set cookie maxAge to DEFAULT duration', () => {
      const options = getSessionOptions();
      expect(options.cookie?.maxAge).toBe(SESSION_DURATIONS.DEFAULT);
    });

    it('should have a secret defined', () => {
      const options = getSessionOptions();
      expect(options.secret).toBeDefined();
      expect(typeof options.secret).toBe('string');
    });

    it('should have cookie secure set based on environment', () => {
      const options = getSessionOptions();
      // In test environment, NODE_ENV is 'test', so secure should be false
      expect(typeof options.cookie?.secure).toBe('boolean');
    });
  });

  describe('getRememberMeCookieOptions', () => {
    it('should return remember me cookie options with httpOnly', () => {
      const options = getRememberMeCookieOptions();
      expect(options.httpOnly).toBe(true);
    });

    it('should set sameSite to lax', () => {
      const options = getRememberMeCookieOptions();
      expect(options.sameSite).toBe('lax');
    });

    it('should set path to /', () => {
      const options = getRememberMeCookieOptions();
      expect(options.path).toBe('/');
    });

    it('should set maxAge to REMEMBER_ME duration', () => {
      const options = getRememberMeCookieOptions();
      expect(options.maxAge).toBe(SESSION_DURATIONS.REMEMBER_ME);
    });

    it('should have secure property set based on environment', () => {
      const options = getRememberMeCookieOptions();
      expect(typeof options.secure).toBe('boolean');
    });
  });
});
