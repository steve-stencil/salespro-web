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
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

/**
 * Comprehensive wildcard permission tests.
 * Tests that wildcard patterns are correctly evaluated:
 * - Global wildcard `*` grants all permissions
 * - Resource wildcard `resource:*` grants all actions for that resource
 * - Wildcards don't grant platform permissions to company users
 * - Multiple wildcards combine correctly
 */
describe('Wildcard Permission Tests', () => {
  let testCompany: Company;
  let adminUser: User;
  let targetUser: User;
  let testOffice: Office;
  let testRole: Role;

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Create test company
    testCompany = em.create(Company, {
      id: uuid(),
      name: 'Wildcard Test Company',
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

    // Create admin user
    adminUser = em.create(User, {
      id: uuid(),
      email: `admin-wildcard-${Date.now()}@example.com`,
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
      email: `target-wildcard-${Date.now()}@example.com`,
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
      name: 'Wildcard Test Office',
      company: testCompany,
      isActive: true,
    });
    em.persist(testOffice);

    // Create test role for role operations
    testRole = em.create(Role, {
      id: uuid(),
      name: 'wildcardTestRole',
      displayName: 'Wildcard Test Role',
      permissions: ['customer:read'],
      type: RoleType.COMPANY,
      company: testCompany,
    });
    em.persist(testRole);

    await em.flush();
  });

  afterEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up in correct order
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
  // Global Wildcard (*) Tests
  // ============================================================================

  describe('Global Wildcard (*)', () => {
    it('should grant access to user routes', async () => {
      const { cookie } = await createUserWithPermissions(['*']);

      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
    });

    it('should grant access to office routes', async () => {
      const { cookie } = await createUserWithPermissions(['*']);

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
    });

    it('should grant access to role routes', async () => {
      const { cookie } = await createUserWithPermissions(['*']);

      const response = await makeRequest()
        .get('/api/roles')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
    });

    it('should grant access to update operations', async () => {
      const { cookie } = await createUserWithPermissions(['*']);

      const response = await makeRequest()
        .patch(`/api/users/${targetUser.id}`)
        .set('Cookie', cookie)
        .send({ nameFirst: 'GlobalWildcard' });

      expect(response.status).toBe(200);
    });

    it('should grant access to activate operations', async () => {
      const { cookie } = await createUserWithPermissions(['*']);

      const response = await makeRequest()
        .post(`/api/users/${targetUser.id}/activate`)
        .set('Cookie', cookie)
        .send({ isActive: false });

      expect(response.status).toBe(200);
    });

    it('should NOT grant platform permissions to company users', async () => {
      const { cookie } = await createUserWithPermissions(['*']);

      // Platform routes require internal user, not just permissions
      const response = await makeRequest()
        .get('/api/platform/companies')
        .set('Cookie', cookie);

      // Should get 403 because user is not an internal user
      expect(response.status).toBe(403);
    });

    it('should allow role assignment operations', async () => {
      const { cookie } = await createUserWithPermissions(['*']);

      const response = await makeRequest()
        .post('/api/roles/assign')
        .set('Cookie', cookie)
        .send({
          userId: targetUser.id,
          roleId: testRole.id,
        });

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Resource Wildcard (resource:*) Tests
  // ============================================================================

  describe('Resource Wildcard (user:*)', () => {
    it('should grant user:read via user:*', async () => {
      const { cookie } = await createUserWithPermissions(['user:*']);

      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
    });

    it('should grant user:update via user:*', async () => {
      const { cookie } = await createUserWithPermissions(['user:*']);

      const response = await makeRequest()
        .patch(`/api/users/${targetUser.id}`)
        .set('Cookie', cookie)
        .send({ nameFirst: 'UserWildcard' });

      expect(response.status).toBe(200);
    });

    it('should grant user:activate via user:*', async () => {
      const { cookie } = await createUserWithPermissions(['user:*']);

      const response = await makeRequest()
        .post(`/api/users/${targetUser.id}/activate`)
        .set('Cookie', cookie)
        .send({ isActive: false });

      expect(response.status).toBe(200);
    });

    it('should NOT grant office:read via user:*', async () => {
      const { cookie } = await createUserWithPermissions(['user:*']);

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
    });

    it('should NOT grant role:read via user:*', async () => {
      const { cookie } = await createUserWithPermissions(['user:*']);

      const response = await makeRequest()
        .get('/api/roles')
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
    });
  });

  describe('Resource Wildcard (office:*)', () => {
    it('should grant office:read via office:*', async () => {
      const { cookie } = await createUserWithPermissions(['office:*']);

      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
    });

    it('should grant access to specific office via office:*', async () => {
      const { cookie } = await createUserWithPermissions(['office:*']);

      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
    });

    it('should NOT grant user:read via office:*', async () => {
      const { cookie } = await createUserWithPermissions(['office:*']);

      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
    });
  });

  describe('Resource Wildcard (role:*)', () => {
    it('should grant role:read via role:*', async () => {
      const { cookie } = await createUserWithPermissions(['role:*']);

      const response = await makeRequest()
        .get('/api/roles')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
    });

    it('should grant role:create via role:*', async () => {
      const { cookie } = await createUserWithPermissions(['role:*']);

      const response = await makeRequest()
        .post('/api/roles')
        .set('Cookie', cookie)
        .send({
          name: 'createdViaWildcard',
          displayName: 'Created Via Wildcard',
          permissions: ['customer:read'],
        });

      expect(response.status).toBe(201);
    });

    it('should grant role:assign via role:*', async () => {
      const { cookie } = await createUserWithPermissions(['role:*']);

      const response = await makeRequest()
        .post('/api/roles/assign')
        .set('Cookie', cookie)
        .send({
          userId: targetUser.id,
          roleId: testRole.id,
        });

      expect(response.status).toBe(200);
    });

    it('should NOT grant user:read via role:*', async () => {
      const { cookie } = await createUserWithPermissions(['role:*']);

      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // Multiple Wildcards Combination Tests
  // ============================================================================

  describe('Multiple Wildcards Combination', () => {
    it('should grant access with user:* and office:*', async () => {
      const { cookie } = await createUserWithPermissions([
        'user:*',
        'office:*',
      ]);

      const usersResponse = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);
      expect(usersResponse.status).toBe(200);

      const officesResponse = await makeRequest()
        .get('/api/offices')
        .set('Cookie', cookie);
      expect(officesResponse.status).toBe(200);
    });

    it('should still deny role:read with user:* and office:*', async () => {
      const { cookie } = await createUserWithPermissions([
        'user:*',
        'office:*',
      ]);

      const response = await makeRequest()
        .get('/api/roles')
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
    });

    it('should grant all with user:*, office:*, and role:*', async () => {
      const { cookie } = await createUserWithPermissions([
        'user:*',
        'office:*',
        'role:*',
      ]);

      const usersResponse = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);
      expect(usersResponse.status).toBe(200);

      const officesResponse = await makeRequest()
        .get('/api/offices')
        .set('Cookie', cookie);
      expect(officesResponse.status).toBe(200);

      const rolesResponse = await makeRequest()
        .get('/api/roles')
        .set('Cookie', cookie);
      expect(rolesResponse.status).toBe(200);
    });
  });

  // ============================================================================
  // Mixed Explicit and Wildcard Permissions
  // ============================================================================

  describe('Mixed Explicit and Wildcard Permissions', () => {
    it('should grant access with explicit and wildcard for same resource', async () => {
      const { cookie } = await createUserWithPermissions([
        'user:read',
        'user:*',
      ]);

      // user:* should grant all user operations
      const updateResponse = await makeRequest()
        .patch(`/api/users/${targetUser.id}`)
        .set('Cookie', cookie)
        .send({ nameFirst: 'Mixed' });

      expect(updateResponse.status).toBe(200);
    });

    it('should combine explicit permissions with wildcards correctly', async () => {
      const { cookie } = await createUserWithPermissions([
        'user:read',
        'office:*',
      ]);

      // user:read only - cannot update
      const userUpdateResponse = await makeRequest()
        .patch(`/api/users/${targetUser.id}`)
        .set('Cookie', cookie)
        .send({ nameFirst: 'ShouldFail' });
      expect(userUpdateResponse.status).toBe(403);

      // But can read users
      const usersResponse = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);
      expect(usersResponse.status).toBe(200);

      // And can access all office operations
      const officesResponse = await makeRequest()
        .get('/api/offices')
        .set('Cookie', cookie);
      expect(officesResponse.status).toBe(200);
    });
  });

  // ============================================================================
  // Invalid Wildcard Patterns
  // ============================================================================

  describe('Invalid Wildcard Patterns', () => {
    it('should not match invalid resource wildcards', async () => {
      const { cookie } = await createUserWithPermissions(['invalid:*']);

      // invalid:* doesn't match any valid resource
      const usersResponse = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);
      expect(usersResponse.status).toBe(403);

      const officesResponse = await makeRequest()
        .get('/api/offices')
        .set('Cookie', cookie);
      expect(officesResponse.status).toBe(403);
    });

    it('should not match partial resource names', async () => {
      const { cookie } = await createUserWithPermissions(['use:*']);

      // use:* should NOT match user:read
      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // Wildcard Platform Permission Isolation
  // ============================================================================

  describe('Wildcard Platform Permission Isolation', () => {
    it('should not allow company user to access platform routes even with *', async () => {
      const { cookie } = await createUserWithPermissions(['*']);

      // Even with * wildcard, company users cannot access platform routes
      // because platform routes require requireInternalUser() middleware
      const response = await makeRequest()
        .get('/api/platform/companies')
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('internal platform user');
    });

    it('should not allow company user to access internal-users even with *', async () => {
      const { cookie } = await createUserWithPermissions(['*']);

      const response = await makeRequest()
        .get('/api/internal-users')
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
    });

    it('should not grant platform:* permissions to company user', async () => {
      const { cookie } = await createUserWithPermissions(['platform:*']);

      const response = await makeRequest()
        .get('/api/platform/companies')
        .set('Cookie', cookie);

      // User is not an internal user, so fails on requireInternalUser check
      expect(response.status).toBe(403);
    });
  });
});
