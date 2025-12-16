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
  SubscriptionTier,
  SessionLimitStrategy,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

/**
 * Integration tests for Company Settings routes.
 * Tests GET /companies/settings and PATCH /companies/settings endpoints.
 */
describe('Company Settings Routes', () => {
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

    // Create test company with mfaRequired = false
    testCompany = em.create(Company, {
      id: uuid(),
      name: 'Company Settings Test Company',
      maxSeats: 10,
      maxSessionsPerUser: 5,
      tier: SubscriptionTier.FREE,
      sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
      mfaRequired: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
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
      name: `companyTestAdmin-${Date.now()}`,
      displayName: 'Company Test Admin',
      permissions: ['*'],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRole);

    // Create admin user
    adminUser = em.create(User, {
      id: uuid(),
      email: `admin-company-${Date.now()}@example.com`,
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
  // GET /companies/settings - Get company settings
  // ============================================================================

  describe('GET /api/companies/settings', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/companies/settings');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks company:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .get('/api/companies/settings')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should return company settings for authenticated user with company:read', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:read',
      ]);

      const response = await makeRequest()
        .get('/api/companies/settings')
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.settings).toBeDefined();
      expect(response.body.settings.companyId).toBe(testCompany.id);
      expect(response.body.settings.companyName).toBe(testCompany.name);
      expect(response.body.settings.mfaRequired).toBe(false);
      expect(response.body.settings.updatedAt).toBeDefined();
    });

    it('should return correct mfaRequired status when true', async () => {
      // Update mfaRequired to true
      const orm = getORM();
      const em = orm.em.fork();
      const company = await em.findOne(Company, { id: testCompany.id });
      if (company) {
        company.mfaRequired = true;
        await em.flush();
      }

      const response = await makeRequest()
        .get('/api/companies/settings')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.settings.mfaRequired).toBe(true);
    });

    it('should allow access with company:* wildcard permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:*',
      ]);

      const response = await makeRequest()
        .get('/api/companies/settings')
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.settings).toBeDefined();
    });

    it('should allow access with * wildcard permission', async () => {
      const response = await makeRequest()
        .get('/api/companies/settings')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.settings).toBeDefined();
    });
  });

  // ============================================================================
  // PATCH /companies/settings - Update company settings
  // ============================================================================

  describe('PATCH /api/companies/settings', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest()
        .patch('/api/companies/settings')
        .send({ mfaRequired: true });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks company:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:read',
      ]);

      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', userCookie)
        .send({ mfaRequired: true });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should return 400 for invalid payload', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:update',
      ]);

      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', userCookie)
        .send({ mfaRequired: 'not-a-boolean' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should update mfaRequired to true', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:update',
      ]);

      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', userCookie)
        .send({ mfaRequired: true });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Settings updated successfully');
      expect(response.body.settings.mfaRequired).toBe(true);

      // Verify the change persisted
      const orm = getORM();
      const em = orm.em.fork();
      const company = await em.findOne(Company, { id: testCompany.id });
      expect(company?.mfaRequired).toBe(true);
    });

    it('should update mfaRequired to false', async () => {
      // First set mfaRequired to true
      const orm = getORM();
      const em = orm.em.fork();
      const company = await em.findOne(Company, { id: testCompany.id });
      if (company) {
        company.mfaRequired = true;
        await em.flush();
      }

      const { cookie: userCookie } = await createUserWithPermissions([
        'company:update',
      ]);

      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', userCookie)
        .send({ mfaRequired: false });

      expect(response.status).toBe(200);
      expect(response.body.settings.mfaRequired).toBe(false);

      // Verify the change persisted
      const em2 = orm.em.fork();
      const updatedCompany = await em2.findOne(Company, { id: testCompany.id });
      expect(updatedCompany?.mfaRequired).toBe(false);
    });

    it('should return updated settings after change', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:update',
      ]);

      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', userCookie)
        .send({ mfaRequired: true });

      expect(response.status).toBe(200);
      expect(response.body.settings).toBeDefined();
      expect(response.body.settings.companyId).toBe(testCompany.id);
      expect(response.body.settings.companyName).toBe(testCompany.name);
      expect(response.body.settings.mfaRequired).toBe(true);
      expect(response.body.settings.updatedAt).toBeDefined();
    });

    it('should succeed with empty payload (no changes)', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:update',
      ]);

      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', userCookie)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Settings updated successfully');
    });

    it('should not change mfaRequired when setting to same value', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:update',
      ]);

      // mfaRequired is already false, send false again
      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', userCookie)
        .send({ mfaRequired: false });

      expect(response.status).toBe(200);
      expect(response.body.settings.mfaRequired).toBe(false);
    });

    it('should allow access with company:* wildcard permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:*',
      ]);

      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', userCookie)
        .send({ mfaRequired: true });

      expect(response.status).toBe(200);
      expect(response.body.settings.mfaRequired).toBe(true);
    });

    it('should allow access with * wildcard permission', async () => {
      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', cookie)
        .send({ mfaRequired: true });

      expect(response.status).toBe(200);
      expect(response.body.settings.mfaRequired).toBe(true);
    });
  });

  // ============================================================================
  // Permission Tests
  // ============================================================================

  describe('Permission Tests', () => {
    it('should deny access with only company:read for PATCH', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:read',
      ]);

      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', userCookie)
        .send({ mfaRequired: true });

      expect(response.status).toBe(403);
    });

    it('should not grant company:read via user:* wildcard', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:*',
      ]);

      const response = await makeRequest()
        .get('/api/companies/settings')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });

    it('should not grant company:update via office:* wildcard', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'office:*',
      ]);

      const response = await makeRequest()
        .patch('/api/companies/settings')
        .set('Cookie', userCookie)
        .send({ mfaRequired: true });

      expect(response.status).toBe(403);
    });

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
        .get('/api/companies/settings')
        .set('Cookie', `sid=${sid}`);

      expect(response.status).toBe(403);
    });
  });
});
