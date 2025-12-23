/**
 * Document Template ETL Service
 *
 * Service for importing document templates from Parse/legacy system
 * into the new database schema.
 */

import { v4 as uuid } from 'uuid';

import {
  Company,
  DocumentTemplate,
  DocumentTemplateCategory,
  DocumentType,
  ImportSession,
  ImportSessionStatus,
  Office,
  File,
  FileStatus,
  FileVisibility,
  User,
} from '../../entities';
import { generateStorageKey, getStorageAdapter } from '../../lib/storage';

import { createParseClient } from './parse-client';
import { transformToTemplate } from './transform';
import { EtlErrorCode, EtlServiceError } from './types';

import type { ParseClient } from './parse-client';
import type {
  BatchImportOptions,
  BatchImportResult,
  ParseSourceOffice,
  TransformedTemplateData,
} from './types';
import type { EntityManager } from '@mikro-orm/core';

// Re-export types and utilities
export * from './types';
export * from './transform';
export { ParseClient, createParseClient } from './parse-client';

/**
 * Document Template ETL Service.
 *
 * Handles:
 * - Fetching source data from Parse
 * - Office and type mapping
 * - Batch importing templates
 * - File downloads and storage
 */
export class DocumentTemplateEtlService {
  private readonly parseClient: ParseClient;

  constructor(
    private readonly em: EntityManager,
    parseClient?: ParseClient,
  ) {
    this.parseClient = parseClient ?? createParseClient();
  }

  /**
   * Fetch source offices from Parse.
   */
  async fetchSourceOffices(): Promise<ParseSourceOffice[]> {
    return this.parseClient.queryOffices();
  }

  /**
   * Fetch distinct source types from Parse.
   */
  async fetchSourceTypes(): Promise<string[]> {
    return this.parseClient.queryDocumentTypes();
  }

  /**
   * Get total document count from Parse.
   */
  async getSourceDocumentCount(): Promise<number> {
    return this.parseClient.countDocuments();
  }

  /**
   * Create a new import session.
   * officeMapping values can be: target office UUID, 'create', or 'none'
   */
  async createImportSession(
    companyId: string,
    userId: string,
    officeMapping: Record<string, string>,
    typeMapping: Record<string, string>,
  ): Promise<ImportSession> {
    const company = await this.em.findOne(Company, { id: companyId });
    if (!company) {
      throw new EtlServiceError(
        'Company not found',
        EtlErrorCode.INVALID_MAPPING,
      );
    }

    // Validate type mapping references existing DocumentTypes
    for (const [sourceType, targetId] of Object.entries(typeMapping)) {
      if (targetId === 'create') continue;
      const docType = await this.em.findOne(DocumentType, {
        id: targetId,
        company: companyId,
        deletedAt: null,
      });
      if (!docType) {
        throw new EtlServiceError(
          `DocumentType not found for source type "${sourceType}"`,
          EtlErrorCode.INVALID_MAPPING,
          { sourceType, targetId },
        );
      }
    }

    // Validate office mapping references existing Offices
    for (const [sourceOffice, targetId] of Object.entries(officeMapping)) {
      if (targetId === 'create' || targetId === 'none') continue;
      const office = await this.em.findOne(Office, {
        id: targetId,
        company: companyId,
      });
      if (!office) {
        throw new EtlServiceError(
          `Office not found for source office "${sourceOffice}"`,
          EtlErrorCode.INVALID_MAPPING,
          { sourceOffice, targetId },
        );
      }
    }

    const totalCount = await this.getSourceDocumentCount();

    const session = new ImportSession();
    session.company = this.em.getReference(Company, companyId);
    session.createdBy = this.em.getReference(User, userId);
    session.status = ImportSessionStatus.PENDING;
    session.officeMapping = officeMapping;
    session.typeMapping = typeMapping;
    session.totalCount = totalCount;

    await this.em.persistAndFlush(session);
    return session;
  }

  /**
   * Get an import session by ID.
   */
  async getImportSession(
    sessionId: string,
    companyId: string,
  ): Promise<ImportSession | null> {
    return this.em.findOne(ImportSession, {
      id: sessionId,
      company: companyId,
    });
  }

