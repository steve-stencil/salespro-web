/**
 * Office Queries Tests
 *
 * Unit tests for the office query functions.
 * These tests mock the MongoDB collection to verify:
 * - Correct query filtering by company
 * - Pagination behavior
 * - Security through company scoping
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { EtlErrorCode, EtlServiceError } from '../../types';
import { getCollection } from '../base';
import {
  queryOffices,
  countOffices,
  queryAllOffices,
  queryOfficesByIds,
  queryOfficeById,
} from '../office.queries';

// Mock the base module
vi.mock('../base', () => ({
  getCollection: vi.fn(),
  createPointer: vi.fn((className: string, id: string) => `${className}$${id}`),
  parsePointer: vi.fn((pointer: string) => pointer.split('$')[1] ?? null),
}));

describe('Office Queries', () => {
  let mockCollection: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    countDocuments: ReturnType<typeof vi.fn>;
  };
  let mockCursor: {
    project: ReturnType<typeof vi.fn>;
    sort: ReturnType<typeof vi.fn>;
    skip: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    toArray: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock cursor chain
    mockCursor = {
      project: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    };

    // Setup mock collection
    mockCollection = {
      find: vi.fn().mockReturnValue(mockCursor),
      findOne: vi.fn().mockResolvedValue(null),
      countDocuments: vi.fn().mockResolvedValue(0),
    };

    vi.mocked(getCollection).mockResolvedValue(mockCollection as never);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // queryOffices Tests
  // ==========================================================================

  describe('queryOffices', () => {
    it('should filter by company pointer', async () => {
      const sourceCompanyId = 'company-123';
      mockCursor.toArray.mockResolvedValue([]);
      mockCollection.countDocuments.mockResolvedValue(0);

      await queryOffices(sourceCompanyId, 0, 100);

      expect(mockCollection.find).toHaveBeenCalledWith({
        _p_company: 'Company$company-123',
      });
    });

    it('should paginate correctly', async () => {
      const sourceCompanyId = 'company-123';
      mockCursor.toArray.mockResolvedValue([]);
      mockCollection.countDocuments.mockResolvedValue(0);

      await queryOffices(sourceCompanyId, 20, 50);

      expect(mockCursor.skip).toHaveBeenCalledWith(20);
      expect(mockCursor.limit).toHaveBeenCalledWith(50);
    });

    it('should return total count', async () => {
      const sourceCompanyId = 'company-123';
      mockCursor.toArray.mockResolvedValue([
        { _id: 'office1', name: 'Office 1' },
      ]);
      mockCollection.countDocuments.mockResolvedValue(42);

      const result = await queryOffices(sourceCompanyId, 0, 100);

      expect(result.total).toBe(42);
    });

    it('should transform documents correctly', async () => {
      const sourceCompanyId = 'company-123';
      mockCursor.toArray.mockResolvedValue([
        { _id: 'office1', name: 'Office One' },
        { _id: 'office2', name: 'Office Two' },
      ]);
      mockCollection.countDocuments.mockResolvedValue(2);

      const result = await queryOffices(sourceCompanyId, 0, 100);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        objectId: 'office1',
        name: 'Office One',
      });
      expect(result.items[1]).toEqual({
        objectId: 'office2',
        name: 'Office Two',
      });
    });

    it('should use default name when name is missing', async () => {
      const sourceCompanyId = 'company-123';
      mockCursor.toArray.mockResolvedValue([
        { _id: 'office1' }, // No name
      ]);
      mockCollection.countDocuments.mockResolvedValue(1);

      const result = await queryOffices(sourceCompanyId, 0, 100);

      expect(result.items[0]?.name).toBe('Unknown');
    });

    it('should throw EtlServiceError on query failure', async () => {
      const sourceCompanyId = 'company-123';
      mockCollection.find.mockImplementation(() => {
        throw new Error('Connection lost');
      });

      await expect(queryOffices(sourceCompanyId, 0, 100)).rejects.toThrow(
        EtlServiceError,
      );
      await expect(queryOffices(sourceCompanyId, 0, 100)).rejects.toMatchObject(
        {
          code: EtlErrorCode.SOURCE_QUERY_FAILED,
        },
      );
    });

    it('should sort by name', async () => {
      const sourceCompanyId = 'company-123';
      mockCursor.toArray.mockResolvedValue([]);
      mockCollection.countDocuments.mockResolvedValue(0);

      await queryOffices(sourceCompanyId, 0, 100);

      expect(mockCursor.sort).toHaveBeenCalledWith({ name: 1 });
    });

    it('should project only required fields', async () => {
      const sourceCompanyId = 'company-123';
      mockCursor.toArray.mockResolvedValue([]);
      mockCollection.countDocuments.mockResolvedValue(0);

      await queryOffices(sourceCompanyId, 0, 100);

      expect(mockCursor.project).toHaveBeenCalledWith({ _id: 1, name: 1 });
    });
  });

  // ==========================================================================
  // countOffices Tests
  // ==========================================================================

  describe('countOffices', () => {
    it('should return count scoped to company', async () => {
      const sourceCompanyId = 'company-456';
      mockCollection.countDocuments.mockResolvedValue(15);

      const result = await countOffices(sourceCompanyId);

      expect(result).toBe(15);
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        _p_company: 'Company$company-456',
      });
    });

    it('should throw EtlServiceError on count failure', async () => {
      const sourceCompanyId = 'company-123';
      mockCollection.countDocuments.mockRejectedValue(new Error('Timeout'));

      await expect(countOffices(sourceCompanyId)).rejects.toThrow(
        EtlServiceError,
      );
      await expect(countOffices(sourceCompanyId)).rejects.toMatchObject({
        code: EtlErrorCode.SOURCE_QUERY_FAILED,
      });
    });
  });

  // ==========================================================================
  // queryAllOffices Tests
  // ==========================================================================

  describe('queryAllOffices', () => {
    it('should filter by company pointer', async () => {
      const sourceCompanyId = 'company-789';
      mockCursor.toArray.mockResolvedValue([]);

      await queryAllOffices(sourceCompanyId, 0, 50);

      expect(mockCollection.find).toHaveBeenCalledWith({
        _p_company: 'Company$company-789',
      });
    });

    it('should return full document data for ETL', async () => {
      const sourceCompanyId = 'company-123';
      const now = new Date();
      mockCursor.toArray.mockResolvedValue([
        {
          _id: 'office1',
          name: 'Office One',
          _p_company: 'Company$company-123',
          _created_at: now,
          _updated_at: now,
        },
      ]);

      const result = await queryAllOffices(sourceCompanyId, 0, 50);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        objectId: 'office1',
        name: 'Office One',
        sourceCompanyId: 'company-123',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });

    it('should sort by created date', async () => {
      const sourceCompanyId = 'company-123';
      mockCursor.toArray.mockResolvedValue([]);

      await queryAllOffices(sourceCompanyId, 0, 50);

      expect(mockCursor.sort).toHaveBeenCalledWith({ _created_at: 1 });
    });
  });

  // ==========================================================================
  // queryOfficesByIds Tests
  // ==========================================================================

  describe('queryOfficesByIds', () => {
    it('should return only offices matching IDs AND company', async () => {
      const sourceCompanyId = 'company-123';
      mockCursor.toArray.mockResolvedValue([
        { _id: 'office1', name: 'Office 1', _p_company: 'Company$company-123' },
      ]);

      const result = await queryOfficesByIds(sourceCompanyId, [
        'office1',
        'office2',
      ]);

      expect(mockCollection.find).toHaveBeenCalledWith({
        _id: { $in: ['office1', 'office2'] },
        _p_company: 'Company$company-123',
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array for empty IDs input', async () => {
      const sourceCompanyId = 'company-123';

      const result = await queryOfficesByIds(sourceCompanyId, []);

      expect(result).toEqual([]);
      expect(mockCollection.find).not.toHaveBeenCalled();
    });

    it('should ignore IDs from different companies (security)', async () => {
      const sourceCompanyId = 'company-123';
      // MongoDB would filter out offices not belonging to company-123
      mockCursor.toArray.mockResolvedValue([]);

      const result = await queryOfficesByIds(sourceCompanyId, [
        'office-from-other-company',
      ]);

      // The query should include the company filter
      expect(mockCollection.find).toHaveBeenCalledWith(
        expect.objectContaining({
          _p_company: 'Company$company-123',
        }),
      );
      // Result should be empty since office doesn't belong to this company
      expect(result).toEqual([]);
    });

    it('should throw EtlServiceError on query failure', async () => {
      const sourceCompanyId = 'company-123';
      mockCollection.find.mockImplementation(() => {
        throw new Error('Query error');
      });

      await expect(
        queryOfficesByIds(sourceCompanyId, ['office1']),
      ).rejects.toThrow(EtlServiceError);
    });
  });

  // ==========================================================================
  // queryOfficeById Tests
  // ==========================================================================

  describe('queryOfficeById', () => {
    it('should return single office by ID', async () => {
      const now = new Date();
      mockCollection.findOne.mockResolvedValue({
        _id: 'office1',
        name: 'Office One',
        _p_company: 'Company$company-123',
        _created_at: now,
        _updated_at: now,
      });

      const result = await queryOfficeById('office1');

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: 'office1' });
      expect(result).toEqual({
        objectId: 'office1',
        name: 'Office One',
        sourceCompanyId: 'company-123',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });

    it('should return null for non-existent office', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await queryOfficeById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw EtlServiceError on query failure', async () => {
      mockCollection.findOne.mockRejectedValue(new Error('Find error'));

      await expect(queryOfficeById('office1')).rejects.toThrow(EtlServiceError);
      await expect(queryOfficeById('office1')).rejects.toMatchObject({
        code: EtlErrorCode.SOURCE_QUERY_FAILED,
      });
    });
  });

  // ==========================================================================
  // Security Tests
  // ==========================================================================

  describe('Security - Company Scoping', () => {
    it('should always include company filter in queryOffices', async () => {
      await queryOffices('any-company', 0, 100);

      const findCall = mockCollection.find.mock.calls[0];
      expect(findCall?.[0]).toHaveProperty('_p_company');
    });

    it('should always include company filter in queryAllOffices', async () => {
      await queryAllOffices('any-company', 0, 50);

      const findCall = mockCollection.find.mock.calls[0];
      expect(findCall?.[0]).toHaveProperty('_p_company');
    });

    it('should always include company filter in queryOfficesByIds', async () => {
      await queryOfficesByIds('any-company', ['id1']);

      const findCall = mockCollection.find.mock.calls[0];
      expect(findCall?.[0]).toHaveProperty('_p_company');
    });

    it('should always include company filter in countOffices', async () => {
      await countOffices('any-company');

      const countCall = mockCollection.countDocuments.mock.calls[0];
      expect(countCall?.[0]).toHaveProperty('_p_company');
    });
  });
});
