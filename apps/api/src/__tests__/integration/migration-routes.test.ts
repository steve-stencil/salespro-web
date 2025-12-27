/**
 * Migration Routes Integration Tests
 *
 * Tests for migration API endpoints functionality:
 * - GET /:collection/source-count
 * - GET /:collection/source
 * - POST /:collection/imported-status
 * - POST /:collection/sessions
 * - GET /:collection/sessions/:id
 * - POST /:collection/sessions/:id/batch
 */

import { v4 as uuid } from 'uuid';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  beforeEach,
  vi,
} from 'vitest';

import {
  Office,
  MigrationSession,
  MigrationSessionStatus,
} from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
// Import mocked modules
import {
  countOffices,
  queryOffices,
  queryAllOffices,
  queryOfficesByIds,
} from '../../services/etl/queries/office.queries';
import { getSourceCompanyIdByEmail } from '../../services/etl/queries/user.queries';

import {
  makeRequest,
  waitForDatabase,
  createTestCompany,
  createUserWithPermissions,
  cleanupTestData,
} from './helpers';

import type { Company, User } from '../../entities';

describe('Migration Routes Integration Tests', () => {
  let company: Company;
  let user: User;
  let cookie: string;
  const mockSourceCompanyId = 'source-company-abc123';

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const orm = getORM();
    const em = orm.em.fork();

    // Create company and user with migration permission
    company = await createTestCompany(em, { name: 'Migration Test Company' });

    const result = await createUserWithPermissions(
      em,
      company,
      [PERMISSIONS.DATA_MIGRATION, 'office:read'],
      { email: `migration-test-${Date.now()}@example.com` },
    );
    user = result.user;
    cookie = result.cookie;

    // Setup default mocks
    vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue(mockSourceCompanyId);
    vi.mocked(countOffices).mockResolvedValue(5);
    vi.mocked(queryOffices).mockResolvedValue({
      items: [
        { objectId: 'office1', name: 'Office 1' },
        { objectId: 'office2', name: 'Office 2' },
      ],
      total: 5,
    });
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
    vi.mocked(queryOfficesByIds).mockResolvedValue([
      {
        objectId: 'office1',
        name: 'Office 1',
        sourceCompanyId: mockSourceCompanyId,
      },
    ]);
  });

  afterEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    await em.nativeDelete('migration_session', {});
    await cleanupTestData();
  });

  // ============================================================================
  // GET /:collection/source-count
  // ============================================================================

  describe('GET /migration/:collection/source-count', () => {
    it('should return source count for authenticated user', async () => {
      vi.mocked(countOffices).mockResolvedValue(42);

      const response = await makeRequest()
        .get('/api/migration/offices/source-count')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBe(42);
      expect(response.body.data.sourceCompanyId).toBe(mockSourceCompanyId);
    });

    it('should return 404 when user has no source company', async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue(null);

      const response = await makeRequest()
        .get('/api/migration/offices/source-count')
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Source company not found');
    });

    it('should call countOffices with correct source company ID', async () => {
      await makeRequest()
        .get('/api/migration/offices/source-count')
        .set('Cookie', cookie);

      expect(countOffices).toHaveBeenCalledWith(mockSourceCompanyId);
    });
  });

  // ============================================================================
  // GET /:collection/source
  // ============================================================================

  describe('GET /migration/:collection/source', () => {
    it('should return paginated source items', async () => {
      const mockItems = [
        { objectId: 'office1', name: 'Office 1' },
        { objectId: 'office2', name: 'Office 2' },
        { objectId: 'office3', name: 'Office 3' },
      ];
      vi.mocked(queryOffices).mockResolvedValue({
        items: mockItems,
        total: 10,
      });

      const response = await makeRequest()
        .get('/api/migration/offices/source')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.meta.total).toBe(10);
      expect(response.body.meta.skip).toBe(0);
      expect(response.body.meta.limit).toBe(100);
    });

    it('should respect skip and limit parameters', async () => {
      await makeRequest()
        .get('/api/migration/offices/source?skip=20&limit=50')
        .set('Cookie', cookie);

      expect(queryOffices).toHaveBeenCalledWith(mockSourceCompanyId, 20, 50);
    });

    it('should enforce max limit of 100', async () => {
      await makeRequest()
        .get('/api/migration/offices/source?limit=500')
        .set('Cookie', cookie);

      expect(queryOffices).toHaveBeenCalledWith(mockSourceCompanyId, 0, 100);
    });

    it('should return 404 when user has no source company', async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue(null);

      const response = await makeRequest()
        .get('/api/migration/offices/source')
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /:collection/imported-status
  // ============================================================================

  describe('POST /migration/:collection/imported-status', () => {
    it('should return imported source IDs', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create an office with sourceId to simulate imported data
      const importedOffice = em.create(Office, {
        id: uuid(),
        name: 'Imported Office',
        company,
        isActive: true,
        sourceId: 'office1',
      });
      em.persist(importedOffice);
      await em.flush();

      const response = await makeRequest()
        .post('/api/migration/offices/imported-status')
        .set('Cookie', cookie)
        .send({ sourceIds: ['office1', 'office2', 'office3'] });

      expect(response.status).toBe(200);
      expect(response.body.data.importedSourceIds).toContain('office1');
      expect(response.body.data.importedSourceIds).not.toContain('office2');
    });

    it('should return empty array for no matches', async () => {
      const response = await makeRequest()
        .post('/api/migration/offices/imported-status')
        .set('Cookie', cookie)
        .send({ sourceIds: ['nonexistent1', 'nonexistent2'] });

      expect(response.status).toBe(200);
      expect(response.body.data.importedSourceIds).toEqual([]);
    });

    it('should handle empty sourceIds array', async () => {
      const response = await makeRequest()
        .post('/api/migration/offices/imported-status')
        .set('Cookie', cookie)
        .send({ sourceIds: [] });

      expect(response.status).toBe(200);
      expect(response.body.data.importedSourceIds).toEqual([]);
    });

    it('should reject non-array sourceIds', async () => {
      const response = await makeRequest()
        .post('/api/migration/offices/imported-status')
        .set('Cookie', cookie)
        .send({ sourceIds: 'not-an-array' });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // POST /:collection/sessions
  // ============================================================================

  describe('POST /migration/:collection/sessions', () => {
    it('should create a new migration session', async () => {
      vi.mocked(countOffices).mockResolvedValue(15);

      const response = await makeRequest()
        .post('/api/migration/offices/sessions')
        .set('Cookie', cookie);

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.sourceCompanyId).toBe(mockSourceCompanyId);
      expect(response.body.data.totalCount).toBe(15);
      expect(response.body.data.importedCount).toBe(0);
    });

    it('should store source company ID in session', async () => {
      const response = await makeRequest()
        .post('/api/migration/offices/sessions')
        .set('Cookie', cookie);

      expect(response.status).toBe(201);

      const orm = getORM();
      const em = orm.em.fork();
      const session = await em.findOne(MigrationSession, {
        id: response.body.data.id,
      });

      expect(session).not.toBeNull();
      expect(session?.sourceCompanyId).toBe(mockSourceCompanyId);
    });

    it('should return 404 when user has no source company', async () => {
      vi.mocked(getSourceCompanyIdByEmail).mockResolvedValue(null);

      const response = await makeRequest()
        .post('/api/migration/offices/sessions')
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Source company not found');
    });
  });

  // ============================================================================
  // GET /:collection/sessions/:id
  // ============================================================================

  describe('GET /migration/:collection/sessions/:id', () => {
    it('should return session details', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const session = em.create(MigrationSession, {
        id: uuid(),
        company,
        createdBy: user,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.IN_PROGRESS,
        totalCount: 100,
        importedCount: 50,
        skippedCount: 10,
        errorCount: 2,
        errors: [{ sourceId: 'err1', error: 'Test error' }],
      });
      em.persist(session);
      await em.flush();

      const response = await makeRequest()
        .get(`/api/migration/offices/sessions/${session.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(session.id);
      expect(response.body.data.status).toBe('in_progress');
      expect(response.body.data.totalCount).toBe(100);
      expect(response.body.data.importedCount).toBe(50);
      expect(response.body.data.skippedCount).toBe(10);
      expect(response.body.data.errorCount).toBe(2);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await makeRequest()
        .get(`/api/migration/offices/sessions/${uuid()}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /:collection/sessions/:id/batch
  // ============================================================================

  describe('POST /migration/:collection/sessions/:id/batch', () => {
    let session: MigrationSession;

    beforeEach(async () => {
      const orm = getORM();
      const em = orm.em.fork();

      session = em.create(MigrationSession, {
        id: uuid(),
        company,
        createdBy: user,
        sourceCompanyId: mockSourceCompanyId,
        status: MigrationSessionStatus.PENDING,
        totalCount: 5,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      });
      em.persist(session);
      await em.flush();
    });

    it('should import batch with pagination', async () => {
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

      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${session.id}/batch`)
        .set('Cookie', cookie)
        .send({ skip: 0, limit: 50 });

      expect(response.status).toBe(200);
      expect(response.body.data.importedCount).toBe(2);
      expect(response.body.data.session.status).toBeDefined();
    });

    it('should import specific source IDs when provided', async () => {
      vi.mocked(queryOfficesByIds).mockResolvedValue([
        {
          objectId: 'office1',
          name: 'Office 1',
          sourceCompanyId: mockSourceCompanyId,
        },
      ]);

      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${session.id}/batch`)
        .set('Cookie', cookie)
        .send({ skip: 0, limit: 50, sourceIds: ['office1'] });

      expect(response.status).toBe(200);
      expect(queryOfficesByIds).toHaveBeenCalledWith(mockSourceCompanyId, [
        'office1',
      ]);
    });

    it('should skip already imported offices', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Pre-import an office
      const existingOffice = em.create(Office, {
        id: uuid(),
        name: 'Already Imported',
        company,
        isActive: true,
        sourceId: 'office1',
      });
      em.persist(existingOffice);
      await em.flush();

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

      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${session.id}/batch`)
        .set('Cookie', cookie)
        .send({ skip: 0, limit: 50 });

      expect(response.status).toBe(200);
      expect(response.body.data.importedCount).toBe(1);
      expect(response.body.data.skippedCount).toBe(1);
    });

    it('should update session status to in_progress on first batch', async () => {
      // Mock a full batch to indicate more items exist (hasMore will be true)
      // This prevents the session from being marked as completed
      const mockOffices = Array.from({ length: 50 }, (_, i) => ({
        objectId: `office${i + 1}`,
        name: `Office ${i + 1}`,
        sourceCompanyId: mockSourceCompanyId,
      }));
      vi.mocked(queryAllOffices).mockResolvedValue(mockOffices);

      await makeRequest()
        .post(`/api/migration/offices/sessions/${session.id}/batch`)
        .set('Cookie', cookie)
        .send({ skip: 0, limit: 50 });

      const orm = getORM();
      const em = orm.em.fork();
      const updatedSession = await em.findOne(MigrationSession, {
        id: session.id,
      });

      expect(updatedSession?.status).toBe(MigrationSessionStatus.IN_PROGRESS);
    });

    it('should mark session completed when all items processed', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Update session to have 2 total items
      session.totalCount = 2;
      em.persist(session);
      await em.flush();

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

      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${session.id}/batch`)
        .set('Cookie', cookie)
        .send({ skip: 0, limit: 50 });

      expect(response.status).toBe(200);
      expect(response.body.data.session.status).toBe('completed');
    });

    it('should reject completed session', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      session.status = MigrationSessionStatus.COMPLETED;
      session.completedAt = new Date();
      em.persist(session);
      await em.flush();

      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${session.id}/batch`)
        .set('Cookie', cookie)
        .send({ skip: 0, limit: 50 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Migration session already completed');
    });

    it('should validate batch schema', async () => {
      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${session.id}/batch`)
        .set('Cookie', cookie)
        .send({ skip: -1, limit: 50 }); // Invalid negative skip

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await makeRequest()
        .post(`/api/migration/offices/sessions/${uuid()}/batch`)
        .set('Cookie', cookie)
        .send({ skip: 0, limit: 50 });

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // Collection Validation Tests
  // ============================================================================

  describe('Collection Parameter Validation', () => {
    it('should reject unsupported collection names', async () => {
      const response = await makeRequest()
        .get('/api/migration/unsupported/source-count')
        .set('Cookie', cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid collection');
      expect(response.body.message).toContain('offices');
    });

    it('should accept valid collection name: offices', async () => {
      const response = await makeRequest()
        .get('/api/migration/offices/source-count')
        .set('Cookie', cookie);

      expect(response.status).not.toBe(400);
    });
  });
});
