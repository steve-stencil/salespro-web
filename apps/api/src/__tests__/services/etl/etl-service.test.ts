/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Unit tests for DocumentTemplateEtlService.
 *
 * Tests the ETL service logic with mocked dependencies.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  ImportSession,
  ImportSessionStatus,
  DocumentTemplateCategory,
} from '../../../entities';
import {
  DocumentTemplateEtlService,
  EtlServiceError,
  EtlErrorCode,
} from '../../../services/etl';
import { createRawParseDocumentData } from '../../factories';

import type { ParseClient } from '../../../services/etl/parse-client';
import type { EntityManager } from '@mikro-orm/core';

// Mock ParseClient factory
function createMockParseClient(
  overrides: Partial<ParseClient> = {},
): ParseClient {
  return {
    queryDocuments: vi.fn().mockResolvedValue([]),
    queryOffices: vi.fn().mockResolvedValue([]),
    queryDocumentTypes: vi.fn().mockResolvedValue([]),
    countDocuments: vi.fn().mockResolvedValue(0),
    downloadFile: vi.fn().mockResolvedValue(Buffer.from('test')),
    ...overrides,
  } as ParseClient;
}

// Mock EntityManager factory
function createMockEntityManager(
  overrides: Partial<EntityManager> = {},
): EntityManager {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    getReference: vi.fn((entity: string, id: string) => ({ id })),
    persist: vi.fn(),
    persistAndFlush: vi.fn(),
    flush: vi.fn(),
    ...overrides,
  } as unknown as EntityManager;
}

