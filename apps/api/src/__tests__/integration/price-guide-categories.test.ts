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
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

/**
 * Integration tests for Price Guide Category routes.
 * Tests CRUD operations, hierarchical structure, and authorization.
 */
describe('Price Guide Categories Routes', () => {
  let testCompany: Company;
  let adminUser: User;
  let adminRole: Role;
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
      name: 'Price Guide Test Company',
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

    // Create admin role with all permissions
    adminRole = em.create(Role, {
      id: uuid(),
      name: `priceGuideTestAdmin-${Date.now()}`,
      displayName: 'Price Guide Test Admin',
      permissions: ['*'],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRole);

    // Create admin user
    adminUser = em.create(User, {
      id: uuid(),
      email: `admin-priceguide-${Date.now()}@example.com`,
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
   * Create a test category directly in the database
   */
  async function createCategory(
    name: string,
    parentId?: string,
  ): Promise<PriceGuideCategory> {
    const orm = getORM();
    const em = orm.em.fork();

    const category = em.create(PriceGuideCategory, {
      id: uuid(),
      name,
      company: testCompany,
      sortOrder: 0,
      isActive: true,
      parent: parentId
        ? em.getReference(PriceGuideCategory, parentId)
        : undefined,
    });
    em.persist(category);
    await em.flush();

    return category;
  }

  // ============================================================================
  // GET /price-guide/categories - List categories
  // ============================================================================

  describe('GET /api/price-guide/categories', () => {
    it('should return empty array when no categories exist', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/categories')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.categories).toEqual([]);
    });

    it('should return all categories for the company', async () => {
      await createCategory('Roofing');
      await createCategory('Windows');

      const response = await makeRequest()
        .get('/api/price-guide/categories')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.categories).toHaveLength(2);
      expect(
        response.body.categories.map((c: { name: string }) => c.name),
      ).toContain('Roofing');
      expect(
        response.body.categories.map((c: { name: string }) => c.name),
      ).toContain('Windows');
    });

    it('should include child and item counts', async () => {
      const parent = await createCategory('Roofing');
      await createCategory('Shingles', parent.id);
      await createCategory('Gutters', parent.id);

      const response = await makeRequest()
        .get('/api/price-guide/categories')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      const roofing = response.body.categories.find(
        (c: { name: string }) => c.name === 'Roofing',
      );
      expect(roofing.childCount).toBe(2);
      expect(roofing.itemCount).toBe(0);
    });

    it('should filter by parentId', async () => {
      const parent = await createCategory('Roofing');
      await createCategory('Shingles', parent.id);
      await createCategory('Windows'); // root level

      const response = await makeRequest()
        .get(`/api/price-guide/categories?parentId=${parent.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.categories).toHaveLength(1);
      expect(response.body.categories[0].name).toBe('Shingles');
    });

    it('should filter by parentId=null for root categories', async () => {
      const parent = await createCategory('Roofing');
      await createCategory('Shingles', parent.id);

      const response = await makeRequest()
        .get('/api/price-guide/categories?parentId=null')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.categories).toHaveLength(1);
      expect(response.body.categories[0].name).toBe('Roofing');
    });

    it('should filter by isActive', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const activeCategory = em.create(PriceGuideCategory, {
        id: uuid(),
        name: 'Active Category',
        company: testCompany,
        isActive: true,
      });
      em.persist(activeCategory);

      const inactiveCategory = em.create(PriceGuideCategory, {
        id: uuid(),
        name: 'Inactive Category',
        company: testCompany,
        isActive: false,
      });
      em.persist(inactiveCategory);
      await em.flush();

      const response = await makeRequest()
        .get('/api/price-guide/categories?isActive=true')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.categories).toHaveLength(1);
      expect(response.body.categories[0].name).toBe('Active Category');
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get('/api/price-guide/categories');
      expect(response.status).toBe(401);
    });

    it('should return 403 without price_guide_category:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .get('/api/price-guide/categories')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });

    it('should allow access with price_guide_category:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'price_guide_category:read',
      ]);

      const response = await makeRequest()
        .get('/api/price-guide/categories')
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // GET /price-guide/categories/tree - Tree structure
  // ============================================================================

  describe('GET /api/price-guide/categories/tree', () => {
    it('should return hierarchical tree structure', async () => {
      const roofing = await createCategory('Roofing');
      await createCategory('Shingles', roofing.id);
      await createCategory('Gutters', roofing.id);
      await createCategory('Windows');

      const response = await makeRequest()
        .get('/api/price-guide/categories/tree')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.categories).toHaveLength(2); // Root categories

      const roofingNode = response.body.categories.find(
        (c: { name: string }) => c.name === 'Roofing',
      );
      expect(roofingNode.children).toHaveLength(2);
      expect(
        roofingNode.children.map((c: { name: string }) => c.name),
      ).toContain('Shingles');
      expect(
        roofingNode.children.map((c: { name: string }) => c.name),
      ).toContain('Gutters');

      const windowsNode = response.body.categories.find(
        (c: { name: string }) => c.name === 'Windows',
      );
      expect(windowsNode.children).toHaveLength(0);
    });

    it('should support deeply nested hierarchies', async () => {
      const roofing = await createCategory('Roofing');
      const shingles = await createCategory('Shingles', roofing.id);
      await createCategory('Asphalt Shingles', shingles.id);

      const response = await makeRequest()
        .get('/api/price-guide/categories/tree')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);

      const roofingNode = response.body.categories[0];
      expect(roofingNode.name).toBe('Roofing');
      expect(roofingNode.children[0].name).toBe('Shingles');
      expect(roofingNode.children[0].children[0].name).toBe('Asphalt Shingles');
    });
  });

  // ============================================================================
  // GET /price-guide/categories/:id - Get single category
  // ============================================================================

  describe('GET /api/price-guide/categories/:id', () => {
    it('should return category by ID', async () => {
      const category = await createCategory('Roofing');

      const response = await makeRequest()
        .get(`/api/price-guide/categories/${category.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.category.id).toBe(category.id);
      expect(response.body.category.name).toBe('Roofing');
      expect(response.body.category.parentId).toBeNull();
    });

    it('should return 404 for non-existent category', async () => {
      const response = await makeRequest()
        .get(`/api/price-guide/categories/${uuid()}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Category not found');
    });

    it('should not return category from another company', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create another company and category
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
      await em.flush();

      const response = await makeRequest()
        .get(`/api/price-guide/categories/${otherCategory.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /price-guide/categories - Create category
  // ============================================================================

  describe('POST /api/price-guide/categories', () => {
    it('should create a root category', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/categories')
        .set('Cookie', cookie)
        .send({ name: 'Roofing' });

      expect(response.status).toBe(201);
      expect(response.body.category.name).toBe('Roofing');
      expect(response.body.category.parentId).toBeNull();
      expect(response.body.message).toBe('Category created successfully');
    });

    it('should create a child category', async () => {
      const parent = await createCategory('Roofing');

      const response = await makeRequest()
        .post('/api/price-guide/categories')
        .set('Cookie', cookie)
        .send({ name: 'Shingles', parentId: parent.id });

      expect(response.status).toBe(201);
      expect(response.body.category.name).toBe('Shingles');
      expect(response.body.category.parentId).toBe(parent.id);
    });

    it('should set sortOrder and isActive', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/categories')
        .set('Cookie', cookie)
        .send({ name: 'Roofing', sortOrder: 10, isActive: false });

      expect(response.status).toBe(201);
      expect(response.body.category.sortOrder).toBe(10);
      expect(response.body.category.isActive).toBe(false);
    });

    it('should return 400 for missing name', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/categories')
        .set('Cookie', cookie)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid parent ID', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/categories')
        .set('Cookie', cookie)
        .send({ name: 'Shingles', parentId: uuid() });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Parent category not found');
    });

    it('should return 409 for duplicate name at same level', async () => {
      await createCategory('Roofing');

      const response = await makeRequest()
        .post('/api/price-guide/categories')
        .set('Cookie', cookie)
        .send({ name: 'Roofing' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Category name already exists');
    });

    it('should allow same name at different levels', async () => {
      const parent = await createCategory('Roofing');
      await createCategory('Materials'); // root level

      // Same name under different parent should be allowed
      const response = await makeRequest()
        .post('/api/price-guide/categories')
        .set('Cookie', cookie)
        .send({ name: 'Materials', parentId: parent.id });

      expect(response.status).toBe(201);
    });

    it('should return 403 without price_guide_category:create permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'price_guide_category:read',
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/categories')
        .set('Cookie', userCookie)
        .send({ name: 'Roofing' });

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // PATCH /price-guide/categories/:id - Update category
  // ============================================================================

  describe('PATCH /api/price-guide/categories/:id', () => {
    it('should update category name', async () => {
      const category = await createCategory('Roofing');

      const response = await makeRequest()
        .patch(`/api/price-guide/categories/${category.id}`)
        .set('Cookie', cookie)
        .send({ name: 'Roofing & Siding' });

      expect(response.status).toBe(200);
      expect(response.body.category.name).toBe('Roofing & Siding');
    });

    it('should move category to new parent', async () => {
      const roofing = await createCategory('Roofing');
      const windows = await createCategory('Windows');
      const shingles = await createCategory('Shingles', roofing.id);

      const response = await makeRequest()
        .patch(`/api/price-guide/categories/${shingles.id}`)
        .set('Cookie', cookie)
        .send({ parentId: windows.id });

      expect(response.status).toBe(200);
      expect(response.body.category.parentId).toBe(windows.id);
    });

    it('should move category to root level', async () => {
      const roofing = await createCategory('Roofing');
      const shingles = await createCategory('Shingles', roofing.id);

      const response = await makeRequest()
        .patch(`/api/price-guide/categories/${shingles.id}`)
        .set('Cookie', cookie)
        .send({ parentId: null });

      expect(response.status).toBe(200);
      expect(response.body.category.parentId).toBeNull();
    });

    it('should prevent circular reference (self-parent)', async () => {
      const category = await createCategory('Roofing');

      const response = await makeRequest()
        .patch(`/api/price-guide/categories/${category.id}`)
        .set('Cookie', cookie)
        .send({ parentId: category.id });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid parent');
    });

    it('should prevent circular reference (child as parent)', async () => {
      const parent = await createCategory('Roofing');
      const child = await createCategory('Shingles', parent.id);

      const response = await makeRequest()
        .patch(`/api/price-guide/categories/${parent.id}`)
        .set('Cookie', cookie)
        .send({ parentId: child.id });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid parent');
    });

    it('should return 404 for non-existent category', async () => {
      const response = await makeRequest()
        .patch(`/api/price-guide/categories/${uuid()}`)
        .set('Cookie', cookie)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
    });

    it('should return 409 for duplicate name at same level', async () => {
      await createCategory('Roofing');
      const windows = await createCategory('Windows');

      const response = await makeRequest()
        .patch(`/api/price-guide/categories/${windows.id}`)
        .set('Cookie', cookie)
        .send({ name: 'Roofing' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Category name already exists');
    });
  });

  // ============================================================================
  // DELETE /price-guide/categories/:id - Delete category
  // ============================================================================

  describe('DELETE /api/price-guide/categories/:id', () => {
    it('should delete empty category', async () => {
      const category = await createCategory('Roofing');

      const response = await makeRequest()
        .delete(`/api/price-guide/categories/${category.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Category deleted successfully');

      // Verify deletion
      const checkResponse = await makeRequest()
        .get(`/api/price-guide/categories/${category.id}`)
        .set('Cookie', cookie);
      expect(checkResponse.status).toBe(404);
    });

    it('should return 409 when category has children', async () => {
      const parent = await createCategory('Roofing');
      await createCategory('Shingles', parent.id);

      const response = await makeRequest()
        .delete(`/api/price-guide/categories/${parent.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Category has children or items');
      expect(response.body.childCount).toBe(1);
    });

    it('should force delete with children using ?force=true', async () => {
      const parent = await createCategory('Roofing');
      await createCategory('Shingles', parent.id);

      const response = await makeRequest()
        .delete(`/api/price-guide/categories/${parent.id}?force=true`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.deletedChildren).toBe(1);
    });

    it('should return 404 for non-existent category', async () => {
      const response = await makeRequest()
        .delete(`/api/price-guide/categories/${uuid()}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });

    it('should return 403 without price_guide_category:delete permission', async () => {
      const category = await createCategory('Roofing');
      const { cookie: userCookie } = await createUserWithPermissions([
        'price_guide_category:read',
      ]);

      const response = await makeRequest()
        .delete(`/api/price-guide/categories/${category.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // Cross-company isolation tests
  // ============================================================================

  describe('Cross-company isolation', () => {
    it('should not list categories from other companies', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create other company with category
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

      // Create category for test company
      const myCategory = em.create(PriceGuideCategory, {
        id: uuid(),
        name: 'My Category',
        company: testCompany,
      });
      em.persist(myCategory);
      await em.flush();

      const response = await makeRequest()
        .get('/api/price-guide/categories')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.categories).toHaveLength(1);
      expect(response.body.categories[0].name).toBe('My Category');
    });
  });
});
