import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import {
  createTestOption,
  createTestUpCharge,
  createDefaultPriceTypesWithOffice,
  createTestOptionPrice,
  createTestUpChargePrice,
  createTestPriceType,
} from '../factories/price-guide';

import {
  createCompanySetup,
  createTestOffice,
  createUserWithPermissions,
} from './auth-test-helpers';
import { makeRequest, getTestApp } from './helpers';

import type { CompanySetup } from './auth-test-helpers';
import type { Office } from '../../entities';
import type {
  PriceGuideOption,
  UpCharge,
  PriceObjectType,
} from '../../entities';
import type { EntityManager } from '@mikro-orm/core';

describe('Price Guide Pricing Routes', () => {
  let setup: CompanySetup;
  let office: Office;
  let em: EntityManager;
  let priceTypes: PriceObjectType[];
  let testOption: PriceGuideOption;
  let testUpCharge: UpCharge;

  beforeAll(() => {
    // Ensure test server is available
    getTestApp();
  });

  beforeEach(async () => {
    const orm = getORM();
    em = orm.em.fork();

    // Create company with office
    setup = await createCompanySetup({ createOffice: true });
    office = setup.office!;

    // Create price types and assign to office
    priceTypes = await createDefaultPriceTypesWithOffice(
      em,
      setup.company,
      office,
    );

    // Create test option with pricing
    testOption = await createTestOption(em, setup.company, {
      name: 'Test Window',
      brand: 'TestBrand',
      itemCode: 'WIN-001',
    });

    // Create test upcharge with pricing
    testUpCharge = await createTestUpCharge(em, setup.company, {
      name: 'Grilles',
      note: 'Decorative grilles',
    });

    // Add pricing for option
    for (const pt of priceTypes) {
      await createTestOptionPrice(em, testOption, office, pt, {
        amount: pt.sortOrder * 100,
      });
    }

    // Add default pricing for upcharge
    for (const pt of priceTypes) {
      await createTestUpChargePrice(em, testUpCharge, office, pt, {
        amount: pt.sortOrder * 50,
      });
    }
  });

  describe('GET /api/price-guide/pricing/options/:optionId', () => {
    it('should return option prices for all offices', async () => {
      const response = await makeRequest()
        .get(`/api/price-guide/pricing/options/${testOption.id}`)
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.option).toBeDefined();
      expect(response.body.option.id).toBe(testOption.id);
      expect(response.body.option.name).toBe('Test Window');
      // 4 price types created in setup
      expect(response.body.priceTypes.length).toBeGreaterThanOrEqual(4);
      expect(response.body.pricing).toHaveLength(1); // One office
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get(
        `/api/price-guide/pricing/options/${testOption.id}`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 without settings:read permission', async () => {
      const noPermsUser = await createUserWithPermissions(
        em,
        setup.company,
        [],
      );

      const response = await makeRequest()
        .get(`/api/price-guide/pricing/options/${testOption.id}`)
        .set('Cookie', noPermsUser.cookie);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent option', async () => {
      const response = await makeRequest()
        .get(
          '/api/price-guide/pricing/options/00000000-0000-0000-0000-000000000000',
        )
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/price-guide/pricing/options/:optionId', () => {
    it('should update option prices for an office', async () => {
      const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;
      const laborType = priceTypes.find(pt => pt.code === 'LABOR')!;

      const response = await makeRequest()
        .put(`/api/price-guide/pricing/options/${testOption.id}`)
        .set('Cookie', setup.adminCookie)
        .send({
          officeId: office.id,
          prices: [
            { priceTypeId: materialType.id, amount: 500 },
            { priceTypeId: laborType.id, amount: 200 },
          ],
          version: testOption.version,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Prices updated successfully');

      // Verify prices were updated
      const getResponse = await makeRequest()
        .get(`/api/price-guide/pricing/options/${testOption.id}`)
        .set('Cookie', setup.adminCookie);

      const officeData = getResponse.body.pricing[0];
      expect(officeData.prices[materialType.id]).toBe(500);
      expect(officeData.prices[laborType.id]).toBe(200);
    });

    it('should return 409 on concurrent modification', async () => {
      const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;

      const response = await makeRequest()
        .put(`/api/price-guide/pricing/options/${testOption.id}`)
        .set('Cookie', setup.adminCookie)
        .send({
          officeId: office.id,
          prices: [{ priceTypeId: materialType.id, amount: 500 }],
          version: 999, // Wrong version
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('CONCURRENT_MODIFICATION');
    });

    it('should return 403 without settings:update permission', async () => {
      const readOnlyUser = await createUserWithPermissions(em, setup.company, [
        PERMISSIONS.SETTINGS_READ,
      ]);
      const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;

      const response = await makeRequest()
        .put(`/api/price-guide/pricing/options/${testOption.id}`)
        .set('Cookie', readOnlyUser.cookie)
        .send({
          officeId: office.id,
          prices: [{ priceTypeId: materialType.id, amount: 500 }],
          version: testOption.version,
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/price-guide/pricing/options/:optionId/bulk', () => {
    it('should update prices across all offices', async () => {
      // Create a second office (needed for bulk update to affect multiple offices)
      await createTestOffice(em, setup.company, 'Office 2');
      const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;

      const response = await makeRequest()
        .put(`/api/price-guide/pricing/options/${testOption.id}/bulk`)
        .set('Cookie', setup.adminCookie)
        .send({
          prices: [{ priceTypeId: materialType.id, amount: 999 }],
          version: testOption.version,
        });

      expect(response.status).toBe(200);
      expect(response.body.officesAffected).toBe(2);

      // Verify both offices have the new price
      const getResponse = await makeRequest()
        .get(`/api/price-guide/pricing/options/${testOption.id}`)
        .set('Cookie', setup.adminCookie);

      expect(getResponse.body.pricing).toHaveLength(2);
      for (const officeData of getResponse.body.pricing) {
        expect(officeData.prices[materialType.id]).toBe(999);
      }
    });
  });

  describe('GET /api/price-guide/pricing/upcharges/:upchargeId', () => {
    it('should return upcharge prices with defaults and overrides', async () => {
      const response = await makeRequest()
        .get(`/api/price-guide/pricing/upcharges/${testUpCharge.id}`)
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.upcharge).toBeDefined();
      expect(response.body.upcharge.id).toBe(testUpCharge.id);
      // 4 price types created in setup
      expect(response.body.priceTypes.length).toBeGreaterThanOrEqual(4);
      expect(response.body.defaultPricing).toHaveLength(1);
      expect(response.body.overridePricing).toHaveLength(0);
    });

    it('should return 404 for non-existent upcharge', async () => {
      const response = await makeRequest()
        .get(
          '/api/price-guide/pricing/upcharges/00000000-0000-0000-0000-000000000000',
        )
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/price-guide/pricing/upcharges/:upchargeId/defaults', () => {
    it('should update default upcharge prices', async () => {
      const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;

      const response = await makeRequest()
        .put(`/api/price-guide/pricing/upcharges/${testUpCharge.id}/defaults`)
        .set('Cookie', setup.adminCookie)
        .send({
          officeId: office.id,
          prices: [
            { priceTypeId: materialType.id, amount: 75, isPercentage: false },
          ],
          version: testUpCharge.version,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Default prices updated successfully');
    });

    it('should support percentage-based pricing', async () => {
      const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;
      const laborType = priceTypes.find(pt => pt.code === 'LABOR')!;

      const response = await makeRequest()
        .put(`/api/price-guide/pricing/upcharges/${testUpCharge.id}/defaults`)
        .set('Cookie', setup.adminCookie)
        .send({
          officeId: office.id,
          prices: [
            {
              priceTypeId: materialType.id,
              amount: 0.1, // 10%
              isPercentage: true,
              percentageBaseTypeIds: [materialType.id, laborType.id],
            },
          ],
          version: testUpCharge.version,
        });

      expect(response.status).toBe(200);
    });
  });

  describe('PUT /api/price-guide/pricing/upcharges/:upchargeId/overrides', () => {
    it('should create option-specific override prices', async () => {
      const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;

      const response = await makeRequest()
        .put(`/api/price-guide/pricing/upcharges/${testUpCharge.id}/overrides`)
        .set('Cookie', setup.adminCookie)
        .send({
          optionId: testOption.id,
          officeId: office.id,
          prices: [
            { priceTypeId: materialType.id, amount: 150, isPercentage: false },
          ],
          version: testUpCharge.version,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        'Override prices updated successfully',
      );

      // Verify override appears in GET response
      const getResponse = await makeRequest()
        .get(`/api/price-guide/pricing/upcharges/${testUpCharge.id}`)
        .set('Cookie', setup.adminCookie);

      expect(getResponse.body.overridePricing).toHaveLength(1);
      expect(getResponse.body.overridePricing[0].option.id).toBe(testOption.id);
    });
  });

  describe('DELETE /api/price-guide/pricing/upcharges/:upchargeId/overrides', () => {
    it('should delete override prices', async () => {
      // First create an override
      const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;
      await createTestUpChargePrice(em, testUpCharge, office, materialType, {
        option: testOption,
        amount: 150,
      });

      const response = await makeRequest()
        .delete(
          `/api/price-guide/pricing/upcharges/${testUpCharge.id}/overrides`,
        )
        .query({ optionId: testOption.id, officeId: office.id })
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        'Override prices deleted successfully',
      );
    });

    it('should return 404 if no overrides exist', async () => {
      const response = await makeRequest()
        .delete(
          `/api/price-guide/pricing/upcharges/${testUpCharge.id}/overrides`,
        )
        .query({
          optionId: '00000000-0000-0000-0000-000000000000',
          officeId: office.id,
        })
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('Price Types Routes', () => {
    describe('GET /api/price-guide/pricing/price-types', () => {
      it('should list all company price types with parentCode', async () => {
        const response = await makeRequest()
          .get('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        // 4 price types created in beforeEach
        expect(response.body.priceTypes).toHaveLength(4);
        // Check parentCode and parentLabel are present
        const materialType = response.body.priceTypes.find(
          (pt: { code: string }) => pt.code === 'MATERIAL',
        );
        expect(materialType).toBeDefined();
        expect(materialType.parentCode).toBe('MATERIAL');
        expect(materialType.parentLabel).toBe('Materials');
        expect(materialType.isActive).toBe(true);
      });

      it('should include enabledOfficeIds in response', async () => {
        const response = await makeRequest()
          .get('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        const materialType = response.body.priceTypes.find(
          (pt: { code: string }) => pt.code === 'MATERIAL',
        );
        expect(materialType.enabledOfficeIds).toContain(office.id);
        expect(materialType.officeCount).toBe(1);
        expect(materialType.totalOffices).toBe(1);
      });

      it('should return parentCodes list', async () => {
        const response = await makeRequest()
          .get('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.parentCodes).toBeDefined();
        expect(response.body.parentCodes).toHaveLength(5);
        expect(
          response.body.parentCodes.map((p: { code: string }) => p.code),
        ).toEqual(['MATERIAL', 'LABOR', 'MATERIAL_LABOR', 'TAX', 'OTHER']);
      });
    });

    describe('POST /api/price-guide/pricing/price-types', () => {
      it('should create a price type with required parentCode', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({
            code: 'CUSTOM',
            name: 'Custom Type',
            parentCode: 'OTHER',
            description: 'A custom price type',
          });

        expect(response.status).toBe(201);
        expect(response.body.priceType.code).toBe('CUSTOM');
        expect(response.body.priceType.name).toBe('Custom Type');
        expect(response.body.priceType.parentCode).toBe('OTHER');
        expect(response.body.priceType.parentLabel).toBe('Other');
      });

      it('should reject missing parentCode', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({
            code: 'NOTYPE',
            name: 'No Parent Code',
          });

        expect(response.status).toBe(400);
      });

      it('should reject invalid parentCode', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({
            code: 'BADTYPE',
            name: 'Bad Parent Code',
            parentCode: 'INVALID',
          });

        expect(response.status).toBe(400);
      });

      it('should reject duplicate code within company', async () => {
        // First create
        await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({ code: 'DUP', name: 'Duplicate', parentCode: 'OTHER' });

        // Second create with same code
        const response = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({
            code: 'DUP',
            name: 'Another Duplicate',
            parentCode: 'OTHER',
          });

        expect(response.status).toBe(409);
      });
    });

    describe('PUT /api/price-guide/pricing/price-types/:id', () => {
      it('should update price type name and parentCode', async () => {
        // Create a custom type first
        const createResponse = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({ code: 'EDIT', name: 'To Edit', parentCode: 'OTHER' });

        const typeId = createResponse.body.priceType.id;

        const response = await makeRequest()
          .put(`/api/price-guide/pricing/price-types/${typeId}`)
          .set('Cookie', setup.adminCookie)
          .send({ name: 'Edited Name', parentCode: 'LABOR' });

        expect(response.status).toBe(200);
        expect(response.body.priceType.name).toBe('Edited Name');
        expect(response.body.priceType.parentCode).toBe('LABOR');
      });
    });

    describe('DELETE /api/price-guide/pricing/price-types/:id', () => {
      it('should soft delete price type', async () => {
        // Create a custom type first
        const createResponse = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({ code: 'DEL', name: 'To Delete', parentCode: 'OTHER' });

        const typeId = createResponse.body.priceType.id;

        const response = await makeRequest()
          .delete(`/api/price-guide/pricing/price-types/${typeId}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);

        // Verify it no longer appears in list
        const listResponse = await makeRequest()
          .get('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie);

        const deletedType = listResponse.body.priceTypes.find(
          (pt: { id: string }) => pt.id === typeId,
        );
        expect(deletedType).toBeUndefined();
      });
    });

    describe('POST /api/price-guide/pricing/price-types/generate', () => {
      it('should generate default price types for offices', async () => {
        // Create a second office
        const office2 = await createTestOffice(em, setup.company, 'Office 2');

        const response = await makeRequest()
          .post('/api/price-guide/pricing/price-types/generate')
          .set('Cookie', setup.adminCookie)
          .send({
            parentCodes: ['MATERIAL_LABOR'],
            officeIds: [office.id, office2.id],
          });

        expect(response.status).toBe(201);
        expect(response.body.priceTypesCreated).toBe(1);
        expect(response.body.assignmentsCreated).toBe(2);
      });

      it('should skip existing price types but create missing assignments', async () => {
        // Create a second office
        const office2 = await createTestOffice(em, setup.company, 'Office 2');

        // MATERIAL already exists for office, so just create assignment for office2
        const response = await makeRequest()
          .post('/api/price-guide/pricing/price-types/generate')
          .set('Cookie', setup.adminCookie)
          .send({
            parentCodes: ['MATERIAL'],
            officeIds: [office.id, office2.id],
          });

        expect(response.status).toBe(201);
        // Type already exists, so 0 new types
        expect(response.body.priceTypesCreated).toBe(0);
        // Only office2 needs new assignment
        expect(response.body.assignmentsCreated).toBe(1);
      });
    });

    describe('Office Assignment Routes', () => {
      it('should assign price type to office', async () => {
        // Create a new price type without office assignment
        const pt = await createTestPriceType(em, setup.company, {
          code: 'ASSIGN_TEST',
          name: 'Assign Test',
          parentCode: 'OTHER',
        });

        const response = await makeRequest()
          .post(
            `/api/price-guide/pricing/price-types/${pt.id}/offices/${office.id}`,
          )
          .set('Cookie', setup.adminCookie)
          .send({});

        expect(response.status).toBe(201);
        expect(response.body.assignment.priceTypeId).toBe(pt.id);
        expect(response.body.assignment.officeId).toBe(office.id);
      });

      it('should remove price type from office', async () => {
        const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;

        const response = await makeRequest()
          .delete(
            `/api/price-guide/pricing/price-types/${materialType.id}/offices/${office.id}`,
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);

        // Verify enabledOfficeIds no longer includes office
        const listResponse = await makeRequest()
          .get('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie);

        const mt = listResponse.body.priceTypes.find(
          (pt: { code: string }) => pt.code === 'MATERIAL',
        );
        expect(mt.enabledOfficeIds).not.toContain(office.id);
        expect(mt.officeCount).toBe(0);
      });

      it('should return 404 when removing non-existent assignment', async () => {
        // Create price type but don't assign to office
        const pt = await createTestPriceType(em, setup.company, {
          code: 'UNASSIGNED',
          name: 'Unassigned',
          parentCode: 'OTHER',
        });

        const response = await makeRequest()
          .delete(
            `/api/price-guide/pricing/price-types/${pt.id}/offices/${office.id}`,
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });
    });
  });
});
