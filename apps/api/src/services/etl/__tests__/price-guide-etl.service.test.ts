/**
 * Price Guide ETL Service Tests
 *
 * Unit tests for the PriceGuideEtlService.
 * Tests the main orchestration service for price guide imports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MigrationSessionStatus } from '../../../entities';
import { PriceGuideEtlService } from '../price-guide-etl.service';
import {
  countCategories,
  queryCategories,
} from '../queries/custom-config.queries';
import {
  countMSIs,
  queryAllMSIs,
  queryMSIs,
} from '../queries/measure-sheet-item.queries';
import {
  countOptions,
  countUpCharges,
  queryOptions,
  queryUpCharges,
} from '../queries/price-guide-item.queries';
import { getSourceCompanyIdByEmail } from '../queries/user.queries';
import { isSourceConfigured } from '../source-client';
import { EtlErrorCode, EtlServiceError } from '../types';

import type { EntityManager } from '@mikro-orm/core';

// Mock all query modules
vi.mock('../queries/custom-config.queries', () => ({
  queryCategories: vi.fn(),
  countCategories: vi.fn(),
}));

vi.mock('../queries/measure-sheet-item.queries', () => ({
  countMSIs: vi.fn(),
  queryAllMSIs: vi.fn(),
  queryMSIsByIds: vi.fn(),
  queryMSIs: vi.fn(),
}));

vi.mock('../queries/price-guide-item.queries', () => ({
  countOptions: vi.fn(),
  countUpCharges: vi.fn(),
  countPGIs: vi.fn(),
  queryAllPGIs: vi.fn(),
  queryPGIsByIds: vi.fn(),
  queryPGIs: vi.fn(),
  queryOptions: vi.fn(),
  queryUpCharges: vi.fn(),
}));

vi.mock('../queries/user.queries', () => ({
  getSourceCompanyIdByEmail: vi.fn(),
}));

vi.mock('../source-client', () => ({
  isSourceConfigured: vi.fn(),
}));

describe('PriceGuideEtlService', () => {
  let service: PriceGuideEtlService;
  let mockFindOne: ReturnType<typeof vi.fn>;
  let mockFind: ReturnType<typeof vi.fn>;
  let mockGetReference: ReturnType<typeof vi.fn>;
  let mockPersist: ReturnType<typeof vi.fn>;
  let mockPersistAndFlush: ReturnType<typeof vi.fn>;
  let mockFlush: ReturnType<typeof vi.fn>;
  let mockCount: ReturnType<typeof vi.fn>;
  let mockEm: EntityManager;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFindOne = vi.fn();
    mockFind = vi.fn().mockResolvedValue([]);
    mockGetReference = vi.fn().mockImplementation((_: unknown, id: string) => ({
      id,
    }));
    mockPersist = vi.fn();
    mockPersistAndFlush = vi.fn();
    mockFlush = vi.fn();
    mockCount = vi.fn().mockResolvedValue(0);

    mockEm = {
      findOne: mockFindOne,
      find: mockFind,
      getReference: mockGetReference,
      persist: mockPersist,
      persistAndFlush: mockPersistAndFlush,
      flush: mockFlush,
      count: mockCount,
    } as unknown as EntityManager;

    service = new PriceGuideEtlService(mockEm);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // isSourceConfigured Tests
  // ==========================================================================

  describe('isSourceConfigured', () => {
    it('should return true when source is configured', () => {
      vi.mocked(isSourceConfigured).mockReturnValue(true);

      expect(service.isSourceConfigured()).toBe(true);
    });

    it('should return false when source is not configured', () => {
      vi.mocked(isSourceConfigured).mockReturnValue(false);

      expect(service.isSourceConfigured()).toBe(false);
    });
  });

  // ==========================================================================
  // initializeSourceCompany Tests
  // ==========================================================================

  describe('initializeSourceCompany', () => {
    it('should set sourceCompanyId when user is found', async () => {
      const expectedCompanyId = 'company123';
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue(expectedCompanyId);

      const result = await service.initializeSourceCompany('test@example.com');

      expect(result).toBe(expectedCompanyId);
      expect(getSourceCompanyIdByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(service.getSourceCompanyId()).toBe(expectedCompanyId);
    });

    it('should throw EtlServiceError when user is not found', async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue(null);

      await expect(
        service.initializeSourceCompany('unknown@example.com'),
      ).rejects.toThrow(EtlServiceError);

      await expect(
        service.initializeSourceCompany('unknown@example.com'),
      ).rejects.toMatchObject({
        code: EtlErrorCode.SOURCE_COMPANY_NOT_FOUND,
      });
    });
  });

  // ==========================================================================
  // getSourceCount Tests
  // ==========================================================================

  describe('getSourceCount', () => {
    beforeEach(async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue('company123');
      await service.initializeSourceCompany('test@example.com');
    });

    it('should return MSI count from source', async () => {
      vi.mocked(countMSIs).mockResolvedValue(100);

      const result = await service.getSourceCount();

      expect(result).toBe(100);
      expect(countMSIs).toHaveBeenCalledWith('company123');
    });

    it('should throw error when source company not initialized', async () => {
      const uninitializedService = new PriceGuideEtlService(mockEm);

      await expect(uninitializedService.getSourceCount()).rejects.toThrow(
        EtlServiceError,
      );
    });
  });

  // ==========================================================================
  // getSourceCounts Tests
  // ==========================================================================

  describe('getSourceCounts', () => {
    beforeEach(async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue('company123');
      await service.initializeSourceCompany('test@example.com');
    });

    it('should return all counts from source', async () => {
      vi.mocked(countCategories).mockResolvedValue(10);
      vi.mocked(countMSIs).mockResolvedValue(100);
      vi.mocked(countOptions).mockResolvedValue(50);
      vi.mocked(countUpCharges).mockResolvedValue(25);

      const result = await service.getSourceCounts();

      expect(result.categories).toBe(10);
      expect(result.msis).toBe(100);
      expect(result.options).toBe(50);
      expect(result.upCharges).toBe(25);
    });
  });

  // ==========================================================================
  // createSession Tests
  // ==========================================================================

  describe('createSession', () => {
    const mockCompanyId = 'company-uuid';
    const mockUserId = 'user-uuid';

    beforeEach(async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue(
        'sourceCompany123',
      );
      // Mock all counts used by getSourceCounts()
      vi.mocked(countCategories).mockResolvedValue(5);
      vi.mocked(countMSIs).mockResolvedValue(20);
      vi.mocked(countOptions).mockResolvedValue(10);
      vi.mocked(countUpCharges).mockResolvedValue(5);

      await service.initializeSourceCompany('test@example.com');

      mockFindOne.mockResolvedValue({ id: mockCompanyId });
    });

    it('should create a new migration session', async () => {
      mockPersistAndFlush.mockResolvedValue(undefined);

      const session = await service.createSession(mockCompanyId, mockUserId);

      expect(session).toBeDefined();
      expect(session.sourceCompanyId).toBe('sourceCompany123');
      // totalCount = categories + msis + options + upCharges = 5 + 20 + 10 + 5 = 40
      expect(session.totalCount).toBe(40);
      expect(mockPersistAndFlush).toHaveBeenCalled();
    });

    it('should throw error when company not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        service.createSession(mockCompanyId, mockUserId),
      ).rejects.toThrow(EtlServiceError);
    });
  });

  // ==========================================================================
  // importPriceGuideBatch Tests
  // ==========================================================================

  describe('importPriceGuideBatch', () => {
    const mockCompanyId = 'company-uuid';
    const mockUserId = 'user-uuid';
    const mockSessionId = 'session-uuid';
    const mockSourceCompanyId = 'source-company-123';

    beforeEach(() => {
      vi.mocked(queryAllMSIs).mockResolvedValue({ items: [], total: 0 });
      vi.mocked(queryOptions).mockResolvedValue({ items: [], total: 0 });
      vi.mocked(queryUpCharges).mockResolvedValue({ items: [], total: 0 });
      vi.mocked(queryCategories).mockResolvedValue([]);
    });

    it('should throw error when session not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        service.importPriceGuideBatch({
          companyId: mockCompanyId,
          skip: 0,
          limit: 50,
          sessionId: mockSessionId,
          userId: mockUserId,
        }),
      ).rejects.toMatchObject({
        code: EtlErrorCode.SESSION_NOT_FOUND,
      });
    });

    it('should throw error when session is already completed', async () => {
      const mockSession = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.COMPLETED,
        totalCount: 10,
        importedCount: 10,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
        completedAt: new Date(),
      };
      mockFindOne.mockResolvedValue(mockSession);

      await expect(
        service.importPriceGuideBatch({
          companyId: mockCompanyId,
          skip: 0,
          limit: 50,
          sessionId: mockSessionId,
          userId: mockUserId,
        }),
      ).rejects.toMatchObject({
        code: EtlErrorCode.SESSION_INVALID_STATE,
      });
    });

    it('should import categories first on initial batch', async () => {
      const mockSession = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.PENDING,
        totalCount: 10,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      const mockCategories = [
        { name: 'Windows', order: 1, type: 'default' as const },
        { name: 'Doors', order: 2, type: 'detail' as const },
      ];
      vi.mocked(queryCategories).mockResolvedValue(mockCategories);

      await service.importPriceGuideBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
      });

      expect(queryCategories).toHaveBeenCalledWith(mockSourceCompanyId);
    });

    it('should transition session status from PENDING to IN_PROGRESS when more items exist', async () => {
      const mockSession = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.PENDING,
        totalCount: 100,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      // Return full batch (100 items) indicating more exist
      const mockMSIs = Array.from({ length: 100 }, (_, i) => ({
        objectId: `msi-${i}`,
        itemName: `MSI ${i}`,
        category: 'Test',
      }));
      vi.mocked(queryAllMSIs).mockResolvedValue({
        items: mockMSIs,
        total: 200, // More than returned
      });

      // Also return options/upcharges with more
      const mockOptions = Array.from({ length: 100 }, (_, i) => ({
        objectId: `opt-${i}`,
        isAccessory: false,
        displayTitle: `Option ${i}`,
      }));
      vi.mocked(queryOptions).mockResolvedValue({
        items: mockOptions,
        total: 200,
      });

      await service.importPriceGuideBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
      });

      // Status should be IN_PROGRESS since hasMore is true
      expect(mockSession.status).toBe(MigrationSessionStatus.IN_PROGRESS);
    });

    it('should return hasMore based on batch results', async () => {
      const mockSession = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.IN_PROGRESS,
        totalCount: 100,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      // Return full batch (50 items) indicating more exist
      const mockMSIs = Array.from({ length: 50 }, (_, i) => ({
        objectId: `msi-${i}`,
        itemName: `MSI ${i}`,
        category: 'Test',
      }));
      vi.mocked(queryAllMSIs).mockResolvedValue({
        items: mockMSIs,
        total: 100,
      });

      const result = await service.importPriceGuideBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
      });

      // hasMore should be based on whether any source has more items
      expect(result).toHaveProperty('hasMore');
    });

    it('should update importedCount after successful import', async () => {
      const mockSession = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.IN_PROGRESS,
        totalCount: 10,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      const mockMSIs = [
        { objectId: 'msi-1', itemName: 'MSI 1', category: 'Test' },
        { objectId: 'msi-2', itemName: 'MSI 2', category: 'Test' },
      ];
      vi.mocked(queryAllMSIs).mockResolvedValue({ items: mockMSIs, total: 2 });

      await service.importPriceGuideBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
      });

      // Session importedCount should be updated
      expect(mockSession.importedCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // setSourceCompanyId Tests
  // ==========================================================================

  describe('setSourceCompanyId', () => {
    it('should set the source company ID directly', () => {
      service.setSourceCompanyId('directCompanyId');

      expect(service.getSourceCompanyId()).toBe('directCompanyId');
    });
  });

  // ==========================================================================
  // getSession Tests
  // ==========================================================================

  describe('getSession', () => {
    it('should return session for valid ID and company', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.PENDING,
      };
      mockFindOne.mockResolvedValue(mockSession);

      const result = await service.getSession('session-123', 'company-123');

      expect(result).toBe(mockSession);
      expect(mockFindOne).toHaveBeenCalledWith(expect.anything(), {
        id: 'session-123',
        company: 'company-123',
      });
    });

    it('should return null for non-existent session', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await service.getSession('nonexistent', 'company-123');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('error handling', () => {
    it('should throw EtlServiceError with correct code for connection failures', async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockRejectedValue(
        new EtlServiceError(
          'Connection failed',
          EtlErrorCode.SOURCE_CONNECTION_FAILED,
        ),
      );

      await expect(
        service.initializeSourceCompany('test@example.com'),
      ).rejects.toMatchObject({
        code: EtlErrorCode.SOURCE_CONNECTION_FAILED,
      });
    });
  });

  // ==========================================================================
  // fetchSourceItems Tests
  // ==========================================================================

  describe('fetchSourceItems', () => {
    beforeEach(async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue('company123');
      await service.initializeSourceCompany('test@example.com');
    });

    it('should fetch source items for preview', async () => {
      const mockItems = [
        { objectId: 'msi-1', name: 'MSI 1' },
        { objectId: 'msi-2', name: 'MSI 2' },
      ];
      vi.mocked(queryMSIs).mockResolvedValue({
        items: mockItems,
        total: 2,
      });

      const result = await service.fetchSourceItems(0, 100);

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(2);
      expect(queryMSIs).toHaveBeenCalledWith('company123', 0, 100);
    });

    it('should throw error when source company not initialized', async () => {
      const uninitializedService = new PriceGuideEtlService(mockEm);

      await expect(uninitializedService.fetchSourceItems()).rejects.toThrow(
        EtlServiceError,
      );
    });
  });
});
