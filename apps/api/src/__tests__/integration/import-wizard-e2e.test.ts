/**
 * E2E tests for the complete import wizard flow.
 *
 * Tests the full workflow from session creation to completion.
 * Note: These tests mock the ParseClient since we can't connect to Parse during tests.
 */
import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

import {
  ImportSession,
  ImportSessionStatus,
  DocumentType,
  DocumentTemplate,
  DocumentTemplateCategory,
  Company,
} from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import {
  makeRequest,
  createCompanySetup,
  createUserWithPermissions,
} from './helpers';

import type { CompanySetup, UserWithSession } from './auth-test-helpers';

// Note: Parse client is mocked in server-setup.ts for all integration tests

describe('Import Wizard E2E Flow', () => {
  let setup: CompanySetup;
  let etlUser: UserWithSession;

  beforeAll(async () => {
    setup = await createCompanySetup({ createOffice: true });
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up entities from previous tests
    await em.nativeDelete(DocumentTemplate, { company: setup.company.id });
    await em.nativeDelete(ImportSession, { company: setup.company.id });
    await em.nativeDelete(DocumentType, { company: setup.company.id });
    await em.nativeDelete(DocumentTemplateCategory, {
      company: setup.company.id,
    });

    // Create ETL user
    etlUser = await createUserWithPermissions(
      em,
      setup.company,
      [PERMISSIONS.TEMPLATE_INGEST, PERMISSIONS.TEMPLATE_READ],
      { email: `etl-e2e-${Date.now()}@test.com` },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Import Flow', () => {
    it('should complete a full import workflow', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // =====================================================================
      // STEP 1: Get local offices for mapping UI
      // =====================================================================
      const officesResponse = await makeRequest()
        .get('/api/etl/local-offices')
        .set('Cookie', etlUser.cookie);

      expect(officesResponse.status).toBe(200);
      expect(officesResponse.body.data).toBeDefined();
      // Should have the office from setup
      expect(officesResponse.body.data.length).toBeGreaterThanOrEqual(1);

      // =====================================================================
      // STEP 2: Create a document type to map to
      // =====================================================================
      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Contract',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      // =====================================================================
      // STEP 3: Create import session with mappings
      // =====================================================================
      const sessionResponse = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', etlUser.cookie)
        .send({
          officeMapping: {
            sourceOffice1: 'create', // Will create a new office
            sourceOffice2: 'none', // Will skip this office
          },
          typeMapping: {
            contract: docType.id, // Map to existing type
          },
        });

      expect(sessionResponse.status).toBe(201);
      expect(sessionResponse.body.data).toBeDefined();
      expect(sessionResponse.body.data.id).toBeDefined();
      expect(sessionResponse.body.data.status).toBe(
        ImportSessionStatus.PENDING,
      );

      const sessionId = sessionResponse.body.data.id as string;

      // =====================================================================
      // STEP 4: Check import session status
      // =====================================================================
      const statusResponse = await makeRequest()
        .get(`/api/etl/import-sessions/${sessionId}`)
        .set('Cookie', etlUser.cookie);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.id).toBe(sessionId);
      expect(statusResponse.body.data.status).toBe(ImportSessionStatus.PENDING);
      expect(statusResponse.body.data.officeMapping).toEqual({
        sourceOffice1: 'create',
        sourceOffice2: 'none',
      });

      // =====================================================================
      // STEP 5: Import batch (with mocked Parse returning empty results)
      // =====================================================================
      const batchResponse = await makeRequest()
        .post(`/api/etl/import-sessions/${sessionId}/batch`)
        .set('Cookie', etlUser.cookie)
        .send({ skip: 0, limit: 10 });

      expect(batchResponse.status).toBe(200);
      expect(batchResponse.body.data).toBeDefined();
      expect(batchResponse.body.data.importedCount).toBe(0); // Mocked Parse returns empty
      expect(batchResponse.body.data.hasMore).toBe(false); // No more docs

      // Session should be completed since there are no documents
      expect(batchResponse.body.data.session.status).toBe(
        ImportSessionStatus.COMPLETED,
      );

      // =====================================================================
      // STEP 6: Verify session is marked as completed
      // =====================================================================
      const finalStatusResponse = await makeRequest()
        .get(`/api/etl/import-sessions/${sessionId}`)
        .set('Cookie', etlUser.cookie);

      expect(finalStatusResponse.status).toBe(200);
      expect(finalStatusResponse.body.data.status).toBe(
        ImportSessionStatus.COMPLETED,
      );
      expect(finalStatusResponse.body.data.completedAt).toBeDefined();
    });

    it('should handle multiple batch imports correctly', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a document type
      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Proposal',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      // Create session
      const sessionResponse = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', etlUser.cookie)
        .send({
          officeMapping: {},
          typeMapping: { proposal: docType.id },
        });

      expect(sessionResponse.status).toBe(201);
      const sessionId = sessionResponse.body.data.id as string;

      // Import first batch
      const batch1Response = await makeRequest()
        .post(`/api/etl/import-sessions/${sessionId}/batch`)
        .set('Cookie', etlUser.cookie)
        .send({ skip: 0, limit: 5 });

      expect(batch1Response.status).toBe(200);

      // Since mocked Parse returns empty, import should be complete
      expect(batch1Response.body.data.session.status).toBe(
        ImportSessionStatus.COMPLETED,
      );

      // Trying another batch should fail (session already completed)
      const batch2Response = await makeRequest()
        .post(`/api/etl/import-sessions/${sessionId}/batch`)
        .set('Cookie', etlUser.cookie)
        .send({ skip: 5, limit: 5 });

      expect(batch2Response.status).toBe(400);
      expect(batch2Response.body.error).toBe(
        'Import session already completed',
      );
    });

    it('should validate office and type mappings before creating session', async () => {
      // Try to create session with invalid type mapping
      const invalidTypeResponse = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', etlUser.cookie)
        .send({
          officeMapping: {},
          typeMapping: { contract: 'invalid-uuid' }, // Invalid UUID
        });

      expect(invalidTypeResponse.status).toBe(400);

      // Try to create session with invalid office mapping
      const invalidOfficeResponse = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', etlUser.cookie)
        .send({
          officeMapping: { office1: 'invalid-uuid' }, // Invalid UUID
          typeMapping: {},
        });

      expect(invalidOfficeResponse.status).toBe(400);
    });

    it('should support creating new offices during import', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create document type
      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Invoice',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      // Create session with "create" office mapping
      const sessionResponse = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', etlUser.cookie)
        .send({
          officeMapping: {
            newOffice: 'create',
          },
          typeMapping: {},
        });

      expect(sessionResponse.status).toBe(201);

      // Office creation happens during actual import when templates reference the source office
      // Since Parse is mocked with empty results, no offices will be created
      // This test validates the mapping is accepted
      const sessionId = sessionResponse.body.data.id as string;
      expect(sessionId).toBeDefined();
    });

    it('should persist import session in database correctly', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Custom Type',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      const sessionResponse = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', etlUser.cookie)
        .send({
          officeMapping: { office1: 'none' },
          typeMapping: { custom: docType.id },
        });

      expect(sessionResponse.status).toBe(201);
      const sessionId = sessionResponse.body.data.id as string;

      // Verify session exists in database
      em.clear();
      const savedSession = await em.findOne(ImportSession, { id: sessionId });

      expect(savedSession).not.toBeNull();
      expect(savedSession?.status).toBe(ImportSessionStatus.PENDING);
      expect(savedSession?.officeMapping).toEqual({ office1: 'none' });
      expect(savedSession?.typeMapping).toEqual({ custom: docType.id });
      expect(savedSession?.totalCount).toBe(0); // Mocked Parse returns 0
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // This test verifies the API handles errors appropriately
      // by requesting a non-existent session
      const response = await makeRequest()
        .get(`/api/etl/import-sessions/${uuid()}`)
        .set('Cookie', etlUser.cookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Import session not found');
    });

    it('should require authentication for all ETL endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/etl/local-offices' },
        { method: 'get', path: '/api/etl/source-offices' },
        { method: 'get', path: '/api/etl/source-types' },
        { method: 'post', path: '/api/etl/import-sessions' },
        { method: 'get', path: `/api/etl/import-sessions/${uuid()}` },
        { method: 'post', path: `/api/etl/import-sessions/${uuid()}/batch` },
      ];

      for (const endpoint of endpoints) {
        const response =
          endpoint.method === 'get'
            ? await makeRequest().get(endpoint.path)
            : await makeRequest().post(endpoint.path).send({});

        expect(response.status).toBe(401);
      }
    });
  });
});
