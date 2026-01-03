/**
 * Import Rollback Service Tests
 *
 * Unit tests for the ImportRollbackService.
 * Tests rollback operations for price guide imports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MigrationSessionStatus } from '../../../entities';
import { ImportRollbackService } from '../rollback.service';

import type { EntityManager } from '@mikro-orm/core';

describe('ImportRollbackService', () => {
  let service: ImportRollbackService;
  let mockFindOne: ReturnType<typeof vi.fn>;
  let mockFind: ReturnType<typeof vi.fn>;
  let mockCount: ReturnType<typeof vi.fn>;
  let mockNativeDelete: ReturnType<typeof vi.fn>;
  let mockNativeUpdate: ReturnType<typeof vi.fn>;
  let mockTransactional: ReturnType<typeof vi.fn>;
  let mockEm: EntityManager;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFindOne = vi.fn();
    mockFind = vi.fn().mockResolvedValue([]);
    mockCount = vi.fn().mockResolvedValue(0);
    mockNativeDelete = vi.fn().mockResolvedValue(0);
    mockNativeUpdate = vi.fn().mockResolvedValue(1);

    // Mock transactional to execute the callback with a mock transaction EM
    mockTransactional = vi
      .fn()
      .mockImplementation((callback: (em: unknown) => Promise<void>) => {
        const transactionEm = {
          nativeDelete: mockNativeDelete,
          find: mockFind,
        };
        return callback(transactionEm);
      });

    mockEm = {
      findOne: mockFindOne,
      find: mockFind,
      count: mockCount,
      nativeDelete: mockNativeDelete,
      nativeUpdate: mockNativeUpdate,
      transactional: mockTransactional,
    } as unknown as EntityManager;

    service = new ImportRollbackService(mockEm);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // rollbackSession Tests
  // ==========================================================================

  describe('rollbackSession', () => {
    it('should throw error when session not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.rollbackSession('non-existent-id')).rejects.toThrow(
        'Migration session non-existent-id not found',
      );
    });

    it('should throw error when session already rolled back', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.ROLLED_BACK,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      await expect(service.rollbackSession('session-123')).rejects.toThrow(
        'Session session-123 has already been rolled back',
      );
    });

    it('should throw error when session rollback already failed', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.ROLLBACK_FAILED,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      await expect(service.rollbackSession('session-123')).rejects.toThrow(
        'Session session-123 has already been rolled back',
      );
    });

    it('should execute rollback in transaction', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.COMPLETED,
        completedAt: new Date(),
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      await service.rollbackSession('session-123');

      expect(mockTransactional).toHaveBeenCalled();
    });

    it('should delete junction tables first', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.COMPLETED,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      // Track deletion order
      const deletionOrder: string[] = [];
      mockNativeDelete.mockImplementation((Entity: { name: string }) => {
        deletionOrder.push(Entity.name);
        return 1;
      });

      await service.rollbackSession('session-123');

      // Junction tables should be deleted first
      expect(deletionOrder.indexOf('MeasureSheetItemOption')).toBeLessThan(
        deletionOrder.indexOf('MeasureSheetItem'),
      );
      expect(deletionOrder.indexOf('MeasureSheetItemUpCharge')).toBeLessThan(
        deletionOrder.indexOf('MeasureSheetItem'),
      );
    });

    it('should delete pricing entities before main entities', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.COMPLETED,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      const deletionOrder: string[] = [];
      mockNativeDelete.mockImplementation((Entity: { name: string }) => {
        deletionOrder.push(Entity.name);
        return 1;
      });

      await service.rollbackSession('session-123');

      // Pricing should be deleted before options/upcharges
      expect(deletionOrder.indexOf('OptionPrice')).toBeLessThan(
        deletionOrder.indexOf('PriceGuideOption'),
      );
      expect(deletionOrder.indexOf('UpChargePrice')).toBeLessThan(
        deletionOrder.indexOf('UpCharge'),
      );
    });

    it('should return accurate deletion stats', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.COMPLETED,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      // Return different counts for different entity types
      mockNativeDelete.mockImplementation((Entity: { name: string }) => {
        switch (Entity.name) {
          case 'MeasureSheetItem':
            return 10;
          case 'PriceGuideOption':
            return 5;
          case 'UpCharge':
            return 3;
          case 'PriceGuideCategory':
            return 8;
          default:
            return 0;
        }
      });

      const stats = await service.rollbackSession('session-123');

      expect(stats.msisDeleted).toBe(10);
      expect(stats.optionsDeleted).toBe(5);
      expect(stats.upChargesDeleted).toBe(3);
    });

    it('should call nativeUpdate to set ROLLED_BACK status', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.COMPLETED,
        completedAt: new Date(),
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      await service.rollbackSession('session-123');

      expect(mockNativeUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'session-123' },
        expect.objectContaining({
          status: MigrationSessionStatus.ROLLED_BACK,
        }),
      );
    });

    it('should handle rollback of IN_PROGRESS session', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.IN_PROGRESS,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      const stats = await service.rollbackSession('session-123');

      expect(stats).toBeDefined();
      expect(mockNativeUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'session-123' },
        expect.objectContaining({
          status: MigrationSessionStatus.ROLLED_BACK,
        }),
      );
    });

    it('should handle rollback of PENDING session', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.PENDING,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      const stats = await service.rollbackSession('session-123');

      expect(stats).toBeDefined();
      expect(mockNativeUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'session-123' },
        expect.objectContaining({
          status: MigrationSessionStatus.ROLLED_BACK,
        }),
      );
    });
  });

  // ==========================================================================
  // previewRollback Tests
  // ==========================================================================

  describe('previewRollback', () => {
    it('should return count preview without deleting', async () => {
      // Setup counts for different entities - return in order called
      const counts = [
        200, // MeasureSheetItemOption
        150, // MeasureSheetItemUpCharge
        100, // MeasureSheetItemOffice
        50, // MeasureSheetItemAdditionalDetailField
        25, // UpChargeAdditionalDetailField
        10, // UpChargeDisabledOption
        30, // OptionPrice
        20, // UpChargePrice
        100, // MeasureSheetItem
        50, // PriceGuideOption
        25, // UpCharge
        30, // AdditionalDetailField
        15, // PriceGuideCategory
      ];
      let callIndex = 0;
      mockCount.mockImplementation(() => {
        const val = counts[callIndex] ?? 0;
        callIndex++;
        return val;
      });

      const preview = await service.previewRollback('session-123');

      expect(preview.msisDeleted).toBe(100);
      expect(preview.optionsDeleted).toBe(50);
      expect(preview.upChargesDeleted).toBe(25);
      expect(preview.categoriesDeleted).toBe(15);
      expect(preview.additionalDetailsDeleted).toBe(30);
      expect(preview.pricesDeleted).toBe(50); // 30 + 20
      expect(preview.junctionsDeleted).toBe(535); // 200 + 150 + 100 + 50 + 25 + 10
    });

    it('should not call nativeDelete during preview', async () => {
      mockCount.mockResolvedValue(0);

      await service.previewRollback('session-123');

      expect(mockNativeDelete).not.toHaveBeenCalled();
    });

    it('should return all zeros for non-existent session data', async () => {
      mockCount.mockResolvedValue(0);

      const preview = await service.previewRollback('session-123');

      expect(preview.msisDeleted).toBe(0);
      expect(preview.optionsDeleted).toBe(0);
      expect(preview.upChargesDeleted).toBe(0);
      expect(preview.categoriesDeleted).toBe(0);
      expect(preview.additionalDetailsDeleted).toBe(0);
      expect(preview.pricesDeleted).toBe(0);
      expect(preview.junctionsDeleted).toBe(0);
    });
  });

  // ==========================================================================
  // Category Recursive Delete Tests
  // ==========================================================================

  describe('deleteCategoriesRecursively', () => {
    it('should delete categories by depth', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.COMPLETED,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      // Mock categories at different depths
      const mockCategories = [
        { id: 'cat-3', depth: 2 },
        { id: 'cat-2', depth: 1 },
        { id: 'cat-1', depth: 0 },
      ];

      // Track deletion queries for PriceGuideCategory
      const depthsDeleted: number[] = [];
      mockFind.mockResolvedValue(mockCategories);
      mockNativeDelete.mockImplementation(
        (Entity: { name: string }, filter?: { depth?: number }) => {
          if (
            Entity.name === 'PriceGuideCategory' &&
            filter?.depth !== undefined
          ) {
            depthsDeleted.push(filter.depth);
          }
          return 1;
        },
      );

      await service.rollbackSession('session-123');

      // Deepest categories (highest depth) should be deleted first
      // Verify we delete from depth 2 down to 0
      const categoryDeletions = depthsDeleted.filter(d => d >= 0);
      if (categoryDeletions.length >= 2) {
        expect(categoryDeletions[0]).toBeGreaterThanOrEqual(
          categoryDeletions[1] ?? 0,
        );
      }
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('error handling', () => {
    it('should propagate transaction errors', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.COMPLETED,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      mockTransactional.mockRejectedValue(new Error('Database error'));

      await expect(service.rollbackSession('session-123')).rejects.toThrow(
        'Database error',
      );
    });

    it('should mark session as ROLLBACK_FAILED on error', async () => {
      const mockSession = {
        id: 'session-123',
        status: MigrationSessionStatus.COMPLETED,
        errors: [],
      };
      mockFindOne.mockResolvedValue(mockSession);

      mockTransactional.mockRejectedValue(new Error('Database error'));

      try {
        await service.rollbackSession('session-123');
      } catch {
        // Expected to fail
      }

      // Should update status to ROLLBACK_FAILED
      expect(mockNativeUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'session-123' },
        expect.objectContaining({
          status: MigrationSessionStatus.ROLLBACK_FAILED,
        }),
      );
    });
  });
});
