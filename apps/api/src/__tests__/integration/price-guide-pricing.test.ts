import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import {
  createTestOption,
  createTestUpCharge,
  createDefaultPriceTypes,
  createTestOptionPrice,
  createTestUpChargePrice,
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

    // Create price types
    priceTypes = await createDefaultPriceTypes(em);

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
      // At least 4 price types (global types)
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
      // At least 4 price types (global types)
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
      it('should list all price types', async () => {
        const response = await makeRequest()
          .get('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        // At least 4 global price types should exist
        expect(response.body.priceTypes.length).toBeGreaterThanOrEqual(4);
        // Check that we have the expected global types
        const globalTypes = response.body.priceTypes.filter(
          (pt: { isGlobal: boolean }) => pt.isGlobal,
        );
        expect(globalTypes.length).toBeGreaterThanOrEqual(4);
        expect(globalTypes[0].isEditable).toBe(false);
      });
    });

    describe('POST /api/price-guide/pricing/price-types', () => {
      it('should create a company-specific price type', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({
            code: 'CUSTOM',
            name: 'Custom Type',
            description: 'A custom price type',
          });

        expect(response.status).toBe(201);
        expect(response.body.priceType.code).toBe('CUSTOM');
        expect(response.body.priceType.name).toBe('Custom Type');
      });

      it('should reject duplicate code', async () => {
        // First create
        await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({ code: 'DUP', name: 'Duplicate' });

        // Second create with same code
        const response = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({ code: 'DUP', name: 'Another Duplicate' });

        expect(response.status).toBe(409);
      });

      it('should reject global type codes', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({ code: 'MATERIAL', name: 'My Material' });

        expect(response.status).toBe(409);
      });
    });

    describe('PUT /api/price-guide/pricing/price-types/:id', () => {
      it('should update company-specific price type', async () => {
        // Create a custom type first
        const createResponse = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({ code: 'EDIT', name: 'To Edit' });

        const typeId = createResponse.body.priceType.id;

        const response = await makeRequest()
          .put(`/api/price-guide/pricing/price-types/${typeId}`)
          .set('Cookie', setup.adminCookie)
          .send({ name: 'Edited Name' });

        expect(response.status).toBe(200);
        expect(response.body.priceType.name).toBe('Edited Name');
      });

      it('should reject editing global types', async () => {
        const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;

        const response = await makeRequest()
          .put(`/api/price-guide/pricing/price-types/${materialType.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ name: 'Hacked Materials' });

        expect(response.status).toBe(403);
      });
    });

    describe('DELETE /api/price-guide/pricing/price-types/:id', () => {
      it('should soft delete company-specific price type', async () => {
        // Create a custom type first
        const createResponse = await makeRequest()
          .post('/api/price-guide/pricing/price-types')
          .set('Cookie', setup.adminCookie)
          .send({ code: 'DEL', name: 'To Delete' });

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

      it('should reject deleting global types', async () => {
        const materialType = priceTypes.find(pt => pt.code === 'MATERIAL')!;

        const response = await makeRequest()
          .delete(`/api/price-guide/pricing/price-types/${materialType.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(403);
      });
    });
  });
});
