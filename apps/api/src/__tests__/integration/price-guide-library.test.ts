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
  createTestPriceGuideImage,
  createTestTag,
  assignTagToEntity,
  linkImageToMeasureSheetItem,
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
      it('should update upcharge thumbnail without requiring version', async () => {
        const upCharge = await createTestUpCharge(em, setup.company, {
          name: 'Test Upcharge',
        });

        // Update with null (clear thumbnail)
        const response = await makeRequest()
          .put(`/api/price-guide/library/upcharges/${upCharge.id}/thumbnail`)
          .set('Cookie', setup.adminCookie)
          .send({ imageId: null });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Thumbnail updated');
        expect(response.body.thumbnailUrl).toBeNull();
      });

      it('should return 404 for non-existent upcharge', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';

        const response = await makeRequest()
          .put(`/api/price-guide/library/upcharges/${fakeId}/thumbnail`)
          .set('Cookie', setup.adminCookie)
          .send({ imageId: null });

        expect(response.status).toBe(404);
      });

      it('should require authentication', async () => {
        const upCharge = await createTestUpCharge(em, setup.company);

        const response = await makeRequest()
          .put(`/api/price-guide/library/upcharges/${upCharge.id}/thumbnail`)
          .send({ imageId: null });

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
          .send({ imageId: null });

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
        await linkImageToMeasureSheetItem(em, msi, image, 0);

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
        await linkImageToMeasureSheetItem(em, msi, image, 0);

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
        await linkImageToMeasureSheetItem(em, msi, image, 0);

        const response = await makeRequest()
          .delete(`/api/price-guide/library/images/${image.id}`)
          .query({ force: 'true' })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
      });
    });
  });
});
