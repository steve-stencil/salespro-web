/**
 * Trusted Device Service for MFA bypass on known devices.
 * Allows users to skip MFA verification on devices they've previously verified.
 * @module services/auth/trusted-device
 */
import { TrustedDevice, User } from '../../entities';
import { generateSecureToken, hashToken } from '../../lib/crypto';

import type { EntityManager } from '@mikro-orm/core';

/**
 * Configuration for trusted device functionality.
 */
export const TRUSTED_DEVICE_CONFIG = {
  /** Number of days a device trust is valid */
  TRUST_DURATION_DAYS: 30,
  /** Length of the device token in bytes (64 bytes = 128 hex chars) */
  TOKEN_LENGTH: 64,
  /** Cookie name for device trust */
  COOKIE_NAME: 'device_trust',
} as const;

/**
 * Result type for device trust verification.
 */
export type TrustedDeviceVerifyResult = {
  trusted: boolean;
  device?: TrustedDevice;
  reason?: 'not_found' | 'expired' | 'token_mismatch';
};

/**
 * Result type for creating a trusted device.
 */
export type CreateTrustedDeviceResult = {
  device: TrustedDevice;
  /** The raw token to set in the cookie (NOT hashed) */
  token: string;
};

/**
 * Generates a secure random token for the device trust cookie.
 * The token is cryptographically random and URL-safe.
 *
 * @returns A secure random token as hex string
 */
export function generateDeviceToken(): string {
  return generateSecureToken(TRUSTED_DEVICE_CONFIG.TOKEN_LENGTH);
}

/**
 * Hashes a device token for secure storage in the database.
 * Uses SHA-256 for fast, consistent hashing (not password hashing).
 *
 * @param token - The raw device token to hash
 * @returns The hashed token
 */
export function hashDeviceToken(token: string): string {
  return hashToken(token);
}

/**
 * Parses user agent string into a human-readable device name.
 * Extracts browser and OS information.
 *
 * @param userAgent - The User-Agent header string
 * @returns Human-readable device name (e.g., "Chrome on MacOS")
 */
export function generateDeviceName(userAgent: string): string {
  if (!userAgent || userAgent.trim() === '') {
    return 'Unknown Device';
  }

  const browser = parseBrowser(userAgent);
  const os = parseOS(userAgent);

  if (browser && os) {
    return `${browser} on ${os}`;
  }
  if (browser) {
    return browser;
  }
  if (os) {
    return `Browser on ${os}`;
  }

  return 'Unknown Device';
}

/**
 * Parses browser name from user agent string.
 */
function parseBrowser(userAgent: string): string | null {
  // Order matters - check more specific patterns first
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('OPR/') || userAgent.includes('Opera')) return 'Opera';
  if (userAgent.includes('Chrome/') && !userAgent.includes('Chromium/')) {
    return 'Chrome';
  }
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
    return 'Safari';
  }
  if (userAgent.includes('Firefox/')) return 'Firefox';
  if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) return 'IE';
  return null;
}

/**
 * Parses OS name from user agent string.
 */
function parseOS(userAgent: string): string | null {
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
    return 'MacOS';
  }
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('CrOS')) return 'ChromeOS';
  return null;
}

/**
 * Creates a new trusted device record for a user.
 * Generates a secure token and stores the hashed version in the database.
 *
 * @param em - MikroORM entity manager
 * @param userId - The user's ID
 * @param userAgent - The User-Agent header string
 * @param ipAddress - The client's IP address
 * @returns The created device and the raw token for the cookie
 */
export async function createTrustedDevice(
  em: EntityManager,
  userId: string,
  userAgent: string,
  ipAddress: string,
): Promise<CreateTrustedDeviceResult> {
  const user = await em.findOneOrFail(User, { id: userId });
  const token = generateDeviceToken();
  const hashedToken = hashDeviceToken(token);

  const device = new TrustedDevice();
  device.user = user;
  device.deviceFingerprint = hashedToken;
  device.deviceName = generateDeviceName(userAgent);
  device.lastIpAddress = ipAddress;
  device.lastSeenAt = new Date();
  device.trustExpiresAt = new Date(
    Date.now() +
      TRUSTED_DEVICE_CONFIG.TRUST_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );

  em.persist(device);
  await em.flush();

  return { device, token };
}

/**
 * Verifies if a device token is valid for a user.
 * Checks token existence, ownership, and expiration.
 * Uses timing-safe comparison via consistent hashing.
 *
 * @param em - MikroORM entity manager
 * @param userId - The user's ID
 * @param deviceToken - The raw device token from the cookie
 * @returns Verification result with trusted status and reason if failed
 */
export async function verifyTrustedDevice(
  em: EntityManager,
  userId: string,
  deviceToken: string,
): Promise<TrustedDeviceVerifyResult> {
  if (!deviceToken || deviceToken.trim() === '') {
    return { trusted: false, reason: 'not_found' };
  }

  const hashedToken = hashDeviceToken(deviceToken);

  const device = await em.findOne(TrustedDevice, {
    user: { id: userId },
    deviceFingerprint: hashedToken,
  });

  if (!device) {
    return { trusted: false, reason: 'not_found' };
  }

  if (device.isTrustExpired) {
    return { trusted: false, device, reason: 'expired' };
  }

  return { trusted: true, device };
}

/**
 * Updates the lastSeenAt timestamp for a trusted device.
 * Called when a trusted device is used for login.
 *
 * @param em - MikroORM entity manager
 * @param device - The trusted device entity
 * @param ipAddress - The current IP address
 */
export async function updateTrustedDeviceLastSeen(
  em: EntityManager,
  device: TrustedDevice,
  ipAddress: string,
): Promise<void> {
  device.lastSeenAt = new Date();
  device.lastIpAddress = ipAddress;
  await em.flush();
}

/**
 * Removes all trusted devices for a user.
 * Called when user disables MFA or as a security measure.
 *
 * @param em - MikroORM entity manager
 * @param userId - The user's ID
 * @returns Number of devices removed
 */
export async function clearUserTrustedDevices(
  em: EntityManager,
  userId: string,
): Promise<number> {
  const count = await em.nativeDelete(TrustedDevice, { user: { id: userId } });
  return count;
}

/**
 * Gets all trusted devices for a user.
 * Useful for account security management UI.
 *
 * @param em - MikroORM entity manager
 * @param userId - The user's ID
 * @returns List of trusted devices (without tokens)
 */
export async function getUserTrustedDevices(
  em: EntityManager,
  userId: string,
): Promise<TrustedDevice[]> {
  return em.find(
    TrustedDevice,
    { user: { id: userId } },
    { orderBy: { lastSeenAt: 'DESC' } },
  );
}

/**
 * Removes a specific trusted device by ID.
 *
 * @param em - MikroORM entity manager
 * @param userId - The user's ID
 * @param deviceId - The device's ID
 * @returns True if device was removed, false if not found
 */
export async function removeTrustedDevice(
  em: EntityManager,
  userId: string,
  deviceId: string,
): Promise<boolean> {
  const count = await em.nativeDelete(TrustedDevice, {
    id: deviceId,
    user: { id: userId },
  });
  return count > 0;
}
