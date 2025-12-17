import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';

import {
  RoleType,
  Company,
  User,
  Role,
  UserRole,
  Session,
  Office,
  SessionSource,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

/**
 * Authorization tests for Office routes.
 * Tests that permissions are properly enforced:
 * - office:read for GET operations
 * - Wildcard permissions (office:*, *)
 */
describe('Offices Routes Authorization Tests', () => {
  let testCompany: Company;
  let adminUser: User;
  let testOffice: Office;
  let testOffice2: Office;
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
      name: 'Offices Auth Test Company',
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
      name: 'officesTestAdmin',
      displayName: 'Offices Test Admin',
      permissions: ['*'],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRole);

    // Create admin user
    adminUser = em.create(User, {
      id: uuid(),
      email: `admin-offices-${Date.now()}@example.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'Admin',
      nameLast: 'User',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: testCompany,
    });
    em.persist(adminUser);

    // Create test offices
    testOffice = em.create(Office, {
      id: uuid(),
      name: 'Main Office',
      company: testCompany,
      isActive: true,
    });
    em.persist(testOffice);

    testOffice2 = em.create(Office, {
      id: uuid(),
      name: 'Branch Office',
      company: testCompany,
      isActive: true,
    });
    em.persist(testOffice2);

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
    await em.nativeDelete('user_role', {});
    await em.nativeDelete('session', {});
    await em.nativeDelete('office', {});
    await em.nativeDelete('user', {});
    await em.nativeDelete('role', {});
    await em.nativeDelete('company', {});
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Create a user with a specific role that has given permissions
   */
  async function createUserWithPermissions(
    permissions: string[],
  ): Promise<{ user: User; cookie: string }> {
    const orm = getORM();
    const em = orm.em.fork();

    // Create role with specified permissions
    const role = em.create(Role, {
      id: uuid(),
      name: `testRole-${Date.now()}-${Math.random()}`,
      displayName: 'Test Role',
      permissions,
      type: RoleType.COMPANY,
      company: testCompany,
    });
    em.persist(role);

    // Create user
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

    // Assign role
    const userRole = em.create(UserRole, {
      id: uuid(),
      user,
      role,
      company: testCompany,
    });
    em.persist(userRole);

    // Create session
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

  // ============================================================================
  // GET /offices - List offices
  // ============================================================================

  describe('GET /api/offices - Authorization', () => {
    it('should allow access with office:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'office:read',
      ]);

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.offices).toBeDefined();
      expect(Array.isArray(response.body.offices)).toBe(true);
    });

    it('should return 403 without office:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'customer:read',
      ]);

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow access with office:* wildcard permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'office:*',
      ]);

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.offices).toBeDefined();
    });

    it('should allow access with global * wildcard permission', async () => {
      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.offices).toBeDefined();
      expect(response.body.offices.length).toBe(2);
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get('/api/offices');

      expect(response.status).toBe(401);
    });

    it('should return all offices when filtered by isActive', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'office:read',
      ]);

      const response = await makeRequest()
        .get('/api/offices?isActive=true')
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.offices).toBeDefined();
      expect(
        response.body.offices.every((o: { isActive: boolean }) => o.isActive),
      ).toBe(true);
    });
  });

  // ============================================================================
  // GET /offices/:id - Get specific office
  // ============================================================================

  describe('GET /api/offices/:id - Authorization', () => {
    it('should allow access with office:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'office:read',
      ]);

      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.office).toBeDefined();
      expect(response.body.office.id).toBe(testOffice.id);
      expect(response.body.office.name).toBe('Main Office');
    });

    it('should return 403 without office:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow access with office:* wildcard', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'office:*',
      ]);

      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.office.id).toBe(testOffice.id);
    });

    it('should return 404 for non-existent office', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'office:read',
      ]);

      const response = await makeRequest()
        .get(`/api/offices/${uuid()}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Office not found');
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get(`/api/offices/${testOffice.id}`);

      expect(response.status).toBe(401);
    });
  });

  // ============================================================================
  // Cross-Resource Permission Tests
  // ============================================================================

  describe('Cross-Resource Permission Isolation', () => {
    it('should not grant office:read via user:* wildcard', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:*',
      ]);

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });

    it('should not grant office:read via role:* wildcard', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'role:*',
      ]);

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });

    it('should not grant office:read via customer:* wildcard', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'customer:*',
      ]);

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });

    it('should grant access with multiple resource wildcards including office:*', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:*',
        'office:*',
      ]);

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Empty Permissions Test
  // ============================================================================

  describe('Empty/No Permissions', () => {
    it('should return 403 when user has no permissions', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create user with no role assignment
      const user = em.create(User, {
        id: uuid(),
        email: `noPerms-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'No',
        nameLast: 'Permissions',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(user);

      // Create session without any role
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

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', `sid=${sid}`);

      expect(response.status).toBe(403);
    });
  });
});
