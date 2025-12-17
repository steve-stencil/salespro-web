import { describe, it, expect, vi, beforeEach } from 'vitest';

import { TrustedDevice } from '../../../entities';
import {
  generateDeviceToken,
  hashDeviceToken,
  generateDeviceName,
  createTrustedDevice,
  verifyTrustedDevice,
  updateTrustedDeviceLastSeen,
  clearUserTrustedDevices,
  getUserTrustedDevices,
  removeTrustedDevice,
  TRUSTED_DEVICE_CONFIG,
} from '../../../services/auth/trusted-device';

import type { User } from '../../../entities';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Create a mock EntityManager with common operations
 */
function createMockEm(): {
  findOne: ReturnType<typeof vi.fn>;
  findOneOrFail: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  nativeDelete: ReturnType<typeof vi.fn>;
} {
  return {
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    find: vi.fn(),
    persist: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    nativeDelete: vi.fn().mockResolvedValue(0),
  };
}

/**
 * Create a mock user
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    nameFirst: 'Test',
    nameLast: 'User',
    ...overrides,
  } as User;
}

/**
 * Create a mock trusted device
 */
function createMockTrustedDevice(
  overrides: Partial<TrustedDevice> = {},
): TrustedDevice {
  const device = new TrustedDevice();
  device.id = 'device-123';
  device.deviceFingerprint = 'hashed-token';
  device.deviceName = 'Chrome on MacOS';
  device.lastIpAddress = '127.0.0.1';
  device.lastSeenAt = new Date();
  device.trustExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  device.createdAt = new Date();

  Object.assign(device, overrides);
  return device;
}

