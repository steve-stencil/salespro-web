/**
 * Integration tests for template filtering by office and document type.
 *
 * Tests the mobile template endpoints with filtering logic.
 */
import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

import {
  DocumentTemplate,
  DocumentTemplateCategory,
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
  expectUnauthorized,
  expectForbidden,
} from './helpers';

import type { CompanySetup, UserWithSession } from './auth-test-helpers';

describe('Template Filtering', () => {
  let setup: CompanySetup;
  let templateUser: UserWithSession;
  let noPermsUser: UserWithSession;

  beforeAll(async () => {
    setup = await createCompanySetup({ createOffice: true });
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up templates and related entities
    await em.nativeDelete(DocumentTemplate, { company: setup.company.id });
    await em.nativeDelete(DocumentType, { company: setup.company.id });
    await em.nativeDelete(DocumentTemplateCategory, {
      company: setup.company.id,
    });

    // Create users with specific permissions
    templateUser = await createUserWithPermissions(
      em,
      setup.company,
      [PERMISSIONS.TEMPLATE_READ],
      { email: `template-${Date.now()}@test.com` },
    );

    noPermsUser = await createUserWithPermissions(em, setup.company, [], {
      email: `noperms-${Date.now()}@test.com`,
    });
  });

  describe('GET /api/mobile/templates - Office Filtering', () => {
    it('should return templates assigned to specific office when officeIds provided', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create offices
      const office1 = await createTestOffice(em, setup.company, 'Office 1');
      const office2 = await createTestOffice(em, setup.company, 'Office 2');

      // Create category and type
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
        name: 'Contract',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);

      // Create templates:
      // - template1: assigned to office1
      // - template2: assigned to office2
      // - template3: no offices (unassigned)
      const template1 = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Office 1 Template',
        pageId: 'page1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA', 'TX'],
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
      template1.includedOffices.add(office1);
      em.persist(template1);

      const template2 = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Office 2 Template',
        pageId: 'page2',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 1,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
      template2.includedOffices.add(office2);
      em.persist(template2);

      const template3 = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Unassigned Template',
        pageId: 'page3',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 2,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
      // No offices assigned
      em.persist(template3);

      await em.flush();

      // Query for office1 - should get only template1
      const response1 = await makeRequest()
        .get(`/api/mobile/templates?officeIds=${office1.id}`)
        .set('Cookie', templateUser.cookie);

      expect(response1.status).toBe(200);
      expect(response1.body.templates).toHaveLength(1);
      expect(response1.body.templates[0].displayName).toBe('Office 1 Template');

      // Query for office2 - should get only template2
      const response2 = await makeRequest()
        .get(`/api/mobile/templates?officeIds=${office2.id}`)
        .set('Cookie', templateUser.cookie);

      expect(response2.status).toBe(200);
      expect(response2.body.templates).toHaveLength(1);
      expect(response2.body.templates[0].displayName).toBe('Office 2 Template');
    });

    it('should return templates assigned to multiple offices when officeIds contains multiple IDs', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const office1 = await createTestOffice(em, setup.company, 'Office 1');
      const office2 = await createTestOffice(em, setup.company, 'Office 2');

      const category = em.create(DocumentTemplateCategory, {
        id: uuid(),
        name: 'Category',
        sortOrder: 0,
        isImported: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(category);

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Contract',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);

      const template1 = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Office 1 Only',
        pageId: 'page1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
      template1.includedOffices.add(office1);
      em.persist(template1);

      const template2 = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Office 2 Only',
        pageId: 'page2',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 1,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
      template2.includedOffices.add(office2);
      em.persist(template2);

      await em.flush();

      // Query for both offices - should get both templates
      const response = await makeRequest()
        .get(`/api/mobile/templates?officeIds=${office1.id},${office2.id}`)
        .set('Cookie', templateUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.templates).toHaveLength(2);
    });

    it('should return templates with no offices assigned when officeIds is empty string', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const office = await createTestOffice(em, setup.company, 'Office 1');

      const category = em.create(DocumentTemplateCategory, {
        id: uuid(),
        name: 'Category',
        sortOrder: 0,
        isImported: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(category);

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Contract',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);

      // Template assigned to office
      const assignedTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Assigned Template',
        pageId: 'page1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
      assignedTemplate.includedOffices.add(office);
      em.persist(assignedTemplate);

      // Template not assigned to any office
      const unassignedTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Unassigned Template',
        pageId: 'page2',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 1,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
      em.persist(unassignedTemplate);

      await em.flush();

      // Query with empty officeIds - should get only unassigned template
      const response = await makeRequest()
        .get('/api/mobile/templates?officeIds=')
        .set('Cookie', templateUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.templates).toHaveLength(1);
      expect(response.body.templates[0].displayName).toBe(
        'Unassigned Template',
      );
    });

    it('should not filter by office when officeIds is not provided', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const office = await createTestOffice(em, setup.company, 'Office 1');

      const category = em.create(DocumentTemplateCategory, {
        id: uuid(),
        name: 'Category',
        sortOrder: 0,
        isImported: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(category);

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Contract',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);

      // Template assigned to office
      const assignedTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Assigned',
        pageId: 'page1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
      assignedTemplate.includedOffices.add(office);
      em.persist(assignedTemplate);

      // Template not assigned to any office
      const unassignedTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Unassigned',
        pageId: 'page2',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 1,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
      em.persist(unassignedTemplate);

      await em.flush();

      // Query without officeIds - should get all templates
      const response = await makeRequest()
        .get('/api/mobile/templates')
        .set('Cookie', templateUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.templates).toHaveLength(2);
    });
  });

  describe('GET /api/mobile/templates - Document Type Filtering', () => {
    it('should return templates filtered by document type IDs', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const category = em.create(DocumentTemplateCategory, {
        id: uuid(),
        name: 'Category',
        sortOrder: 0,
        isImported: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(category);

      const contractType = em.create(DocumentType, {
        id: uuid(),
        name: 'Contract',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(contractType);

      const proposalType = em.create(DocumentType, {
        id: uuid(),
        name: 'Proposal',
        sortOrder: 1,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(proposalType);

      const invoiceType = em.create(DocumentType, {
        id: uuid(),
        name: 'Invoice',
        sortOrder: 2,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(invoiceType);

      // Create contract template
      const contractTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Contract Template',
        pageId: 'contract1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
        documentType: contractType,
      });
      em.persist(contractTemplate);

      // Create proposal template
      const proposalTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Proposal Template',
        pageId: 'proposal1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
        documentType: proposalType,
      });
      em.persist(proposalTemplate);

      // Create invoice template
      const invoiceTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Invoice Template',
        pageId: 'invoice1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
        documentType: invoiceType,
      });
      em.persist(invoiceTemplate);

      await em.flush();

      // Filter by contract type only
      const response1 = await makeRequest()
        .get(`/api/mobile/templates?documentTypeIds=${contractType.id}`)
        .set('Cookie', templateUser.cookie);

      expect(response1.status).toBe(200);
      expect(response1.body.templates).toHaveLength(1);
      expect(response1.body.templates[0].displayName).toBe('Contract Template');

      // Filter by contract and proposal types
      const response2 = await makeRequest()
        .get(
          `/api/mobile/templates?documentTypeIds=${contractType.id},${proposalType.id}`,
        )
        .set('Cookie', templateUser.cookie);

      expect(response2.status).toBe(200);
      expect(response2.body.templates).toHaveLength(2);
    });

    it('should return error when documentTypeIds is empty', async () => {
      const response = await makeRequest()
        .get('/api/mobile/templates?documentTypeIds=')
        .set('Cookie', templateUser.cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('documentTypeIds cannot be empty');
    });

    it('should not filter by document type when documentTypeIds not provided', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const category = em.create(DocumentTemplateCategory, {
        id: uuid(),
        name: 'Category',
        sortOrder: 0,
        isImported: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(category);

      const type1 = em.create(DocumentType, {
        id: uuid(),
        name: 'Type 1',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(type1);

      const type2 = em.create(DocumentType, {
        id: uuid(),
        name: 'Type 2',
        sortOrder: 1,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(type2);

      const template1 = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Template 1',
        pageId: 'p1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
        documentType: type1,
      });
      em.persist(template1);

      const template2 = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Template 2',
        pageId: 'p2',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 1,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
        documentType: type2,
      });
      em.persist(template2);

      await em.flush();

      // Query without documentTypeIds - should get all templates
      const response = await makeRequest()
        .get('/api/mobile/templates')
        .set('Cookie', templateUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.templates).toHaveLength(2);
    });
  });

  describe('GET /api/mobile/templates - State Filtering', () => {
    it('should return templates included for a specific state', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const category = em.create(DocumentTemplateCategory, {
        id: uuid(),
        name: 'Category',
        sortOrder: 0,
        isImported: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(category);

      const docType = em.create(DocumentType, {
        id: uuid(),
        name: 'Contract',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(docType);

      // Template for California only
      const caTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'California Contract',
        pageId: 'ca1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
      em.persist(caTemplate);

      // Template for CA and TX
      const multiStateTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'CA/TX Contract',
        pageId: 'catx1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 1,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA', 'TX'],
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
      em.persist(multiStateTemplate);

      // Template with no states (not available anywhere)
      const noStateTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'No States Template',
        pageId: 'none1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 2,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: [], // Empty means no states
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
      em.persist(noStateTemplate);

      await em.flush();

      // Query for CA - should get CA-only and CA/TX templates
      const caResponse = await makeRequest()
        .get('/api/mobile/templates?state=CA')
        .set('Cookie', templateUser.cookie);

      expect(caResponse.status).toBe(200);
      expect(caResponse.body.templates).toHaveLength(2);

      // Query for TX - should only get CA/TX template
      const txResponse = await makeRequest()
        .get('/api/mobile/templates?state=TX')
        .set('Cookie', templateUser.cookie);

      expect(txResponse.status).toBe(200);
      expect(txResponse.body.templates).toHaveLength(1);
      expect(txResponse.body.templates[0].displayName).toBe('CA/TX Contract');

      // Query for NY - should get no templates
      const nyResponse = await makeRequest()
        .get('/api/mobile/templates?state=NY')
        .set('Cookie', templateUser.cookie);

      expect(nyResponse.status).toBe(200);
      expect(nyResponse.body.templates).toHaveLength(0);
    });
  });

  describe('GET /api/mobile/templates - Combined Filtering', () => {
    it('should combine office and type filtering', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const office = await createTestOffice(em, setup.company, 'Test Office');

      const category = em.create(DocumentTemplateCategory, {
        id: uuid(),
        name: 'Category',
        sortOrder: 0,
        isImported: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(category);

      const contractType = em.create(DocumentType, {
        id: uuid(),
        name: 'Contract',
        sortOrder: 0,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(contractType);

      const proposalType = em.create(DocumentType, {
        id: uuid(),
        name: 'Proposal',
        sortOrder: 1,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(proposalType);

      // Contract template in office
      const contractTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Contract in Office',
        pageId: 'contract1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
        documentType: contractType,
      });
      contractTemplate.includedOffices.add(office);
      em.persist(contractTemplate);

      // Proposal template in office
      const proposalTemplate = em.create(DocumentTemplate, {
        id: uuid(),
        displayName: 'Proposal in Office',
        pageId: 'proposal1',
        pageWidth: 612,
        pageHeight: 792,
        hMargin: 35,
        wMargin: 20,
        sortOrder: 0,
        canAddMultiplePages: false,
        isTemplate: false,
        includedStates: ['CA'],
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
        documentType: proposalType,
      });
      proposalTemplate.includedOffices.add(office);
      em.persist(proposalTemplate);

      await em.flush();

      // Query with office filter and contract type - should only get contract
      const response = await makeRequest()
        .get(
          `/api/mobile/templates?officeIds=${office.id}&documentTypeIds=${contractType.id}`,
        )
        .set('Cookie', templateUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.templates).toHaveLength(1);
      expect(response.body.templates[0].displayName).toBe('Contract in Office');
    });
  });

  describe('GET /api/mobile/templates/document-types', () => {
    it('should return document types assigned to specific office when officeIds provided', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const office = await createTestOffice(em, setup.company, 'Test Office');

      // Type in office
      const typeInOffice = em.create(DocumentType, {
        id: uuid(),
        name: 'In Office Type',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      typeInOffice.offices.add(office);
      em.persist(typeInOffice);

      // Type not in any office
      const typeNoOffice = em.create(DocumentType, {
        id: uuid(),
        name: 'No Office Type',
        sortOrder: 1,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(typeNoOffice);

      await em.flush();

      // Query with office filter - should only get typeInOffice
      const response = await makeRequest()
        .get(`/api/mobile/templates/document-types?officeIds=${office.id}`)
        .set('Cookie', templateUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.documentTypes).toHaveLength(1);
      expect(response.body.documentTypes[0].name).toBe('In Office Type');
    });

    it('should return document types with no offices when officeIds is empty', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const office = await createTestOffice(em, setup.company, 'Test Office');

      // Type in office
      const typeInOffice = em.create(DocumentType, {
        id: uuid(),
        name: 'In Office Type',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      typeInOffice.offices.add(office);
      em.persist(typeInOffice);

      // Type not in any office
      const typeNoOffice = em.create(DocumentType, {
        id: uuid(),
        name: 'No Office Type',
        sortOrder: 1,
        isDefault: true,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(typeNoOffice);

      await em.flush();

      // Query with empty officeIds - should only get typeNoOffice
      const response = await makeRequest()
        .get('/api/mobile/templates/document-types?officeIds=')
        .set('Cookie', templateUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.documentTypes).toHaveLength(1);
      expect(response.body.documentTypes[0].name).toBe('No Office Type');
    });

    it('should return all document types when no office filter', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const type1 = em.create(DocumentType, {
        id: uuid(),
        name: 'Type 1',
        sortOrder: 0,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(type1);

      const type2 = em.create(DocumentType, {
        id: uuid(),
        name: 'Type 2',
        sortOrder: 1,
        isDefault: false,
        company: em.getReference(Company, setup.company.id),
      });
      em.persist(type2);

      await em.flush();

      const response = await makeRequest()
        .get('/api/mobile/templates/document-types')
        .set('Cookie', templateUser.cookie);

      expect(response.status).toBe(200);
      expect(response.body.documentTypes).toHaveLength(2);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for templates list', async () => {
      const response = await makeRequest().get('/api/mobile/templates');

      expectUnauthorized(response);
    });

    it('should require TEMPLATE_READ permission', async () => {
      const response = await makeRequest()
        .get('/api/mobile/templates')
        .set('Cookie', noPermsUser.cookie);

      expectForbidden(response);
    });
  });
});
