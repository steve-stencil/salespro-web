import { createHash, randomBytes } from 'crypto';

import argon2 from 'argon2';

/**
 * Hash a password using Argon2id (recommended for password hashing)
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token
 * @param length Number of bytes (default 32 = 256 bits)
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Hash a token for secure storage (using SHA-256)
 * Tokens are hashed so they can't be used if the database is compromised
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a backup code in format XXXX-XXXX-XXXX
 */
export function generateBackupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  const bytes = randomBytes(12);

  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) {
      code += '-';
    }
    code += chars[bytes[i]! % chars.length];
  }

  return code;
}

/**
 * Generate a secure ID (URL-safe base64)
 */
export function generateSecureId(length: number = 24): string {
  return randomBytes(length).toString('base64url').slice(0, length);
}

/**
 * Get the prefix of a token for identification
 */
export function getTokenPrefix(token: string, length: number = 8): string {
  return token.slice(0, length);
}
