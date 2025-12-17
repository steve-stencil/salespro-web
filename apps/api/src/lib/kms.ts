/**
 * AWS KMS service for envelope encryption.
 *
 * Uses AWS Key Management Service to manage encryption keys:
 * - Master key (CMK) never leaves AWS
 * - Data keys are generated per-encryption and stored encrypted
 * - Provides automatic key rotation and full audit trail
 */

import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
} from '@aws-sdk/client-kms';
import { fromIni } from '@aws-sdk/credential-providers';

import { env } from '../config/env';

/** Error codes for KMS operations */
export enum KmsErrorCode {
  MISSING_KEY_ID = 'MISSING_KEY_ID',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  INVALID_CIPHERTEXT = 'INVALID_CIPHERTEXT',
  SERVICE_ERROR = 'SERVICE_ERROR',
}

/** Error thrown by KMS operations */
export class KmsError extends Error {
  constructor(
    message: string,
    public readonly code: KmsErrorCode,
    cause?: Error,
  ) {
    super(message, { cause });
    this.name = 'KmsError';
  }
}

/** Result from generating a data key */
export type DataKeyResult = {
  /** Plaintext data key for local encryption (keep in memory only) */
  plaintextKey: Buffer;
  /** Encrypted data key to store in database */
  encryptedKey: string;
};

/** Lazy-initialized KMS client */
let kmsClient: KMSClient | null = null;

/**
 * Get or create the KMS client.
 */
function getKmsClient(): KMSClient {
  if (!kmsClient) {
    const clientConfig: ConstructorParameters<typeof KMSClient>[0] = {
      region: env.AWS_REGION,
    };

    // Use AWS profile if specified (for local development)
    if (env.AWS_PROFILE) {
      clientConfig.credentials = fromIni({ profile: env.AWS_PROFILE });
    }

    kmsClient = new KMSClient(clientConfig);
  }
  return kmsClient;
}

/**
 * Get the KMS key ID from environment.
 */
function getKeyId(): string {
  const keyId = env.KMS_KEY_ID;
  if (!keyId) {
    throw new KmsError(
      'KMS_KEY_ID environment variable is not set',
      KmsErrorCode.MISSING_KEY_ID,
    );
  }
  return keyId;
}

/**
 * Generate a new data key for encryption.
 *
 * Uses KMS to generate a 256-bit data key. Returns both:
 * - Plaintext key (for local AES encryption - keep in memory only)
 * - Encrypted key (to store alongside the encrypted data)
 *
 * @returns DataKeyResult with plaintext and encrypted keys
 */
export async function generateDataKey(): Promise<DataKeyResult> {
  const client = getKmsClient();
  const keyId = getKeyId();

  try {
    const command = new GenerateDataKeyCommand({
      KeyId: keyId,
      KeySpec: 'AES_256',
    });

    const response = await client.send(command);

    if (!response.Plaintext || !response.CiphertextBlob) {
      throw new KmsError(
        'KMS did not return expected key data',
        KmsErrorCode.SERVICE_ERROR,
      );
    }

    return {
      plaintextKey: Buffer.from(response.Plaintext),
      encryptedKey: Buffer.from(response.CiphertextBlob).toString('base64'),
    };
  } catch (error) {
    if (error instanceof KmsError) {
      throw error;
    }

    const awsError = error as { name?: string; message?: string };

    if (awsError.name === 'NotFoundException') {
      throw new KmsError(
        `KMS key not found: ${keyId}`,
        KmsErrorCode.KEY_NOT_FOUND,
        error as Error,
      );
    }

    if (
      awsError.name === 'AccessDeniedException' ||
      awsError.name === 'UnauthorizedException'
    ) {
      throw new KmsError(
        'Access denied to KMS key. Check IAM permissions.',
        KmsErrorCode.ACCESS_DENIED,
        error as Error,
      );
    }

    throw new KmsError(
      `KMS error: ${awsError.message ?? 'Unknown error'}`,
      KmsErrorCode.SERVICE_ERROR,
      error as Error,
    );
  }
}

/**
 * Decrypt an encrypted data key.
 *
 * Uses KMS to decrypt a data key that was previously encrypted.
 * The decrypted key can then be used for local AES decryption.
 *
 * @param encryptedKey - Base64-encoded encrypted data key
 * @returns Plaintext data key buffer
 */
export async function decryptDataKey(encryptedKey: string): Promise<Buffer> {
  const client = getKmsClient();

  try {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedKey, 'base64'),
    });

    const response = await client.send(command);

    if (!response.Plaintext) {
      throw new KmsError(
        'KMS did not return decrypted key',
        KmsErrorCode.SERVICE_ERROR,
      );
    }

    return Buffer.from(response.Plaintext);
  } catch (error) {
    if (error instanceof KmsError) {
      throw error;
    }

    const awsError = error as { name?: string; message?: string };

    if (awsError.name === 'InvalidCiphertextException') {
      throw new KmsError(
        'Invalid encrypted data key',
        KmsErrorCode.INVALID_CIPHERTEXT,
        error as Error,
      );
    }

    if (
      awsError.name === 'AccessDeniedException' ||
      awsError.name === 'UnauthorizedException'
    ) {
      throw new KmsError(
        'Access denied to KMS key. Check IAM permissions.',
        KmsErrorCode.ACCESS_DENIED,
        error as Error,
      );
    }

    throw new KmsError(
      `KMS error: ${awsError.message ?? 'Unknown error'}`,
      KmsErrorCode.SERVICE_ERROR,
      error as Error,
    );
  }
}

/**
 * Check if KMS is configured.
 */
export function isKmsConfigured(): boolean {
  return !!env.KMS_KEY_ID;
}