describe('DocumentTemplateEtlService', () => {
  let service: DocumentTemplateEtlService;
  let mockEm: EntityManager;
  let mockParseClient: ParseClient;

  beforeEach(() => {
    mockParseClient = createMockParseClient();
    mockEm = createMockEntityManager();
    service = new DocumentTemplateEtlService(mockEm, mockParseClient);
  });

  describe('fetchSourceOffices', () => {
    it('should delegate to ParseClient.queryOffices', async () => {
      const mockOffices = [
        { objectId: 'office1', name: 'Office 1' },
        { objectId: 'office2', name: 'Office 2' },
      ];
      mockParseClient.queryOffices.mockResolvedValue(mockOffices);

      const result = await service.fetchSourceOffices();

      expect(mockParseClient.queryOffices).toHaveBeenCalled();
      expect(result).toEqual(mockOffices);
    });
  });

  describe('fetchSourceTypes', () => {
    it('should delegate to ParseClient.queryDocumentTypes', async () => {
      const mockTypes = ['contract', 'proposal', 'invoice'];
      mockParseClient.queryDocumentTypes.mockResolvedValue(mockTypes);

      const result = await service.fetchSourceTypes();

      expect(mockParseClient.queryDocumentTypes).toHaveBeenCalled();
      expect(result).toEqual(mockTypes);
    });
  });

  describe('getSourceDocumentCount', () => {
    it('should delegate to ParseClient.countDocuments', async () => {
      mockParseClient.countDocuments.mockResolvedValue(150);

      const result = await service.getSourceDocumentCount();

      expect(mockParseClient.countDocuments).toHaveBeenCalled();
      expect(result).toBe(150);
    });
  });

  describe('createImportSession', () => {
    const companyId = 'company-123';
    const userId = 'user-456';

    it('should throw error if company not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      await expect(
        service.createImportSession(companyId, userId, {}, {}),
      ).rejects.toThrow(EtlServiceError);

      await expect(
        service.createImportSession(companyId, userId, {}, {}),
      ).rejects.toMatchObject({
        code: EtlErrorCode.INVALID_MAPPING,
      });
    });

    it('should throw error if type mapping references non-existent DocumentType', async () => {
      // First call returns company, second returns null for DocumentType
      mockEm.findOne
        .mockResolvedValueOnce({ id: companyId }) // Company found
        .mockResolvedValueOnce(null); // DocumentType not found

      const typeMapping = { contract: 'invalid-type-id' };

      await expect(
        service.createImportSession(companyId, userId, {}, typeMapping),
      ).rejects.toThrow(EtlServiceError);
    });

    it('should throw error if office mapping references non-existent Office', async () => {
      mockEm.findOne
        .mockResolvedValueOnce({ id: companyId }) // Company found
        .mockResolvedValueOnce(null); // Office not found

      const officeMapping = { sourceOffice1: 'invalid-office-id' };

      await expect(
        service.createImportSession(companyId, userId, officeMapping, {}),
      ).rejects.toThrow(EtlServiceError);
    });

    it('should allow "create" value in type mapping', async () => {
      mockEm.findOne.mockResolvedValue({ id: companyId });
      mockParseClient.countDocuments.mockResolvedValue(10);

      const typeMapping = { contract: 'create' };

      // Should not throw
      await service.createImportSession(companyId, userId, {}, typeMapping);

      // Should not check for DocumentType when mapping is 'create'
      expect(mockEm.findOne).toHaveBeenCalledTimes(1); // Only company lookup
    });

    it('should allow "create" and "none" values in office mapping', async () => {
      mockEm.findOne.mockResolvedValue({ id: companyId });
      mockParseClient.countDocuments.mockResolvedValue(10);

      const officeMapping = {
        office1: 'create',
        office2: 'none',
      };

      await service.createImportSession(companyId, userId, officeMapping, {});

      // Should not check for Office when mapping is 'create' or 'none'
      expect(mockEm.findOne).toHaveBeenCalledTimes(1); // Only company lookup
    });

    it('should create and persist ImportSession with correct data', async () => {
      mockEm.findOne.mockResolvedValue({ id: companyId });
      mockParseClient.countDocuments.mockResolvedValue(50);

      const officeMapping = { office1: 'create' };
      const typeMapping = { contract: 'create' };

      await service.createImportSession(
        companyId,
        userId,
        officeMapping,
        typeMapping,
      );

      expect(mockEm.persistAndFlush).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ImportSessionStatus.PENDING,
          officeMapping,
          typeMapping,
          totalCount: 50,
        }),
      );
    });
  });

  describe('getImportSession', () => {
    it('should find session by id and company', async () => {
      const mockSession = {
        id: 'session-123',
        company: { id: 'company-123' },
        status: ImportSessionStatus.PENDING,
      };
      mockEm.findOne.mockResolvedValue(mockSession);

      const result = await service.getImportSession(
        'session-123',
        'company-123',
      );

      expect(mockEm.findOne).toHaveBeenCalledWith(ImportSession, {
        id: 'session-123',
        company: 'company-123',
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null if session not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await service.getImportSession(
        'nonexistent',
        'company-123',
      );

      expect(result).toBeNull();
    });
  });

  describe('importBatch', () => {
    const batchOptions = {
      companyId: 'company-123',
      officeMapping: {},
      typeMapping: {},
      skip: 0,
      limit: 10,
      sessionId: 'session-123',
      userId: 'user-456',
    };

    it('should throw error if session not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      await expect(service.importBatch(batchOptions)).rejects.toThrow(
        EtlServiceError,
      );
      await expect(service.importBatch(batchOptions)).rejects.toMatchObject({
        code: EtlErrorCode.SESSION_NOT_FOUND,
      });
    });

    it('should throw error if session already completed', async () => {
      const completedSession = {
        id: 'session-123',
        status: ImportSessionStatus.COMPLETED,
      };
      mockEm.findOne.mockResolvedValue(completedSession);

      await expect(service.importBatch(batchOptions)).rejects.toThrow(
        EtlServiceError,
      );
      await expect(service.importBatch(batchOptions)).rejects.toMatchObject({
        code: EtlErrorCode.SESSION_INVALID_STATE,
      });
    });

    it('should update session status to IN_PROGRESS on first batch', async () => {
      const pendingSession = {
        id: 'session-123',
        status: ImportSessionStatus.PENDING,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        totalCount: 100, // Higher total so it doesn't complete immediately
        errors: [],
      };

      // Return full batch to simulate hasMore = true
      const rawDocs = Array.from({ length: 10 }, (_, i) =>
        createRawParseDocumentData({ objectId: `doc-${i}` }),
      );

      mockEm.findOne.mockResolvedValue(pendingSession);
      mockParseClient.queryDocuments.mockResolvedValue(rawDocs);

      // Mock to skip all documents
      mockEm.findOne
        .mockResolvedValueOnce(pendingSession)
        .mockResolvedValue({ id: 'existing' });

      await service.importBatch(batchOptions);

      // Status should be IN_PROGRESS because there are more docs (hasMore=true)
      expect(pendingSession.status).toBe(ImportSessionStatus.IN_PROGRESS);
    });

    it('should skip documents that already exist', async () => {
      const session = {
        id: 'session-123',
        status: ImportSessionStatus.IN_PROGRESS,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        totalCount: 10,
        errors: [],
      };

      const rawDoc = createRawParseDocumentData({ objectId: 'existing-doc' });

      // First findOne returns session, subsequent ones return existing template
      mockEm.findOne
        .mockResolvedValueOnce(session) // Session lookup
        .mockResolvedValueOnce({ id: 'existing-template' }); // Existing template

      mockParseClient.queryDocuments.mockResolvedValue([rawDoc]);

      const result = await service.importBatch(batchOptions);

      expect(result.skippedCount).toBe(1);
      expect(result.importedCount).toBe(0);
      expect(session.skippedCount).toBe(1);
    });

    it('should record errors for failed imports', async () => {
      const session = {
        id: 'session-123',
        status: ImportSessionStatus.IN_PROGRESS,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        totalCount: 10,
        errors: [] as Array<{
          templateId: string;
          error: string;
          timestamp: string;
        }>,
      };

      const rawDoc = createRawParseDocumentData({ objectId: 'error-doc' });
      mockParseClient.queryDocuments.mockResolvedValue([rawDoc]);

      // Reset mocks and set up the sequence of calls:
      // 1. Session lookup - returns session
      // 2. Existing template check - returns null (not existing)
      // 3. Category lookup - throws error
      mockEm.findOne
        .mockReset()
        .mockResolvedValueOnce(session) // Session lookup
        .mockResolvedValueOnce(null) // No existing template
        .mockRejectedValueOnce(new Error('Database error')); // Category lookup fails

      const result = await service.importBatch(batchOptions);

      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        templateId: 'error-doc',
        error: expect.stringContaining('Database error'),
      });
      expect(session.errorCount).toBe(1);
    });

    it('should return hasMore=true when batch is full', async () => {
      const session = {
        id: 'session-123',
        status: ImportSessionStatus.IN_PROGRESS,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        totalCount: 100,
        errors: [],
      };

      // Create exactly `limit` documents
      const rawDocs = Array.from({ length: 10 }, (_, i) =>
        createRawParseDocumentData({ objectId: `doc-${i}` }),
      );

      mockEm.findOne.mockResolvedValue(session);
      mockParseClient.queryDocuments.mockResolvedValue(rawDocs);

      // Mock to skip all documents (easier than setting up full import)
      mockEm.findOne
        .mockResolvedValueOnce(session)
        // Each doc check returns existing
        .mockResolvedValue({ id: 'existing' });

      const result = await service.importBatch(batchOptions);

      expect(result.hasMore).toBe(true);
    });

    it('should return hasMore=false when batch is not full', async () => {
      const session = {
        id: 'session-123',
        status: ImportSessionStatus.IN_PROGRESS,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        totalCount: 5,
        errors: [],
      };

      const rawDocs = Array.from({ length: 5 }, (_, i) =>
        createRawParseDocumentData({ objectId: `doc-${i}` }),
      );

      mockEm.findOne.mockResolvedValue(session);
      mockParseClient.queryDocuments.mockResolvedValue(rawDocs);

      // Mock to skip all documents
      mockEm.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValue({ id: 'existing' });

      const result = await service.importBatch({ ...batchOptions, limit: 10 });

      expect(result.hasMore).toBe(false);
    });

    it('should mark session as COMPLETED when all documents processed', async () => {
      const session = {
        id: 'session-123',
        status: ImportSessionStatus.IN_PROGRESS,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        totalCount: 2,
        errors: [],
        completedAt: null as Date | null,
      };

      const rawDocs = Array.from({ length: 2 }, (_, i) =>
        createRawParseDocumentData({ objectId: `doc-${i}` }),
      );

      mockEm.findOne.mockResolvedValue(session);
      mockParseClient.queryDocuments.mockResolvedValue(rawDocs);

      // Mock to skip all documents
      mockEm.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValue({ id: 'existing' });

      await service.importBatch({ ...batchOptions, limit: 10 });

      expect(session.status).toBe(ImportSessionStatus.COMPLETED);
      expect(session.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('getOrCreateCategory', () => {
    it('should return cached category if available', async () => {
      const cache = new Map<string, DocumentTemplateCategory>();
      const cachedCategory = new DocumentTemplateCategory();
      cachedCategory.name = 'Cached';
      cache.set('company-123:Contracts', cachedCategory);

      const result = await service.getOrCreateCategory(
        'company-123',
        'Contracts',
        cache,
      );

      expect(result).toBe(cachedCategory);
      expect(mockEm.findOne).not.toHaveBeenCalled();
    });

    it('should find existing category from database', async () => {
      const cache = new Map<string, DocumentTemplateCategory>();
      const existingCategory = new DocumentTemplateCategory();
      existingCategory.name = 'Existing';

      mockEm.findOne.mockResolvedValue(existingCategory);

      const result = await service.getOrCreateCategory(
        'company-123',
        'Existing',
        cache,
      );

      expect(result).toBe(existingCategory);
      expect(cache.get('company-123:Existing')).toBe(existingCategory);
    });

    it('should create new category if not found', async () => {
      const cache = new Map<string, DocumentTemplateCategory>();

      mockEm.findOne.mockResolvedValue(null);

      const result = await service.getOrCreateCategory(
        'company-123',
        'New Category',
        cache,
      );

      expect(result).toBeInstanceOf(DocumentTemplateCategory);
      expect(result.name).toBe('New Category');
      expect(result.isImported).toBe(true);
      expect(mockEm.persist).toHaveBeenCalled();
      expect(cache.has('company-123:New Category')).toBe(true);
    });

    it('should set high sortOrder for empty category name', async () => {
      const cache = new Map<string, DocumentTemplateCategory>();

      mockEm.findOne.mockResolvedValue(null);

      const result = await service.getOrCreateCategory(
        'company-123',
        '',
        cache,
      );

      expect(result.sortOrder).toBe(999);
    });
  });
});
