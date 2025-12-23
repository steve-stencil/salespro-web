/**
 * Integration tests for ETL Import routes.
 *
 * Tests the /api/etl endpoints for importing document templates.
 * These tests mock the ParseClient to avoid external dependencies.
 */
import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

import {
  ImportSession,
  ImportSessionStatus,
  DocumentType,
  Company,
} from '../../entities';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import {
  makeRequest,
  createCompanySetup,
  createUserWithPermissions,
  createTestOffice,
  expectForbidden,
  expectNotFound,
  expectUnauthorized,
} from './helpers';

import type { CompanySetup, UserWithSession } from './auth-test-helpers';

describe('ETL Import Routes', () => {
  let setup: CompanySetup;
  let etlUser: UserWithSession;
  let noPermsUser: UserWithSession;

  beforeAll(async () => {
    setup = await createCompanySetup({ createOffice: true });
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up import sessions and related entities
    await em.nativeDelete(ImportSession, { company: setup.company.id });
    await em.nativeDelete(DocumentType, { company: setup.company.id });

    // Create users with specific permissions
    etlUser = await createUserWithPermissions(
      em,
      setup.company,
      [PERMISSIONS.TEMPLATE_INGEST],
      { email: `etl-${Date.now()}@test.com` },
    );

    noPermsUser = await createUserWithPermissions(em, setup.company, [], {
      email: `noperms-${Date.now()}@test.com`,
    });
  });

  describe('GET /api/etl/local-offices', () => {
    it('should return local offices for the company', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create some offices
      await createTestOffice(em, setup.company, 'Office Alpha');
      await createTestOffice(em, setup.company, 'Office Beta');

      const response = await makeRequest()
        .get('/api/etl/local-offices')
        .set('Cookie', etlUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3); // 2 new + 1 from setup
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('isActive');
    });

    it('should require authentication', async () => {
      const response = await makeRequest().get('/api/etl/local-offices');

      expectUnauthorized(response);
    });

    it('should require TEMPLATE_INGEST permission', async () => {
      const response = await makeRequest()
        .get('/api/etl/local-offices')
        .set('Cookie', noPermsUser.cookie);

      expectForbidden(response);
    });
  });

  describe('POST /api/etl/import-sessions', () => {
    it('should create a new import session', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a document type to map to
      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Contract',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      const response = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', etlUser.cookie)
        .send({
          officeMapping: { sourceOffice1: 'create' },
          typeMapping: { contract: docType.id },
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe(ImportSessionStatus.PENDING);
      expect(response.body.data.officeMapping).toEqual({
        sourceOffice1: 'create',
      });
    });

    it('should reject invalid type mapping', async () => {
      const response = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', etlUser.cookie)
        .send({
          officeMapping: {},
          typeMapping: { contract: 'non-existent-id' },
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid office mapping', async () => {
      const response = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', etlUser.cookie)
        .send({
          officeMapping: { office1: 'non-existent-id' },
          typeMapping: {},
        });

      expect(response.status).toBe(400);
    });

    it('should accept "create" and "none" office mappings', async () => {
      const response = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', etlUser.cookie)
        .send({
          officeMapping: { office1: 'create', office2: 'none' },
          typeMapping: {},
        });

      expect(response.status).toBe(201);
    });

    it('should require TEMPLATE_INGEST permission', async () => {
      const response = await makeRequest()
        .post('/api/etl/import-sessions')
        .set('Cookie', noPermsUser.cookie)
        .send({
          officeMapping: {},
          typeMapping: {},
        });

      expectForbidden(response);
    });
  });

  describe('GET /api/etl/import-sessions/:id', () => {
    it('should return session status and progress', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const session = em.create(ImportSession, {
        id: uuid(),
        status: ImportSessionStatus.IN_PROGRESS,
        officeMapping: {},
        typeMapping: {},
        totalCount: 100,
        importedCount: 50,
        skippedCount: 5,
        errorCount: 2,
        errors: [],
        company: em.getReference(Company, setup.company.id),
        createdBy: em.getReference('User', etlUser.user.id),
      });
      em.persist(session);
      await em.flush();

      const response = await makeRequest()
        .get(`/api/etl/import-sessions/${session.id}`)
        .set('Cookie', etlUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(session.id);
      expect(response.body.data.status).toBe(ImportSessionStatus.IN_PROGRESS);
      expect(response.body.data.totalCount).toBe(100);
      expect(response.body.data.importedCount).toBe(50);
      expect(response.body.data.skippedCount).toBe(5);
      expect(response.body.data.errorCount).toBe(2);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await makeRequest()
        .get(`/api/etl/import-sessions/${uuid()}`)
        .set('Cookie', etlUser.cookie);

      expectNotFound(response, 'Import session not found');
    });

    it('should not return sessions from other companies', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create another company
      const otherCompany = em.create(Company, {
        id: uuid(),
        name: 'Other Company',
        isActive: true,
        mfaRequired: false,
        maxSessionsPerUser: 5,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
          historyCount: 3,
          maxAgeDays: 90,
        },
      });
      em.persist(otherCompany);

      const session = em.create(ImportSession, {
        id: uuid(),
        status: ImportSessionStatus.PENDING,
        officeMapping: {},
        typeMapping: {},
        totalCount: 10,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
        company: otherCompany,
        createdBy: em.getReference('User', etlUser.user.id),
      });
      em.persist(session);
      await em.flush();

      const response = await makeRequest()
        .get(`/api/etl/import-sessions/${session.id}`)
        .set('Cookie', etlUser.cookie);

      expectNotFound(response, 'Import session not found');
    });
  });

  describe('POST /api/etl/import-sessions/:id/batch', () => {
    it('should return 404 for non-existent session', async () => {
      const response = await makeRequest()
        .post(`/api/etl/import-sessions/${uuid()}/batch`)
        .set('Cookie', etlUser.cookie)
        .send({ skip: 0, limit: 10 });

      expectNotFound(response, 'Import session not found');
    });

    it('should reject batch import for completed session', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const session = em.create(ImportSession, {
        id: uuid(),
        status: ImportSessionStatus.COMPLETED,
        officeMapping: {},
        typeMapping: {},
        totalCount: 10,
        importedCount: 10,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
        company: em.getReference(Company, setup.company.id),
        createdBy: em.getReference('User', etlUser.user.id),
        completedAt: new Date(),
      });
      em.persist(session);
      await em.flush();

      const response = await makeRequest()
        .post(`/api/etl/import-sessions/${session.id}/batch`)
        .set('Cookie', etlUser.cookie)
        .send({ skip: 0, limit: 10 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Import session already completed');
    });

    it('should reject batch import for failed session', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const session = em.create(ImportSession, {
        id: uuid(),
        status: ImportSessionStatus.FAILED,
        officeMapping: {},
        typeMapping: {},
        totalCount: 10,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 10,
        errors: [],
        company: em.getReference(Company, setup.company.id),
        createdBy: em.getReference('User', etlUser.user.id),
      });
      em.persist(session);
      await em.flush();

      const response = await makeRequest()
        .post(`/api/etl/import-sessions/${session.id}/batch`)
        .set('Cookie', etlUser.cookie)
        .send({ skip: 0, limit: 10 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Import session has failed');
    });

    it('should validate batch parameters', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const session = em.create(ImportSession, {
        id: uuid(),
        status: ImportSessionStatus.PENDING,
        officeMapping: {},
        typeMapping: {},
        totalCount: 10,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
        company: em.getReference(Company, setup.company.id),
        createdBy: em.getReference('User', etlUser.user.id),
      });
      em.persist(session);
      await em.flush();

      const response = await makeRequest()
        .post(`/api/etl/import-sessions/${session.id}/batch`)
        .set('Cookie', etlUser.cookie)
        .send({ skip: -1, limit: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require TEMPLATE_INGEST permission', async () => {
      const response = await makeRequest()
        .post(`/api/etl/import-sessions/${uuid()}/batch`)
        .set('Cookie', noPermsUser.cookie)
        .send({ skip: 0, limit: 10 });

      expectForbidden(response);
    });
  });
});
