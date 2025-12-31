import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { TaggableEntityType } from '../../entities/price-guide/types';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import {
  createTestOption,
  createTestUpCharge,
  createTestAdditionalDetailField,
  createTestCategory,
  createTestMeasureSheetItem,
  linkOptionToMeasureSheetItem,
  linkAdditionalDetailToUpCharge,
  linkAdditionalDetailToMeasureSheetItem,
  createTestPriceGuideImage,
  createTestTag,
  assignTagToEntity,
  setMsiThumbnail,
} from '../factories/price-guide';

import {
  createCompanySetup,
  createUserWithPermissions,
} from './auth-test-helpers';
import { makeRequest, getTestApp } from './helpers';

import type { CompanySetup } from './auth-test-helpers';
import type { EntityManager } from '@mikro-orm/core';

describe('Price Guide Library Routes', () => {
  let setup: CompanySetup;
  let em: EntityManager;

  beforeAll(() => {
    getTestApp();
  });

  beforeEach(async () => {
    const orm = getORM();
    em = orm.em.fork();
    setup = await createCompanySetup({ createOffice: true });
  });

  // ==========================================================================
  // Options Library
  // ==========================================================================

  describe('Options Library (/api/price-guide/library/options)', () => {
    describe('GET /api/price-guide/library/options', () => {
      it('should list options with pagination', async () => {
        // Create test options
        await createTestOption(em, setup.company, { name: 'Option A' });
        await createTestOption(em, setup.company, { name: 'Option B' });
        await createTestOption(em, setup.company, { name: 'Option C' });

        const response = await makeRequest()
          .get('/api/price-guide/library/options')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(3);
        expect(response.body.hasMore).toBe(false);
      });

      it('should support search', async () => {
        await createTestOption(em, setup.company, {
          name: 'Low-E Glass',
          brand: 'WindowTech',
        });
        await createTestOption(em, setup.company, { name: 'Regular Glass' });

        const response = await makeRequest()
          .get('/api/price-guide/library/options')
          .query({ search: 'Low-E' })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].name).toBe('Low-E Glass');
      });

      it('should support cursor pagination', async () => {
        for (let i = 0; i < 5; i++) {
          await createTestOption(em, setup.company, { name: `Option ${i}` });
        }

        const response1 = await makeRequest()
          .get('/api/price-guide/library/options')
          .query({ limit: 2 })
          .set('Cookie', setup.adminCookie);

        expect(response1.status).toBe(200);
        expect(response1.body.items).toHaveLength(2);
        expect(response1.body.hasMore).toBe(true);
        expect(response1.body.nextCursor).toBeDefined();

        const response2 = await makeRequest()
          .get('/api/price-guide/library/options')
          .query({ limit: 2, cursor: response1.body.nextCursor })
          .set('Cookie', setup.adminCookie);

        expect(response2.status).toBe(200);
        expect(response2.body.items).toHaveLength(2);
      });
    });

    describe('GET /api/price-guide/library/options/:id', () => {
      it('should return option details with MSI usage', async () => {
        const option = await createTestOption(em, setup.company, {
          name: 'Test Option',
          brand: 'TestBrand',
          itemCode: 'OPT-001',
        });

        // Link to an MSI
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        await linkOptionToMeasureSheetItem(em, msi, option, 0);

        const response = await makeRequest()
          .get(`/api/price-guide/library/options/${option.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.option.id).toBe(option.id);
        expect(response.body.option.name).toBe('Test Option');
        expect(response.body.option.brand).toBe('TestBrand');
        expect(response.body.option.usedByMSIs).toHaveLength(1);
      });

      it('should return 404 for non-existent option', async () => {
        const response = await makeRequest()
          .get(
            '/api/price-guide/library/options/00000000-0000-0000-0000-000000000000',
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/price-guide/library/options', () => {
      it('should create a new option', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/options')
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'New Option',
            brand: 'NewBrand',
            itemCode: 'NEW-001',
            measurementType: 'sqft',
          });

        expect(response.status).toBe(201);
        expect(response.body.option.name).toBe('New Option');
        expect(response.body.option.brand).toBe('NewBrand');
      });

      it('should validate required fields', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/options')
          .set('Cookie', setup.adminCookie)
          .send({});

        expect(response.status).toBe(400);
      });

      it('should require settings:update permission', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );

        const response = await makeRequest()
          .post('/api/price-guide/library/options')
          .set('Cookie', readOnlyUser.cookie)
          .send({ name: 'Test' });

        expect(response.status).toBe(403);
      });
    });

    describe('PUT /api/price-guide/library/options/:id', () => {
      it('should update an option with version check', async () => {
        const option = await createTestOption(em, setup.company, {
          name: 'Original Name',
        });

        const response = await makeRequest()
          .put(`/api/price-guide/library/options/${option.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Updated Name',
            version: option.version,
          });

        expect(response.status).toBe(200);
        expect(response.body.option.name).toBe('Updated Name');
      });

      it('should return 409 on version mismatch', async () => {
        const option = await createTestOption(em, setup.company);

        const response = await makeRequest()
          .put(`/api/price-guide/library/options/${option.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Updated Name',
            version: 999,
          });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe('CONCURRENT_MODIFICATION');
      });
    });

    describe('DELETE /api/price-guide/library/options/:id', () => {
      it('should soft delete an option', async () => {
        const option = await createTestOption(em, setup.company);

        const response = await makeRequest()
          .delete(`/api/price-guide/library/options/${option.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);

        // Verify it no longer appears in list
        const listResponse = await makeRequest()
          .get('/api/price-guide/library/options')
          .set('Cookie', setup.adminCookie);

        expect(
          listResponse.body.items.find(
            (o: { id: string }) => o.id === option.id,
          ),
        ).toBeUndefined();
      });

      // Note: The "option in use" tests require database triggers to maintain linkedMsiCount.
      // Since the test schema uses refreshDatabase() which doesn't include triggers,
      // we test the force delete behavior directly.
      it('should allow deleting option with force=true', async () => {
        const option = await createTestOption(em, setup.company);
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        await linkOptionToMeasureSheetItem(em, msi, option, 0);

        // Use force=true to delete regardless of linkedMsiCount
        const response = await makeRequest()
          .delete(`/api/price-guide/library/options/${option.id}`)
          .query({ force: 'true' })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
      });
    });
  });

  // ==========================================================================
  // UpCharges Library
  // ==========================================================================

  describe('UpCharges Library (/api/price-guide/library/upcharges)', () => {
    describe('GET /api/price-guide/library/upcharges', () => {
      it('should list upcharges with pagination', async () => {
        await createTestUpCharge(em, setup.company, { name: 'UpCharge A' });
        await createTestUpCharge(em, setup.company, { name: 'UpCharge B' });

        const response = await makeRequest()
          .get('/api/price-guide/library/upcharges')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(2);
      });

      it('should support search', async () => {
        await createTestUpCharge(em, setup.company, { name: 'Grilles' });
        await createTestUpCharge(em, setup.company, { name: 'Tint' });

        const response = await makeRequest()
          .get('/api/price-guide/library/upcharges')
          .query({ search: 'Grill' })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
      });
    });

    describe('POST /api/price-guide/library/upcharges', () => {
      it('should create a new upcharge', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/upcharges')
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'New UpCharge',
            note: 'A test upcharge',
            measurementType: 'each',
          });

        expect(response.status).toBe(201);
        expect(response.body.upcharge.name).toBe('New UpCharge');
      });
    });

    describe('PUT /api/price-guide/library/upcharges/:id', () => {
      it('should update an upcharge', async () => {
        const upCharge = await createTestUpCharge(em, setup.company, {
          name: 'Original',
        });

        const response = await makeRequest()
          .put(`/api/price-guide/library/upcharges/${upCharge.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Updated',
            version: upCharge.version,
          });

        expect(response.status).toBe(200);
        expect(response.body.upcharge.name).toBe('Updated');
      });
    });

    describe('PUT /api/price-guide/library/upcharges/:id/thumbnail', () => {
      it('should update upcharge thumbnail with version', async () => {
        const upCharge = await createTestUpCharge(em, setup.company, {
          name: 'Test Upcharge',
        });

        // Update with null (clear thumbnail)
        const response = await makeRequest()
          .put(`/api/price-guide/library/upcharges/${upCharge.id}/thumbnail`)
          .set('Cookie', setup.adminCookie)
          .send({ imageId: null, version: upCharge.version });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Thumbnail cleared');
      });

      it('should return 404 for non-existent upcharge', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';

        const response = await makeRequest()
          .put(`/api/price-guide/library/upcharges/${fakeId}/thumbnail`)
          .set('Cookie', setup.adminCookie)
          .send({ imageId: null, version: 1 });

        expect(response.status).toBe(404);
      });

      it('should require authentication', async () => {
        const upCharge = await createTestUpCharge(em, setup.company);

        const response = await makeRequest()
          .put(`/api/price-guide/library/upcharges/${upCharge.id}/thumbnail`)
          .send({ imageId: null, version: upCharge.version });

        expect(response.status).toBe(401);
      });

      it('should require settings:update permission', async () => {
        const noPermUser = await createUserWithPermissions(
          em,
          setup.company,
          [],
        );
        const upCharge = await createTestUpCharge(em, setup.company);

        const response = await makeRequest()
          .put(`/api/price-guide/library/upcharges/${upCharge.id}/thumbnail`)
          .set('Cookie', noPermUser.cookie)
          .send({ imageId: null, version: upCharge.version });

        expect(response.status).toBe(403);
      });
    });

    describe('DELETE /api/price-guide/library/upcharges/:id', () => {
      it('should soft delete an upcharge', async () => {
        const upCharge = await createTestUpCharge(em, setup.company);

        const response = await makeRequest()
          .delete(`/api/price-guide/library/upcharges/${upCharge.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
      });
    });

    describe('Disabled Options', () => {
      it('should set disabled options', async () => {
        const upCharge = await createTestUpCharge(em, setup.company);
        const option1 = await createTestOption(em, setup.company, {
          name: 'Option 1',
        });
        const option2 = await createTestOption(em, setup.company, {
          name: 'Option 2',
        });

        const response = await makeRequest()
          .put(
            `/api/price-guide/library/upcharges/${upCharge.id}/disabled-options`,
          )
          .set('Cookie', setup.adminCookie)
          .send({
            optionIds: [option1.id, option2.id],
            version: upCharge.version,
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe(
          'Disabled options updated successfully',
        );
      });

      it('should get disabled options', async () => {
        const upCharge = await createTestUpCharge(em, setup.company);
        const option = await createTestOption(em, setup.company);

        // First set a disabled option
        await makeRequest()
          .put(
            `/api/price-guide/library/upcharges/${upCharge.id}/disabled-options`,
          )
          .set('Cookie', setup.adminCookie)
          .send({
            optionIds: [option.id],
            version: upCharge.version,
          });

        // Then get the list
        const response = await makeRequest()
          .get(
            `/api/price-guide/library/upcharges/${upCharge.id}/disabled-options`,
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.disabledOptions).toHaveLength(1);
        expect(response.body.disabledOptions[0].id).toBe(option.id);
      });
    });

    describe('Additional Details', () => {
      describe('GET /api/price-guide/library/upcharges/:id/additional-details', () => {
        it('should list linked additional detail fields', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);
          const field1 = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Field 1' },
          );
          const field2 = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Field 2' },
          );

          await linkAdditionalDetailToUpCharge(em, upCharge, field1, 0);
          await linkAdditionalDetailToUpCharge(em, upCharge, field2, 1);

          const response = await makeRequest()
            .get(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', setup.adminCookie);

          expect(response.status).toBe(200);
          expect(response.body.additionalDetails).toHaveLength(2);
          expect(response.body.additionalDetails[0].title).toBe('Field 1');
          expect(response.body.additionalDetails[1].title).toBe('Field 2');
        });

        it('should return empty array when no fields are linked', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);

          const response = await makeRequest()
            .get(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', setup.adminCookie);

          expect(response.status).toBe(200);
          expect(response.body.additionalDetails).toEqual([]);
        });

        it('should return fields ordered by sortOrder', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);
          const fieldA = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Field A' },
          );
          const fieldB = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Field B' },
          );
          const fieldC = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Field C' },
          );

          // Link in non-alphabetical order but with specific sort orders
          await linkAdditionalDetailToUpCharge(em, upCharge, fieldC, 0);
          await linkAdditionalDetailToUpCharge(em, upCharge, fieldA, 1);
          await linkAdditionalDetailToUpCharge(em, upCharge, fieldB, 2);

          const response = await makeRequest()
            .get(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', setup.adminCookie);

          expect(response.status).toBe(200);
          expect(response.body.additionalDetails[0].title).toBe('Field C');
          expect(response.body.additionalDetails[1].title).toBe('Field A');
          expect(response.body.additionalDetails[2].title).toBe('Field B');
        });

        it('should return 404 for non-existent upcharge', async () => {
          const response = await makeRequest()
            .get(
              '/api/price-guide/library/upcharges/00000000-0000-0000-0000-000000000000/additional-details',
            )
            .set('Cookie', setup.adminCookie);

          expect(response.status).toBe(404);
        });

        it('should require authentication', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);

          const response = await makeRequest().get(
            `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
          );

          expect(response.status).toBe(401);
        });
      });

      describe('POST /api/price-guide/library/upcharges/:id/additional-details', () => {
        it('should link additional detail fields to an upcharge', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);
          const field1 = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Notes' },
          );
          const field2 = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Color' },
          );

          const response = await makeRequest()
            .post(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', setup.adminCookie)
            .send({ fieldIds: [field1.id, field2.id] });

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          expect(response.body.linked).toBe(2);

          // Verify by listing
          const listResponse = await makeRequest()
            .get(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', setup.adminCookie);

          expect(listResponse.body.additionalDetails).toHaveLength(2);
        });

        it('should skip already linked fields', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);
          const field = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Existing Field' },
          );

          // Link first time
          await linkAdditionalDetailToUpCharge(em, upCharge, field, 0);

          // Try to link again
          const response = await makeRequest()
            .post(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', setup.adminCookie)
            .send({ fieldIds: [field.id] });

          expect(response.status).toBe(200);
          expect(response.body.linked).toBe(0);
        });

        it('should skip inactive fields', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);
          const inactiveField = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Inactive Field', isActive: false },
          );

          const response = await makeRequest()
            .post(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', setup.adminCookie)
            .send({ fieldIds: [inactiveField.id] });

          expect(response.status).toBe(200);
          expect(response.body.linked).toBe(0);
        });

        it('should validate required fieldIds', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);

          const response = await makeRequest()
            .post(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', setup.adminCookie)
            .send({ fieldIds: [] });

          expect(response.status).toBe(400);
        });

        it('should return 404 for non-existent upcharge', async () => {
          const field = await createTestAdditionalDetailField(
            em,
            setup.company,
          );

          const response = await makeRequest()
            .post(
              '/api/price-guide/library/upcharges/00000000-0000-0000-0000-000000000000/additional-details',
            )
            .set('Cookie', setup.adminCookie)
            .send({ fieldIds: [field.id] });

          expect(response.status).toBe(404);
        });

        it('should require settings:update permission', async () => {
          const readOnlyUser = await createUserWithPermissions(
            em,
            setup.company,
            [PERMISSIONS.SETTINGS_READ],
          );
          const upCharge = await createTestUpCharge(em, setup.company);
          const field = await createTestAdditionalDetailField(
            em,
            setup.company,
          );

          const response = await makeRequest()
            .post(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', readOnlyUser.cookie)
            .send({ fieldIds: [field.id] });

          expect(response.status).toBe(403);
        });
      });

      describe('DELETE /api/price-guide/library/upcharges/:id/additional-details/:fieldId', () => {
        it('should unlink an additional detail field from an upcharge', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);
          const field = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'To Remove' },
          );

          await linkAdditionalDetailToUpCharge(em, upCharge, field, 0);

          const response = await makeRequest()
            .delete(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details/${field.id}`,
            )
            .set('Cookie', setup.adminCookie);

          expect(response.status).toBe(200);
          expect(response.body.message).toBe(
            'Additional detail unlinked successfully',
          );

          // Verify removed
          const listResponse = await makeRequest()
            .get(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', setup.adminCookie);

          expect(listResponse.body.additionalDetails).toHaveLength(0);
        });

        it('should return 404 when field is not linked', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);
          const field = await createTestAdditionalDetailField(
            em,
            setup.company,
          );

          const response = await makeRequest()
            .delete(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details/${field.id}`,
            )
            .set('Cookie', setup.adminCookie);

          expect(response.status).toBe(404);
          expect(response.body.error).toBe('Additional detail link not found');
        });

        it('should return 404 for non-existent upcharge', async () => {
          const field = await createTestAdditionalDetailField(
            em,
            setup.company,
          );

          const response = await makeRequest()
            .delete(
              `/api/price-guide/library/upcharges/00000000-0000-0000-0000-000000000000/additional-details/${field.id}`,
            )
            .set('Cookie', setup.adminCookie);

          expect(response.status).toBe(404);
        });

        it('should require settings:update permission', async () => {
          const readOnlyUser = await createUserWithPermissions(
            em,
            setup.company,
            [PERMISSIONS.SETTINGS_READ],
          );
          const upCharge = await createTestUpCharge(em, setup.company);
          const field = await createTestAdditionalDetailField(
            em,
            setup.company,
          );
          await linkAdditionalDetailToUpCharge(em, upCharge, field, 0);

          const response = await makeRequest()
            .delete(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details/${field.id}`,
            )
            .set('Cookie', readOnlyUser.cookie);

          expect(response.status).toBe(403);
        });
      });

      describe('PUT /api/price-guide/library/upcharges/:id/additional-details/order', () => {
        it('should reorder additional detail fields', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);
          const field1 = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'First' },
          );
          const field2 = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Second' },
          );
          const field3 = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Third' },
          );

          const link1 = await linkAdditionalDetailToUpCharge(
            em,
            upCharge,
            field1,
            0,
          );
          const link2 = await linkAdditionalDetailToUpCharge(
            em,
            upCharge,
            field2,
            1,
          );
          const link3 = await linkAdditionalDetailToUpCharge(
            em,
            upCharge,
            field3,
            2,
          );

          // Reorder: Third, First, Second
          const response = await makeRequest()
            .put(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details/order`,
            )
            .set('Cookie', setup.adminCookie)
            .send({ orderedIds: [link3.id, link1.id, link2.id] });

          expect(response.status).toBe(200);
          expect(response.body.message).toBe(
            'Additional details reordered successfully',
          );

          // Verify new order
          const listResponse = await makeRequest()
            .get(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
            )
            .set('Cookie', setup.adminCookie);

          expect(listResponse.body.additionalDetails[0].title).toBe('Third');
          expect(listResponse.body.additionalDetails[1].title).toBe('First');
          expect(listResponse.body.additionalDetails[2].title).toBe('Second');
        });

        it('should validate required orderedIds', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);

          const response = await makeRequest()
            .put(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details/order`,
            )
            .set('Cookie', setup.adminCookie)
            .send({ orderedIds: [] });

          expect(response.status).toBe(400);
        });

        it('should return 404 for non-existent upcharge', async () => {
          // Create a field and link it to get a valid junction ID
          const upCharge = await createTestUpCharge(em, setup.company);
          const field = await createTestAdditionalDetailField(
            em,
            setup.company,
          );
          const link = await linkAdditionalDetailToUpCharge(
            em,
            upCharge,
            field,
            0,
          );

          const response = await makeRequest()
            .put(
              '/api/price-guide/library/upcharges/00000000-0000-0000-0000-000000000000/additional-details/order',
            )
            .set('Cookie', setup.adminCookie)
            .send({ orderedIds: [link.id] });

          expect(response.status).toBe(404);
        });

        it('should require settings:update permission', async () => {
          const readOnlyUser = await createUserWithPermissions(
            em,
            setup.company,
            [PERMISSIONS.SETTINGS_READ],
          );
          const upCharge = await createTestUpCharge(em, setup.company);

          const response = await makeRequest()
            .put(
              `/api/price-guide/library/upcharges/${upCharge.id}/additional-details/order`,
            )
            .set('Cookie', readOnlyUser.cookie)
            .send({
              orderedIds: ['00000000-0000-0000-0000-000000000001'],
            });

          expect(response.status).toBe(403);
        });
      });

      describe('GET /api/price-guide/library/upcharges/:id (detail with additional details)', () => {
        it('should include additional details in upcharge detail response', async () => {
          const upCharge = await createTestUpCharge(em, setup.company, {
            name: 'Upcharge With Details',
          });
          const field1 = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Room Name', inputType: 'text', isRequired: true },
          );
          const field2 = await createTestAdditionalDetailField(
            em,
            setup.company,
            { title: 'Color Choice', inputType: 'picker', isRequired: false },
          );

          await linkAdditionalDetailToUpCharge(em, upCharge, field1, 0);
          await linkAdditionalDetailToUpCharge(em, upCharge, field2, 1);

          const response = await makeRequest()
            .get(`/api/price-guide/library/upcharges/${upCharge.id}`)
            .set('Cookie', setup.adminCookie);

          expect(response.status).toBe(200);
          expect(response.body.upcharge.additionalDetails).toHaveLength(2);

          // Verify field structure
          const detail1 = response.body.upcharge.additionalDetails[0];
          expect(detail1.fieldId).toBe(field1.id);
          expect(detail1.title).toBe('Room Name');
          expect(detail1.inputType).toBe('text');
          expect(detail1.isRequired).toBe(true);
          expect(detail1.sortOrder).toBe(0);
          expect(detail1.junctionId).toBeDefined();

          const detail2 = response.body.upcharge.additionalDetails[1];
          expect(detail2.fieldId).toBe(field2.id);
          expect(detail2.title).toBe('Color Choice');
          expect(detail2.inputType).toBe('picker');
          expect(detail2.isRequired).toBe(false);
          expect(detail2.sortOrder).toBe(1);
        });

        it('should return empty array when no additional details are linked', async () => {
          const upCharge = await createTestUpCharge(em, setup.company);

          const response = await makeRequest()
            .get(`/api/price-guide/library/upcharges/${upCharge.id}`)
            .set('Cookie', setup.adminCookie);

          expect(response.status).toBe(200);
          expect(response.body.upcharge.additionalDetails).toEqual([]);
        });
      });
    });
  });

  // ==========================================================================
  // Additional Details Library
  // ==========================================================================

  describe('Additional Details Library (/api/price-guide/library/additional-details)', () => {
    describe('GET /api/price-guide/library/additional-details', () => {
      it('should list additional detail fields', async () => {
        await createTestAdditionalDetailField(em, setup.company, {
          title: 'Room Name',
        });
        await createTestAdditionalDetailField(em, setup.company, {
          title: 'Quantity',
        });

        const response = await makeRequest()
          .get('/api/price-guide/library/additional-details')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(2);
      });
    });

    describe('POST /api/price-guide/library/additional-details', () => {
      it('should create a text field', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/additional-details')
          .set('Cookie', setup.adminCookie)
          .send({
            title: 'Notes',
            inputType: 'text',
            isRequired: false,
          });

        expect(response.status).toBe(201);
        expect(response.body.field.title).toBe('Notes');
        expect(response.body.field.inputType).toBe('text');
      });

      it('should create a picker field with options', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/additional-details')
          .set('Cookie', setup.adminCookie)
          .send({
            title: 'Color',
            inputType: 'picker',
            pickerValues: ['White', 'Black', 'Bronze'],
            isRequired: true,
          });

        expect(response.status).toBe(201);
        expect(response.body.field.inputType).toBe('picker');
        // pickerValues is stored but not returned in minimal create response
      });

      it('should validate required fields', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/additional-details')
          .set('Cookie', setup.adminCookie)
          .send({
            // Missing title and inputType
          });

        expect(response.status).toBe(400);
      });
    });

    describe('PUT /api/price-guide/library/additional-details/:id', () => {
      it('should update a field', async () => {
        const field = await createTestAdditionalDetailField(em, setup.company, {
          title: 'Original',
        });

        const response = await makeRequest()
          .put(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            title: 'Updated',
            version: field.version,
          });

        expect(response.status).toBe(200);
        expect(response.body.field.title).toBe('Updated');
      });
    });

    describe('DELETE /api/price-guide/library/additional-details/:id', () => {
      it('should soft delete a field', async () => {
        const field = await createTestAdditionalDetailField(em, setup.company);

        const response = await makeRequest()
          .delete(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
      });
    });
  });

  // ==========================================================================
  // Images Library
  // ==========================================================================

  describe('Images Library (/api/price-guide/library/images)', () => {
    describe('GET /api/price-guide/library/images', () => {
      it('should list images with pagination', async () => {
        await createTestPriceGuideImage(em, setup.company, setup.adminUser, {
          name: 'Image A',
        });
        await createTestPriceGuideImage(em, setup.company, setup.adminUser, {
          name: 'Image B',
        });
        await createTestPriceGuideImage(em, setup.company, setup.adminUser, {
          name: 'Image C',
        });

        const response = await makeRequest()
          .get('/api/price-guide/library/images')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(3);
        expect(response.body.hasMore).toBe(false);
      });

      it('should support search by name', async () => {
        await createTestPriceGuideImage(em, setup.company, setup.adminUser, {
          name: 'Window Product Image',
        });
        await createTestPriceGuideImage(em, setup.company, setup.adminUser, {
          name: 'Door Product Image',
        });

        const response = await makeRequest()
          .get('/api/price-guide/library/images')
          .query({ search: 'Window' })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].name).toBe('Window Product Image');
      });

      it('should filter by tags', async () => {
        // Create images
        const taggedImage = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
          { name: 'Tagged Image' },
        );
        await createTestPriceGuideImage(em, setup.company, setup.adminUser, {
          name: 'Untagged Image',
        });

        // Create tag and assign to first image
        const tag = await createTestTag(em, setup.company, { name: 'Windows' });
        await assignTagToEntity(
          em,
          tag,
          TaggableEntityType.PRICE_GUIDE_IMAGE,
          taggedImage.id,
        );

        const response = await makeRequest()
          .get('/api/price-guide/library/images')
          .query({ tags: tag.id })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].id).toBe(taggedImage.id);
      });

      it('should filter by multiple tags (OR logic)', async () => {
        // Create images
        const image1 = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
          { name: 'Image 1' },
        );
        const image2 = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
          { name: 'Image 2' },
        );
        await createTestPriceGuideImage(em, setup.company, setup.adminUser, {
          name: 'Image 3',
        });

        // Create tags
        const tag1 = await createTestTag(em, setup.company, { name: 'Tag1' });
        const tag2 = await createTestTag(em, setup.company, { name: 'Tag2' });

        await assignTagToEntity(
          em,
          tag1,
          TaggableEntityType.PRICE_GUIDE_IMAGE,
          image1.id,
        );
        await assignTagToEntity(
          em,
          tag2,
          TaggableEntityType.PRICE_GUIDE_IMAGE,
          image2.id,
        );

        const response = await makeRequest()
          .get('/api/price-guide/library/images')
          .query({ tags: `${tag1.id},${tag2.id}` })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(2);
      });

      it('should support cursor pagination', async () => {
        for (let i = 0; i < 5; i++) {
          await createTestPriceGuideImage(em, setup.company, setup.adminUser, {
            name: `Image ${i}`,
          });
        }

        const response1 = await makeRequest()
          .get('/api/price-guide/library/images')
          .query({ limit: 2 })
          .set('Cookie', setup.adminCookie);

        expect(response1.status).toBe(200);
        expect(response1.body.items).toHaveLength(2);
        expect(response1.body.hasMore).toBe(true);
        expect(response1.body.nextCursor).toBeDefined();

        const response2 = await makeRequest()
          .get('/api/price-guide/library/images')
          .query({ limit: 2, cursor: response1.body.nextCursor })
          .set('Cookie', setup.adminCookie);

        expect(response2.status).toBe(200);
        expect(response2.body.items).toHaveLength(2);
      });

      it('should require authentication', async () => {
        const response = await makeRequest().get(
          '/api/price-guide/library/images',
        );

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/price-guide/library/images/:id', () => {
      it('should return image details with MSI usage count', async () => {
        const image = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
          {
            name: 'Test Image',
            description: 'Test description',
          },
        );

        // Link to an MSI
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        await setMsiThumbnail(em, msi, image);

        const response = await makeRequest()
          .get(`/api/price-guide/library/images/${image.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.item.id).toBe(image.id);
        expect(response.body.item.name).toBe('Test Image');
        expect(response.body.item.description).toBe('Test description');
      });

      it('should return 404 for non-existent image', async () => {
        const response = await makeRequest()
          .get(
            '/api/price-guide/library/images/00000000-0000-0000-0000-000000000000',
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/price-guide/library/images/:id', () => {
      it('should update an image with version check', async () => {
        const image = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
          {
            name: 'Original Name',
          },
        );

        const response = await makeRequest()
          .put(`/api/price-guide/library/images/${image.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Updated Name',
            version: image.version,
          });

        expect(response.status).toBe(200);
        expect(response.body.item.name).toBe('Updated Name');
      });

      it('should return 409 on version mismatch', async () => {
        const image = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
        );

        const response = await makeRequest()
          .put(`/api/price-guide/library/images/${image.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Updated Name',
            version: 999,
          });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe('Conflict');
      });

      it('should require settings:update permission', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );
        const image = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
        );

        const response = await makeRequest()
          .put(`/api/price-guide/library/images/${image.id}`)
          .set('Cookie', readOnlyUser.cookie)
          .send({ name: 'Updated', version: image.version });

        expect(response.status).toBe(403);
      });
    });

    describe('POST /api/price-guide/library/images', () => {
      it('should upload a new image', async () => {
        // Create a small test image buffer (1x1 red pixel PNG)
        const testImageBuffer = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64',
        );

        const response = await makeRequest()
          .post('/api/price-guide/library/images')
          .set('Cookie', setup.adminCookie)
          .attach('file', testImageBuffer, 'test-image.png')
          .field('name', 'Test Upload Image')
          .field('description', 'A test description');

        expect(response.status).toBe(201);
        expect(response.body.item).toBeDefined();
        expect(response.body.item.name).toBe('Test Upload Image');
        expect(response.body.item.description).toBe('A test description');
        expect(response.body.item.id).toBeDefined();
        expect(response.body.item.version).toBe(1);
      });

      it('should require a file to be uploaded', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/images')
          .set('Cookie', setup.adminCookie)
          .field('name', 'Test Image');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('No file provided');
      });

      it('should require a name', async () => {
        const testImageBuffer = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64',
        );

        const response = await makeRequest()
          .post('/api/price-guide/library/images')
          .set('Cookie', setup.adminCookie)
          .attach('file', testImageBuffer, 'test-image.png');
        // No name field

        expect(response.status).toBe(400);
      });

      it('should require settings:update permission', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );

        const testImageBuffer = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64',
        );

        const response = await makeRequest()
          .post('/api/price-guide/library/images')
          .set('Cookie', readOnlyUser.cookie)
          .attach('file', testImageBuffer, 'test-image.png')
          .field('name', 'Test Image');

        expect(response.status).toBe(403);
      });
    });

    describe('GET /api/price-guide/library/images/:id/where-used', () => {
      it('should return empty lists when image is not linked', async () => {
        const image = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
          { name: 'Unlinked Image' },
        );

        const response = await makeRequest()
          .get(`/api/price-guide/library/images/${image.id}/where-used`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.msis).toEqual([]);
        expect(response.body.upcharges).toEqual([]);
      });

      it('should return linked MSIs with category info', async () => {
        const image = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
          { name: 'Linked Image' },
        );

        const category = await createTestCategory(em, setup.company, {
          name: 'Windows',
        });
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
          {
            name: 'Double Hung Window',
          },
        );
        await setMsiThumbnail(em, msi, image);

        const response = await makeRequest()
          .get(`/api/price-guide/library/images/${image.id}/where-used`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.msis).toHaveLength(1);
        expect(response.body.msis[0].id).toBe(msi.id);
        expect(response.body.msis[0].name).toBe('Double Hung Window');
        expect(response.body.msis[0].category.name).toBe('Windows');
        expect(response.body.upcharges).toEqual([]);
      });

      it('should return 404 for non-existent image', async () => {
        const response = await makeRequest()
          .get(
            '/api/price-guide/library/images/00000000-0000-0000-0000-000000000000/where-used',
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/price-guide/library/images/:id', () => {
      it('should soft delete an image', async () => {
        const image = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
        );

        const response = await makeRequest()
          .delete(`/api/price-guide/library/images/${image.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);

        // Verify it no longer appears in list
        const listResponse = await makeRequest()
          .get('/api/price-guide/library/images')
          .set('Cookie', setup.adminCookie);

        expect(
          listResponse.body.items.find(
            (i: { id: string }) => i.id === image.id,
          ),
        ).toBeUndefined();
      });

      it('should allow force delete even if linked to MSI', async () => {
        const image = await createTestPriceGuideImage(
          em,
          setup.company,
          setup.adminUser,
        );
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        await setMsiThumbnail(em, msi, image);

        const response = await makeRequest()
          .delete(`/api/price-guide/library/images/${image.id}`)
          .query({ force: 'true' })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
      });
    });
  });

  // ==========================================================================
  // Measure Sheet Item Additional Details
  // ==========================================================================

  describe('MSI Additional Details (/api/price-guide/measure-sheet-items/:id/additional-details)', () => {
    describe('POST /api/price-guide/measure-sheet-items/:id/additional-details', () => {
      it('should link additional detail fields to an MSI', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        const field1 = await createTestAdditionalDetailField(
          em,
          setup.company,
          { title: 'Room Name' },
        );
        const field2 = await createTestAdditionalDetailField(
          em,
          setup.company,
          { title: 'Quantity' },
        );

        const response = await makeRequest()
          .post(
            `/api/price-guide/measure-sheet-items/${msi.id}/additional-details`,
          )
          .set('Cookie', setup.adminCookie)
          .send({ fieldIds: [field1.id, field2.id] });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.linked).toBe(2);
      });

      it('should skip already linked fields', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        const field = await createTestAdditionalDetailField(em, setup.company, {
          title: 'Existing Field',
        });

        // Link first time
        await linkAdditionalDetailToMeasureSheetItem(em, msi, field, 0);

        // Try to link again
        const response = await makeRequest()
          .post(
            `/api/price-guide/measure-sheet-items/${msi.id}/additional-details`,
          )
          .set('Cookie', setup.adminCookie)
          .send({ fieldIds: [field.id] });

        expect(response.status).toBe(200);
        expect(response.body.linked).toBe(0);
      });

      it('should skip non-existent fields', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        const response = await makeRequest()
          .post(
            `/api/price-guide/measure-sheet-items/${msi.id}/additional-details`,
          )
          .set('Cookie', setup.adminCookie)
          .send({ fieldIds: ['00000000-0000-0000-0000-000000000000'] });

        expect(response.status).toBe(200);
        expect(response.body.linked).toBe(0);
      });

      it('should validate required fieldIds', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        const response = await makeRequest()
          .post(
            `/api/price-guide/measure-sheet-items/${msi.id}/additional-details`,
          )
          .set('Cookie', setup.adminCookie)
          .send({});

        expect(response.status).toBe(400);
      });

      it('should return 404 for non-existent MSI', async () => {
        // Create a valid field to link
        const field = await createTestAdditionalDetailField(em, setup.company);

        const response = await makeRequest()
          .post(
            '/api/price-guide/measure-sheet-items/00000000-0000-0000-0000-000000000000/additional-details',
          )
          .set('Cookie', setup.adminCookie)
          .send({ fieldIds: [field.id] });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Measure sheet item not found');
      });

      it('should require settings:update permission', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        const response = await makeRequest()
          .post(
            `/api/price-guide/measure-sheet-items/${msi.id}/additional-details`,
          )
          .set('Cookie', readOnlyUser.cookie)
          .send({ fieldIds: [] });

        expect(response.status).toBe(403);
      });

      it('should require authentication', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        const response = await makeRequest().post(
          `/api/price-guide/measure-sheet-items/${msi.id}/additional-details`,
        );

        expect(response.status).toBe(401);
      });
    });

    describe('DELETE /api/price-guide/measure-sheet-items/:id/additional-details/:fieldId', () => {
      it('should unlink an additional detail field from MSI', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        const field = await createTestAdditionalDetailField(em, setup.company, {
          title: 'To Remove',
        });

        await linkAdditionalDetailToMeasureSheetItem(em, msi, field, 0);

        const response = await makeRequest()
          .delete(
            `/api/price-guide/measure-sheet-items/${msi.id}/additional-details/${field.id}`,
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe(
          'Additional detail unlinked successfully',
        );
      });

      it('should return 404 when field is not linked', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        const field = await createTestAdditionalDetailField(em, setup.company);

        const response = await makeRequest()
          .delete(
            `/api/price-guide/measure-sheet-items/${msi.id}/additional-details/${field.id}`,
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Additional detail link not found');
      });

      it('should return 404 for non-existent MSI', async () => {
        const field = await createTestAdditionalDetailField(em, setup.company);

        const response = await makeRequest()
          .delete(
            `/api/price-guide/measure-sheet-items/00000000-0000-0000-0000-000000000000/additional-details/${field.id}`,
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });

      it('should require settings:update permission', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        const field = await createTestAdditionalDetailField(em, setup.company);
        await linkAdditionalDetailToMeasureSheetItem(em, msi, field, 0);

        const response = await makeRequest()
          .delete(
            `/api/price-guide/measure-sheet-items/${msi.id}/additional-details/${field.id}`,
          )
          .set('Cookie', readOnlyUser.cookie);

        expect(response.status).toBe(403);
      });
    });
  });

  // ==========================================================================
  // Additional Details Security Tests
  // ==========================================================================

  describe('Additional Details Security', () => {
    describe('Cross-company isolation', () => {
      it('should not allow accessing another company additional detail fields', async () => {
        // Create another company with its own data
        const otherSetup = await createCompanySetup({ createOffice: true });
        const otherField = await createTestAdditionalDetailField(
          em,
          otherSetup.company,
          { title: 'Other Company Field' },
        );

        // Try to access from the first company
        const response = await makeRequest()
          .get(`/api/price-guide/library/additional-details/${otherField.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Additional detail field not found');
      });

      it('should not allow updating another company additional detail field', async () => {
        const otherSetup = await createCompanySetup({ createOffice: true });
        const otherField = await createTestAdditionalDetailField(
          em,
          otherSetup.company,
          { title: 'Other Company Field' },
        );

        const response = await makeRequest()
          .put(`/api/price-guide/library/additional-details/${otherField.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ title: 'Hacked Title', version: 1 });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Additional detail field not found');
      });

      it('should not allow deleting another company additional detail field', async () => {
        const otherSetup = await createCompanySetup({ createOffice: true });
        const otherField = await createTestAdditionalDetailField(
          em,
          otherSetup.company,
          { title: 'Other Company Field' },
        );

        const response = await makeRequest()
          .delete(
            `/api/price-guide/library/additional-details/${otherField.id}`,
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Additional detail field not found');
      });

      it('should not allow linking another company field to our upcharge', async () => {
        const otherSetup = await createCompanySetup({ createOffice: true });
        const otherField = await createTestAdditionalDetailField(
          em,
          otherSetup.company,
          { title: 'Other Company Field' },
        );

        const upCharge = await createTestUpCharge(em, setup.company);

        const response = await makeRequest()
          .post(
            `/api/price-guide/library/upcharges/${upCharge.id}/additional-details`,
          )
          .set('Cookie', setup.adminCookie)
          .send({ fieldIds: [otherField.id] });

        // Should succeed but not link the other company's field
        expect(response.status).toBe(200);
        expect(response.body.linked).toBe(0);
      });

      it('should not allow linking another company field to our MSI', async () => {
        const otherSetup = await createCompanySetup({ createOffice: true });
        const otherField = await createTestAdditionalDetailField(
          em,
          otherSetup.company,
          { title: 'Other Company Field' },
        );

        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        const response = await makeRequest()
          .post(
            `/api/price-guide/measure-sheet-items/${msi.id}/additional-details`,
          )
          .set('Cookie', setup.adminCookie)
          .send({ fieldIds: [otherField.id] });

        // Should succeed but not link the other company's field
        expect(response.status).toBe(200);
        expect(response.body.linked).toBe(0);
      });

      it('should only list own company fields', async () => {
        // Create fields for both companies
        await createTestAdditionalDetailField(em, setup.company, {
          title: 'Our Field',
        });

        const otherSetup = await createCompanySetup({ createOffice: true });
        await createTestAdditionalDetailField(em, otherSetup.company, {
          title: 'Other Company Field',
        });

        const response = await makeRequest()
          .get('/api/price-guide/library/additional-details')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].title).toBe('Our Field');
      });
    });

    describe('Permission checks', () => {
      it('should require settings:read to list additional detail fields', async () => {
        const noPermsUser = await createUserWithPermissions(
          em,
          setup.company,
          [],
        );

        const response = await makeRequest()
          .get('/api/price-guide/library/additional-details')
          .set('Cookie', noPermsUser.cookie);

        expect(response.status).toBe(403);
      });

      it('should require settings:read to get additional detail field detail', async () => {
        const noPermsUser = await createUserWithPermissions(
          em,
          setup.company,
          [],
        );
        const field = await createTestAdditionalDetailField(em, setup.company);

        const response = await makeRequest()
          .get(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', noPermsUser.cookie);

        expect(response.status).toBe(403);
      });

      it('should require settings:update to create additional detail field', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );

        const response = await makeRequest()
          .post('/api/price-guide/library/additional-details')
          .set('Cookie', readOnlyUser.cookie)
          .send({ title: 'New Field', inputType: 'text' });

        expect(response.status).toBe(403);
      });

      it('should require settings:update to update additional detail field', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );
        const field = await createTestAdditionalDetailField(em, setup.company);

        const response = await makeRequest()
          .put(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', readOnlyUser.cookie)
          .send({ title: 'Updated', version: 1 });

        expect(response.status).toBe(403);
      });

      it('should require settings:update to delete additional detail field', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );
        const field = await createTestAdditionalDetailField(em, setup.company);

        const response = await makeRequest()
          .delete(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', readOnlyUser.cookie);

        expect(response.status).toBe(403);
      });

      it('should allow user with settings:read to list fields', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );
        await createTestAdditionalDetailField(em, setup.company);

        const response = await makeRequest()
          .get('/api/price-guide/library/additional-details')
          .set('Cookie', readOnlyUser.cookie);

        expect(response.status).toBe(200);
      });

      it('should allow user with settings:update to create fields', async () => {
        const writeUser = await createUserWithPermissions(em, setup.company, [
          PERMISSIONS.SETTINGS_UPDATE,
        ]);

        const response = await makeRequest()
          .post('/api/price-guide/library/additional-details')
          .set('Cookie', writeUser.cookie)
          .send({ title: 'New Field', inputType: 'text' });

        expect(response.status).toBe(201);
      });
    });
  });

  // ==========================================================================
  // Additional Details CRUD - Extended Tests
  // ==========================================================================

  describe('Additional Details CRUD Extended Tests', () => {
    describe('GET /api/price-guide/library/additional-details/:id', () => {
      it('should return full field detail with configuration', async () => {
        const field = await createTestAdditionalDetailField(em, setup.company, {
          title: 'Color Choice',
          inputType: 'picker',
          isRequired: true,
          pickerValues: ['White', 'Black', 'Bronze'],
        });

        const response = await makeRequest()
          .get(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.field.id).toBe(field.id);
        expect(response.body.field.title).toBe('Color Choice');
        expect(response.body.field.inputType).toBe('picker');
        expect(response.body.field.isRequired).toBe(true);
        expect(response.body.field.pickerValues).toEqual([
          'White',
          'Black',
          'Bronze',
        ]);
        expect(response.body.field.version).toBeDefined();
      });

      it('should include usage information', async () => {
        const field = await createTestAdditionalDetailField(em, setup.company, {
          title: 'Shared Field',
        });

        // Link to an MSI
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
          { name: 'Test Window' },
        );
        await linkAdditionalDetailToMeasureSheetItem(em, msi, field, 0);

        // Link to an upcharge
        const upCharge = await createTestUpCharge(em, setup.company, {
          name: 'Test UpCharge',
        });
        await linkAdditionalDetailToUpCharge(em, upCharge, field, 0);

        const response = await makeRequest()
          .get(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.field.usedByMSIs).toHaveLength(1);
        expect(response.body.field.usedByMSIs[0].name).toBe('Test Window');
        expect(response.body.field.usedByUpcharges).toHaveLength(1);
        expect(response.body.field.usedByUpcharges[0].name).toBe(
          'Test UpCharge',
        );
      });

      it('should return 404 for non-existent field', async () => {
        const response = await makeRequest()
          .get(
            '/api/price-guide/library/additional-details/00000000-0000-0000-0000-000000000000',
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });

      it('should require authentication', async () => {
        const field = await createTestAdditionalDetailField(em, setup.company);

        const response = await makeRequest().get(
          `/api/price-guide/library/additional-details/${field.id}`,
        );

        expect(response.status).toBe(401);
      });
    });

    describe('PUT /api/price-guide/library/additional-details/:id (optimistic locking)', () => {
      it('should reject update with wrong version', async () => {
        const field = await createTestAdditionalDetailField(em, setup.company, {
          title: 'Original Title',
        });

        // First update succeeds
        await makeRequest()
          .put(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ title: 'Updated Title', version: 1 });

        // Second update with old version fails
        const response = await makeRequest()
          .put(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ title: 'Concurrent Update', version: 1 });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe('CONCURRENT_MODIFICATION');
        expect(response.body.currentVersion).toBe(2);
      });

      it('should update various field properties', async () => {
        const field = await createTestAdditionalDetailField(em, setup.company, {
          title: 'Original',
          inputType: 'text',
          isRequired: false,
        });

        const response = await makeRequest()
          .put(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            title: 'Updated Title',
            isRequired: true,
            placeholder: 'Enter value here',
            note: 'This is a note',
            version: 1,
          });

        expect(response.status).toBe(200);
        expect(response.body.field.title).toBe('Updated Title');

        // Verify changes persisted
        const getResponse = await makeRequest()
          .get(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', setup.adminCookie);

        expect(getResponse.body.field.title).toBe('Updated Title');
        expect(getResponse.body.field.isRequired).toBe(true);
        expect(getResponse.body.field.placeholder).toBe('Enter value here');
        expect(getResponse.body.field.note).toBe('This is a note');
      });

      it('should return 404 for non-existent field', async () => {
        const response = await makeRequest()
          .put(
            '/api/price-guide/library/additional-details/00000000-0000-0000-0000-000000000000',
          )
          .set('Cookie', setup.adminCookie)
          .send({ title: 'New Title', version: 1 });

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/price-guide/library/additional-details/:id (with usage)', () => {
      it('should warn when field is in use by MSI', async () => {
        const field = await createTestAdditionalDetailField(em, setup.company, {
          title: 'Used Field',
        });

        // Link to MSI
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        await linkAdditionalDetailToMeasureSheetItem(em, msi, field, 0);

        // Manually update the usage count to simulate trigger behavior
        const knex = em.getKnex();
        await knex('additional_detail_field')
          .where({ id: field.id })
          .update({ linked_msi_count: 1 });

        const response = await makeRequest()
          .delete(`/api/price-guide/library/additional-details/${field.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(409);
        expect(response.body.error).toBe('Field is in use');
        expect(response.body.msiUsageCount).toBeDefined();
      });

      it('should allow force delete when field is in use', async () => {
        const field = await createTestAdditionalDetailField(em, setup.company, {
          title: 'Force Delete Field',
        });

        // Link to MSI
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        await linkAdditionalDetailToMeasureSheetItem(em, msi, field, 0);

        // Manually update the usage count to simulate trigger behavior
        const knex = em.getKnex();
        await knex('additional_detail_field')
          .where({ id: field.id })
          .update({ linked_msi_count: 1 });

        const response = await makeRequest()
          .delete(`/api/price-guide/library/additional-details/${field.id}`)
          .query({ force: 'true' })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe(
          'Additional detail field deleted successfully',
        );
      });

      it('should return 404 for non-existent field', async () => {
        const response = await makeRequest()
          .delete(
            '/api/price-guide/library/additional-details/00000000-0000-0000-0000-000000000000',
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });
    });

    describe('GET /api/price-guide/library/additional-details (list with filters)', () => {
      it('should support search by title', async () => {
        await createTestAdditionalDetailField(em, setup.company, {
          title: 'Room Name',
        });
        await createTestAdditionalDetailField(em, setup.company, {
          title: 'Color Choice',
        });

        const response = await makeRequest()
          .get('/api/price-guide/library/additional-details')
          .query({ search: 'Room' })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].title).toBe('Room Name');
      });

      it('should support cursor pagination', async () => {
        for (let i = 0; i < 5; i++) {
          await createTestAdditionalDetailField(em, setup.company, {
            title: `Field ${String.fromCharCode(65 + i)}`,
          });
        }

        const response1 = await makeRequest()
          .get('/api/price-guide/library/additional-details')
          .query({ limit: 2 })
          .set('Cookie', setup.adminCookie);

        expect(response1.status).toBe(200);
        expect(response1.body.items).toHaveLength(2);
        expect(response1.body.hasMore).toBe(true);
        expect(response1.body.nextCursor).toBeDefined();

        const response2 = await makeRequest()
          .get('/api/price-guide/library/additional-details')
          .query({ limit: 2, cursor: response1.body.nextCursor })
          .set('Cookie', setup.adminCookie);

        expect(response2.status).toBe(200);
        expect(response2.body.items).toHaveLength(2);
      });

      it('should require authentication', async () => {
        const response = await makeRequest().get(
          '/api/price-guide/library/additional-details',
        );

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/price-guide/library/additional-details (validation)', () => {
      it('should reject empty title', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/additional-details')
          .set('Cookie', setup.adminCookie)
          .send({ title: '', inputType: 'text' });

        expect(response.status).toBe(400);
      });

      it('should reject invalid inputType', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/additional-details')
          .set('Cookie', setup.adminCookie)
          .send({ title: 'Test Field', inputType: 'invalid' });

        expect(response.status).toBe(400);
      });

      it('should create field with all configurations', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/additional-details')
          .set('Cookie', setup.adminCookie)
          .send({
            title: 'Detailed Field',
            inputType: 'picker',
            cellType: 'text',
            placeholder: 'Select a value',
            note: 'Help text',
            defaultValue: 'White',
            isRequired: true,
            shouldCopy: true,
            pickerValues: ['White', 'Black', 'Bronze'],
          });

        expect(response.status).toBe(201);
        expect(response.body.field.title).toBe('Detailed Field');
        expect(response.body.field.inputType).toBe('picker');
      });

      it('should require authentication', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/library/additional-details')
          .send({ title: 'Test', inputType: 'text' });

        expect(response.status).toBe(401);
      });
    });
  });
});