  /**
   * Import a batch of documents.
   */
  async importBatch(options: BatchImportOptions): Promise<BatchImportResult> {
    const {
      companyId,
      officeMapping,
      typeMapping,
      skip,
      limit,
      sessionId,
      userId,
      sourceOfficeNames = {},
    } = options;

    // Get session
    const session = await this.em.findOne(ImportSession, { id: sessionId });
    if (!session) {
      throw new EtlServiceError(
        'Import session not found',
        EtlErrorCode.SESSION_NOT_FOUND,
      );
    }

    const currentStatus = session.status as ImportSessionStatus;
    if (currentStatus === ImportSessionStatus.COMPLETED) {
      throw new EtlServiceError(
        'Import session already completed',
        EtlErrorCode.SESSION_INVALID_STATE,
      );
    }

    // Update status to in progress
    if (currentStatus === ImportSessionStatus.PENDING) {
      session.status = ImportSessionStatus.IN_PROGRESS;
    }

    // Fetch batch from Parse
    const rawDocuments = await this.parseClient.queryDocuments(skip, limit);

    const result: BatchImportResult = {
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      hasMore: rawDocuments.length === limit,
    };

    // Cache for categories and types
    const categoryCache = new Map<string, DocumentTemplateCategory>();
    const typeCache = new Map<string, DocumentType>();
    const officeCache = new Map<string, Office>();

    for (const raw of rawDocuments) {
      try {
        // Check if already exists
        const existing = await this.em.findOne(DocumentTemplate, {
          sourceTemplateId: raw.objectId,
          company: companyId,
        });

        if (existing) {
          result.skippedCount++;
          session.skippedCount++;
          continue;
        }

        // Transform
        const data = transformToTemplate(raw);

        // Get or create category
        const category = await this.getOrCreateCategory(
          companyId,
          data.categoryName,
          categoryCache,
        );

        // Get DocumentType
        const documentType = await this.getOrCreateDocumentType(
          companyId,
          data.sourceType,
          typeMapping,
          typeCache,
        );

        // Resolve offices
        const offices = await this.resolveOffices(
          companyId,
          data.sourceOfficeIds,
          officeMapping,
          sourceOfficeNames,
          officeCache,
        );

        // Download files (best effort)
        const fileRefs = await this.downloadAssetFiles(data, companyId, userId);

        // Create template
        const template = this.createTemplate(
          companyId,
          category,
          documentType,
          offices,
          data,
          fileRefs,
        );

        this.em.persist(template);
        result.importedCount++;
        session.importedCount++;
      } catch (error) {
        result.errorCount++;
        session.errorCount++;
        result.errors.push({
          templateId: raw.objectId,
          error: error instanceof Error ? error.message : String(error),
        });
        session.errors.push({
          templateId: raw.objectId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Check if import is complete
    const totalImported =
      session.importedCount + session.skippedCount + session.errorCount;
    if (totalImported >= session.totalCount || !result.hasMore) {
      session.status = ImportSessionStatus.COMPLETED;
      session.completedAt = new Date();
    }

    await this.em.flush();

    return result;
  }

  /**
   * Get or create a category by name.
   */
  async getOrCreateCategory(
    companyId: string,
    categoryName: string,
    cache: Map<string, DocumentTemplateCategory>,
  ): Promise<DocumentTemplateCategory> {
    const cacheKey = `${companyId}:${categoryName}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // Find existing
    const existing = await this.em.findOne(DocumentTemplateCategory, {
      company: companyId,
      name: categoryName,
      deletedAt: null,
    });

    if (existing) {
      cache.set(cacheKey, existing);
      return existing;
    }

    // Create new
    const category = new DocumentTemplateCategory();
    category.company = this.em.getReference(Company, companyId);
    category.name = categoryName;
    category.sortOrder = categoryName === '' ? 999 : cache.size;
    category.isImported = true;

    this.em.persist(category);
    cache.set(cacheKey, category);
    return category;
  }

  /**
   * Get or create a DocumentType based on mapping.
   */
  private async getOrCreateDocumentType(
    companyId: string,
    sourceType: string,
    typeMapping: Record<string, string>,
    cache: Map<string, DocumentType>,
  ): Promise<DocumentType> {
    const cacheKey = `${companyId}:${sourceType}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const mappedId = typeMapping[sourceType];

    if (mappedId && mappedId !== 'create') {
      // Use existing type
      const existing = await this.em.findOne(DocumentType, { id: mappedId });
      if (existing) {
        cache.set(cacheKey, existing);
        return existing;
      }
    }

    // Find by name or create
    let docType = await this.em.findOne(DocumentType, {
      company: companyId,
      name: sourceType,
      deletedAt: null,
    });

    if (!docType) {
      docType = new DocumentType();
      docType.company = this.em.getReference(Company, companyId);
      docType.name = sourceType;
      docType.isDefault = false;
      docType.sortOrder = 100;
      this.em.persist(docType);
    }

    cache.set(cacheKey, docType);
    return docType;
  }

  /**
   * Resolve offices based on mapping.
   * officeMapping values can be: target office UUID, 'create', or 'none'
   */
  private async resolveOffices(
    companyId: string,
    sourceOfficeIds: string[],
    officeMapping: Record<string, string>,
    sourceOfficeNames: Record<string, string>,
    cache: Map<string, Office>,
  ): Promise<Office[]> {
    const offices: Office[] = [];

    for (const sourceId of sourceOfficeIds) {
      const mapping = officeMapping[sourceId];

      if (!mapping || mapping === 'none') {
        continue;
      }

      const cacheKey = `${companyId}:${sourceId}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        offices.push(cached);
        continue;
      }

      if (mapping === 'create') {
        // Create new office with source name
        const officeName = sourceOfficeNames[sourceId] ?? `Office ${sourceId}`;
        let office = await this.em.findOne(Office, {
          company: companyId,
          name: officeName,
        });

        if (!office) {
          office = new Office();
          office.company = this.em.getReference(Company, companyId);
          office.name = officeName;
          office.isActive = true;
          this.em.persist(office);
        }

        cache.set(cacheKey, office);
        offices.push(office);
      } else {
        // Use existing office
        const office = await this.em.findOne(Office, { id: mapping });
        if (office) {
          cache.set(cacheKey, office);
          offices.push(office);
        }
      }
    }

    return offices;
  }

  /**
   * Download asset files (PDF, icon, watermark, images) and create File entities.
   */
  private async downloadAssetFiles(
    data: TransformedTemplateData,
    companyId: string,
    userId: string,
  ): Promise<{ pdf?: File; icon?: File; watermark?: File; images: File[] }> {
    const result: {
      pdf?: File;
      icon?: File;
      watermark?: File;
      images: File[];
    } = { images: [] };

    const downloadAndStore = async (
      url: string | undefined,
      type: 'pdf' | 'icon' | 'watermark' | 'image',
    ): Promise<File | undefined> => {
      if (!url) return undefined;

      try {
        const buffer = await this.parseClient.downloadFile(url);
        const filename = url.split('/').pop() ?? `${type}-${uuid()}`;
        const mimeType = this.getMimeType(filename, type);

        // Generate storage key and upload
        const fileId = uuid();
        const ext = filename.includes('.')
          ? filename.split('.').pop()
          : type === 'pdf'
            ? 'pdf'
            : 'png';
        const storageKey = generateStorageKey(companyId, fileId, ext ?? '');

        const storage = getStorageAdapter();
        await storage.upload({
          key: storageKey,
          buffer,
          mimeType,
        });

        // Create File entity
        const file = new File();
        file.id = fileId;
        file.filename = filename;
        file.storageKey = storageKey;
        file.mimeType = mimeType;
        file.size = buffer.length;
        file.visibility = FileVisibility.COMPANY;
        file.status = FileStatus.ACTIVE;
        file.company = this.em.getReference(Company, companyId);
        file.uploadedBy = this.em.getReference(User, userId);
        file.metadata = { source: 'etl-import', type };

        this.em.persist(file);
        return file;
      } catch (error) {
        // Log but don't fail the entire import
        console.error(`Failed to download ${type} file:`, error);
        return undefined;
      }
    };

    result.pdf = await downloadAndStore(data.pdfUrl, 'pdf');
    result.icon = await downloadAndStore(data.iconUrl, 'icon');
    result.watermark = await downloadAndStore(data.watermarkUrl, 'watermark');

    // Download template images
    for (const imageUrl of data.imageUrls) {
      const imageFile = await downloadAndStore(imageUrl, 'image');
      if (imageFile) {
        result.images.push(imageFile);
      }
    }

    return result;
  }

  /**
   * Get MIME type for a file.
   */
  private getMimeType(
    filename: string,
    type: 'pdf' | 'icon' | 'watermark' | 'image',
  ): string {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';

    // Default based on type
    return type === 'pdf' ? 'application/pdf' : 'image/png';
  }

  /**
   * Create a DocumentTemplate entity.
   */
  private createTemplate(
    companyId: string,
    category: DocumentTemplateCategory,
    documentType: DocumentType,
    offices: Office[],
    data: TransformedTemplateData,
    files: { pdf?: File; icon?: File; watermark?: File; images: File[] },
  ): DocumentTemplate {
    const template = new DocumentTemplate();

    template.company = this.em.getReference(Company, companyId);
    template.category = category;
    template.documentType = documentType;
    template.sourceTemplateId = data.sourceTemplateId;
    template.pageId = data.pageId;
    template.displayName = data.displayName;
    template.sortOrder = data.sortOrder;
    template.canAddMultiplePages = data.canAddMultiplePages;
    template.isTemplate = data.isTemplate;
    template.includedStates = data.includedStates;
    template.pageWidth = data.pageWidth;
    template.pageHeight = data.pageHeight;
    template.hMargin = data.hMargin;
    template.wMargin = data.wMargin;
    template.photosPerPage = data.photosPerPage;
    template.useWatermark = data.useWatermark;
    template.watermarkWidthPercent = data.watermarkWidthPercent;
    template.watermarkAlpha = data.watermarkAlpha;
    template.documentDataJson = data.documentDataJson;
    template.hasUserInput = data.hasUserInput;
    template.signatureFieldCount = data.signatureFieldCount;
    template.initialsFieldCount = data.initialsFieldCount;

    // Set file references
    if (files.pdf) template.pdfFile = files.pdf;
    if (files.icon) template.iconFile = files.icon;
    if (files.watermark) template.watermarkFile = files.watermark;

    // Add template images
    for (const image of files.images) {
      template.templateImages.add(image);
    }

    // Add offices
    for (const office of offices) {
      template.includedOffices.add(office);
    }

    return template;
  }
}
