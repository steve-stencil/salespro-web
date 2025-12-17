/**
 * Office integration service for managing third-party integration credentials.
 *
 * Uses AWS KMS envelope encryption:
 * - KMS generates data keys for each integration
 * - Data key encrypts credentials locally (AES-256-GCM)
 * - Encrypted data key stored alongside ciphertext
 * - KMS master key never leaves AWS
 */

import { Office, OfficeIntegration } from '../../entities';
import { encrypt, decrypt, EncryptionError } from '../../lib/encryption';
import {
  generateDataKey,
  decryptDataKey,
  isKmsConfigured,
  KmsError,
} from '../../lib/kms';

import { OfficeIntegrationError, OfficeIntegrationErrorCode } from './types';

import type {
  OfficeIntegrationResponse,
  OfficeIntegrationWithCredentials,
  UpsertIntegrationParams,
  ListIntegrationsOptions,
  IntegrationCredentials,
} from './types';
import type { EntityManager, FilterQuery } from '@mikro-orm/core';

// Re-export types
export * from './types';

/**
 * Office integration service for managing third-party integrations.
 */
export class OfficeIntegrationService {
  constructor(private readonly em: EntityManager) {}

  /**
   * List all integrations for an office.
   * Credentials are not included in the response (use getDecryptedCredentials).
   */
  async listIntegrations(
    officeId: string,
    companyId: string,
    options: ListIntegrationsOptions = {},
  ): Promise<OfficeIntegrationResponse[]> {
    await this.findOffice(officeId, companyId);

    const where: FilterQuery<OfficeIntegration> = { office: officeId };
    if (options.enabledOnly) {
      where['isEnabled'] = true;
    }

    const integrations = await this.em.find(OfficeIntegration, where, {
      orderBy: { displayName: 'ASC' },
    });

    return integrations.map(i => this.mapToResponse(i));
  }

  /**
   * Get a specific integration by key.
   * Credentials are not included (use getDecryptedCredentials).
   */
  async getIntegration(
    officeId: string,
    companyId: string,
    integrationKey: string,
  ): Promise<OfficeIntegrationResponse> {
    await this.findOffice(officeId, companyId);

    const integration = await this.em.findOne(OfficeIntegration, {
      office: officeId,
      integrationKey,
    });

    if (!integration) {
      throw new OfficeIntegrationError(
        `Integration '${integrationKey}' not found`,
        OfficeIntegrationErrorCode.INTEGRATION_NOT_FOUND,
      );
    }

    return this.mapToResponse(integration);
  }

  /**
   * Get integration with decrypted credentials.
   * Only use when credentials are actually needed.
   */
  async getDecryptedCredentials(
    officeId: string,
    companyId: string,
    integrationKey: string,
  ): Promise<OfficeIntegrationWithCredentials> {
    await this.findOffice(officeId, companyId);

    const integration = await this.em.findOne(OfficeIntegration, {
      office: officeId,
      integrationKey,
    });

    if (!integration) {
      throw new OfficeIntegrationError(
        `Integration '${integrationKey}' not found`,
        OfficeIntegrationErrorCode.INTEGRATION_NOT_FOUND,
      );
    }

    let credentials: IntegrationCredentials | null = null;
    if (integration.encryptedCredentials && integration.encryptedDataKey) {
      credentials = await this.decryptCredentials(
        integration.encryptedCredentials,
        integration.encryptedDataKey,
      );
    }

    return {
      ...this.mapToResponse(integration),
      credentials,
    };
  }

  /**
   * Create or update an integration.
   * Credentials are encrypted using KMS envelope encryption before storage.
   */
  async upsertIntegration(
    params: UpsertIntegrationParams,
  ): Promise<OfficeIntegrationResponse> {
    const {
      officeId,
      companyId,
      integrationKey,
      displayName,
      credentials,
      config,
      isEnabled,
    } = params;

    const office = await this.findOffice(officeId, companyId);

    let integration = await this.em.findOne(OfficeIntegration, {
      office: officeId,
      integrationKey,
    });

    if (!integration) {
      // Create new integration
      integration = new OfficeIntegration();
      integration.office = office;
      integration.integrationKey = integrationKey;
    }

    // Update fields
    integration.displayName = displayName;

    if (credentials !== undefined) {
      if (Object.keys(credentials).length === 0) {
        // Clear credentials
        integration.encryptedCredentials = undefined;
        integration.encryptedDataKey = undefined;
      } else {
        // Encrypt with KMS envelope encryption
        const { encryptedCredentials, encryptedDataKey } =
          await this.encryptCredentials(credentials);
        integration.encryptedCredentials = encryptedCredentials;
        integration.encryptedDataKey = encryptedDataKey;
      }
    }

    if (config !== undefined) {
      integration.config = config;
    }

    if (isEnabled !== undefined) {
      integration.isEnabled = isEnabled;
    }

    await this.em.persistAndFlush(integration);

    return this.mapToResponse(integration);
  }

