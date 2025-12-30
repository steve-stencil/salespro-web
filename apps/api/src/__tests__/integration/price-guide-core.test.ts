import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import {
  createTestCategory,
  createTestMeasureSheetItem,
  createTestOption,
  createTestUpCharge,
  linkOptionToMeasureSheetItem,
  linkUpChargeToMeasureSheetItem,
} from '../factories/price-guide';

import {
  createCompanySetup,
  createUserWithPermissions,
} from './auth-test-helpers';
import { makeRequest, getTestApp } from './helpers';

import type { CompanySetup } from './auth-test-helpers';
import type { EntityManager } from '@mikro-orm/core';

describe('Price Guide Core Routes', () => {
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
  // Categories
  // ==========================================================================

  describe('Categories (/api/price-guide/categories)', () => {
    describe('GET /api/price-guide/categories', () => {
      it('should return category tree', async () => {
        const parent = await createTestCategory(em, setup.company, {
          name: 'Windows',
        });
        await createTestCategory(em, setup.company, {
          name: 'Double Hung',
          parent,
        });
        await createTestCategory(em, setup.company, {
          name: 'Casement',
          parent,
        });

        const response = await makeRequest()
          .get('/api/price-guide/categories')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.categories).toHaveLength(1); // Only root categories
        expect(response.body.categories[0].name).toBe('Windows');
        expect(response.body.categories[0].children).toHaveLength(2);
      });

      it('should return empty array when no categories', async () => {
        const response = await makeRequest()
          .get('/api/price-guide/categories')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.categories).toHaveLength(0);
      });

      it('should require authentication', async () => {
        const response = await makeRequest().get('/api/price-guide/categories');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/price-guide/categories/:id', () => {
      it('should return category details with path', async () => {
        const parent = await createTestCategory(em, setup.company, {
          name: 'Windows',
        });
        const child = await createTestCategory(em, setup.company, {
          name: 'Double Hung',
          parent,
        });

        const response = await makeRequest()
          .get(`/api/price-guide/categories/${child.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.category.name).toBe('Double Hung');
        expect(response.body.category.fullPath).toBe('Windows > Double Hung');
      });

      it('should return 404 for non-existent category', async () => {
        const response = await makeRequest()
          .get(
            '/api/price-guide/categories/00000000-0000-0000-0000-000000000000',
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/price-guide/categories', () => {
      it('should create a root category', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/categories')
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Doors',
          });

        expect(response.status).toBe(201);
        expect(response.body.category.name).toBe('Doors');
        expect(response.body.category.depth).toBe(0);
      });

      it('should create a child category', async () => {
        const parent = await createTestCategory(em, setup.company, {
          name: 'Windows',
        });

        const response = await makeRequest()
          .post('/api/price-guide/categories')
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Sliding',
            parentId: parent.id,
          });

        expect(response.status).toBe(201);
        expect(response.body.category.depth).toBe(1);
      });

      it('should validate name is required', async () => {
        const response = await makeRequest()
          .post('/api/price-guide/categories')
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
          .post('/api/price-guide/categories')
          .set('Cookie', readOnlyUser.cookie)
          .send({ name: 'Test' });

        expect(response.status).toBe(403);
      });
    });

    describe('PUT /api/price-guide/categories/:id', () => {
      it('should update category name', async () => {
        const category = await createTestCategory(em, setup.company, {
          name: 'Original',
        });

        const response = await makeRequest()
          .put(`/api/price-guide/categories/${category.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Updated',
            version: category.version,
          });

        expect(response.status).toBe(200);
        expect(response.body.category.name).toBe('Updated');
      });

      it('should return 409 on version conflict', async () => {
        const category = await createTestCategory(em, setup.company);

        const response = await makeRequest()
          .put(`/api/price-guide/categories/${category.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Updated',
            version: 999,
          });

        expect(response.status).toBe(409);
      });
    });

    describe('DELETE /api/price-guide/categories/:id', () => {
      it('should soft delete a category', async () => {
        const category = await createTestCategory(em, setup.company);

        const response = await makeRequest()
          .delete(`/api/price-guide/categories/${category.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
      });

      it('should prevent deleting category with children', async () => {
        const parent = await createTestCategory(em, setup.company, {
          name: 'Parent',
        });
        await createTestCategory(em, setup.company, {
          name: 'Child',
          parent,
        });

        const response = await makeRequest()
          .delete(`/api/price-guide/categories/${parent.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(409);
        expect(response.body.error).toBe('Category has children');
      });
    });

    describe('PUT /api/price-guide/categories/:id/move', () => {
      it('should move category to new parent', async () => {
        const parent1 = await createTestCategory(em, setup.company, {
          name: 'Parent 1',
        });
        const parent2 = await createTestCategory(em, setup.company, {
          name: 'Parent 2',
        });
        const child = await createTestCategory(em, setup.company, {
          name: 'Child',
          parent: parent1,
        });

        const response = await makeRequest()
          .put(`/api/price-guide/categories/${child.id}/move`)
          .set('Cookie', setup.adminCookie)
          .send({
            newParentId: parent2.id,
            sortOrder: 0,
          });

        expect(response.status).toBe(200);

        // Verify parent changed
        const getResponse = await makeRequest()
          .get(`/api/price-guide/categories/${child.id}`)
          .set('Cookie', setup.adminCookie);

        expect(getResponse.body.category.parentId).toBe(parent2.id);
      });

      it('should move to root when newParentId is null', async () => {
        const parent = await createTestCategory(em, setup.company, {
          name: 'Parent',
        });
        const child = await createTestCategory(em, setup.company, {
          name: 'Child',
          parent,
        });

        const response = await makeRequest()
          .put(`/api/price-guide/categories/${child.id}/move`)
          .set('Cookie', setup.adminCookie)
          .send({
            newParentId: null,
            sortOrder: 0,
          });

        expect(response.status).toBe(200);

        const getResponse = await makeRequest()
          .get(`/api/price-guide/categories/${child.id}`)
          .set('Cookie', setup.adminCookie);

        expect(getResponse.body.category.depth).toBe(0);
      });

      it('should prevent circular reference', async () => {
        const parent = await createTestCategory(em, setup.company, {
          name: 'Parent',
        });
        const child = await createTestCategory(em, setup.company, {
          name: 'Child',
          parent,
        });

        const response = await makeRequest()
          .put(`/api/price-guide/categories/${parent.id}/move`)
          .set('Cookie', setup.adminCookie)
          .send({
            newParentId: child.id, // Try to make parent a child of its child
            sortOrder: 0,
          });

        expect(response.status).toBe(400);
      });

      it('should reorder categories with sortOrder', async () => {
        // Create categories in specific order
        await createTestCategory(em, setup.company, {
          name: 'Category A',
          sortOrder: 0,
        });
        await createTestCategory(em, setup.company, {
          name: 'Category B',
          sortOrder: 1,
        });
        const cat3 = await createTestCategory(em, setup.company, {
          name: 'Category C',
          sortOrder: 2,
        });

        // Move cat3 to be first (before cat1)
        const response = await makeRequest()
          .put(`/api/price-guide/categories/${cat3.id}/move`)
          .set('Cookie', setup.adminCookie)
          .send({
            newParentId: null,
            sortOrder: -1, // Before cat1's sortOrder of 0
          });

        expect(response.status).toBe(200);
        expect(response.body.category.sortOrder).toBe(-1);

        // Verify order in tree response
        const treeResponse = await makeRequest()
          .get('/api/price-guide/categories')
          .set('Cookie', setup.adminCookie);

        expect(treeResponse.status).toBe(200);
        const names = treeResponse.body.categories.map(
          (c: { name: string }) => c.name,
        );
        expect(names).toEqual(['Category C', 'Category A', 'Category B']);
      });
    });

    describe('Cascading MSI counts', () => {
      it('should include MSI counts from child categories in parent count', async () => {
        // Create category hierarchy: Parent > Child > Grandchild
        const parent = await createTestCategory(em, setup.company, {
          name: 'Parent',
        });
        const child = await createTestCategory(em, setup.company, {
          name: 'Child',
          parent,
        });
        const grandchild = await createTestCategory(em, setup.company, {
          name: 'Grandchild',
          parent: child,
        });

        // Create MSIs in different levels
        await createTestMeasureSheetItem(em, setup.company, parent, {
          name: 'Parent MSI',
        });
        await createTestMeasureSheetItem(em, setup.company, child, {
          name: 'Child MSI 1',
        });
        await createTestMeasureSheetItem(em, setup.company, child, {
          name: 'Child MSI 2',
        });
        await createTestMeasureSheetItem(em, setup.company, grandchild, {
          name: 'Grandchild MSI',
        });

        const response = await makeRequest()
          .get('/api/price-guide/categories')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);

        const parentNode = response.body.categories.find(
          (c: { name: string }) => c.name === 'Parent',
        );
        expect(parentNode).toBeDefined();
        // Parent should have: 1 (direct) + 2 (child) + 1 (grandchild) = 4
        expect(parentNode.msiCount).toBe(4);
        expect(parentNode.directMsiCount).toBe(1);

        // Child should have: 2 (direct) + 1 (grandchild) = 3
        const childNode = parentNode.children.find(
          (c: { name: string }) => c.name === 'Child',
        );
        expect(childNode.msiCount).toBe(3);
        expect(childNode.directMsiCount).toBe(2);

        // Grandchild should have: 1 (direct only)
        const grandchildNode = childNode.children.find(
          (c: { name: string }) => c.name === 'Grandchild',
        );
        expect(grandchildNode.msiCount).toBe(1);
        expect(grandchildNode.directMsiCount).toBe(1);
      });

      it('should show 0 count for categories with no MSIs', async () => {
        await createTestCategory(em, setup.company, {
          name: 'Empty Category',
        });

        const response = await makeRequest()
          .get('/api/price-guide/categories')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);

        const emptyCategory = response.body.categories.find(
          (c: { name: string }) => c.name === 'Empty Category',
        );
        expect(emptyCategory.msiCount).toBe(0);
        expect(emptyCategory.directMsiCount).toBe(0);
      });

      it('should update counts when MSI is moved to different category', async () => {
        const cat1 = await createTestCategory(em, setup.company, {
          name: 'Category 1',
        });
        const cat2 = await createTestCategory(em, setup.company, {
          name: 'Category 2',
        });

        const msi = await createTestMeasureSheetItem(em, setup.company, cat1, {
          name: 'Movable MSI',
        });

        // Initially cat1 should have 1, cat2 should have 0
        let response = await makeRequest()
          .get('/api/price-guide/categories')
          .set('Cookie', setup.adminCookie);

        let cat1Node = response.body.categories.find(
          (c: { name: string }) => c.name === 'Category 1',
        );
        let cat2Node = response.body.categories.find(
          (c: { name: string }) => c.name === 'Category 2',
        );
        expect(cat1Node.msiCount).toBe(1);
        expect(cat2Node.msiCount).toBe(0);

        // Move MSI to cat2
        await makeRequest()
          .put(`/api/price-guide/measure-sheet-items/${msi.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            categoryId: cat2.id,
            version: msi.version,
          });

        // Now cat1 should have 0, cat2 should have 1
        response = await makeRequest()
          .get('/api/price-guide/categories')
          .set('Cookie', setup.adminCookie);

        cat1Node = response.body.categories.find(
          (c: { name: string }) => c.name === 'Category 1',
        );
        cat2Node = response.body.categories.find(
          (c: { name: string }) => c.name === 'Category 2',
        );
        expect(cat1Node.msiCount).toBe(0);
        expect(cat2Node.msiCount).toBe(1);
      });
    });
  });

  // ==========================================================================
  // Measure Sheet Items
  // ==========================================================================

  describe('Measure Sheet Items (/api/price-guide/measure-sheet-items)', () => {
    describe('GET /api/price-guide/measure-sheet-items', () => {
      it('should list MSIs for a category', async () => {
        const category = await createTestCategory(em, setup.company);
        await createTestMeasureSheetItem(em, setup.company, category, {
          name: 'MSI A',
        });
        await createTestMeasureSheetItem(em, setup.company, category, {
          name: 'MSI B',
        });

        const response = await makeRequest()
          .get('/api/price-guide/measure-sheet-items')
          .query({ categoryId: category.id })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(2);
      });

      it('should support search', async () => {
        const category = await createTestCategory(em, setup.company);
        await createTestMeasureSheetItem(em, setup.company, category, {
          name: 'Double Hung Window',
        });
        await createTestMeasureSheetItem(em, setup.company, category, {
          name: 'Casement Window',
        });

        const response = await makeRequest()
          .get('/api/price-guide/measure-sheet-items')
          .query({ categoryId: category.id, search: 'Double' })
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
      });

      it('should list all MSIs when no categoryId', async () => {
        const category = await createTestCategory(em, setup.company);
        await createTestMeasureSheetItem(em, setup.company, category, {
          name: 'MSI 1',
        });
        await createTestMeasureSheetItem(em, setup.company, category, {
          name: 'MSI 2',
        });

        const response = await makeRequest()
          .get('/api/price-guide/measure-sheet-items')
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.items.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('GET /api/price-guide/measure-sheet-items/:id', () => {
      it('should return MSI with linked options and upcharges', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
          { name: 'Test MSI' },
        );
        const option = await createTestOption(em, setup.company);
        const upCharge = await createTestUpCharge(em, setup.company);

        await linkOptionToMeasureSheetItem(em, msi, option, 0);
        await linkUpChargeToMeasureSheetItem(em, msi, upCharge, 0);

        const response = await makeRequest()
          .get(`/api/price-guide/measure-sheet-items/${msi.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
        expect(response.body.item.name).toBe('Test MSI');
        expect(response.body.item.options).toHaveLength(1);
        expect(response.body.item.upcharges).toHaveLength(1);
      });
    });

    describe('POST /api/price-guide/measure-sheet-items', () => {
      it('should create an MSI', async () => {
        const category = await createTestCategory(em, setup.company);
        // At least one option is required. See ADR-003.
        const option = await createTestOption(em, setup.company);

        const response = await makeRequest()
          .post('/api/price-guide/measure-sheet-items')
          .set('Cookie', setup.adminCookie)
          .send({
            categoryId: category.id,
            name: 'New MSI',
            note: 'A new measure sheet item',
            measurementType: 'sqft',
            officeIds: [setup.office!.id],
            optionIds: [option.id],
          });

        expect(response.status).toBe(201);
        expect(response.body.item.name).toBe('New MSI');
      });

      it('should validate category exists', async () => {
        // At least one option is required. See ADR-003.
        const option = await createTestOption(em, setup.company);

        const response = await makeRequest()
          .post('/api/price-guide/measure-sheet-items')
          .set('Cookie', setup.adminCookie)
          .send({
            categoryId: '00000000-0000-0000-0000-000000000000',
            name: 'New MSI',
            measurementType: 'sqft',
            officeIds: [setup.office!.id],
            optionIds: [option.id],
          });

        expect(response.status).toBe(400);
      });
    });

    describe('PUT /api/price-guide/measure-sheet-items/:id', () => {
      it('should update an MSI', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        const response = await makeRequest()
          .put(`/api/price-guide/measure-sheet-items/${msi.id}`)
          .set('Cookie', setup.adminCookie)
          .send({
            name: 'Updated MSI',
            version: msi.version,
          });

        expect(response.status).toBe(200);
        expect(response.body.item.name).toBe('Updated MSI');
      });
    });

    describe('PUT /api/price-guide/measure-sheet-items/:id/thumbnail', () => {
      it('should update MSI thumbnail without requiring version', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        // Update with null (clear thumbnail)
        const response = await makeRequest()
          .put(`/api/price-guide/measure-sheet-items/${msi.id}/thumbnail`)
          .set('Cookie', setup.adminCookie)
          .send({ imageId: null });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Thumbnail updated');
        expect(response.body.thumbnailUrl).toBeNull();
      });

      it('should return 404 for non-existent MSI', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';

        const response = await makeRequest()
          .put(`/api/price-guide/measure-sheet-items/${fakeId}/thumbnail`)
          .set('Cookie', setup.adminCookie)
          .send({ imageId: null });

        expect(response.status).toBe(404);
      });

      it('should require authentication', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        const response = await makeRequest()
          .put(`/api/price-guide/measure-sheet-items/${msi.id}/thumbnail`)
          .send({ imageId: null });

        expect(response.status).toBe(401);
      });

      it('should require settings:update permission', async () => {
        const noPermUser = await createUserWithPermissions(
          em,
          setup.company,
          [],
        );
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        const response = await makeRequest()
          .put(`/api/price-guide/measure-sheet-items/${msi.id}/thumbnail`)
          .set('Cookie', noPermUser.cookie)
          .send({ imageId: null });

        expect(response.status).toBe(403);
      });
    });

    describe('DELETE /api/price-guide/measure-sheet-items/:id', () => {
      it('should soft delete an MSI', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );

        const response = await makeRequest()
          .delete(`/api/price-guide/measure-sheet-items/${msi.id}`)
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
      });
    });

    describe('Link/Unlink Options', () => {
      it('should link options to MSI', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        const option = await createTestOption(em, setup.company);

        const response = await makeRequest()
          .post(`/api/price-guide/measure-sheet-items/${msi.id}/options`)
          .set('Cookie', setup.adminCookie)
          .send({ optionIds: [option.id] });

        expect(response.status).toBe(200);
      });

      it('should unlink an option from MSI', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        // Need at least 2 options to unlink one (ADR-003 requires >= 1 option)
        const option1 = await createTestOption(em, setup.company);
        const option2 = await createTestOption(em, setup.company);
        await linkOptionToMeasureSheetItem(em, msi, option1, 0);
        await linkOptionToMeasureSheetItem(em, msi, option2, 1);

        const response = await makeRequest()
          .delete(
            `/api/price-guide/measure-sheet-items/${msi.id}/options/${option1.id}`,
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
      });

      it('should not allow unlinking the last option from MSI', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        // Only one option - cannot unlink (ADR-003 requires >= 1 option)
        const option = await createTestOption(em, setup.company);
        await linkOptionToMeasureSheetItem(em, msi, option, 0);

        const response = await makeRequest()
          .delete(
            `/api/price-guide/measure-sheet-items/${msi.id}/options/${option.id}`,
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('CANNOT_REMOVE_LAST_OPTION');
      });

      it('should skip already-linked options', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        const option = await createTestOption(em, setup.company);
        await linkOptionToMeasureSheetItem(em, msi, option, 0);

        // Linking an already-linked option should succeed but link 0
        const response = await makeRequest()
          .post(`/api/price-guide/measure-sheet-items/${msi.id}/options`)
          .set('Cookie', setup.adminCookie)
          .send({ optionIds: [option.id] });

        expect(response.status).toBe(200);
        expect(response.body.linked).toBe(0);
      });
    });

    describe('Link/Unlink UpCharges', () => {
      it('should link upcharges to MSI', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        const upCharge = await createTestUpCharge(em, setup.company);

        const response = await makeRequest()
          .post(`/api/price-guide/measure-sheet-items/${msi.id}/upcharges`)
          .set('Cookie', setup.adminCookie)
          .send({ upchargeIds: [upCharge.id] });

        expect(response.status).toBe(200);
      });

      it('should unlink an upcharge from MSI', async () => {
        const category = await createTestCategory(em, setup.company);
        const msi = await createTestMeasureSheetItem(
          em,
          setup.company,
          category,
        );
        const upCharge = await createTestUpCharge(em, setup.company);
        await linkUpChargeToMeasureSheetItem(em, msi, upCharge, 0);

        const response = await makeRequest()
          .delete(
            `/api/price-guide/measure-sheet-items/${msi.id}/upcharges/${upCharge.id}`,
          )
          .set('Cookie', setup.adminCookie);

        expect(response.status).toBe(200);
      });
    });
  });
});
