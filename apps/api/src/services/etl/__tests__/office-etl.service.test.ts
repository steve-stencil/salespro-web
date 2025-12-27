/**
 * Office ETL Service Tests
 *
 * Unit tests for the OfficeEtlService.
 * These tests mock the MongoDB queries and database operations
 * to test the service logic in isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MigrationSessionStatus } from '../../../entities';
import { OfficeEtlService } from '../office-etl.service';
import {
  queryOffices,
  countOffices,
  queryAllOffices,
  queryOfficesByIds,
} from '../queries/office.queries';
import { getSourceCompanyIdByEmail } from '../queries/user.queries';
import { isSourceConfigured } from '../source-client';
import { EtlErrorCode, EtlServiceError } from '../types';

import type { EntityManager } from '@mikro-orm/core';

// Mock the query modules
vi.mock('../queries/office.queries', () => ({
  queryOffices: vi.fn(),
  countOffices: vi.fn(),
  queryAllOffices: vi.fn(),
  queryOfficesByIds: vi.fn(),
}));

vi.mock('../queries/user.queries', () => ({
  getSourceCompanyIdByEmail: vi.fn(),
}));

vi.mock('../source-client', () => ({
  isSourceConfigured: vi.fn(),
}));

describe('OfficeEtlService', () => {
  let service: OfficeEtlService;
  let mockFindOne: ReturnType<typeof vi.fn>;
  let mockFind: ReturnType<typeof vi.fn>;
  let mockGetReference: ReturnType<typeof vi.fn>;
  let mockPersist: ReturnType<typeof vi.fn>;
  let mockPersistAndFlush: ReturnType<typeof vi.fn>;
  let mockFlush: ReturnType<typeof vi.fn>;
  let mockRefresh: ReturnType<typeof vi.fn>;
  let mockEm: EntityManager;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock functions
    mockFindOne = vi.fn();
    mockFind = vi.fn().mockResolvedValue([]);
    mockGetReference = vi.fn().mockImplementation((_: unknown, id: string) => ({
      id,
    }));
    mockPersist = vi.fn();
    mockPersistAndFlush = vi.fn();
    mockFlush = vi.fn();
    mockRefresh = vi.fn();

    // Create mock EntityManager
    mockEm = {
      findOne: mockFindOne,
      find: mockFind,
      getReference: mockGetReference,
      persist: mockPersist,
      persistAndFlush: mockPersistAndFlush,
      flush: mockFlush,
      refresh: mockRefresh,
    } as unknown as EntityManager;

    service = new OfficeEtlService(mockEm);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

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

  describe('fetchSourceItems', () => {
    beforeEach(async () => {
      // Initialize source company first
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue('company123');
      await service.initializeSourceCompany('test@example.com');
    });

    it('should fetch and return source items', async () => {
      const mockItems = [
        { objectId: 'office1', name: 'Office 1' },
        { objectId: 'office2', name: 'Office 2' },
      ];
      vi.mocked(queryOffices).mockResolvedValue({
        items: mockItems,
        total: 2,
      });

      const result = await service.fetchSourceItems(0, 100);

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(2);
      expect(queryOffices).toHaveBeenCalledWith('company123', 0, 100);
    });

    it('should throw error when source company not initialized', async () => {
      // Create new service without initializing
      const uninitializedService = new OfficeEtlService(mockEm);

      await expect(uninitializedService.fetchSourceItems()).rejects.toThrow(
        EtlServiceError,
      );
    });
  });

  describe('getSourceCount', () => {
    beforeEach(async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue('company123');
      await service.initializeSourceCompany('test@example.com');
    });

    it('should return the count of source items', async () => {
      vi.mocked(countOffices).mockResolvedValue(42);

      const result = await service.getSourceCount();

      expect(result).toBe(42);
      expect(countOffices).toHaveBeenCalledWith('company123');
    });
  });

  describe('createSession', () => {
    const mockCompanyId = 'company-uuid';
    const mockUserId = 'user-uuid';

    beforeEach(async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue(
        'sourceCompany123',
      );
      vi.mocked(countOffices).mockResolvedValue(5);
      await service.initializeSourceCompany('test@example.com');

      // Mock company lookup
      mockFindOne.mockResolvedValue({ id: mockCompanyId });
    });

    it('should create a new migration session', async () => {
      mockPersistAndFlush.mockResolvedValue(undefined);

      const session = await service.createSession(mockCompanyId, mockUserId);

      expect(session).toBeDefined();
      expect(session.sourceCompanyId).toBe('sourceCompany123');
      expect(session.totalCount).toBe(5);
      expect(mockPersistAndFlush).toHaveBeenCalled();
    });

    it('should throw error when company not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        service.createSession(mockCompanyId, mockUserId),
      ).rejects.toThrow(EtlServiceError);
    });
  });

  describe('setSourceCompanyId', () => {
    it('should set the source company ID directly', () => {
      service.setSourceCompanyId('directCompanyId');

      expect(service.getSourceCompanyId()).toBe('directCompanyId');
    });
  });

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
  // getImportedSourceIds Tests
  // ==========================================================================

  describe('getImportedSourceIds', () => {
    it('should return Set of already-imported sourceIds', async () => {
      const mockOffices = [{ sourceId: 'office1' }, { sourceId: 'office3' }];
      mockFind.mockResolvedValue(mockOffices);

      const result = await service.getImportedSourceIds('company-id', [
        'office1',
        'office2',
        'office3',
      ]);

      expect(result).toBeInstanceOf(Set);
      expect(result.has('office1')).toBe(true);
      expect(result.has('office2')).toBe(false);
      expect(result.has('office3')).toBe(true);
    });

    it('should return empty Set for empty input', async () => {
      const result = await service.getImportedSourceIds('company-id', []);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
      expect(mockFind).not.toHaveBeenCalled();
    });

    it('should scope query by companyId', async () => {
      mockFind.mockResolvedValue([]);

      await service.getImportedSourceIds('specific-company-id', ['office1']);

      expect(mockFind).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          company: 'specific-company-id',
          sourceId: { $in: ['office1'] },
        }),
        expect.anything(),
      );
    });

    it('should filter out null sourceIds', async () => {
      const mockOffices = [
        { sourceId: 'office1' },
        { sourceId: null },
        { sourceId: 'office3' },
      ];
      mockFind.mockResolvedValue(mockOffices);

      const result = await service.getImportedSourceIds('company-id', [
        'office1',
        'office2',
        'office3',
      ]);

      expect(result.size).toBe(2);
      expect(result.has('office1')).toBe(true);
      expect(result.has('office3')).toBe(true);
    });
  });

  // ==========================================================================
  // importBatch Tests
  // ==========================================================================

  describe('importBatch', () => {
    const mockCompanyId = 'company-uuid';
    const mockUserId = 'user-uuid';
    const mockSessionId = 'session-uuid';
    const mockSourceCompanyId = 'source-company-123';

    beforeEach(() => {
      vi.mocked(queryAllOffices).mockResolvedValue([]);
      vi.mocked(queryOfficesByIds).mockResolvedValue([]);
    });

    it('should import new offices correctly', async () => {
      const mockSession = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.PENDING,
        totalCount: 5,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
      // First call returns session, subsequent calls return null (office doesn't exist)
      mockFindOne
        .mockResolvedValueOnce(mockSession) // Session lookup
        .mockResolvedValueOnce(null) // Office 1 doesn't exist
        .mockResolvedValueOnce(null); // Office 2 doesn't exist

      vi.mocked(queryAllOffices).mockResolvedValue([
        {
          objectId: 'office1',
          name: 'Office 1',
          sourceCompanyId: mockSourceCompanyId,
        },
        {
          objectId: 'office2',
          name: 'Office 2',
          sourceCompanyId: mockSourceCompanyId,
        },
      ]);

      const result = await service.importBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
      });

      expect(result.importedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(mockPersist).toHaveBeenCalledTimes(2);
      expect(mockFlush).toHaveBeenCalled();
    });

    it('should skip existing offices by sourceId + companyId', async () => {
      const mockSession = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.PENDING,
        totalCount: 5,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };

      // First call for session, second for existing office check
      mockFindOne
        .mockResolvedValueOnce(mockSession)
        .mockResolvedValueOnce({ id: 'existing-office', sourceId: 'office1' }) // exists
        .mockResolvedValueOnce(null); // doesn't exist

      vi.mocked(queryAllOffices).mockResolvedValue([
        {
          objectId: 'office1',
          name: 'Office 1',
          sourceCompanyId: mockSourceCompanyId,
        },
        {
          objectId: 'office2',
          name: 'Office 2',
          sourceCompanyId: mockSourceCompanyId,
        },
      ]);

      const result = await service.importBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
      });

      expect(result.importedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    it('should handle transform errors per-item', async () => {
      const mockSession = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.PENDING,
        totalCount: 5,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
      // First call returns session, subsequent calls return null (office doesn't exist)
      mockFindOne
        .mockResolvedValueOnce(mockSession) // Session lookup
        .mockResolvedValueOnce(null) // Office 1 doesn't exist
        .mockResolvedValueOnce(null); // Office 2 doesn't exist

      // Return one valid and one that will cause an error
      vi.mocked(queryAllOffices).mockResolvedValue([
        {
          objectId: 'office1',
          name: 'Office 1',
          sourceCompanyId: mockSourceCompanyId,
        },
        {
          objectId: 'office2',
          name: undefined,
          sourceCompanyId: mockSourceCompanyId,
        },
      ]);

      // Mock persist to throw on second call
      let persistCallCount = 0;
      mockPersist.mockImplementation(() => {
        persistCallCount++;
        if (persistCallCount === 2) {
          throw new Error('Validation error');
        }
      });

      const result = await service.importBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
      });

      expect(result.importedCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.sourceId).toBe('office2');
    });

    it('should use sourceIds when provided for selective import', async () => {
      const mockSession = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.PENDING,
        totalCount: 5,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      vi.mocked(queryOfficesByIds).mockResolvedValue([
        {
          objectId: 'office1',
          name: 'Office 1',
          sourceCompanyId: mockSourceCompanyId,
        },
      ]);

      await service.importBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
        sourceIds: ['office1'],
      });

      expect(queryOfficesByIds).toHaveBeenCalledWith(mockSourceCompanyId, [
        'office1',
      ]);
      expect(queryAllOffices).not.toHaveBeenCalled();
    });

    it('should throw error when session not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        service.importBatch({
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
        totalCount: 5,
        importedCount: 5,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      await expect(
        service.importBatch({
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
  });

  // ==========================================================================
  // Session State Transitions Tests
  // ==========================================================================

  describe('Session State Transitions', () => {
    const mockCompanyId = 'company-uuid';
    const mockUserId = 'user-uuid';
    const mockSessionId = 'session-uuid';
    const mockSourceCompanyId = 'source-company-123';

    it('should transition from PENDING to IN_PROGRESS on first batch', async () => {
      const mockSession = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.PENDING,
        totalCount: 100, // Large total to ensure we don't complete
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
      // First call returns session, subsequent calls return null (office doesn't exist)
      const mockOffices = Array.from({ length: 50 }, (_, i) => ({
        objectId: `office${i}`,
        name: `Office ${i}`,
        sourceCompanyId: mockSourceCompanyId,
      }));
      // Setup mock to return session first, then null for all office lookups
      mockFindOne.mockImplementation(
        (_entity: unknown, filter: Record<string, unknown> | undefined) => {
          if (filter?.['id'] === mockSessionId) {
            return mockSession;
          }
          return null; // Office doesn't exist
        },
      );

      // Return full batch (same size as limit) to indicate hasMore=true
      vi.mocked(queryAllOffices).mockResolvedValue(mockOffices);

      await service.importBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
      });

      // After first batch, status should still be IN_PROGRESS (not completed)
      expect(mockSession.status).toBe(MigrationSessionStatus.IN_PROGRESS);
    });

    it('should transition to COMPLETED when all items processed', async () => {
      const mockSession: {
        id: string;
        sourceCompanyId: string;
        status: MigrationSessionStatus;
        totalCount: number;
        importedCount: number;
        skippedCount: number;
        errorCount: number;
        errors: never[];
        completedAt?: Date;
      } = {
        id: mockSessionId,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.IN_PROGRESS,
        totalCount: 2,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
      // Setup mock to return session first, then null for all office lookups
      mockFindOne.mockImplementation(
        (_entity: unknown, filter: Record<string, unknown> | undefined) => {
          if (filter?.['id'] === mockSessionId) {
            return mockSession;
          }
          return null; // Office doesn't exist
        },
      );

      vi.mocked(queryAllOffices).mockResolvedValue([
        {
          objectId: 'office1',
          name: 'Office 1',
          sourceCompanyId: mockSourceCompanyId,
        },
        {
          objectId: 'office2',
          name: 'Office 2',
          sourceCompanyId: mockSourceCompanyId,
        },
      ]);

      await service.importBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
      });

      expect(mockSession.status).toBe(MigrationSessionStatus.COMPLETED);
      expect(mockSession.completedAt).toBeInstanceOf(Date);
    });

    it('should remain IN_PROGRESS when more items exist', async () => {
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
      // Setup mock to return session first, then null for all office lookups
      mockFindOne.mockImplementation(
        (_entity: unknown, filter: Record<string, unknown> | undefined) => {
          if (filter?.['id'] === mockSessionId) {
            return mockSession;
          }
          return null; // Office doesn't exist
        },
      );

      // Return full batch size indicating more items exist
      const mockOffices = Array.from({ length: 50 }, (_, i) => ({
        objectId: `office${i}`,
        name: `Office ${i}`,
        sourceCompanyId: mockSourceCompanyId,
      }));
      vi.mocked(queryAllOffices).mockResolvedValue(mockOffices);

      const result = await service.importBatch({
        companyId: mockCompanyId,
        skip: 0,
        limit: 50,
        sessionId: mockSessionId,
        userId: mockUserId,
      });

      expect(result.hasMore).toBe(true);
      expect(mockSession.status).toBe(MigrationSessionStatus.IN_PROGRESS);
    });

    it('should not allow import into COMPLETED session', async () => {
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
        service.importBatch({
          companyId: mockCompanyId,
          skip: 0,
          limit: 50,
          sessionId: mockSessionId,
          userId: mockUserId,
        }),
      ).rejects.toThrow('Migration session already completed');
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

    it('should scope by companyId for security', async () => {
      mockFindOne.mockResolvedValue(null);

      await service.getSession('session-123', 'company-456');

      expect(mockFindOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ company: 'company-456' }),
      );
    });
  });
});