describe('Trusted Device Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDeviceToken', () => {
    it('should generate token of correct length', () => {
      const token = generateDeviceToken();

      // Token is hex string, so 64 bytes = 128 hex chars
      const expectedLength = TRUSTED_DEVICE_CONFIG.TOKEN_LENGTH * 2;
      expect(token).toHaveLength(expectedLength);
    });

    it('should generate unique tokens on each call', () => {
      const token1 = generateDeviceToken();
      const token2 = generateDeviceToken();
      const token3 = generateDeviceToken();

      expect(token1).not.toBe(token2);
      expect(token2).not.toBe(token3);
      expect(token1).not.toBe(token3);
    });

    it('should generate alphanumeric hex tokens', () => {
      const token = generateDeviceToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('hashDeviceToken', () => {
    it('should return different hash than input', () => {
      const token = 'test-token-12345';
      const hash = hashDeviceToken(token);

      expect(hash).not.toBe(token);
    });

    it('should produce consistent hashes for same input', () => {
      const token = 'test-token-12345';
      const hash1 = hashDeviceToken(token);
      const hash2 = hashDeviceToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashDeviceToken('token-1');
      const hash2 = hashDeviceToken('token-2');

      expect(hash1).not.toBe(hash2);
    });

    it('should return a 64-character hex string (SHA-256)', () => {
      const hash = hashDeviceToken('any-token');

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('generateDeviceName', () => {
    it('should parse Chrome on MacOS correctly', () => {
      const userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const name = generateDeviceName(userAgent);

      expect(name).toBe('Chrome on MacOS');
    });

    it('should parse Safari on iOS correctly', () => {
      const userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const name = generateDeviceName(userAgent);

      expect(name).toBe('Safari on iOS');
    });

    it('should parse Firefox on Windows correctly', () => {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
      const name = generateDeviceName(userAgent);

      expect(name).toBe('Firefox on Windows');
    });

    it('should parse Chrome on Android correctly', () => {
      const userAgent =
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
      const name = generateDeviceName(userAgent);

      expect(name).toBe('Chrome on Android');
    });

    it('should parse Edge on Windows correctly', () => {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      const name = generateDeviceName(userAgent);

      expect(name).toBe('Edge on Windows');
    });

    it('should parse Opera on Linux correctly', () => {
      const userAgent =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0';
      const name = generateDeviceName(userAgent);

      expect(name).toBe('Opera on Linux');
    });

    it('should handle unknown user agents gracefully', () => {
      const name = generateDeviceName('SomeUnknownBot/1.0');

      expect(name).toBe('Unknown Device');
    });

    it('should handle empty user agent', () => {
      const name = generateDeviceName('');

      expect(name).toBe('Unknown Device');
    });

    it('should handle whitespace-only user agent', () => {
      const name = generateDeviceName('   ');

      expect(name).toBe('Unknown Device');
    });

    it('should return browser only when OS cannot be detected', () => {
      // A user agent with a browser but unknown OS
      const userAgent = 'Mozilla/5.0 Chrome/120.0.0.0';
      const name = generateDeviceName(userAgent);

      expect(name).toBe('Chrome');
    });
  });

  describe('createTrustedDevice', () => {
    it('should create trusted device with correct properties', async () => {
      const user = createMockUser();
      const em = createMockEm();
      em.findOneOrFail.mockResolvedValue(user);

      const userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0';
      const ipAddress = '192.168.1.1';

      const result = await createTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        userAgent,
        ipAddress,
      );

      expect(result.device).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.device.deviceName).toBe('Chrome on MacOS');
      expect(result.device.lastIpAddress).toBe(ipAddress);
      expect(result.device.user).toBe(user);
      expect(em.persist).toHaveBeenCalled();
      expect(em.flush).toHaveBeenCalled();
    });

    it('should set trust expiration to 30 days', async () => {
      const user = createMockUser();
      const em = createMockEm();
      em.findOneOrFail.mockResolvedValue(user);

      const now = Date.now();
      const result = await createTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        'Chrome on MacOS',
        '127.0.0.1',
      );

      const expectedExpiry =
        now + TRUSTED_DEVICE_CONFIG.TRUST_DURATION_DAYS * 24 * 60 * 60 * 1000;
      const actualExpiry = result.device.trustExpiresAt!.getTime();

      // Allow 1 second tolerance for test execution time
      expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(actualExpiry).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should store hashed token in deviceFingerprint', async () => {
      const user = createMockUser();
      const em = createMockEm();
      em.findOneOrFail.mockResolvedValue(user);

      const result = await createTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        'Test Agent',
        '127.0.0.1',
      );

      // Token should be raw, fingerprint should be hashed
      const expectedHash = hashDeviceToken(result.token);
      expect(result.device.deviceFingerprint).toBe(expectedHash);
    });
  });

  describe('verifyTrustedDevice', () => {
    it('should return trusted=true for valid device', async () => {
      const token = generateDeviceToken();
      const hashedToken = hashDeviceToken(token);
      const device = createMockTrustedDevice({
        deviceFingerprint: hashedToken,
      });

      const em = createMockEm();
      em.findOne.mockResolvedValue(device);

      const result = await verifyTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        token,
      );

      expect(result.trusted).toBe(true);
      expect(result.device).toBe(device);
      expect(result.reason).toBeUndefined();
    });

    it('should return not_found when device does not exist', async () => {
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      const result = await verifyTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        'some-token',
      );

      expect(result.trusted).toBe(false);
      expect(result.reason).toBe('not_found');
    });

    it('should return not_found for empty token', async () => {
      const em = createMockEm();

      const result = await verifyTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        '',
      );

      expect(result.trusted).toBe(false);
      expect(result.reason).toBe('not_found');
      expect(em.findOne).not.toHaveBeenCalled();
    });

    it('should return expired when device trust has expired', async () => {
      const device = createMockTrustedDevice({
        trustExpiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const em = createMockEm();
      em.findOne.mockResolvedValue(device);

      const result = await verifyTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        'some-token',
      );

      expect(result.trusted).toBe(false);
      expect(result.reason).toBe('expired');
      expect(result.device).toBe(device);
    });

    it('should query by user and hashed token', async () => {
      const token = 'my-device-token';
      const em = createMockEm();
      em.findOne.mockResolvedValue(null);

      await verifyTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        token,
      );

      expect(em.findOne).toHaveBeenCalledWith(TrustedDevice, {
        user: { id: 'user-123' },
        deviceFingerprint: hashDeviceToken(token),
      });
    });
  });

  describe('updateTrustedDeviceLastSeen', () => {
    it('should update lastSeenAt and lastIpAddress', async () => {
      const device = createMockTrustedDevice();
      const oldLastSeen = device.lastSeenAt;
      const em = createMockEm();

      await updateTrustedDeviceLastSeen(
        em as unknown as EntityManager,
        device,
        '10.0.0.1',
      );

      expect(device.lastIpAddress).toBe('10.0.0.1');
      expect(device.lastSeenAt.getTime()).toBeGreaterThanOrEqual(
        oldLastSeen.getTime(),
      );
      expect(em.flush).toHaveBeenCalled();
    });
  });

  describe('clearUserTrustedDevices', () => {
    it('should delete all trusted devices for user', async () => {
      const em = createMockEm();
      em.nativeDelete.mockResolvedValue(3);

      const count = await clearUserTrustedDevices(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(count).toBe(3);
      expect(em.nativeDelete).toHaveBeenCalledWith(TrustedDevice, {
        user: { id: 'user-123' },
      });
    });

    it('should return 0 when no devices exist', async () => {
      const em = createMockEm();
      em.nativeDelete.mockResolvedValue(0);

      const count = await clearUserTrustedDevices(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(count).toBe(0);
    });
  });

  describe('getUserTrustedDevices', () => {
    it('should return devices ordered by lastSeenAt descending', async () => {
      const devices = [
        createMockTrustedDevice({ id: 'device-1' }),
        createMockTrustedDevice({ id: 'device-2' }),
      ];
      const em = createMockEm();
      em.find.mockResolvedValue(devices);

      const result = await getUserTrustedDevices(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result).toBe(devices);
      expect(em.find).toHaveBeenCalledWith(
        TrustedDevice,
        { user: { id: 'user-123' } },
        { orderBy: { lastSeenAt: 'DESC' } },
      );
    });

    it('should return empty array when no devices exist', async () => {
      const em = createMockEm();
      em.find.mockResolvedValue([]);

      const result = await getUserTrustedDevices(
        em as unknown as EntityManager,
        'user-123',
      );

      expect(result).toEqual([]);
    });
  });

  describe('removeTrustedDevice', () => {
    it('should return true when device is removed', async () => {
      const em = createMockEm();
      em.nativeDelete.mockResolvedValue(1);

      const result = await removeTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        'device-456',
      );

      expect(result).toBe(true);
      expect(em.nativeDelete).toHaveBeenCalledWith(TrustedDevice, {
        id: 'device-456',
        user: { id: 'user-123' },
      });
    });

    it('should return false when device not found', async () => {
      const em = createMockEm();
      em.nativeDelete.mockResolvedValue(0);

      const result = await removeTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        'nonexistent-device',
      );

      expect(result).toBe(false);
    });

    it('should only delete device belonging to the specified user', async () => {
      const em = createMockEm();
      em.nativeDelete.mockResolvedValue(0);

      await removeTrustedDevice(
        em as unknown as EntityManager,
        'user-123',
        'device-456',
      );

      expect(em.nativeDelete).toHaveBeenCalledWith(TrustedDevice, {
        id: 'device-456',
        user: { id: 'user-123' },
      });
    });
  });

  describe('TRUSTED_DEVICE_CONFIG', () => {
    it('should have correct default values', () => {
      expect(TRUSTED_DEVICE_CONFIG.TRUST_DURATION_DAYS).toBe(30);
      expect(TRUSTED_DEVICE_CONFIG.TOKEN_LENGTH).toBe(64);
      expect(TRUSTED_DEVICE_CONFIG.COOKIE_NAME).toBe('device_trust');
    });
  });
});
