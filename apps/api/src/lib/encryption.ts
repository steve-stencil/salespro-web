/**
 * AES-256-GCM encryption utilities for sensitive credential storage.
 *
 * Uses envelope encryption with AWS KMS:
 * - KMS generates and manages data encryption keys
 * - Local AES-256-GCM encryption for actual data
 * - Encrypted data key stored alongside ciphertext
 *
 * Ciphertext format: {iv}:{authTag}:{encrypted} (all base64)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/** Error thrown when encryption/decryption fails */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly code: EncryptionErrorCode,
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/** Error codes for encryption operations */
export enum EncryptionErrorCode {
  INVALID_KEY = 'INVALID_KEY',
  INVALID_CIPHERTEXT = 'INVALID_CIPHERTEXT',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @param key - 32-byte encryption key (from KMS data key)
 * @returns Encrypted string in format: {iv}:{authTag}:{encrypted} (all base64)
 * @throws EncryptionError if encryption fails
 */
export function encrypt(plaintext: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new EncryptionError(
      'Encryption key must be exactly 32 bytes',
      EncryptionErrorCode.INVALID_KEY,
    );
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: {iv}:{authTag}:{encrypted} (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  } catch (error) {
    throw new EncryptionError(
      `Encryption failed: ${(error as Error).message}`,
      EncryptionErrorCode.ENCRYPTION_FAILED,
    );
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 *
 * @param ciphertext - Encrypted string in format: {iv}:{authTag}:{encrypted} (all base64)
 * @param key - 32-byte encryption key (from KMS data key)
 * @returns Decrypted plaintext string
 * @throws EncryptionError if decryption fails
 */
export function decrypt(ciphertext: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new EncryptionError(
      'Encryption key must be exactly 32 bytes',
      EncryptionErrorCode.INVALID_KEY,
    );
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new EncryptionError(
      'Invalid ciphertext format. Expected iv:authTag:encrypted',
      EncryptionErrorCode.INVALID_CIPHERTEXT,
    );
  }

  const ivB64 = parts[0]!;
  const authTagB64 = parts[1]!;
  const encryptedB64 = parts[2]!;

  try {
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    if (iv.length !== IV_LENGTH) {
      throw new EncryptionError(
        `Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`,
        EncryptionErrorCode.INVALID_CIPHERTEXT,
      );
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new EncryptionError(
        `Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`,
        EncryptionErrorCode.INVALID_CIPHERTEXT,
      );
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(
      `Decryption failed: ${(error as Error).message}`,
      EncryptionErrorCode.DECRYPTION_FAILED,
    );
  }
}

/**
 * Generate a random encryption key (for testing or fallback).
 *
 * @returns 32-byte random key
 */
export function generateRandomKey(): Buffer {
  return crypto.randomBytes(32);
}
