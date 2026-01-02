import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { TaggableEntityType } from '../../entities/price-guide/types';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import {
  createTestOption,
  createTestUpCharge,
  createTestAdditionalDetailField,
  createTestMeasureSheetItem,
  createTestCategory,
  createTestTag,
  assignTagToEntity,
} from '../factories/price-guide';

import {
  createCompanySetup,
  createUserWithPermissions,
} from './auth-test-helpers';
import { makeRequest, getTestApp } from './helpers';

import type { CompanySetup } from './auth-test-helpers';
import type { EntityManager } from '@mikro-orm/core';

describe('Price Guide Tags Routes', () => {
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
  // Tag CRUD Routes
  // ==========================================================================

  describe('Tag CRUD (/api/price-guide/tags)', () => {
    describe('GET /api/price-guide/tags', () => {
      it('should list all tags for the company', async () => {
        await createTestTag(em, setup.company, { name: 'Premium' });
        await createTestTag(em, setup.company, { name: 'Sale' });
        await createTestTag(em, setup.company, { name: 'New' });

        const response = await makeRequest()
          .get('/api/price-guide/tags')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.tags).toHaveLength(3);
        expect(response.body.tags.map((t: { name: string }) => t.name)).toEqual(
          expect.arrayContaining(['Premium', 'Sale', 'New']),
        );
      });

      it('should support search by name', async () => {
        await createTestTag(em, setup.company, { name: 'Premium Glass' });
        await createTestTag(em, setup.company, { name: 'Budget' });
        await createTestTag(em, setup.company, { name: 'Premium Metal' });

        const response = await makeRequest()
          .get('/api/price-guide/tags')
          .query({ search: 'Premium' })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.tags).toHaveLength(2);
      });

      it('should only list active tags', async () => {
        await createTestTag(em, setup.company, { name: 'Active Tag' });
        await createTestTag(em, setup.company, {
          name: 'Inactive Tag',
          isActive: false,
        });

        const response = await makeRequest()
          .get('/api/price-guide/tags')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.tags).toHaveLength(1);
        expect(response.body.tags[0].name).toBe('Active Tag');
      });

      it('should require authentication', async () => {
        const response = await makeRequest().get('/api/price-guide/tags');

        expect(response.status).toBe(401);
      });

      it('should require settings:read permission', async () => {
        const noPermUser = await createUserWithPermissions(
          em,
          setup.company,
          [],
        );

        const response = await makeRequest()
          .get('/api/price-guide/tags')
          .set('Cookie', noPermUser.cookie);

        expect(response.status).toBe(403);
      });
    });

    describe('GET /api/price-guide/tags/:id', () => {
      it('should return tag details', async () => {
        const tag = await createTestTag(em, setup.company, {
          name: 'Premium',
          color: '#FF5722',
        });

        const response = await makeRequest()
          .get(`/api/price-guide/tags/${tag.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.tag.id).toBe(tag.id);
        expect(response.body.tag.name).toBe('Premium');
        expect(response.body.tag.color).toBe('#FF5722');
      });

      it('should return 404 for non-existent tag', async () => {
        const response = await makeRequest()
          .get('/api/price-guide/tags/00000000-0000-0000-0000-000000000000')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });

      it('should not return tags from other companies', async () => {
        const otherSetup = await createCompanySetup({ createOffice: true });
        const otherTag = await createTestTag(em, otherSetup.company, {
          name: 'Other Company Tag',
        });

        const response = await makeRequest()
          .get(`/api/price-guide/tags/${otherTag.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/price-guide/tags', () => {
      it('should create a new tag', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/tags')
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'New Tag',
            color: '#2196F3',
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Tag created successfully');
        expect(response.body.tag.name).toBe('New Tag');
        expect(response.body.tag.color).toBe('#2196F3');
      });

      it('should validate required fields', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/tags')
          .set('Cookie', setup.adminCookie)
          .send({});

        expect(response.status).toBe(400);
      });

      it('should validate color format', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/tags')
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Test',
            color: 'invalid-color',
          });

        expect(response.status).toBe(400);
      });

      it('should prevent duplicate tag names', async () => {
        await createTestTag(em, setup.company, { name: 'Duplicate' });

        const response = await makeRequest()
          .post('/api/price-guide/tags')
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Duplicate',
            color: '#000000',
          });

        expect(response.status).toBe(409);
      });

      it('should require settings:update permission', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );

        const response = await makeRequest()
          .post('/api/price-guide/tags')
          .set('Cookie', readOnlyUser.cookie)
          .send({ name: 'Test', color: '#000000' });

        expect(response.status).toBe(403);
      });
    });

    describe('PUT /api/price-guide/tags/:id', () => {
      it('should update tag name', async () => {
        const tag = await createTestTag(em, setup.company, {
          name: 'Original',
        });

        const response = await makeRequest()
          .put(`/api/price-guide/tags/${tag.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ name: 'Updated' });

        expect(response.status).toBe(200);
        expect(response.body.tag.name).toBe('Updated');
      });

      it('should update tag color', async () => {
        const tag = await createTestTag(em, setup.company, {
          color: '#000000',
        });

        const response = await makeRequest()
          .put(`/api/price-guide/tags/${tag.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ color: '#FFFFFF' });

        expect(response.status).toBe(200);
        expect(response.body.tag.color).toBe('#FFFFFF');
      });

      it('should prevent duplicate names when updating', async () => {
        await createTestTag(em, setup.company, { name: 'Existing' });
        const tag = await createTestTag(em, setup.company, {
          name: 'ToUpdate',
        });

        const response = await makeRequest()
          .put(`/api/price-guide/tags/${tag.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ name: 'Existing' });

        expect(response.status).toBe(409);
      });

      it('should return 404 for non-existent tag', async () => {
        const response = await makeRequest()
          .put('/api/price-guide/tags/00000000-0000-0000-0000-000000000000')
          .set('Cookie', setup.adminCookie)
          .send({ name: 'Updated' });

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/price-guide/tags/:id', () => {
      it('should soft delete a tag', async () => {
        const tag = await createTestTag(em, setup.company, {
          name: 'ToDelete',
        });

        const deleteResponse = await makeRequest()
          .delete(`/api/price-guide/tags/${tag.id}`)
          .set('Cookie', setup.adminCookie);

        expect(deleteResponse.status).toBe(200);

        // Verify tag no longer appears in list
        const listResponse = await makeRequest()
          .get('/api/price-guide/tags')
          .set('Cookie', setup.adminCookie);

        expect(
          listResponse.body.tags.find((t: { id: string }) => t.id === tag.id),
        ).toBeUndefined();
      });

      it('should remove all item tag associations when deleting', async () => {
        const tag = await createTestTag(em, setup.company, { name: 'Tagged' });
        const option = await createTestOption(em, setup.company);
        await assignTagToEntity(em, tag, TaggableEntityType.OPTION, option.id);

        await makeRequest()
          .delete(`/api/price-guide/tags/${tag.id}`)
          .set('Cookie', setup.adminCookie);

        // Verify no tags on the option
        const response = await makeRequest()
          .get(`/api/price-guide/tags/items/OPTION/${option.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.body.tags).toHaveLength(0);
      });

      it('should return 404 for non-existent tag', async () => {
        const response = await makeRequest()
          .delete('/api/price-guide/tags/00000000-0000-0000-0000-000000000000')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });
    });
  });

  // ==========================================================================
  // Item Tag Assignment Routes
  // ==========================================================================

  describe('Item Tag Assignment (/api/price-guide/tags/items)', () => {
    describe('GET /api/price-guide/tags/items/:entityType/:entityId', () => {
      it('should get tags for an option', async () => {
        const tag1 = await createTestTag(em, setup.company, { name: 'Tag 1' });
        const tag2 = await createTestTag(em, setup.company, { name: 'Tag 2' });
        const option = await createTestOption(em, setup.company);

        await assignTagToEntity(em, tag1, TaggableEntityType.OPTION, option.id);
        await assignTagToEntity(em, tag2, TaggableEntityType.OPTION, option.id);

        const response = await makeRequest()
          .get(`/api/price-guide/tags/items/OPTION/${option.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.tags).toHaveLength(2);
      });

      it('should get tags for an upcharge', async () => {
        const tag = await createTestTag(em, setup.company, { name: 'Premium' });
        const upCharge = await createTestUpCharge(em, setup.company);

        await assignTagToEntity(
          em,
          tag,
          TaggableEntityType.UPCHARGE,
          upCharge.id,
        );

        const response = await makeRequest()
          .get(`/api/price-guide/tags/items/UPCHARGE/${upCharge.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.tags).toHaveLength(1);
        expect(response.body.tags[0].name).toBe('Premium');
      });

      it('should get tags for an additional detail field', async () => {
        const tag = await createTestTag(em, setup.company, {
          name: 'Required',
        });
        const field = await createTestAdditionalDetailField(em, setup.company);

        await assignTagToEntity(
          em,
          tag,
          TaggableEntityType.ADDITIONAL_DETAIL,
          field.id,
        );

        const response = await makeRequest()
          .get(`/api/price-guide/tags/items/ADDITIONAL_DETAIL/${field.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.tags).toHaveLength(1);
      });

      it('should not return inactive tags', async () => {
        const activeTag = await createTestTag(em, setup.company, {
          name: 'Active',
        });
        const inactiveTag = await createTestTag(em, setup.company, {
          name: 'Inactive',
          isActive: false,
        });
        const option = await createTestOption(em, setup.company);

        await assignTagToEntity(
          em,
          activeTag,
          TaggableEntityType.OPTION,
          option.id,
        );
        await assignTagToEntity(
          em,
          inactiveTag,
          TaggableEntityType.OPTION,
          option.id,
        );

        const response = await makeRequest()
          .get(`/api/price-guide/tags/items/OPTION/${option.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.body.tags).toHaveLength(1);
        expect(response.body.tags[0].name).toBe('Active');
      });

      it('should return 404 for non-existent entity', async () => {
        const response = await makeRequest()
          .get(
            '/api/price-guide/tags/items/OPTION/00000000-0000-0000-0000-000000000000',
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });

      it('should return 400 for invalid entity type', async () => {
        const response = await makeRequest()
          .get(
            '/api/price-guide/tags/items/INVALID/00000000-0000-0000-0000-000000000000',
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(400);
      });
    });

    describe('PUT /api/price-guide/tags/items/:entityType/:entityId', () => {
      it('should set tags for an option', async () => {
        const tag1 = await createTestTag(em, setup.company, { name: 'Tag 1' });
        const tag2 = await createTestTag(em, setup.company, { name: 'Tag 2' });
        const option = await createTestOption(em, setup.company);

        const response = await makeRequest()
          .put(`/api/price-guide/tags/items/OPTION/${option.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ tagIds: [tag1.id, tag2.id] });

        expect(response.status).toBe(200);
        expect(response.body.tags).toHaveLength(2);
      });

      it('should replace existing tags', async () => {
        const tag1 = await createTestTag(em, setup.company, {
          name: 'Old Tag',
        });
        const tag2 = await createTestTag(em, setup.company, {
          name: 'New Tag',
        });
        const option = await createTestOption(em, setup.company);

        // Assign initial tag
        await assignTagToEntity(em, tag1, TaggableEntityType.OPTION, option.id);

        // Replace with new tag
        const response = await makeRequest()
          .put(`/api/price-guide/tags/items/OPTION/${option.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ tagIds: [tag2.id] });

        expect(response.status).toBe(200);
        expect(response.body.tags).toHaveLength(1);
        expect(response.body.tags[0].name).toBe('New Tag');
      });

      it('should clear all tags when empty array is provided', async () => {
        const tag = await createTestTag(em, setup.company, { name: 'Tag' });
        const option = await createTestOption(em, setup.company);
        await assignTagToEntity(em, tag, TaggableEntityType.OPTION, option.id);

        const response = await makeRequest()
          .put(`/api/price-guide/tags/items/OPTION/${option.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ tagIds: [] });

        expect(response.status).toBe(200);
        expect(response.body.tags).toHaveLength(0);
      });

      it('should validate tag IDs belong to company', async () => {
        const otherSetup = await createCompanySetup({ createOffice: true });
        const otherTag = await createTestTag(em, otherSetup.company, {
          name: 'Other Tag',
        });
        const option = await createTestOption(em, setup.company);

        const response = await makeRequest()
          .put(`/api/price-guide/tags/items/OPTION/${option.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ tagIds: [otherTag.id] });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid tag IDs');
      });

      it('should not allow inactive tags', async () => {
        const inactiveTag = await createTestTag(em, setup.company, {
          name: 'Inactive',
          isActive: false,
        });
        const option = await createTestOption(em, setup.company);

        const response = await makeRequest()
          .put(`/api/price-guide/tags/items/OPTION/${option.id}`)
          .set('Cookie', setup.adminCookie)
          .send({ tagIds: [inactiveTag.id] });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid tag IDs');
      });

      it('should return 404 for non-existent entity', async () => {
        const tag = await createTestTag(em, setup.company);

        const response = await makeRequest()
          .put(
            '/api/price-guide/tags/items/OPTION/00000000-0000-0000-0000-000000000000',
          )
          .set('Cookie', setup.adminCookie)
          .send({ tagIds: [tag.id] });

        expect(response.status).toBe(404);
      });

      it('should require settings:update permission', async () => {
        const readOnlyUser = await createUserWithPermissions(
          em,
          setup.company,
          [PERMISSIONS.SETTINGS_READ],
        );
        const tag = await createTestTag(em, setup.company);
        const option = await createTestOption(em, setup.company);

        const response = await makeRequest()
          .put(`/api/price-guide/tags/items/OPTION/${option.id}`)
          .set('Cookie', readOnlyUser.cookie)
          .send({ tagIds: [tag.id] });

        expect(response.status).toBe(403);
      });
    });
  });

  // ==========================================================================
  // Library Route Tag Filtering
  // ==========================================================================

  describe('Library Route Tag Filtering', () => {
    describe('GET /api/price-guide/library/options with tags filter', () => {
      it('should filter options by tag', async () => {
        const tag = await createTestTag(em, setup.company, { name: 'Premium' });
        const taggedOption = await createTestOption(em, setup.company, {
          name: 'Premium Option',
        });
        await createTestOption(em, setup.company, { name: 'Regular Option' });

        await assignTagToEntity(
          em,
          tag,
          TaggableEntityType.OPTION,
          taggedOption.id,
        );

        const response = await makeRequest()
          .get('/api/price-guide/library/options')
          .query({ tags: tag.id })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].name).toBe('Premium Option');
      });

      it('should filter by multiple tags (OR logic)', async () => {
        const tag1 = await createTestTag(em, setup.company, { name: 'Tag1' });
        const tag2 = await createTestTag(em, setup.company, { name: 'Tag2' });

        const option1 = await createTestOption(em, setup.company, {
          name: 'Option 1',
        });
        const option2 = await createTestOption(em, setup.company, {
          name: 'Option 2',
        });
        await createTestOption(em, setup.company, { name: 'Option 3' });

        await assignTagToEntity(
          em,
          tag1,
          TaggableEntityType.OPTION,
          option1.id,
        );
        await assignTagToEntity(
          em,
          tag2,
          TaggableEntityType.OPTION,
          option2.id,
        );

        const response = await makeRequest()
          .get('/api/price-guide/library/options')
          .query({ tags: `${tag1.id},${tag2.id}` })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(2);
      });

      it('should include tags in option response', async () => {
        const tag = await createTestTag(em, setup.company, {
          name: 'Premium',
          color: '#4CAF50',
        });
        const option = await createTestOption(em, setup.company);
        await assignTagToEntity(em, tag, TaggableEntityType.OPTION, option.id);

        const response = await makeRequest()
          .get('/api/price-guide/library/options')
          .set('Cookie', setup.adminCookie);

        const returnedOption = response.body.items.find(
          (o: { id: string }) => o.id === option.id,
        );
        expect(returnedOption.tags).toHaveLength(1);
        expect(returnedOption.tags[0].name).toBe('Premium');
        expect(returnedOption.tags[0].color).toBe('#4CAF50');
      });
    });

    describe('GET /api/price-guide/library/upcharges with tags filter', () => {
      it('should filter upcharges by tag', async () => {
        const tag = await createTestTag(em, setup.company, { name: 'Special' });
        const taggedUpCharge = await createTestUpCharge(em, setup.company, {
          name: 'Special UpCharge',
        });
        await createTestUpCharge(em, setup.company, {
          name: 'Regular UpCharge',
        });

        await assignTagToEntity(
          em,
          tag,
          TaggableEntityType.UPCHARGE,
          taggedUpCharge.id,
        );

        const response = await makeRequest()
          .get('/api/price-guide/library/upcharges')
          .query({ tags: tag.id })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].name).toBe('Special UpCharge');
      });
    });

    describe('GET /api/price-guide/library/additional-details with tags filter', () => {
      it('should filter additional details by tag', async () => {
        const tag = await createTestTag(em, setup.company, {
          name: 'Required',
        });
        const taggedField = await createTestAdditionalDetailField(
          em,
          setup.company,
          { title: 'Tagged Field' },
        );
        await createTestAdditionalDetailField(em, setup.company, {
          title: 'Regular Field',
        });

        await assignTagToEntity(
          em,
          tag,
          TaggableEntityType.ADDITIONAL_DETAIL,
          taggedField.id,
        );

        const response = await makeRequest()
          .get('/api/price-guide/library/additional-details')
          .query({ tags: tag.id })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].title).toBe('Tagged Field');
      });
    });

    describe('GET /api/price-guide/measure-sheet-items with tags filter', () => {
      it('should filter MSIs by tag', async () => {
        const category = await createTestCategory(em, setup.company, {
          name: 'Test Category',
        });
        const tag = await createTestTag(em, setup.company, {
          name: 'Featured',
        });
        const taggedMsi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
          { name: 'Featured MSI' },
        );
        await createTestMeasureSheetItem(em, setup.company, category, {
          name: 'Regular MSI',
        });

        await assignTagToEntity(
          em,
          tag,
          TaggableEntityType.MEASURE_SHEET_ITEM,
          taggedMsi.id,
        );

        const response = await makeRequest()
          .get('/api/price-guide/measure-sheet-items')
          .query({ tags: tag.id })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].name).toBe('Featured MSI');
      });

      it('should filter MSIs by multiple tags (OR logic)', async () => {
        const category = await createTestCategory(em, setup.company, {
          name: 'Test Category',
        });
        const tag1 = await createTestTag(em, setup.company, { name: 'Tag1' });
        const tag2 = await createTestTag(em, setup.company, { name: 'Tag2' });

        const msi1 = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
          { name: 'MSI 1' },
        );
        const msi2 = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
          { name: 'MSI 2' },
        );
        await createTestMeasureSheetItem(em, setup.company, category, {
          name: 'MSI 3',
        });

        await assignTagToEntity(
          em,
          tag1,
          TaggableEntityType.MEASURE_SHEET_ITEM,
          msi1.id,
        );
        await assignTagToEntity(
          em,
          tag2,
          TaggableEntityType.MEASURE_SHEET_ITEM,
          msi2.id,
        );

        const response = await makeRequest()
          .get('/api/price-guide/measure-sheet-items')
          .query({ tags: `${tag1.id},${tag2.id}` })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(2);
      });

      it('should include tags in MSI list response', async () => {
        const category = await createTestCategory(em, setup.company, {
          name: 'Test Category',
        });
        const tag = await createTestTag(em, setup.company, {
          name: 'Premium',
          color: '#FF5722',
        });
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        await assignTagToEntity(
          em,
          tag,
          TaggableEntityType.MEASURE_SHEET_ITEM,
          msi.id,
        );

        const response = await makeRequest()
          .get('/api/price-guide/measure-sheet-items')
          .set('Cookie', setup.adminCookie);

        const returnedMsi = response.body.items.find(
          (m: { id: string }) => m.id === msi.id,
        );
        expect(returnedMsi.tags).toHaveLength(1);
        expect(returnedMsi.tags[0].name).toBe('Premium');
        expect(returnedMsi.tags[0].color).toBe('#FF5722');
      });

      it('should include tags in MSI detail response', async () => {
        const category = await createTestCategory(em, setup.company, {
          name: 'Test Category',
        });
        const tag = await createTestTag(em, setup.company, {
          name: 'Featured',
          color: '#4CAF50',
        });
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        await assignTagToEntity(
          em,
          tag,
          TaggableEntityType.MEASURE_SHEET_ITEM,
          msi.id,
        );

        const response = await makeRequest()
          .get(`/api/price-guide/measure-sheet-items/${msi.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.item.tags).toHaveLength(1);
        expect(response.body.item.tags[0].name).toBe('Featured');
        expect(response.body.item.tags[0].color).toBe('#4CAF50');
      });
    });
  });
});
