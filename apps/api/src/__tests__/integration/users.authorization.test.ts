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
  UserOffice,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

/**
 * Authorization tests for User routes.
 * Tests that permissions are properly enforced:
 * - user:read for GET operations
 * - user:update for PATCH operations
 * - user:activate for activation operations
 * - Wildcard permissions (user:*, *)
 */
describe('Users Routes Authorization Tests', () => {
  let testCompany: Company;
  let adminUser: User;
  let targetUser: User;
  let testOffice: Office;
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
      name: 'Users Auth Test Company',
      maxSessionsPerUser: 5,
      mfaRequired: false,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        historyCount: 3,
        expirationDays: 90,
      },
    });
    em.persist(testCompany);

    // Create admin role with all permissions
    adminRole = em.create(Role, {
      id: uuid(),
      name: 'usersTestAdmin',
      displayName: 'Users Test Admin',
      permissions: ['*'],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRole);

    // Create admin user
    adminUser = em.create(User, {
      id: uuid(),
      email: `admin-users-${Date.now()}@example.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'Admin',
      nameLast: 'User',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: testCompany,
    });
    em.persist(adminUser);

    // Create target user for testing
    targetUser = em.create(User, {
      id: uuid(),
      email: `target-users-${Date.now()}@example.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'Target',
      nameLast: 'User',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: testCompany,
    });
    em.persist(targetUser);

    // Create test office
    testOffice = em.create(Office, {
      id: uuid(),
      name: 'Test Office',
      company: testCompany,
      isActive: true,
    });
    em.persist(testOffice);

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
      source: 'web',
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
    await em.nativeDelete('user_office', {});
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
      source: 'web',
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
  // GET /users - List users
  // ============================================================================

  describe('GET /api/users - Authorization', () => {
    it('should allow access with user:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeDefined();
    });

    it('should return 403 without user:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'customer:read',
      ]);

      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow access with user:* wildcard permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:*',
      ]);

      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeDefined();
    });

    it('should allow access with global * wildcard permission', async () => {
      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get('/api/users');

      expect(response.status).toBe(401);
    });
  });

  // ============================================================================
  // GET /users/:id - Get specific user
  // ============================================================================

  describe('GET /api/users/:id - Authorization', () => {
    it('should allow access with user:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .get(`/api/users/${targetUser.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(targetUser.id);
    });

    it('should return 403 without user:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'office:read',
      ]);

      const response = await makeRequest()
        .get(`/api/users/${targetUser.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow access with user:* wildcard', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:*',
      ]);

      const response = await makeRequest()
        .get(`/api/users/${targetUser.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(targetUser.id);
    });
  });

  // ============================================================================
  // PATCH /users/:id - Update user
  // ============================================================================

  describe('PATCH /api/users/:id - Authorization', () => {
    it('should allow access with user:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:update',
      ]);

      const response = await makeRequest()
        .patch(`/api/users/${targetUser.id}`)
        .set('Cookie', userCookie)
        .send({ nameFirst: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body.user.nameFirst).toBe('Updated');
    });

    it('should return 403 without user:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .patch(`/api/users/${targetUser.id}`)
        .set('Cookie', userCookie)
        .send({ nameFirst: 'Updated' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow access with user:* wildcard', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:*',
      ]);

      const response = await makeRequest()
        .patch(`/api/users/${targetUser.id}`)
        .set('Cookie', userCookie)
        .send({ nameFirst: 'WildcardUpdated' });

      expect(response.status).toBe(200);
      expect(response.body.user.nameFirst).toBe('WildcardUpdated');
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest()
        .patch(`/api/users/${targetUser.id}`)
        .send({ nameFirst: 'Updated' });

      expect(response.status).toBe(401);
    });
  });

  // ============================================================================
  // POST /users/:id/activate - Activate/Deactivate user
  // ============================================================================

  describe('POST /api/users/:id/activate - Authorization', () => {
    it('should allow access with user:activate permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:activate',
      ]);

      const response = await makeRequest()
        .post(`/api/users/${targetUser.id}/activate`)
        .set('Cookie', userCookie)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.user.isActive).toBe(false);
    });

    it('should return 403 without user:activate permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
        'user:update',
      ]);

      const response = await makeRequest()
        .post(`/api/users/${targetUser.id}/activate`)
        .set('Cookie', userCookie)
        .send({ isActive: false });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow access with user:* wildcard', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:*',
      ]);

      const response = await makeRequest()
        .post(`/api/users/${targetUser.id}/activate`)
        .set('Cookie', userCookie)
        .send({ isActive: false });

      expect(response.status).toBe(200);
    });

    it('should allow access with global * wildcard', async () => {
      const response = await makeRequest()
        .post(`/api/users/${targetUser.id}/activate`)
        .set('Cookie', cookie)
        .send({ isActive: false });

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // GET /users/:id/offices - Get user office access
  // ============================================================================

  describe('GET /api/users/:id/offices - Authorization', () => {
    it('should allow access with user:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .get(`/api/users/${targetUser.id}/offices`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.offices).toBeDefined();
    });

    it('should return 403 without user:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'office:read',
      ]);

      const response = await makeRequest()
        .get(`/api/users/${targetUser.id}/offices`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // POST /users/:id/offices - Add office access
  // ============================================================================

  describe('POST /api/users/:id/offices - Authorization', () => {
    it('should allow access with user:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:update',
      ]);

      const response = await makeRequest()
        .post(`/api/users/${targetUser.id}/offices`)
        .set('Cookie', userCookie)
        .send({ officeId: testOffice.id });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Office access granted');
    });

    it('should return 403 without user:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .post(`/api/users/${targetUser.id}/offices`)
        .set('Cookie', userCookie)
        .send({ officeId: testOffice.id });

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // DELETE /users/:id/offices/:officeId - Remove office access
  // ============================================================================

  describe('DELETE /api/users/:id/offices/:officeId - Authorization', () => {
    beforeEach(async () => {
      // Add office access for target user
      const orm = getORM();
      const em = orm.em.fork();

      const userOffice = em.create(UserOffice, {
        id: uuid(),
        user: targetUser,
        office: testOffice,
        assignedBy: adminUser,
      });
      em.persist(userOffice);
      await em.flush();
    });

    it('should allow access with user:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:update',
      ]);

      const response = await makeRequest()
        .delete(`/api/users/${targetUser.id}/offices/${testOffice.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Office access revoked');
    });

    it('should return 403 without user:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .delete(`/api/users/${targetUser.id}/offices/${testOffice.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // PATCH /users/:id/current-office - Set current office
  // ============================================================================

  describe('PATCH /api/users/:id/current-office - Authorization', () => {
    beforeEach(async () => {
      // Add office access for target user
      const orm = getORM();
      const em = orm.em.fork();

      const userOffice = em.create(UserOffice, {
        id: uuid(),
        user: targetUser,
        office: testOffice,
        assignedBy: adminUser,
      });
      em.persist(userOffice);
      await em.flush();
    });

    it('should allow access with user:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:update',
      ]);

      const response = await makeRequest()
        .patch(`/api/users/${targetUser.id}/current-office`)
        .set('Cookie', userCookie)
        .send({ officeId: testOffice.id });

      expect(response.status).toBe(200);
      expect(response.body.user.currentOffice.id).toBe(testOffice.id);
    });

    it('should return 403 without user:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .patch(`/api/users/${targetUser.id}/current-office`)
        .set('Cookie', userCookie)
        .send({ officeId: testOffice.id });

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // Edge Cases and Mixed Permissions
  // ============================================================================

  describe('Mixed Permission Scenarios', () => {
    it('should deny update with only read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      // Can read
      const readResponse = await makeRequest()
        .get(`/api/users/${targetUser.id}`)
        .set('Cookie', userCookie);
      expect(readResponse.status).toBe(200);

      // Cannot update
      const updateResponse = await makeRequest()
        .patch(`/api/users/${targetUser.id}`)
        .set('Cookie', userCookie)
        .send({ nameFirst: 'Forbidden' });
      expect(updateResponse.status).toBe(403);
    });

    it('should allow both read and update with both permissions', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
        'user:update',
      ]);

      // Can read
      const readResponse = await makeRequest()
        .get(`/api/users/${targetUser.id}`)
        .set('Cookie', userCookie);
      expect(readResponse.status).toBe(200);

      // Can update
      const updateResponse = await makeRequest()
        .patch(`/api/users/${targetUser.id}`)
        .set('Cookie', userCookie)
        .send({ nameFirst: 'Allowed' });
      expect(updateResponse.status).toBe(200);
    });

    it('should not grant cross-resource permissions', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'customer:*',
      ]);

      // customer:* does not grant user:read
      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });
  });
});
