import { describe, it, expect } from 'vitest';

import { getClientIp, getUserAgent } from '../../../routes/auth/utils';

import type { Request } from 'express';

/**
 * Create a mock request
 */
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  } as Request;
}

describe('Route Utils', () => {
  describe('getClientIp', () => {
    it('should return x-forwarded-for header when present', () => {
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      expect(getClientIp(req)).toBe('192.168.1.1');
    });

    it('should return first IP when x-forwarded-for contains multiple IPs', () => {
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1' },
      });

      expect(getClientIp(req)).toBe('192.168.1.1');
    });

    it('should trim whitespace from forwarded IP', () => {
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '  192.168.1.1  ' },
      });

      expect(getClientIp(req)).toBe('192.168.1.1');
    });

    it('should return req.ip when no x-forwarded-for header', () => {
      const req = createMockRequest({
        headers: {},
        ip: '10.0.0.1',
      });

      expect(getClientIp(req)).toBe('10.0.0.1');
    });

    it('should return unknown when no IP available', () => {
      const req = createMockRequest({
        headers: {},
        ip: undefined,
      });

      expect(getClientIp(req)).toBe('unknown');
    });

    it('should handle array x-forwarded-for header', () => {
      const req = createMockRequest({
        headers: {
          'x-forwarded-for': ['192.168.1.1', '10.0.0.1'] as unknown as string,
        },
        ip: '127.0.0.1',
      });

      // When it's an array, it falls through to req.ip
      expect(getClientIp(req)).toBe('127.0.0.1');
    });
  });

  describe('getUserAgent', () => {
    it('should return user-agent header when present', () => {
      const req = createMockRequest({
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });

      expect(getUserAgent(req)).toBe(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      );
    });

    it('should return unknown when no user-agent header', () => {
      const req = createMockRequest({
        headers: {},
      });

      expect(getUserAgent(req)).toBe('unknown');
    });
  });
});
