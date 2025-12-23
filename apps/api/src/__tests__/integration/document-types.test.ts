/**
 * Integration tests for Document Types CRUD routes.
 *
 * Tests the /api/document-types endpoints for managing document types.
 */
import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

import {
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
  createTestOffice,
  expectForbidden,
  expectNotFound,
  expectUnauthorized,
} from './helpers';

import type { CompanySetup, UserWithSession } from './auth-test-helpers';

describe('Document Types Routes', () => {
  let setup: CompanySetup;
  let readUser: UserWithSession;
  let createUser: UserWithSession;
  let updateUser: UserWithSession;
  let deleteUser: UserWithSession;
  let noPermsUser: UserWithSession;

  beforeAll(async () => {
    // Create company setup with admin user
    setup = await createCompanySetup({ createOffice: true });
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up document types and templates between tests
    await em.nativeDelete(DocumentTemplate, {
      company: setup.company.id,
    });
    await em.nativeDelete(DocumentType, {
      company: setup.company.id,
    });
    await em.nativeDelete(DocumentTemplateCategory, {
      company: setup.company.id,
    });

    // Create users with specific permissions for testing
    readUser = await createUserWithPermissions(
      em,
      setup.company,
      [PERMISSIONS.DOCUMENT_TYPE_READ],
      { email: `read-${Date.now()}@test.com` },
    );

    createUser = await createUserWithPermissions(
      em,
      setup.company,
      [PERMISSIONS.DOCUMENT_TYPE_READ, PERMISSIONS.DOCUMENT_TYPE_CREATE],
      { email: `create-${Date.now()}@test.com` },
    );

    updateUser = await createUserWithPermissions(
      em,
      setup.company,
      [PERMISSIONS.DOCUMENT_TYPE_READ, PERMISSIONS.DOCUMENT_TYPE_UPDATE],
      { email: `update-${Date.now()}@test.com` },
    );

    deleteUser = await createUserWithPermissions(
      em,
      setup.company,
      [PERMISSIONS.DOCUMENT_TYPE_READ, PERMISSIONS.DOCUMENT_TYPE_DELETE],
      { email: `delete-${Date.now()}@test.com` },
    );

    noPermsUser = await createUserWithPermissions(em, setup.company, [], {
      email: `noperms-${Date.now()}@test.com`,
    });
  });

  describe('GET /api/document-types', () => {
    it('should list all document types for the company', async () => {
      // Create some document types
      const orm = getORM();
      const em = orm.em.fork();

      const docType1 = em.create(DocumentType, {
        id: uuid(),
        name: 'Contract',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      const docType2 = em.create(DocumentType, {
        id: uuid(),
        name: 'Proposal',
        sortOrder: 1,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist([docType1, docType2]);
      await em.flush();

      const response = await makeRequest()
        .get('/api/document-types')
        .set('Cookie', readUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Contract');
      expect(response.body.data[1].name).toBe('Proposal');
    });

    it('should filter document types by office', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create office
      const office = await createTestOffice(em, setup.company, 'Test Office');

      // Create doc types - one with office, one without (available to all)
      const docType1 = em.create(DocumentType, {
        id: uuid(),
        name: 'Office Specific',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      docType1.offices.add(office);

      const docType2 = em.create(DocumentType, {
        id: uuid(),
        name: 'All Offices',
        sortOrder: 1,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });

      em.persist([docType1, docType2]);
      await em.flush();

      // Filter by the office
      const response = await makeRequest()
        .get(`/api/document-types?officeId=${office.id}`)
        .set('Cookie', readUser.cookie);

      expect(response.status).toBe(200);
      // Should return both: specific one and the "all offices" one
      expect(response.body.data).toHaveLength(2);
    });

    it('should require authentication', async () => {
      const response = await makeRequest().get('/api/document-types');

      expectUnauthorized(response);
    });

    it('should require DOCUMENT_TYPE_READ permission', async () => {
      const response = await makeRequest()
        .get('/api/document-types')
        .set('Cookie', noPermsUser.cookie);

      expectForbidden(response);
    });
  });

  describe('GET /api/document-types/:id', () => {
    it('should get a specific document type', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Test Type',
        sortOrder: 5,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      const response = await makeRequest()
        .get(`/api/document-types/${docType.id}`)
        .set('Cookie', readUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(docType.id);
      expect(response.body.data.name).toBe('Test Type');
      expect(response.body.data.sortOrder).toBe(5);
      expect(response.body.data.isDefault).toBe(false);
    });

    it('should return 404 for non-existent document type', async () => {
      const response = await makeRequest()
        .get(`/api/document-types/${uuid()}`)
        .set('Cookie', readUser.cookie);

      expectNotFound(response, 'Document type not found');
    });

    it('should not return deleted document types', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Deleted Type',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
        deletedAt: new Date(),
      });
      em.persist(docType);
      await em.flush();

      const response = await makeRequest()
        .get(`/api/document-types/${docType.id}`)
        .set('Cookie', readUser.cookie);

      expectNotFound(response, 'Document type not found');
    });
  });

  describe('POST /api/document-types', () => {
    it('should create a new document type', async () => {
      const response = await makeRequest()
        .post('/api/document-types')
        .set('Cookie', createUser.cookie)
        .send({
          name: 'New Custom Type',
          sortOrder: 10,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('New Custom Type');
      expect(response.body.data.sortOrder).toBe(10);
      expect(response.body.data.isDefault).toBe(false);
      expect(response.body.data.id).toBeDefined();
    });

    it('should create document type with office assignments', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const office1 = await createTestOffice(em, setup.company, 'Office 1');
      const office2 = await createTestOffice(em, setup.company, 'Office 2');

      const response = await makeRequest()
        .post('/api/document-types')
        .set('Cookie', createUser.cookie)
        .send({
          name: 'Office Type',
          officeIds: [office1.id, office2.id],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.officeIds).toHaveLength(2);
      expect(response.body.data.officeIds).toContain(office1.id);
      expect(response.body.data.officeIds).toContain(office2.id);
    });

    it('should reject duplicate names', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const existing = em.create(DocumentType, {
        id: uuid(),
        name: 'Existing Type',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(existing);
      await em.flush();

      const response = await makeRequest()
        .post('/api/document-types')
        .set('Cookie', createUser.cookie)
        .send({ name: 'Existing Type' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Document type name already exists');
    });

    it('should validate required fields', async () => {
      const response = await makeRequest()
        .post('/api/document-types')
        .set('Cookie', createUser.cookie)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require DOCUMENT_TYPE_CREATE permission', async () => {
      const response = await makeRequest()
        .post('/api/document-types')
        .set('Cookie', readUser.cookie)
        .send({ name: 'Forbidden Type' });

      expectForbidden(response);
    });
  });

  describe('PATCH /api/document-types/:id', () => {
    it('should update document type name', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Original Name',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      const response = await makeRequest()
        .patch(`/api/document-types/${docType.id}`)
        .set('Cookie', updateUser.cookie)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should update document type sortOrder', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Sort Test',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      const response = await makeRequest()
        .patch(`/api/document-types/${docType.id}`)
        .set('Cookie', updateUser.cookie)
        .send({ sortOrder: 99 });

      expect(response.status).toBe(200);
      expect(response.body.data.sortOrder).toBe(99);
    });

    it('should update office assignments', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const office1 = await createTestOffice(em, setup.company, 'Office A');
      const office2 = await createTestOffice(em, setup.company, 'Office B');

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Office Update Test',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      docType.offices.add(office1);
      em.persist(docType);
      await em.flush();

      // Update to different office
      const response = await makeRequest()
        .patch(`/api/document-types/${docType.id}`)
        .set('Cookie', updateUser.cookie)
        .send({ officeIds: [office2.id] });

      expect(response.status).toBe(200);
      expect(response.body.data.officeIds).toHaveLength(1);
      expect(response.body.data.officeIds[0]).toBe(office2.id);
    });

    it('should reject duplicate name on update', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const docType1 = em.create(DocumentType, {
        id: uuid(),
        name: 'First Type',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      const docType2 = em.create(DocumentType, {
        id: uuid(),
        name: 'Second Type',
        sortOrder: 1,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist([docType1, docType2]);
      await em.flush();

      const response = await makeRequest()
        .patch(`/api/document-types/${docType2.id}`)
        .set('Cookie', updateUser.cookie)
        .send({ name: 'First Type' });

      expect(response.status).toBe(409);
    });

    it('should return 404 for non-existent document type', async () => {
      const response = await makeRequest()
        .patch(`/api/document-types/${uuid()}`)
        .set('Cookie', updateUser.cookie)
        .send({ name: 'Updated' });

      expectNotFound(response);
    });

    it('should require DOCUMENT_TYPE_UPDATE permission', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Perms Test',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      const response = await makeRequest()
        .patch(`/api/document-types/${docType.id}`)
        .set('Cookie', readUser.cookie)
        .send({ name: 'Should Fail' });

      expectForbidden(response);
    });
  });

  describe('DELETE /api/document-types/:id', () => {
    it('should soft delete a document type', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'To Delete',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      const response = await makeRequest()
        .delete(`/api/document-types/${docType.id}`)
        .set('Cookie', deleteUser.cookie);

      expect(response.status).toBe(204);

      // Verify it's soft deleted
      em.clear();
      const deleted = await em.findOne(DocumentType, { id: docType.id });
      expect(deleted?.deletedAt).toBeDefined();
    });

    it('should prevent deletion of default document types', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Default Type',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      const response = await makeRequest()
        .delete(`/api/document-types/${docType.id}`)
        .set('Cookie', deleteUser.cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot delete default document type');
    });

    it('should prevent deletion when templates are using the type', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create category first
      const category = em.create(DocumentTemplateCategory, {
        id: uuid(),
        name: 'Test Category',
        sortOrder: 0,
        isImported: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(category);

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Used Type',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);

      const template = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Test Template',
        pageId: 'singlePage',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: true,
        includedStates: ['ALL'],
        useWatermark: false,
        watermarkWidthPercent: 100,
        watermarkAlpha: 0.05,
        photosPerPage: 1,
        documentDataJson: [],
        hasUserInput: false,
        signatureFieldCount: 0,
        initialsFieldCount: 0,
        company: em.getReference(Company, setup.company.id),
        category,
        documentType: docType,
      });
      em.persist(template);
      await em.flush();

      const response = await makeRequest()
        .delete(`/api/document-types/${docType.id}`)
        .set('Cookie', deleteUser.cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Document type is in use');
      expect(response.body.templateCount).toBe(1);
    });

    it('should return 404 for non-existent document type', async () => {
      const response = await makeRequest()
        .delete(`/api/document-types/${uuid()}`)
        .set('Cookie', deleteUser.cookie);

      expectNotFound(response);
    });

    it('should require DOCUMENT_TYPE_DELETE permission', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Perms Delete Test',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);
      await em.flush();

      const response = await makeRequest()
        .delete(`/api/document-types/${docType.id}`)
        .set('Cookie', readUser.cookie);

      expectForbidden(response);
    });
  });
});
