/**
 * User Queries Integration Tests
 *
 * Tests the actual MongoDB queries against an in-memory MongoDB instance.
 * These tests verify:
 * - User lookup by email works correctly
 * - Company pointer parsing from user documents
 * - Case-insensitive email matching
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { closeSourceConnection } from '../queries/base';
import { getSourceCompanyIdByEmail } from '../queries/user.queries';

import { createMockMongoUserDoc } from './fixtures';
import {
  setupMongoTestDb,
  teardownMongoTestDb,
  clearTestDb,
  getTestCollection,
} from './mongo-test-helper';

// Test data constants
const TEST_COMPANY_ID = 'company123';
const OTHER_COMPANY_ID = 'otherCompany456';

describe('User Queries Integration', () => {
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

  describe('getSourceCompanyIdByEmail', () => {
    it('should find user by email and return company ID', async () => {
      // Arrange
      const userCollection = getTestCollection('_User');
      await userCollection.insertOne(
        createMockMongoUserDoc(TEST_COMPANY_ID, {
          _id: 'user1',
          email: 'test@example.com',
          username: 'testuser',
        }),
      );

      // Act
      const companyId = await getSourceCompanyIdByEmail('test@example.com');

      // Assert
      expect(companyId).toBe(TEST_COMPANY_ID);
    });

    it('should find user by username (fallback for legacy systems)', async () => {
      // Arrange: User with email stored in username field
      const userCollection = getTestCollection('_User');
      await userCollection.insertOne(
        createMockMongoUserDoc(TEST_COMPANY_ID, {
          _id: 'user1',
          username: 'legacy@example.com',
          email: '', // Empty email field
        }),
      );

      // Act
      const companyId = await getSourceCompanyIdByEmail('legacy@example.com');

      // Assert
      expect(companyId).toBe(TEST_COMPANY_ID);
    });

    it('should perform case-insensitive email lookup', async () => {
      // Arrange
      const userCollection = getTestCollection('_User');
      await userCollection.insertOne(
        createMockMongoUserDoc(TEST_COMPANY_ID, {
          _id: 'user1',
          email: 'test@example.com', // lowercase
          username: 'testuser',
        }),
      );

      // Act: Search with different cases
      const result1 = await getSourceCompanyIdByEmail('TEST@EXAMPLE.COM');
      const result2 = await getSourceCompanyIdByEmail('Test@Example.Com');

      // Assert
      expect(result1).toBe(TEST_COMPANY_ID);
      expect(result2).toBe(TEST_COMPANY_ID);
    });

    it('should return null for non-existent user', async () => {
      // Arrange
      const userCollection = getTestCollection('_User');
      await userCollection.insertOne(
        createMockMongoUserDoc(TEST_COMPANY_ID, {
          email: 'existing@example.com',
        }),
      );

      // Act
      const companyId = await getSourceCompanyIdByEmail(
        'nonexistent@example.com',
      );

      // Assert
      expect(companyId).toBeNull();
    });

    it('should return null when user has no company pointer', async () => {
      // Arrange: User without company pointer
      const userCollection = getTestCollection('_User');
      await userCollection.insertOne({
        _id: 'user-no-company',
        email: 'nocompany@example.com',
        username: 'nocompany',
        // No _p_company field
      });

      // Act
      const companyId = await getSourceCompanyIdByEmail(
        'nocompany@example.com',
      );

      // Assert
      expect(companyId).toBeNull();
    });

    it('should return correct company when multiple users exist', async () => {
      // Arrange
      const userCollection = getTestCollection('_User');
      await userCollection.insertMany([
        createMockMongoUserDoc(TEST_COMPANY_ID, {
          _id: 'user1',
          email: 'user1@example.com',
        }),
        createMockMongoUserDoc(OTHER_COMPANY_ID, {
          _id: 'user2',
          email: 'user2@example.com',
        }),
      ]);

      // Act
      const companyId1 = await getSourceCompanyIdByEmail('user1@example.com');
      const companyId2 = await getSourceCompanyIdByEmail('user2@example.com');

      // Assert
      expect(companyId1).toBe(TEST_COMPANY_ID);
      expect(companyId2).toBe(OTHER_COMPANY_ID);
    });

    it('should parse company pointer correctly', async () => {
      // Arrange: Test the pointer format parsing
      const userCollection = getTestCollection('_User');
      await userCollection.insertOne({
        _id: 'user1',
        email: 'test@example.com',
        username: 'testuser',
        _p_company: 'Company$my-special-company-id',
      });

      // Act
      const companyId = await getSourceCompanyIdByEmail('test@example.com');

      // Assert
      expect(companyId).toBe('my-special-company-id');
    });

    it('should handle malformed company pointer gracefully', async () => {
      // Arrange: Invalid pointer format (missing $ separator)
      const userCollection = getTestCollection('_User');
      await userCollection.insertOne({
        _id: 'user1',
        email: 'badpointer@example.com',
        username: 'badpointer',
        _p_company: 'InvalidPointerFormat', // No $ separator
      });

      // Act
      const companyId = await getSourceCompanyIdByEmail(
        'badpointer@example.com',
      );

      // Assert: Should return null for malformed pointer
      expect(companyId).toBeNull();
    });

    it('should match email in both email and username fields with OR query', async () => {
      // Arrange: User where email matches username but not email field
      const userCollection = getTestCollection('_User');
      await userCollection.insertOne({
        _id: 'user1',
        email: 'different@domain.com',
        username: 'search@example.com', // Email stored in username
        _p_company: `Company$${TEST_COMPANY_ID}`,
      });

      // Act
      const companyId = await getSourceCompanyIdByEmail('search@example.com');

      // Assert
      expect(companyId).toBe(TEST_COMPANY_ID);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty email gracefully', async () => {
      // Act
      const companyId = await getSourceCompanyIdByEmail('');

      // Assert
      expect(companyId).toBeNull();
    });

    it('should handle special characters in email', async () => {
      // Arrange
      const userCollection = getTestCollection('_User');
      await userCollection.insertOne(
        createMockMongoUserDoc(TEST_COMPANY_ID, {
          _id: 'user1',
          email: 'user+tag@example.com',
          username: 'specialuser',
        }),
      );

      // Act
      const companyId = await getSourceCompanyIdByEmail('user+tag@example.com');

      // Assert
      expect(companyId).toBe(TEST_COMPANY_ID);
    });
  });
});
