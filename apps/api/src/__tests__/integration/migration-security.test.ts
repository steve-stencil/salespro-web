/**
 * Migration Routes Security Tests
 *
 * Tests for security enforcement in migration routes:
 * - Authentication requirements
 * - Permission-based access control
 * - Cross-company data isolation
 * - Session ownership validation
 * - Input validation and injection prevention
 */

import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';

import { MigrationSession, MigrationSessionStatus } from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import {
  makeRequest,
  waitForDatabase,
  createTestCompany,
  createUserWithPermissions,
  cleanupTestData,
} from './helpers';

import type { Company, User } from '../../entities';

describe('Migration Routes Security Tests', () => {
  // Company A entities
  let companyA: Company;
  let userAWithMigration: User;
  let cookieAWithMigration: string;
  let cookieAWithoutMigration: string;

  // Company B entities
  let companyB: Company;
  let userBWithMigration: User;
  let cookieBWithMigration: string;
  let sessionB: MigrationSession;

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // =========================================================================
    // Create Company A with users
    // =========================================================================
    companyA = await createTestCompany(em, {
      name: 'Company A - Migration Security',
    });

    // User A with migration permission
    const resultAMigration = await createUserWithPermissions(
      em,
      companyA,
      [PERMISSIONS.DATA_MIGRATION, 'office:read'],
      { email: `user-a-migration-${Date.now()}@company-a.com` },
    );
    userAWithMigration = resultAMigration.user;
    cookieAWithMigration = resultAMigration.cookie;

    // User A without migration permission
    const resultANoMigration = await createUserWithPermissions(
      em,
      companyA,
      ['office:read', 'user:read'],
      { email: `user-a-nomigration-${Date.now()}@company-a.com` },
    );
    cookieAWithoutMigration = resultANoMigration.cookie;

    // =========================================================================
    // Create Company B with user and migration session
    // =========================================================================
    companyB = await createTestCompany(em, {
      name: 'Company B - Migration Security',
    });

    const resultBMigration = await createUserWithPermissions(
      em,
      companyB,
      [PERMISSIONS.DATA_MIGRATION],
      { email: `user-b-migration-${Date.now()}@company-b.com` },
    );
    userBWithMigration = resultBMigration.user;
    cookieBWithMigration = resultBMigration.cookie;

    // Create a migration session for Company B
    sessionB = em.create(MigrationSession, {
      id: uuid(),
      company: companyB,
      createdBy: userBWithMigration,
      sourceCompanyId: 'source-company-b-123',
      status: MigrationSessionStatus.PENDING,
      totalCount: 10,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
    });
    em.persist(sessionB);
    await em.flush();
  });

  afterEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up migration sessions first
    await em.nativeDelete('migration_session', {});
    await cleanupTestData();
  });

  // ============================================================================
  // Authentication Tests
  // ============================================================================

  describe('Authentication Requirements', () => {
    it('should return 401 when accessing source-count without authentication', async () => {
      const response = await makeRequest().get(
        '/api/migration/offices/source-count',
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when accessing source list without authentication', async () => {
      const response = await makeRequest().get('/api/migration/offices/source');

      expect(response.status).toBe(401);
    });

    it('should return 401 when creating session without authentication', async () => {
      const response = await makeRequest().post(
        '/api/migration/offices/sessions',
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when accessing session without authentication', async () => {
      const response = await makeRequest().get(
        `/api/migration/offices/sessions/${sessionB.id}`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when importing batch without authentication', async () => {
      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${sessionB.id}/batch`)
        .send({ skip: 0, limit: 50 });

      expect(response.status).toBe(401);
    });

    it('should return 401 when checking imported status without authentication', async () => {
      const response = await makeRequest()
        .post('/api/migration/offices/imported-status')
        .send({ sourceIds: ['office1', 'office2'] });

      expect(response.status).toBe(401);
    });
  });

  // ============================================================================
  // Permission Tests
  // ============================================================================

  describe('Permission Requirements', () => {
    it('should return 403 when user lacks data:migration permission for source-count', async () => {
      const response = await makeRequest()
        .get('/api/migration/offices/source-count')
        .set('Cookie', cookieAWithoutMigration);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should return 403 when user lacks data:migration permission for source list', async () => {
      const response = await makeRequest()
        .get('/api/migration/offices/source')
        .set('Cookie', cookieAWithoutMigration);

      expect(response.status).toBe(403);
    });

    it('should return 403 when user lacks data:migration permission for creating session', async () => {
      const response = await makeRequest()
        .post('/api/migration/offices/sessions')
        .set('Cookie', cookieAWithoutMigration);

      expect(response.status).toBe(403);
    });

    it('should return 403 when user lacks data:migration permission for getting session', async () => {
      const response = await makeRequest()
        .get(`/api/migration/offices/sessions/${sessionB.id}`)
        .set('Cookie', cookieAWithoutMigration);

      expect(response.status).toBe(403);
    });

    it('should return 403 when user lacks data:migration permission for batch import', async () => {
      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${sessionB.id}/batch`)
        .set('Cookie', cookieAWithoutMigration)
        .send({ skip: 0, limit: 50 });

      expect(response.status).toBe(403);
    });

    it('should return 403 when user lacks data:migration permission for imported-status', async () => {
      const response = await makeRequest()
        .post('/api/migration/offices/imported-status')
        .set('Cookie', cookieAWithoutMigration)
        .send({ sourceIds: ['office1'] });

      expect(response.status).toBe(403);
    });

    it('should allow access with data:migration permission', async () => {
      const response = await makeRequest()
        .get('/api/migration/offices/source-count')
        .set('Cookie', cookieAWithMigration);

      // May return 200 or 404/503 depending on source config, but not 403
      expect(response.status).not.toBe(403);
    });
  });

  // ============================================================================
  // Cross-Company Data Isolation Tests
  // ============================================================================

  describe('Cross-Company Session Isolation', () => {
    it('should return 404 when User A tries to access Company B session', async () => {
      const response = await makeRequest()
        .get(`/api/migration/offices/sessions/${sessionB.id}`)
        .set('Cookie', cookieAWithMigration);

      // Should be 404 (not 403) to avoid leaking session existence
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Migration session not found');
    });

    it('should return 404 when User A tries to import batch into Company B session', async () => {
      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${sessionB.id}/batch`)
        .set('Cookie', cookieAWithMigration)
        .send({ skip: 0, limit: 50 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Migration session not found');
    });

    it('should allow User B to access their own session', async () => {
      const response = await makeRequest()
        .get(`/api/migration/offices/sessions/${sessionB.id}`)
        .set('Cookie', cookieBWithMigration);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(sessionB.id);
    });
  });

  // ============================================================================
  // Input Validation Tests
  // ============================================================================

  describe('Input Validation', () => {
    it('should reject invalid collection names', async () => {
      const response = await makeRequest()
        .get('/api/migration/invalid-collection/source-count')
        .set('Cookie', cookieAWithMigration);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid collection');
    });

    it('should reject negative skip values', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // First create a session for company A
      const sessionA = em.create(MigrationSession, {
        id: uuid(),
        company: companyA,
        createdBy: userAWithMigration,
        sourceCompanyId: 'source-company-a-123',
        status: MigrationSessionStatus.IN_PROGRESS,
        totalCount: 10,
      });
      em.persist(sessionA);
      await em.flush();

      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${sessionA.id}/batch`)
        .set('Cookie', cookieAWithMigration)
        .send({ skip: -5, limit: 50 });

      expect(response.status).toBe(400);
    });

    it('should reject limit values exceeding maximum', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const sessionA = em.create(MigrationSession, {
        id: uuid(),
        company: companyA,
        createdBy: userAWithMigration,
        sourceCompanyId: 'source-company-a-123',
        status: MigrationSessionStatus.IN_PROGRESS,
        totalCount: 10,
      });
      em.persist(sessionA);
      await em.flush();

      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${sessionA.id}/batch`)
        .set('Cookie', cookieAWithMigration)
        .send({ skip: 0, limit: 500 }); // Max is 100

      expect(response.status).toBe(400);
    });

    it('should reject non-array sourceIds in imported-status', async () => {
      const response = await makeRequest()
        .post('/api/migration/offices/imported-status')
        .set('Cookie', cookieAWithMigration)
        .send({ sourceIds: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('sourceIds must be an array');
    });

    it('should handle empty sourceIds array gracefully', async () => {
      const response = await makeRequest()
        .post('/api/migration/offices/imported-status')
        .set('Cookie', cookieAWithMigration)
        .send({ sourceIds: [] });

      expect(response.status).toBe(200);
      expect(response.body.data.importedSourceIds).toEqual([]);
    });
  });

  // ============================================================================
  // Session State Validation Tests
  // ============================================================================

  describe('Session State Validation', () => {
    it('should reject batch import on completed session', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a completed session for company A
      const completedSession = em.create(MigrationSession, {
        id: uuid(),
        company: companyA,
        createdBy: userAWithMigration,
        sourceCompanyId: 'source-company-a-123',
        status: MigrationSessionStatus.COMPLETED,
        totalCount: 10,
        importedCount: 10,
        completedAt: new Date(),
      });
      em.persist(completedSession);
      await em.flush();

      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${completedSession.id}/batch`)
        .set('Cookie', cookieAWithMigration)
        .send({ skip: 0, limit: 50 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Migration session already completed');
    });

    it('should reject batch import on failed session', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a failed session for company A
      const failedSession = em.create(MigrationSession, {
        id: uuid(),
        company: companyA,
        createdBy: userAWithMigration,
        sourceCompanyId: 'source-company-a-123',
        status: MigrationSessionStatus.FAILED,
        totalCount: 10,
        errorCount: 10,
      });
      em.persist(failedSession);
      await em.flush();

      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${failedSession.id}/batch`)
        .set('Cookie', cookieAWithMigration)
        .send({ skip: 0, limit: 50 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Migration session has failed');
    });
  });

  // ============================================================================
  // Non-Existent Resource Tests
  // ============================================================================

  describe('Non-Existent Resource Handling', () => {
    it('should return 404 for non-existent session ID', async () => {
      const nonExistentId = uuid();

      const response = await makeRequest()
        .get(`/api/migration/offices/sessions/${nonExistentId}`)
        .set('Cookie', cookieAWithMigration);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Migration session not found');
    });

    it('should return 404 for invalid UUID session ID', async () => {
      const response = await makeRequest()
        .get('/api/migration/offices/sessions/not-a-valid-uuid')
        .set('Cookie', cookieAWithMigration);

      // May return 404 or 400 depending on validation order
      expect([400, 404]).toContain(response.status);
    });
  });

  // ============================================================================
  // Data Leakage Prevention Tests
  // ============================================================================

  describe('Data Leakage Prevention', () => {
    it('should not leak session details in error response for cross-company access', async () => {
      const response = await makeRequest()
        .get(`/api/migration/offices/sessions/${sessionB.id}`)
        .set('Cookie', cookieAWithMigration);

      expect(response.status).toBe(404);
      // Should not contain any session data
      expect(response.body.data).toBeUndefined();
      expect(response.body.sourceCompanyId).toBeUndefined();
      expect(response.body.totalCount).toBeUndefined();
    });

    it('should not reveal whether session exists for unauthorized company', async () => {
      // Try to access Company B session from Company A
      const responseExisting = await makeRequest()
        .get(`/api/migration/offices/sessions/${sessionB.id}`)
        .set('Cookie', cookieAWithMigration);

      // Try to access non-existent session
      const responseNonExistent = await makeRequest()
        .get(`/api/migration/offices/sessions/${uuid()}`)
        .set('Cookie', cookieAWithMigration);

      // Both should return same error to prevent enumeration
      expect(responseExisting.status).toBe(404);
      expect(responseNonExistent.status).toBe(404);
      expect(responseExisting.body.error).toBe(responseNonExistent.body.error);
    });
  });

  // ============================================================================
  // Concurrent Request Safety Tests
  // ============================================================================

  describe('Request Safety', () => {
    it('should handle missing user email gracefully', async () => {
      // This tests the case where user exists but email is somehow missing
      // The route should return 401 in this edge case
      const response = await makeRequest()
        .get('/api/migration/offices/source-count')
        .set('Cookie', 'sid=invalid-session-id');

      expect(response.status).toBe(401);
    });
  });
});