  /**
   * Delete an integration.
   */
  async deleteIntegration(
    officeId: string,
    companyId: string,
    integrationKey: string,
  ): Promise<void> {
    await this.findOffice(officeId, companyId);

    const integration = await this.em.findOne(OfficeIntegration, {
      office: officeId,
      integrationKey,
    });

    if (!integration) {
      throw new OfficeIntegrationError(
        `Integration '${integrationKey}' not found`,
        OfficeIntegrationErrorCode.INTEGRATION_NOT_FOUND,
      );
    }

    await this.em.removeAndFlush(integration);
  }

  /**
   * Enable or disable an integration.
   */
  async setEnabled(
    officeId: string,
    companyId: string,
    integrationKey: string,
    isEnabled: boolean,
  ): Promise<OfficeIntegrationResponse> {
    await this.findOffice(officeId, companyId);

    const integration = await this.em.findOne(OfficeIntegration, {
      office: officeId,
      integrationKey,
    });

    if (!integration) {
      throw new OfficeIntegrationError(
        `Integration '${integrationKey}' not found`,
        OfficeIntegrationErrorCode.INTEGRATION_NOT_FOUND,
      );
    }

    integration.isEnabled = isEnabled;
    await this.em.flush();

    return this.mapToResponse(integration);
  }

  /**
   * Find office and validate company access.
   */
  private async findOffice(
    officeId: string,
    companyId: string,
  ): Promise<Office> {
    const office = await this.em.findOne(Office, {
      id: officeId,
      company: companyId,
    });

    if (!office) {
      throw new OfficeIntegrationError(
        'Office not found',
        OfficeIntegrationErrorCode.OFFICE_NOT_FOUND,
      );
    }

    return office;
  }

  /**
   * Encrypt credentials using KMS envelope encryption.
   *
   * 1. Generate a data key from KMS
   * 2. Encrypt credentials locally with the plaintext data key
   * 3. Return both encrypted credentials and encrypted data key
   */
  private async encryptCredentials(
    credentials: IntegrationCredentials,
  ): Promise<{ encryptedCredentials: string; encryptedDataKey: string }> {
    if (!isKmsConfigured()) {
      throw new OfficeIntegrationError(
        'KMS_KEY_ID environment variable is not set',
        OfficeIntegrationErrorCode.MISSING_ENCRYPTION_KEY,
      );
    }

    try {
      // Generate a new data key from KMS
      const { plaintextKey, encryptedKey } = await generateDataKey();

      // Encrypt credentials locally with the data key
      const json = JSON.stringify(credentials);
      const encryptedCredentials = encrypt(json, plaintextKey);

      return {
        encryptedCredentials,
        encryptedDataKey: encryptedKey,
      };
    } catch (error) {
      if (error instanceof KmsError) {
        throw new OfficeIntegrationError(
          `KMS encryption failed: ${error.message}`,
          OfficeIntegrationErrorCode.ENCRYPTION_FAILED,
        );
      }
      if (error instanceof EncryptionError) {
        throw new OfficeIntegrationError(
          `Encryption failed: ${error.message}`,
          OfficeIntegrationErrorCode.ENCRYPTION_FAILED,
        );
      }
      throw error;
    }
  }

  /**
   * Decrypt credentials using KMS envelope encryption.
   *
   * 1. Decrypt the data key using KMS
   * 2. Decrypt credentials locally with the plaintext data key
   */
  private async decryptCredentials(
    encryptedCredentials: string,
    encryptedDataKey: string,
  ): Promise<IntegrationCredentials> {
    try {
      // Decrypt the data key using KMS
      const plaintextKey = await decryptDataKey(encryptedDataKey);

      // Decrypt credentials locally
      const json = decrypt(encryptedCredentials, plaintextKey);
      return JSON.parse(json) as IntegrationCredentials;
    } catch (error) {
      if (error instanceof KmsError) {
        throw new OfficeIntegrationError(
          `KMS decryption failed: ${error.message}`,
          OfficeIntegrationErrorCode.DECRYPTION_FAILED,
        );
      }
      if (error instanceof EncryptionError || error instanceof SyntaxError) {
        throw new OfficeIntegrationError(
          `Decryption failed: ${(error as Error).message}`,
          OfficeIntegrationErrorCode.DECRYPTION_FAILED,
        );
      }
      throw error;
    }
  }

  /**
   * Map integration entity to API response.
   */
  private mapToResponse(
    integration: OfficeIntegration,
  ): OfficeIntegrationResponse {
    return {
      id: integration.id,
      officeId:
        typeof integration.office === 'string'
          ? integration.office
          : integration.office.id,
      integrationKey: integration.integrationKey,
      displayName: integration.displayName,
      hasCredentials:
        integration.encryptedCredentials != null &&
        integration.encryptedDataKey != null,
      config: integration.config ?? null,
      isEnabled: integration.isEnabled,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }
}
