import { describe, it, expect, vi, beforeEach } from 'vitest';

import { hashPassword } from '../../../lib/crypto';
import { validatePassword } from '../../../services/auth/password';

import type { User } from '../../../entities';
import type { EntityManager } from '@mikro-orm/core';

// Mock EntityManager with minimal interface
const createMockEm = () => ({
  fork: vi.fn().mockReturnThis(),
  findOne: vi.fn(),
  find: vi.fn(),
  persist: vi.fn(),
  flush: vi.fn(),
  nativeDelete: vi.fn(),
});

// Mock user with company - properly typed
const createMockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    isActive: true,
    needsResetPassword: false,
    maxSessions: 5,
    failedLoginAttempts: 0,
    emailVerified: true,
    mfaEnabled: false,
    nameFirst: 'Test',
    nameLast: 'User',
    company: {
      id: 'company-123',
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        historyCount: 3,
        maxAgeDays: 90,
      },
    },
    ...overrides,
  }) as User;

describe('Password Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validatePassword', () => {
    it('should reject password shorter than minimum length', async () => {
      const em = createMockEm();
      em.find.mockResolvedValue([]);

      const user = createMockUser();
      const result = await validatePassword(
        em as unknown as EntityManager,
        user,
        'Short1',
      );

      expect(result).toContain('at least 8 characters');
    });

    it('should reject password without uppercase', async () => {
      const em = createMockEm();
      em.find.mockResolvedValue([]);

      const user = createMockUser();
      const result = await validatePassword(
        em as unknown as EntityManager,
        user,
        'lowercase123',
      );

      expect(result).toContain('uppercase');
    });

    it('should reject password without lowercase', async () => {
      const em = createMockEm();
      em.find.mockResolvedValue([]);

      const user = createMockUser();
      const result = await validatePassword(
        em as unknown as EntityManager,
        user,
        'UPPERCASE123',
      );

      expect(result).toContain('lowercase');
    });

    it('should reject password without numbers', async () => {
      const em = createMockEm();
      em.find.mockResolvedValue([]);

      const user = createMockUser();
      const result = await validatePassword(
        em as unknown as EntityManager,
        user,
        'NoNumbersHere',
      );

      expect(result).toContain('number');
    });

    it('should accept valid password', async () => {
      const em = createMockEm();
      em.find.mockResolvedValue([]);

      const user = createMockUser();
      const result = await validatePassword(
        em as unknown as EntityManager,
        user,
        'ValidPass123',
      );

      expect(result).toBeNull();
    });

    it('should require special chars when policy enabled', async () => {
      const em = createMockEm();
      em.find.mockResolvedValue([]);

      const user = {
        ...createMockUser(),
        company: {
          id: 'company-123',
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            historyCount: 0,
            maxAgeDays: 90,
          },
        },
      } as unknown as User;

      const result = await validatePassword(
        em as unknown as EntityManager,
        user,
        'ValidPass123',
      );

      expect(result).toContain('special character');
    });

    it('should accept password with special chars when required', async () => {
      const em = createMockEm();
      em.find.mockResolvedValue([]);

      const user = {
        ...createMockUser(),
        company: {
          id: 'company-123',
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            historyCount: 0,
            maxAgeDays: 90,
          },
        },
      } as unknown as User;

      const result = await validatePassword(
        em as unknown as EntityManager,
        user,
        'ValidPass123!',
      );

      expect(result).toBeNull();
    });

    it('should reject reused password from history', async () => {
      const reusedPassword = 'ReusedPass123';
      const reusedHash = await hashPassword(reusedPassword);

      const em = createMockEm();
      em.find.mockResolvedValue([{ passwordHash: reusedHash }]);

      const user = createMockUser({
        passwordHash: await hashPassword('CurrentPass456'),
      });

      const result = await validatePassword(
        em as unknown as EntityManager,
        user,
        reusedPassword,
      );

      expect(result).toContain('Cannot reuse');
    });

    it('should reject current password reuse', async () => {
      const currentPassword = 'CurrentPass123';
      const currentHash = await hashPassword(currentPassword);

      const em = createMockEm();
      em.find.mockResolvedValue([]);

      const user = createMockUser({
        passwordHash: currentHash,
      });

      const result = await validatePassword(
        em as unknown as EntityManager,
        user,
        currentPassword,
      );

      expect(result).toContain('current password');
    });

    it('should skip history check when historyCount is 0', async () => {
      const em = createMockEm();

      const user = {
        ...createMockUser(),
        company: {
          id: 'company-123',
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: false,
            historyCount: 0,
            maxAgeDays: 90,
          },
        },
      } as unknown as User;

      const result = await validatePassword(
        em as unknown as EntityManager,
        user,
        'ValidPass123',
      );

      expect(result).toBeNull();
      expect(em.find).not.toHaveBeenCalled();
    });
  });
});
