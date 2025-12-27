/**
 * Office Queries Integration Tests
 *
 * Tests the actual MongoDB queries against an in-memory MongoDB instance.
 * These tests verify:
 * - Query syntax and operations work correctly
 * - Pointer format parsing and creation
 * - Pagination and sorting behavior
 * - Data transformation from MongoDB documents
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { closeSourceConnection } from '../queries/base';
import {
  queryOffices,
  countOffices,
  queryAllOffices,
  queryOfficeById,
  queryOfficesByIds,
} from '../queries/office.queries';

import { createMockMongoOfficeDoc } from './fixtures';
import {
  setupMongoTestDb,
  teardownMongoTestDb,
  clearTestDb,
  getTestCollection,
} from './mongo-test-helper';

// Test data constants
const TEST_COMPANY_ID = 'company123';
const OTHER_COMPANY_ID = 'otherCompany456';

describe('Office Queries Integration', () => {
  // Increase timeout for initial MongoDB binary download (first run only)
  beforeAll(async () => {
    await setupMongoTestDb();
  }, 60_000);

  afterAll(async () => {
    await teardownMongoTestDb();
  });

  beforeEach(async () => {
    // Clear data and reset connection between tests
    await clearTestDb();
    await closeSourceConnection();
  });

  describe('queryOffices', () => {
    it('should return offices for the specified company only', async () => {
      // Arrange: Insert offices for two different companies
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertMany([
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office1',
          name: 'Alpha Office',
        }),
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office2',
          name: 'Beta Office',
        }),
        createMockMongoOfficeDoc(OTHER_COMPANY_ID, {
          _id: 'office3',
          name: 'Other Company Office',
        }),
      ]);

      // Act
      const result = await queryOffices(TEST_COMPANY_ID);

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items.map(o => o.objectId)).toEqual(['office1', 'office2']);
    });

    it('should return offices sorted by name', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertMany([
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office1',
          name: 'Zeta Office',
        }),
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office2',
          name: 'Alpha Office',
        }),
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office3',
          name: 'Mango Office',
        }),
      ]);

      // Act
      const result = await queryOffices(TEST_COMPANY_ID);

      // Assert
      expect(result.items.map(o => o.name)).toEqual([
        'Alpha Office',
        'Mango Office',
        'Zeta Office',
      ]);
    });

    it('should support pagination with skip and limit', async () => {
      // Arrange: Insert 5 offices
      const officeCollection = getTestCollection('Office');
      const offices = Array.from({ length: 5 }, (_, i) =>
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: `office${i + 1}`,
          name: `Office ${String(i + 1).padStart(2, '0')}`,
        }),
      );
      await officeCollection.insertMany(offices);

      // Act: Get page 2 (skip 2, limit 2)
      const result = await queryOffices(TEST_COMPANY_ID, 2, 2);

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5); // Total count should be all offices
      expect(result.items.map(o => o.name)).toEqual(['Office 03', 'Office 04']);
    });

    it('should return "Unknown" for offices without a name', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertOne({
        _id: 'office-no-name',
        _p_company: `Company$${TEST_COMPANY_ID}`,
        _created_at: new Date(),
        _updated_at: new Date(),
        // No 'name' field
      });

      // Act
      const result = await queryOffices(TEST_COMPANY_ID);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Unknown');
    });

    it('should return empty results for non-existent company', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertOne(
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office1',
          name: 'Test',
        }),
      );

      // Act
      const result = await queryOffices('nonExistentCompany');

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('countOffices', () => {
    it('should return correct count for company', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertMany([
        createMockMongoOfficeDoc(TEST_COMPANY_ID, { _id: 'office1' }),
        createMockMongoOfficeDoc(TEST_COMPANY_ID, { _id: 'office2' }),
        createMockMongoOfficeDoc(TEST_COMPANY_ID, { _id: 'office3' }),
        createMockMongoOfficeDoc(OTHER_COMPANY_ID, { _id: 'office4' }),
      ]);

      // Act
      const count = await countOffices(TEST_COMPANY_ID);

      // Assert
      expect(count).toBe(3);
    });

    it('should return 0 for company with no offices', async () => {
      // Act
      const count = await countOffices(TEST_COMPANY_ID);

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('queryAllOffices', () => {
    it('should return full office documents with all fields', async () => {
      // Arrange
      const createdAt = new Date('2024-01-01T00:00:00.000Z');
      const updatedAt = new Date('2024-06-15T12:00:00.000Z');
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertOne(
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'full-office',
          name: 'Full Office',
          _created_at: createdAt,
          _updated_at: updatedAt,
        }),
      );

      // Act
      const offices = await queryAllOffices(TEST_COMPANY_ID, 0, 100);

      // Assert
      expect(offices).toHaveLength(1);
      const office = offices[0];
      expect(office).toEqual({
        objectId: 'full-office',
        name: 'Full Office',
        sourceCompanyId: TEST_COMPANY_ID,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    });

    it('should parse company pointer correctly', async () => {
      // Arrange: Use a realistic company ID (alphanumeric with dashes)
      const specialCompanyId = 'special-Company-123-XYZ';
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertOne(
        createMockMongoOfficeDoc(specialCompanyId, {
          _id: 'office1',
          name: 'Test',
        }),
      );

      // Act
      const offices = await queryAllOffices(specialCompanyId, 0, 100);

      // Assert
      expect(offices).toHaveLength(1);
      expect(offices[0]?.sourceCompanyId).toBe(specialCompanyId);
    });

    it('should sort by created_at ascending', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertMany([
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office3',
          name: 'Third',
          _created_at: new Date('2024-03-01'),
        }),
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office1',
          name: 'First',
          _created_at: new Date('2024-01-01'),
        }),
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office2',
          name: 'Second',
          _created_at: new Date('2024-02-01'),
        }),
      ]);

      // Act
      const offices = await queryAllOffices(TEST_COMPANY_ID, 0, 100);

      // Assert
      expect(offices.map(o => o.name)).toEqual(['First', 'Second', 'Third']);
    });

    it('should support pagination', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      const offices = Array.from({ length: 10 }, (_, i) =>
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: `office${i + 1}`,
          name: `Office ${i + 1}`,
          _created_at: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
        }),
      );
      await officeCollection.insertMany(offices);

      // Act: Get second batch
      const result = await queryAllOffices(TEST_COMPANY_ID, 5, 3);

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map(o => o.name)).toEqual([
        'Office 6',
        'Office 7',
        'Office 8',
      ]);
    });
  });

  describe('queryOfficeById', () => {
    it('should return office by ID', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertOne(
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'target-office',
          name: 'Target Office',
        }),
      );

      // Act
      const office = await queryOfficeById('target-office');

      // Assert
      expect(office).not.toBeNull();
      expect(office?.objectId).toBe('target-office');
      expect(office?.name).toBe('Target Office');
    });

    it('should return null for non-existent office', async () => {
      // Act
      const office = await queryOfficeById('does-not-exist');

      // Assert
      expect(office).toBeNull();
    });

    it('should return office regardless of company (no company filter)', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertOne(
        createMockMongoOfficeDoc(OTHER_COMPANY_ID, {
          _id: 'other-company-office',
          name: 'Other Company Office',
        }),
      );

      // Act
      const office = await queryOfficeById('other-company-office');

      // Assert
      expect(office).not.toBeNull();
      expect(office?.sourceCompanyId).toBe(OTHER_COMPANY_ID);
    });
  });

  describe('queryOfficesByIds', () => {
    it('should return offices matching the given IDs for the company', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertMany([
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office1',
          name: 'Office 1',
        }),
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office2',
          name: 'Office 2',
        }),
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office3',
          name: 'Office 3',
        }),
      ]);

      // Act
      const offices = await queryOfficesByIds(TEST_COMPANY_ID, [
        'office1',
        'office3',
      ]);

      // Assert
      expect(offices).toHaveLength(2);
      expect(offices.map(o => o.objectId).sort()).toEqual([
        'office1',
        'office3',
      ]);
    });

    it('should not return offices from other companies even if ID matches', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertMany([
        createMockMongoOfficeDoc(TEST_COMPANY_ID, {
          _id: 'office1',
          name: 'My Office',
        }),
        createMockMongoOfficeDoc(OTHER_COMPANY_ID, {
          _id: 'office2',
          name: 'Other Office',
        }),
      ]);

      // Act
      const offices = await queryOfficesByIds(TEST_COMPANY_ID, [
        'office1',
        'office2',
      ]);

      // Assert
      expect(offices).toHaveLength(1);
      expect(offices[0]?.objectId).toBe('office1');
    });

    it('should return empty array for empty ID list', async () => {
      // Act
      const offices = await queryOfficesByIds(TEST_COMPANY_ID, []);

      // Assert
      expect(offices).toEqual([]);
    });

    it('should return empty array when no IDs match', async () => {
      // Arrange
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertOne(
        createMockMongoOfficeDoc(TEST_COMPANY_ID, { _id: 'office1' }),
      );

      // Act
      const offices = await queryOfficesByIds(TEST_COMPANY_ID, [
        'nonexistent1',
        'nonexistent2',
      ]);

      // Assert
      expect(offices).toEqual([]);
    });
  });

  describe('Pointer format handling', () => {
    it('should correctly filter by company pointer format "Company$<id>"', async () => {
      // Arrange: Manually insert with exact pointer format
      const officeCollection = getTestCollection('Office');
      await officeCollection.insertMany([
        {
          _id: 'office1',
          name: 'Correct Format',
          _p_company: 'Company$correctId',
          _created_at: new Date(),
          _updated_at: new Date(),
        },
        {
          _id: 'office2',
          name: 'Wrong Format',
          _p_company: 'wrongId', // Missing "Company$" prefix
          _created_at: new Date(),
          _updated_at: new Date(),
        },
      ]);

      // Act
      const result = await queryOffices('correctId');

      // Assert: Should only find the correctly formatted one
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.objectId).toBe('office1');
    });
  });
});
