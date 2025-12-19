import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';

import {
  RoleType,
  Company,
  User,
  Role,
  UserRole,
  Session,
  SessionSource,
  PriceGuideCategory,
  MeasureSheetItem,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

/**
 * Integration tests for Measure Sheet Item routes.
 * Tests CRUD operations, category relationships, and authorization.
 */
describe('Measure Sheet Items Routes', () => {
  let testCompany: Company;
  let adminUser: User;
  let adminRole: Role;
  let testCategory: PriceGuideCategory;
  let sessionId: string;
  let cookie: string;

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Create test company
    testCompany = em.create(Company, {
      id: uuid(),
      name: 'Measure Sheet Test Company',
      maxSessionsPerUser: 5,
      mfaRequired: false,
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
    em.persist(testCompany);

    // Create test category
    testCategory = em.create(PriceGuideCategory, {
      id: uuid(),
      name: 'Roofing',
      company: testCompany,
      sortOrder: 0,
      isActive: true,
    });
    em.persist(testCategory);

    // Create admin role with all permissions
    adminRole = em.create(Role, {
      id: uuid(),
      name: `itemsTestAdmin-${Date.now()}`,
      displayName: 'Items Test Admin',
      permissions: ['*'],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRole);

    // Create admin user
    adminUser = em.create(User, {
      id: uuid(),
      email: `admin-items-${Date.now()}@example.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'Admin',
      nameLast: 'User',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: testCompany,
    });
    em.persist(adminUser);

    // Assign admin role to admin user
    const userRole = em.create(UserRole, {
      id: uuid(),
      user: adminUser,
      role: adminRole,
      company: testCompany,
    });
    em.persist(userRole);

    // Create session
    sessionId = uuid();
    const session = em.create(Session, {
      sid: sessionId,
      user: adminUser,
      company: testCompany,
      data: { userId: adminUser.id },
      source: SessionSource.WEB,
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      mfaVerified: false,
    });
    em.persist(session);

    await em.flush();

    cookie = `sid=${sessionId}`;
  });

  afterEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up in correct order (respecting FK constraints)
    await em.nativeDelete('measure_sheet_item', {});
    await em.nativeDelete('price_guide_category_office', {});
    await em.nativeDelete('price_guide_category', {});
    await em.nativeDelete('user_role', {});
    await em.nativeDelete('session', {});
    await em.nativeDelete('user', {});
    await em.nativeDelete('role', {});
    await em.nativeDelete('company', {});
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Create a user with specific permissions
   */
  async function createUserWithPermissions(
    permissions: string[],
  ): Promise<{ user: User; cookie: string }> {
    const orm = getORM();
    const em = orm.em.fork();

    const role = em.create(Role, {
      id: uuid(),
      name: `testRole-${Date.now()}-${Math.random()}`,
      displayName: 'Test Role',
      permissions,
      type: RoleType.COMPANY,
      company: testCompany,
    });
    em.persist(role);

    const user = em.create(User, {
      id: uuid(),
      email: `test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'Test',
      nameLast: 'User',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: testCompany,
    });
    em.persist(user);

    const userRole = em.create(UserRole, {
      id: uuid(),
      user,
      role,
      company: testCompany,
    });
    em.persist(userRole);

    const sid = uuid();
    const session = em.create(Session, {
      sid,
      user,
      company: testCompany,
      data: { userId: user.id },
      source: SessionSource.WEB,
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      mfaVerified: false,
    });
    em.persist(session);

    await em.flush();

    return { user, cookie: `sid=${sid}` };
  }

  /**
   * Create a test item directly in the database
   */
  async function createItem(
    name: string,
    categoryId: string,
    description?: string,
  ): Promise<MeasureSheetItem> {
    const orm = getORM();
    const em = orm.em.fork();

    const item = em.create(MeasureSheetItem, {
      id: uuid(),
      name,
      description,
      category: em.getReference(PriceGuideCategory, categoryId),
      company: testCompany,
      sortOrder: 0,
      isActive: true,
    });
    em.persist(item);
    await em.flush();

    return item;
  }

  /**
   * Create an additional category
   */
  async function createCategory(name: string): Promise<PriceGuideCategory> {
    const orm = getORM();
    const em = orm.em.fork();

    const category = em.create(PriceGuideCategory, {
      id: uuid(),
      name,
      company: testCompany,
      sortOrder: 0,
      isActive: true,
    });
    em.persist(category);
    await em.flush();

    return category;
  }

  // ============================================================================
  // GET /price-guide/items - List items
  // ============================================================================

  describe('GET /api/price-guide/items', () => {
    it('should return empty array when no items exist', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/items')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
    });

    it('should return all items for the company', async () => {
      await createItem('GAF Timberline HD', testCategory.id);
      await createItem('Owens Corning Duration', testCategory.id);

      const response = await makeRequest()
        .get('/api/price-guide/items')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
    });

    it('should include category name in response', async () => {
      await createItem('GAF Timberline HD', testCategory.id);

      const response = await makeRequest()
        .get('/api/price-guide/items')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.items[0].categoryName).toBe('Roofing');
    });

    it('should filter by categoryId', async () => {
      const otherCategory = await createCategory('Windows');
      await createItem('GAF Timberline HD', testCategory.id);
      await createItem('Double Hung Window', otherCategory.id);

      const response = await makeRequest()
        .get(`/api/price-guide/items?categoryId=${testCategory.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe('GAF Timberline HD');
    });

    it('should filter by isActive', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const activeItem = em.create(MeasureSheetItem, {
        id: uuid(),
        name: 'Active Item',
        category: testCategory,
        company: testCompany,
        isActive: true,
      });
      em.persist(activeItem);

      const inactiveItem = em.create(MeasureSheetItem, {
        id: uuid(),
        name: 'Inactive Item',
        category: testCategory,
        company: testCompany,
        isActive: false,
      });
      em.persist(inactiveItem);
      await em.flush();

      const response = await makeRequest()
        .get('/api/price-guide/items?isActive=true')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe('Active Item');
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get('/api/price-guide/items');
      expect(response.status).toBe(401);
    });

    it('should return 403 without priceGuide:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .get('/api/price-guide/items')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });

    it('should allow access with priceGuide:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'priceGuide:read',
      ]);

      const response = await makeRequest()
        .get('/api/price-guide/items')
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // GET /price-guide/items/:id - Get single item
  // ============================================================================

  describe('GET /api/price-guide/items/:id', () => {
    it('should return item by ID', async () => {
      const item = await createItem(
        'GAF Timberline HD',
        testCategory.id,
        'Premium shingles',
      );

      const response = await makeRequest()
        .get(`/api/price-guide/items/${item.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.item.id).toBe(item.id);
      expect(response.body.item.name).toBe('GAF Timberline HD');
      expect(response.body.item.description).toBe('Premium shingles');
      expect(response.body.item.categoryId).toBe(testCategory.id);
      expect(response.body.item.categoryName).toBe('Roofing');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await makeRequest()
        .get(`/api/price-guide/items/${uuid()}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Item not found');
    });

    it('should not return item from another company', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create another company with category and item
      const otherCompany = em.create(Company, {
        id: uuid(),
        name: 'Other Company',
      });
      em.persist(otherCompany);

      const otherCategory = em.create(PriceGuideCategory, {
        id: uuid(),
        name: 'Other Category',
        company: otherCompany,
      });
      em.persist(otherCategory);

      const otherItem = em.create(MeasureSheetItem, {
        id: uuid(),
        name: 'Other Item',
        category: otherCategory,
        company: otherCompany,
      });
      em.persist(otherItem);
      await em.flush();

      const response = await makeRequest()
        .get(`/api/price-guide/items/${otherItem.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /price-guide/items - Create item
  // ============================================================================

  describe('POST /api/price-guide/items', () => {
    it('should create an item', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/items')
        .set('Cookie', cookie)
        .send({
          name: 'GAF Timberline HD',
          categoryId: testCategory.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.item.name).toBe('GAF Timberline HD');
      expect(response.body.item.categoryId).toBe(testCategory.id);
      expect(response.body.message).toBe('Item created successfully');
    });

    it('should create item with description', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/items')
        .set('Cookie', cookie)
        .send({
          name: 'GAF Timberline HD',
          description: 'Premium architectural shingles',
          categoryId: testCategory.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.item.description).toBe(
        'Premium architectural shingles',
      );
    });

    it('should set sortOrder and isActive', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/items')
        .set('Cookie', cookie)
        .send({
          name: 'GAF Timberline HD',
          categoryId: testCategory.id,
          sortOrder: 5,
          isActive: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.item.sortOrder).toBe(5);
      expect(response.body.item.isActive).toBe(false);
    });

    it('should return 400 for missing name', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/items')
        .set('Cookie', cookie)
        .send({ categoryId: testCategory.id });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing categoryId', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/items')
        .set('Cookie', cookie)
        .send({ name: 'GAF Timberline HD' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid categoryId', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/items')
        .set('Cookie', cookie)
        .send({
          name: 'GAF Timberline HD',
          categoryId: uuid(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Category not found');
    });

    it('should return 409 for duplicate name in same category', async () => {
      await createItem('GAF Timberline HD', testCategory.id);

      const response = await makeRequest()
        .post('/api/price-guide/items')
        .set('Cookie', cookie)
        .send({
          name: 'GAF Timberline HD',
          categoryId: testCategory.id,
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Item name already exists');
    });

    it('should allow same name in different categories', async () => {
      const otherCategory = await createCategory('Windows');
      await createItem('Premium Item', testCategory.id);

      const response = await makeRequest()
        .post('/api/price-guide/items')
        .set('Cookie', cookie)
        .send({
          name: 'Premium Item',
          categoryId: otherCategory.id,
        });

      expect(response.status).toBe(201);
    });

    it('should return 403 without priceGuide:create permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'priceGuide:read',
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/items')
        .set('Cookie', userCookie)
        .send({
          name: 'GAF Timberline HD',
          categoryId: testCategory.id,
        });

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // PATCH /price-guide/items/:id - Update item
  // ============================================================================

  describe('PATCH /api/price-guide/items/:id', () => {
    it('should update item name', async () => {
      const item = await createItem('GAF Timberline HD', testCategory.id);

      const response = await makeRequest()
        .patch(`/api/price-guide/items/${item.id}`)
        .set('Cookie', cookie)
        .send({ name: 'GAF Timberline HDZ' });

      expect(response.status).toBe(200);
      expect(response.body.item.name).toBe('GAF Timberline HDZ');
    });

    it('should update item description', async () => {
      const item = await createItem('GAF Timberline HD', testCategory.id);

      const response = await makeRequest()
        .patch(`/api/price-guide/items/${item.id}`)
        .set('Cookie', cookie)
        .send({ description: 'Updated description' });

      expect(response.status).toBe(200);
      expect(response.body.item.description).toBe('Updated description');
    });

    it('should clear description with null', async () => {
      const item = await createItem(
        'GAF Timberline HD',
        testCategory.id,
        'Original description',
      );

      const response = await makeRequest()
        .patch(`/api/price-guide/items/${item.id}`)
        .set('Cookie', cookie)
        .send({ description: null });

      expect(response.status).toBe(200);
      expect(response.body.item.description).toBeNull();
    });

    it('should move item to different category', async () => {
      const otherCategory = await createCategory('Windows');
      const item = await createItem('Universal Item', testCategory.id);

      const response = await makeRequest()
        .patch(`/api/price-guide/items/${item.id}`)
        .set('Cookie', cookie)
        .send({ categoryId: otherCategory.id });

      expect(response.status).toBe(200);
      expect(response.body.item.categoryId).toBe(otherCategory.id);
      expect(response.body.item.categoryName).toBe('Windows');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await makeRequest()
        .patch(`/api/price-guide/items/${uuid()}`)
        .set('Cookie', cookie)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid categoryId', async () => {
      const item = await createItem('GAF Timberline HD', testCategory.id);

      const response = await makeRequest()
        .patch(`/api/price-guide/items/${item.id}`)
        .set('Cookie', cookie)
        .send({ categoryId: uuid() });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Category not found');
    });

    it('should return 409 for duplicate name in same category', async () => {
      await createItem('GAF Timberline HD', testCategory.id);
      const item = await createItem('Owens Corning', testCategory.id);

      const response = await makeRequest()
        .patch(`/api/price-guide/items/${item.id}`)
        .set('Cookie', cookie)
        .send({ name: 'GAF Timberline HD' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Item name already exists');
    });
  });

  // ============================================================================
  // DELETE /price-guide/items/:id - Delete item
  // ============================================================================

  describe('DELETE /api/price-guide/items/:id', () => {
    it('should delete item', async () => {
      const item = await createItem('GAF Timberline HD', testCategory.id);

      const response = await makeRequest()
        .delete(`/api/price-guide/items/${item.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Item deleted successfully');

      // Verify deletion
      const checkResponse = await makeRequest()
        .get(`/api/price-guide/items/${item.id}`)
        .set('Cookie', cookie);
      expect(checkResponse.status).toBe(404);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await makeRequest()
        .delete(`/api/price-guide/items/${uuid()}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });

    it('should return 403 without priceGuide:delete permission', async () => {
      const item = await createItem('GAF Timberline HD', testCategory.id);
      const { cookie: userCookie } = await createUserWithPermissions([
        'priceGuide:read',
      ]);

      const response = await makeRequest()
        .delete(`/api/price-guide/items/${item.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // Cross-company isolation tests
  // ============================================================================

  describe('Cross-company isolation', () => {
    it('should not list items from other companies', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create other company with category and item
      const otherCompany = em.create(Company, {
        id: uuid(),
        name: 'Other Company',
      });
      em.persist(otherCompany);

      const otherCategory = em.create(PriceGuideCategory, {
        id: uuid(),
        name: 'Other Category',
        company: otherCompany,
      });
      em.persist(otherCategory);

      const otherItem = em.create(MeasureSheetItem, {
        id: uuid(),
        name: 'Other Item',
        category: otherCategory,
        company: otherCompany,
      });
      em.persist(otherItem);

      // Create item for test company
      const myItem = em.create(MeasureSheetItem, {
        id: uuid(),
        name: 'My Item',
        category: testCategory,
        company: testCompany,
      });
      em.persist(myItem);
      await em.flush();

      const response = await makeRequest()
        .get('/api/price-guide/items')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe('My Item');
    });
  });
});
