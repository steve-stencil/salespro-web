/**
 * Office settings service for managing office-level settings.
 * Handles logo upload, validation, and settings management.
 */

import sharp from 'sharp';
import { v4 as uuid } from 'uuid';

import {
  Company,
  User,
  Office,
  OfficeSettings,
  File,
  FileStatus,
  FileVisibility,
} from '../../entities';
import {
  getStorageAdapter,
  generateStorageKey,
  getFileExtension,
  sanitizeFilename,
} from '../../lib/storage';

import { LOGO_CONFIG, isValidLogoMimeType } from './config';
import { OfficeSettingsError, OfficeSettingsErrorCode } from './types';

import type {
  UploadLogoParams,
  LogoValidationResult,
  OfficeSettingsResponse,
  LogoInfo,
} from './types';
import type { EntityManager } from '@mikro-orm/core';

// Re-export types and config
export * from './types';
export * from './config';

/**
 * Office settings service for managing office-level configuration.
 */
export class OfficeSettingsService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Get office settings for a specific office.
   * Creates settings if they don't exist.
   */
  async getSettings(
    officeId: string,
    companyId: string,
  ): Promise<OfficeSettingsResponse> {
    const office = await this.findOffice(officeId, companyId);
    let settings = await this.em.findOne(
      OfficeSettings,
      { office: office.id },
      { populate: ['logoFile'] },
    );

    // Create settings if they don't exist (lazy initialization)
    if (!settings) {
      settings = new OfficeSettings();
      settings.office = office;
      await this.em.persistAndFlush(settings);
    }

    return this.mapToResponse(settings);
  }

  /**
   * Upload and set a logo for an office.
   * Validates file type, size, and dimensions before upload.
   */
  async updateLogo(params: UploadLogoParams): Promise<OfficeSettingsResponse> {
    const { officeId, companyId, file, user } = params;

    // Validate the logo
    const validation = await this.validateLogo(file.buffer, file.mimeType);
    if (!validation.valid) {
      throw new OfficeSettingsError(
        validation.error ?? 'Invalid logo',
        validation.code ?? OfficeSettingsErrorCode.INVALID_FILE_TYPE,
      );
    }

    const office = await this.findOffice(officeId, companyId);
    let settings = await this.em.findOne(
      OfficeSettings,
      { office: office.id },
      { populate: ['logoFile'] },
    );

    // Store old logo for cleanup
    const oldLogoFile = settings?.logoFile;

    // Upload the new logo file
    const storage = getStorageAdapter();
    const fileId = uuid();
    const ext = getFileExtension(file.filename, file.mimeType);
    const storageKey = generateStorageKey(companyId, fileId, ext);
    const safeFilename = sanitizeFilename(file.filename);

    try {
      await storage.upload({
        key: storageKey,
        buffer: file.buffer,
        mimeType: file.mimeType,
        metadata: {
          originalFilename: safeFilename,
          uploadedBy: user.id,
          purpose: 'office-logo',
        },
      });
    } catch (error) {
      throw new OfficeSettingsError(
        `Failed to upload logo: ${(error as Error).message}`,
        OfficeSettingsErrorCode.UPLOAD_FAILED,
      );
    }

    // Generate thumbnail
    let thumbnailKey: string | undefined;
    try {
      const thumbnailBuffer = await sharp(file.buffer)
        .resize(200, 200, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .toBuffer();
      thumbnailKey = `${companyId}/thumbnails/${fileId}_thumb.${ext}`;
      await storage.upload({
        key: thumbnailKey,
        buffer: thumbnailBuffer,
        mimeType: file.mimeType,
      });
    } catch (error) {
      // Thumbnail generation is optional, continue without it
      console.error('Logo thumbnail generation failed:', error);
    }

    // Create file entity
    const fileEntity = new File();
    fileEntity.id = fileId;
    fileEntity.filename = safeFilename;
    fileEntity.storageKey = storageKey;
    fileEntity.mimeType = file.mimeType;
    fileEntity.size = file.buffer.length;
    fileEntity.visibility = FileVisibility.COMPANY;
    fileEntity.status = FileStatus.ACTIVE;
    fileEntity.company = this.em.getReference(Company, companyId);
    fileEntity.uploadedBy = this.em.getReference(User, user.id);
    fileEntity.thumbnailKey = thumbnailKey;
    fileEntity.description = `Office logo for ${office.name}`;

    this.em.persist(fileEntity);

    // Create or update settings
    if (!settings) {
      settings = new OfficeSettings();
      settings.office = office;
    }
    settings.logoFile = fileEntity;

    await this.em.persistAndFlush(settings);

    // Clean up old logo file
    if (oldLogoFile) {
      await this.deleteFileAndStorage(oldLogoFile);
    }

    // Re-fetch with populated relations
    await this.em.refresh(settings, { populate: ['logoFile'] });
    return this.mapToResponse(settings);
  }

  /**
   * Remove logo from office settings.
   */
  async removeLogo(
    officeId: string,
    companyId: string,
  ): Promise<OfficeSettingsResponse> {
    const office = await this.findOffice(officeId, companyId);
    const settings = await this.em.findOne(
      OfficeSettings,
      { office: office.id },
      { populate: ['logoFile'] },
    );

    if (!settings) {
      throw new OfficeSettingsError(
        'Office settings not found',
        OfficeSettingsErrorCode.SETTINGS_NOT_FOUND,
      );
    }

    const logoFile = settings.logoFile;
    if (logoFile) {
      settings.logoFile = undefined;
      await this.em.flush();
      await this.deleteFileAndStorage(logoFile);
    }

    return this.mapToResponse(settings);
  }

  /**
   * Validate logo file before upload.
   */
  private async validateLogo(
    buffer: Buffer,
    mimeType: string,
  ): Promise<LogoValidationResult> {
    // Validate MIME type
    if (!isValidLogoMimeType(mimeType)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${LOGO_CONFIG.allowedTypes.join(', ')}`,
        code: OfficeSettingsErrorCode.INVALID_FILE_TYPE,
      };
    }

    // Validate file size
    if (buffer.length > LOGO_CONFIG.maxSizeBytes) {
      const maxSizeMB = LOGO_CONFIG.maxSizeBytes / (1024 * 1024);
      return {
        valid: false,
        error: `File too large. Maximum size is ${maxSizeMB}MB`,
        code: OfficeSettingsErrorCode.FILE_TOO_LARGE,
      };
    }

    // Validate dimensions
    try {
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width;
      const height = metadata.height;

      if (
        !width ||
        !height ||
        width < LOGO_CONFIG.minWidth ||
        height < LOGO_CONFIG.minHeight ||
        width > LOGO_CONFIG.maxWidth ||
        height > LOGO_CONFIG.maxHeight
      ) {
        return {
          valid: false,
          error: `Invalid dimensions (${String(width)}x${String(height)}). Logo must be between ${LOGO_CONFIG.minWidth}x${LOGO_CONFIG.minHeight} and ${LOGO_CONFIG.maxWidth}x${LOGO_CONFIG.maxHeight} pixels`,
          code: OfficeSettingsErrorCode.INVALID_DIMENSIONS,
        };
      }

      return {
        valid: true,
        dimensions: { width, height },
      };
    } catch (error) {
      return {
        valid: false,
        error: `Could not process image: ${(error as Error).message}`,
        code: OfficeSettingsErrorCode.INVALID_FILE_TYPE,
      };
    }
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
      throw new OfficeSettingsError(
        'Office not found',
        OfficeSettingsErrorCode.OFFICE_NOT_FOUND,
      );
    }

    return office;
  }

  /**
   * Delete file entity and remove from storage.
   */
  private async deleteFileAndStorage(file: File): Promise<void> {
    const storage = getStorageAdapter();

    // Soft delete the file entity
    file.status = FileStatus.DELETED;
    file.deletedAt = new Date();
    await this.em.flush();

    // Delete from storage (non-blocking)
    try {
      await storage.delete(file.storageKey);
      if (file.thumbnailKey) {
        await storage.delete(file.thumbnailKey);
      }
    } catch (error) {
      console.error('Failed to delete file from storage:', error);
    }
  }

  /**
   * Map settings entity to API response.
   */
  private async mapToResponse(
    settings: OfficeSettings,
  ): Promise<OfficeSettingsResponse> {
    let logo: LogoInfo | null = null;

    if (settings.logoFile) {
      const storage = getStorageAdapter();
      const file = settings.logoFile;

      const url = await storage.getSignedDownloadUrl({
        key: file.storageKey,
        expiresIn: 3600,
      });
      const thumbnailUrl = file.thumbnailKey
        ? await storage.getSignedDownloadUrl({
            key: file.thumbnailKey,
            expiresIn: 3600,
          })
        : null;

      logo = {
        id: file.id,
        url,
        thumbnailUrl,
        filename: file.filename,
      };
    }

    return {
      id: settings.id,
      officeId:
        typeof settings.office === 'string'
          ? settings.office
          : settings.office.id,
      logo,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}
