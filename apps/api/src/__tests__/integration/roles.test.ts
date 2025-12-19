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
  UserType,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

describe('Roles Routes Integration Tests', () => {
  let testCompany: Company;
  let testUser: User;
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
      name: 'Test Company',
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
      name: 'testAdmin',
      displayName: 'Test Admin',
      permissions: ['*'], // Super admin
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRole);

    // Create test user
    testUser = em.create(User, {
      id: uuid(),
      email: `test-${Date.now()}@example.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'Test',
      nameLast: 'User',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: testCompany,
    });
    em.persist(testUser);

    // Assign admin role to user
    const userRole = em.create(UserRole, {
      id: uuid(),
      user: testUser,
      role: adminRole,
      company: testCompany,
    });
    em.persist(userRole);

    // Create session
    sessionId = uuid();
    const session = em.create(Session, {
      sid: sessionId,
      user: testUser,
      company: testCompany,
      data: { userId: testUser.id },
      source: SessionSource.WEB,
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      mfaVerified: false,
    });
    em.persist(session);

    await em.flush();

    // Create cookie for authentication
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

  describe('GET /api/roles/permissions', () => {
    it('should return all available permissions when authenticated', async () => {
      const response = await makeRequest()
        .get('/api/roles/permissions')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.permissions).toBeDefined();
      expect(Array.isArray(response.body.permissions)).toBe(true);
      expect(response.body.byCategory).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/roles/permissions');

      expect(response.status).toBe(401);
    });

    it('should include permission metadata', async () => {
      const response = await makeRequest()
        .get('/api/roles/permissions')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      const customerRead = response.body.permissions.find(
        (p: { name: string }) => p.name === 'customer:read',
      );
      expect(customerRead).toBeDefined();
      expect(customerRead.label).toBeDefined();
      expect(customerRead.category).toBeDefined();
      expect(customerRead.description).toBeDefined();
    });
  });

  describe('GET /api/roles', () => {
    it('should return available roles when user has role:read permission', async () => {
      const response = await makeRequest()
        .get('/api/roles')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.roles).toBeDefined();
      expect(Array.isArray(response.body.roles)).toBe(true);
    });

    it('should include system roles', async () => {
      const response = await makeRequest()
        .get('/api/roles')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      const systemRole = response.body.roles.find(
        (r: { name: string }) => r.name === 'testAdmin',
      );
      expect(systemRole).toBeDefined();
      expect(systemRole.type).toBe(RoleType.SYSTEM);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/roles');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks role:read permission', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Remove admin role
      await em.nativeDelete(UserRole, { user: testUser.id });

      // Create a role without role:read permission
      const basicRole = em.create(Role, {
        id: uuid(),
        name: 'basic',
        displayName: 'Basic User',
        permissions: ['customer:read'],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(basicRole);

      const userRole = em.create(UserRole, {
        id: uuid(),
        user: testUser,
        role: basicRole,
        company: testCompany,
      });
      em.persist(userRole);
      await em.flush();

      const response = await makeRequest()
        .get('/api/roles')
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('GET /api/roles/:id', () => {
    it('should return specific role by ID', async () => {
      const response = await makeRequest()
        .get(`/api/roles/${adminRole.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.role).toBeDefined();
      expect(response.body.role.id).toBe(adminRole.id);
      expect(response.body.role.name).toBe('testAdmin');
    });

    it('should return 404 for non-existent role', async () => {
      const response = await makeRequest()
        .get(`/api/roles/${uuid()}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get(`/api/roles/${adminRole.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/roles', () => {
    it('should create a new company role', async () => {
      const response = await makeRequest()
        .post('/api/roles')
        .set('Cookie', cookie)
        .send({
          name: 'newRole',
          displayName: 'New Custom Role',
          description: 'A test custom role',
          permissions: ['customer:read', 'customer:create'],
        });

      expect(response.status).toBe(201);
      expect(response.body.role).toBeDefined();
      expect(response.body.role.name).toBe('newRole');
      expect(response.body.role.type).toBe(RoleType.COMPANY);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await makeRequest()
        .post('/api/roles')
        .set('Cookie', cookie)
        .send({
          name: 'incomplete',
          // Missing displayName and permissions
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for empty permissions array', async () => {
      const response = await makeRequest()
        .post('/api/roles')
        .set('Cookie', cookie)
        .send({
          name: 'emptyPermissions',
          displayName: 'Empty Permissions Role',
          permissions: [],
        });

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate role name', async () => {
      // Create initial role
      await makeRequest()
        .post('/api/roles')
        .set('Cookie', cookie)
        .send({
          name: 'duplicateRole',
          displayName: 'Duplicate Role',
          permissions: ['customer:read'],
        });

      // Try to create duplicate
      const response = await makeRequest()
        .post('/api/roles')
        .set('Cookie', cookie)
        .send({
          name: 'duplicateRole',
          displayName: 'Another Duplicate',
          permissions: ['customer:read'],
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Role name already exists');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest()
        .post('/api/roles')
        .send({
          name: 'unauthorized',
          displayName: 'Unauthorized Role',
          permissions: ['customer:read'],
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/roles/:id', () => {
    let companyRole: Role;

    beforeEach(async () => {
      const orm = getORM();
      const em = orm.em.fork();

      companyRole = em.create(Role, {
        id: uuid(),
        name: 'editableRole',
        displayName: 'Editable Role',
        permissions: ['customer:read'],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(companyRole);
      await em.flush();
    });

    it('should update a company role', async () => {
      const response = await makeRequest()
        .patch(`/api/roles/${companyRole.id}`)
        .set('Cookie', cookie)
        .send({
          displayName: 'Updated Display Name',
          permissions: ['customer:read', 'customer:create'],
        });

      expect(response.status).toBe(200);
      expect(response.body.role.displayName).toBe('Updated Display Name');
      expect(response.body.role.permissions).toContain('customer:create');
    });

    it('should return 404 when trying to modify system role', async () => {
      // System roles have no company, so they're not found through company-scoped queries
      const response = await makeRequest()
        .patch(`/api/roles/${adminRole.id}`)
        .set('Cookie', cookie)
        .send({
          displayName: 'Modified System Role',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Role not found or cannot be modified');
    });

    it('should return 404 for non-existent role', async () => {
      const response = await makeRequest()
        .patch(`/api/roles/${uuid()}`)
        .set('Cookie', cookie)
        .send({
          displayName: 'Updated',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/roles/:id', () => {
    let companyRole: Role;

    beforeEach(async () => {
      const orm = getORM();
      const em = orm.em.fork();

      companyRole = em.create(Role, {
        id: uuid(),
        name: 'deletableRole',
        displayName: 'Deletable Role',
        permissions: ['customer:read'],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(companyRole);
      await em.flush();
    });

    it('should delete a company role', async () => {
      const response = await makeRequest()
        .delete(`/api/roles/${companyRole.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Role deleted successfully');
    });

    it('should return 404 when trying to delete system role', async () => {
      // System roles have no company, so they're not found through company-scoped queries
      const response = await makeRequest()
        .delete(`/api/roles/${adminRole.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Role not found or cannot be deleted');
    });

    it('should return 404 for non-existent role', async () => {
      const response = await makeRequest()
        .delete(`/api/roles/${uuid()}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/roles/me', () => {
    it('should return current user roles and permissions', async () => {
      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.roles).toBeDefined();
      expect(Array.isArray(response.body.roles)).toBe(true);
      expect(response.body.permissions).toBeDefined();
    });

    it('should include admin role in response', async () => {
      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      const hasAdminRole = response.body.roles.some(
        (r: { name: string }) => r.name === 'testAdmin',
      );
      expect(hasAdminRole).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/roles/me');

      expect(response.status).toBe(401);
    });

    it('should return platform permissions for internal users', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a platform role with platform permissions
      const platformRole = em.create(Role, {
        id: uuid(),
        name: `platformRole-${Date.now()}`,
        displayName: 'Platform Role',
        type: RoleType.PLATFORM,
        companyPermissions: ['*'], // Full access in any company
        permissions: [
          'platform:admin',
          'platform:view_companies',
          'platform:manage_internal_users',
        ],
      });
      em.persist(platformRole);

      // Create internal user
      const internalUser = em.create(User, {
        id: uuid(),
        email: `internal-${Date.now()}@test.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Internal',
        nameLast: 'User',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        userType: UserType.INTERNAL,
        company: testCompany,
      });
      em.persist(internalUser);
      await em.flush();

      // Assign platform role to internal user (no company context)
      const platformUserRole = em.create(UserRole, {
        user: internalUser,
        role: platformRole,
        assignedAt: new Date(),
      });
      em.persist(platformUserRole);

      // Also assign company role for company-level access
      const companyUserRole = em.create(UserRole, {
        user: internalUser,
        role: adminRole,
        company: testCompany,
        assignedAt: new Date(),
      });
      em.persist(companyUserRole);
      await em.flush();

      // Create session for internal user with activeCompany
      const internalSessionId = uuid();
      const sessionExpiry = new Date(Date.now() + 86400000);
      const internalSession = em.create(Session, {
        sid: internalSessionId,
        user: internalUser,
        activeCompany: testCompany,
        data: { userId: internalUser.id },
        expiresAt: sessionExpiry,
        absoluteExpiresAt: sessionExpiry,
        source: SessionSource.WEB,
      });
      em.persist(internalSession);
      await em.flush();

      const internalCookie = `sid=s%3A${internalSessionId}.fakesignature`;

      // Make request as internal user
      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', internalCookie);

      expect(response.status).toBe(200);

      // Should include both company and platform permissions
      expect(response.body.permissions).toBeDefined();
      expect(response.body.permissions).toContain('platform:admin');
      expect(response.body.permissions).toContain('platform:view_companies');
      expect(response.body.permissions).toContain(
        'platform:manage_internal_users',
      );

      // Should include both roles
      expect(response.body.roles).toBeDefined();
      const hasPlatformRole = response.body.roles.some(
        (r: { type: string }) => r.type === 'platform',
      );
      expect(hasPlatformRole).toBe(true);

      // Cleanup
      await em.nativeDelete(Session, { sid: internalSessionId });
      await em.nativeDelete(UserRole, { user: internalUser.id });
      await em.nativeDelete(User, { id: internalUser.id });
      await em.nativeDelete(Role, { id: platformRole.id });
    });

    it('should include platform role in roles array for internal users', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a platform role
      const platformRole = em.create(Role, {
        id: uuid(),
        name: `platformRole2-${Date.now()}`,
        displayName: 'Platform Role 2',
        type: RoleType.PLATFORM,
        companyPermissions: ['*'], // Full access in any company
        permissions: ['platform:view_companies'],
      });
      em.persist(platformRole);

      // Create internal user
      const internalUser = em.create(User, {
        id: uuid(),
        email: `internal2-${Date.now()}@test.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Internal',
        nameLast: 'User2',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        userType: UserType.INTERNAL,
        company: testCompany,
      });
      em.persist(internalUser);
      await em.flush();

      // Assign platform role
      const platformUserRole = em.create(UserRole, {
        user: internalUser,
        role: platformRole,
        assignedAt: new Date(),
      });
      em.persist(platformUserRole);

      // Assign company role
      const companyUserRole = em.create(UserRole, {
        user: internalUser,
        role: adminRole,
        company: testCompany,
        assignedAt: new Date(),
      });
      em.persist(companyUserRole);
      await em.flush();

      // Create session
      const internalSessionId = uuid();
      const sessionExpiry = new Date(Date.now() + 86400000);
      const internalSession = em.create(Session, {
        sid: internalSessionId,
        user: internalUser,
        activeCompany: testCompany,
        data: { userId: internalUser.id },
        expiresAt: sessionExpiry,
        absoluteExpiresAt: sessionExpiry,
        source: SessionSource.WEB,
      });
      em.persist(internalSession);
      await em.flush();

      const internalCookie = `sid=s%3A${internalSessionId}.fakesignature`;

      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', internalCookie);

      expect(response.status).toBe(200);

      // Verify platform role is in the response
      const platformRoleInResponse = response.body.roles.find(
        (r: { name: string }) => r.name === platformRole.name,
      );
      expect(platformRoleInResponse).toBeDefined();
      expect(platformRoleInResponse.type).toBe('platform');

      // Cleanup
      await em.nativeDelete(Session, { sid: internalSessionId });
      await em.nativeDelete(UserRole, { user: internalUser.id });
      await em.nativeDelete(User, { id: internalUser.id });
      await em.nativeDelete(Role, { id: platformRole.id });
    });
  });

  describe('GET /api/roles/users/:userId', () => {
    it('should return roles for a specific user', async () => {
      const response = await makeRequest()
        .get(`/api/roles/users/${testUser.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.roles).toBeDefined();
      expect(response.body.effectivePermissions).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get(
        `/api/roles/users/${testUser.id}`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/roles/assign', () => {
    let assignableRole: Role;
    let targetUser: User;

    beforeEach(async () => {
      const orm = getORM();
      const em = orm.em.fork();

      assignableRole = em.create(Role, {
        id: uuid(),
        name: 'assignableRole',
        displayName: 'Assignable Role',
        permissions: ['customer:read'],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(assignableRole);

      targetUser = em.create(User, {
        id: uuid(),
        email: `target-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Target',
        nameLast: 'User',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(targetUser);
      await em.flush();
    });

    it('should assign a role to a user', async () => {
      const response = await makeRequest()
        .post('/api/roles/assign')
        .set('Cookie', cookie)
        .send({
          userId: targetUser.id,
          roleId: assignableRole.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Role assigned successfully');
      expect(response.body.assignment.userId).toBe(targetUser.id);
      expect(response.body.assignment.roleId).toBe(assignableRole.id);
    });

    it('should return 409 if role is already assigned', async () => {
      // First assignment
      await makeRequest().post('/api/roles/assign').set('Cookie', cookie).send({
        userId: targetUser.id,
        roleId: assignableRole.id,
      });

      // Duplicate assignment
      const response = await makeRequest()
        .post('/api/roles/assign')
        .set('Cookie', cookie)
        .send({
          userId: targetUser.id,
          roleId: assignableRole.id,
        });

      expect(response.status).toBe(409);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await makeRequest()
        .post('/api/roles/assign')
        .set('Cookie', cookie)
        .send({
          userId: uuid(),
          roleId: assignableRole.id,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 404 for non-existent role', async () => {
      const response = await makeRequest()
        .post('/api/roles/assign')
        .set('Cookie', cookie)
        .send({
          userId: targetUser.id,
          roleId: uuid(),
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Role not found');
    });

    it('should return 400 for invalid request body', async () => {
      const response = await makeRequest()
        .post('/api/roles/assign')
        .set('Cookie', cookie)
        .send({
          userId: 'not-a-uuid',
          roleId: assignableRole.id,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/roles/revoke', () => {
    let assignedRole: Role;
    let targetUser: User;

    beforeEach(async () => {
      const orm = getORM();
      const em = orm.em.fork();

      assignedRole = em.create(Role, {
        id: uuid(),
        name: 'assignedRole',
        displayName: 'Assigned Role',
        permissions: ['customer:read'],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(assignedRole);

      targetUser = em.create(User, {
        id: uuid(),
        email: `revoke-target-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Revoke',
        nameLast: 'Target',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(targetUser);

      // Assign role to target user
      const userRole = em.create(UserRole, {
        id: uuid(),
        user: targetUser,
        role: assignedRole,
        company: testCompany,
      });
      em.persist(userRole);
      await em.flush();
    });

    it('should revoke a role from a user', async () => {
      const response = await makeRequest()
        .post('/api/roles/revoke')
        .set('Cookie', cookie)
        .send({
          userId: targetUser.id,
          roleId: assignedRole.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Role revoked successfully');
    });

    it('should return 404 if role is not assigned', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a role that is NOT assigned
      const unassignedRole = em.create(Role, {
        id: uuid(),
        name: 'unassignedRole',
        displayName: 'Unassigned Role',
        permissions: ['customer:read'],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(unassignedRole);
      await em.flush();

      const response = await makeRequest()
        .post('/api/roles/revoke')
        .set('Cookie', cookie)
        .send({
          userId: targetUser.id,
          roleId: unassignedRole.id,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Role assignment not found');
    });

    it('should return 400 for invalid request body', async () => {
      const response = await makeRequest()
        .post('/api/roles/revoke')
        .set('Cookie', cookie)
        .send({
          userId: 'invalid-uuid',
          roleId: assignedRole.id,
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // Authorization Denial Tests
  // ============================================================================

  describe('Authorization Denial Tests', () => {
    /**
     * Helper to create a user with specific permissions
     */
    async function createUserWithPermissions(
      permissions: string[],
    ): Promise<{ user: User; cookie: string }> {
      const orm = getORM();
      const em = orm.em.fork();

      const role = em.create(Role, {
        id: uuid(),
        name: `denialTestRole-${Date.now()}-${Math.random()}`,
        displayName: 'Denial Test Role',
        permissions,
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(role);

      const user = em.create(User, {
        id: uuid(),
        email: `denial-test-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Denial',
        nameLast: 'Test',
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

    describe('POST /api/roles - role:create denial', () => {
      it('should return 403 without role:create permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:read',
        ]);

        const response = await makeRequest()
          .post('/api/roles')
          .set('Cookie', userCookie)
          .send({
            name: 'deniedRole',
            displayName: 'Denied Role',
            permissions: ['customer:read'],
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('should allow with role:create permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:create',
        ]);

        const response = await makeRequest()
          .post('/api/roles')
          .set('Cookie', userCookie)
          .send({
            name: `allowedRole-${Date.now()}`,
            displayName: 'Allowed Role',
            permissions: ['customer:read'],
          });

        expect(response.status).toBe(201);
      });

      it('should allow with role:* wildcard', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:*',
        ]);

        const response = await makeRequest()
          .post('/api/roles')
          .set('Cookie', userCookie)
          .send({
            name: `wildcardRole-${Date.now()}`,
            displayName: 'Wildcard Role',
            permissions: ['customer:read'],
          });

        expect(response.status).toBe(201);
      });
    });

    describe('PATCH /api/roles/:id - role:update denial', () => {
      let editableRole: Role;

      beforeEach(async () => {
        const orm = getORM();
        const em = orm.em.fork();

        editableRole = em.create(Role, {
          id: uuid(),
          name: `editableDenialRole-${Date.now()}`,
          displayName: 'Editable Denial Role',
          permissions: ['customer:read'],
          type: RoleType.COMPANY,
          company: testCompany,
        });
        em.persist(editableRole);
        await em.flush();
      });

      it('should return 403 without role:update permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:read',
          'role:create',
        ]);

        const response = await makeRequest()
          .patch(`/api/roles/${editableRole.id}`)
          .set('Cookie', userCookie)
          .send({
            displayName: 'Should Not Update',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('should allow with role:update permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:update',
        ]);

        const response = await makeRequest()
          .patch(`/api/roles/${editableRole.id}`)
          .set('Cookie', userCookie)
          .send({
            displayName: 'Updated Successfully',
          });

        expect(response.status).toBe(200);
      });
    });

    describe('DELETE /api/roles/:id - role:delete denial', () => {
      let deletableRole: Role;

      beforeEach(async () => {
        const orm = getORM();
        const em = orm.em.fork();

        deletableRole = em.create(Role, {
          id: uuid(),
          name: `deletableDenialRole-${Date.now()}`,
          displayName: 'Deletable Denial Role',
          permissions: ['customer:read'],
          type: RoleType.COMPANY,
          company: testCompany,
        });
        em.persist(deletableRole);
        await em.flush();
      });

      it('should return 403 without role:delete permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:read',
          'role:update',
        ]);

        const response = await makeRequest()
          .delete(`/api/roles/${deletableRole.id}`)
          .set('Cookie', userCookie);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('should allow with role:delete permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:delete',
        ]);

        const response = await makeRequest()
          .delete(`/api/roles/${deletableRole.id}`)
          .set('Cookie', userCookie);

        expect(response.status).toBe(200);
      });
    });

    describe('POST /api/roles/assign - role:assign denial', () => {
      let assignableRole: Role;
      let targetForAssign: User;

      beforeEach(async () => {
        const orm = getORM();
        const em = orm.em.fork();

        assignableRole = em.create(Role, {
          id: uuid(),
          name: `assignableDenialRole-${Date.now()}`,
          displayName: 'Assignable Denial Role',
          permissions: ['customer:read'],
          type: RoleType.COMPANY,
          company: testCompany,
        });
        em.persist(assignableRole);

        targetForAssign = em.create(User, {
          id: uuid(),
          email: `assign-target-${Date.now()}@example.com`,
          passwordHash: await hashPassword('TestPassword123!'),
          nameFirst: 'Assign',
          nameLast: 'Target',
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          company: testCompany,
        });
        em.persist(targetForAssign);
        await em.flush();
      });

      it('should return 403 without role:assign permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:read',
          'role:create',
          'role:update',
          'role:delete',
        ]);

        const response = await makeRequest()
          .post('/api/roles/assign')
          .set('Cookie', userCookie)
          .send({
            userId: targetForAssign.id,
            roleId: assignableRole.id,
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('should allow with role:assign permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:assign',
        ]);

        const response = await makeRequest()
          .post('/api/roles/assign')
          .set('Cookie', userCookie)
          .send({
            userId: targetForAssign.id,
            roleId: assignableRole.id,
          });

        expect(response.status).toBe(200);
      });
    });

    describe('POST /api/roles/revoke - role:assign denial', () => {
      let revokeRole: Role;
      let targetForRevoke: User;

      beforeEach(async () => {
        const orm = getORM();
        const em = orm.em.fork();

        revokeRole = em.create(Role, {
          id: uuid(),
          name: `revokeDenialRole-${Date.now()}`,
          displayName: 'Revoke Denial Role',
          permissions: ['customer:read'],
          type: RoleType.COMPANY,
          company: testCompany,
        });
        em.persist(revokeRole);

        targetForRevoke = em.create(User, {
          id: uuid(),
          email: `revoke-target-denial-${Date.now()}@example.com`,
          passwordHash: await hashPassword('TestPassword123!'),
          nameFirst: 'Revoke',
          nameLast: 'Target',
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          company: testCompany,
        });
        em.persist(targetForRevoke);

        // Assign the role first so we can revoke it
        const userRole = em.create(UserRole, {
          id: uuid(),
          user: targetForRevoke,
          role: revokeRole,
          company: testCompany,
        });
        em.persist(userRole);
        await em.flush();
      });

      it('should return 403 without role:assign permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:read',
        ]);

        const response = await makeRequest()
          .post('/api/roles/revoke')
          .set('Cookie', userCookie)
          .send({
            userId: targetForRevoke.id,
            roleId: revokeRole.id,
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('should allow with role:assign permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:assign',
        ]);

        const response = await makeRequest()
          .post('/api/roles/revoke')
          .set('Cookie', userCookie)
          .send({
            userId: targetForRevoke.id,
            roleId: revokeRole.id,
          });

        expect(response.status).toBe(200);
      });
    });

    describe('GET /api/roles/:id/users - role:read denial', () => {
      it('should return 403 without role:read permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'user:read',
        ]);

        const response = await makeRequest()
          .get(`/api/roles/${adminRole.id}/users`)
          .set('Cookie', userCookie);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('should allow with role:read permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:read',
        ]);

        const response = await makeRequest()
          .get(`/api/roles/${adminRole.id}/users`)
          .set('Cookie', userCookie);

        expect(response.status).toBe(200);
      });
    });

    describe('GET /api/roles/users/:userId - role:read denial', () => {
      it('should return 403 without role:read permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'user:read',
        ]);

        const response = await makeRequest()
          .get(`/api/roles/users/${testUser.id}`)
          .set('Cookie', userCookie);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });
    });

    describe('POST /api/roles/:id/clone - role:create denial', () => {
      it('should return 403 without role:create permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:read',
        ]);

        const response = await makeRequest()
          .post(`/api/roles/${adminRole.id}/clone`)
          .set('Cookie', userCookie)
          .send({
            name: `clonedRole-${Date.now()}`,
            displayName: 'Cloned Role',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('should allow with role:create permission', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:create',
        ]);

        const response = await makeRequest()
          .post(`/api/roles/${adminRole.id}/clone`)
          .set('Cookie', userCookie)
          .send({
            name: `clonedRole-${Date.now()}`,
            displayName: 'Cloned Role',
          });

        expect(response.status).toBe(201);
      });
    });

    describe('User with only role:read permission', () => {
      it('should only be able to read roles, not modify them', async () => {
        const { cookie: userCookie } = await createUserWithPermissions([
          'role:read',
        ]);

        // Can read roles
        const listResponse = await makeRequest()
          .get('/api/roles')
          .set('Cookie', userCookie);
        expect(listResponse.status).toBe(200);

        // Can read specific role
        const getResponse = await makeRequest()
          .get(`/api/roles/${adminRole.id}`)
          .set('Cookie', userCookie);
        expect(getResponse.status).toBe(200);

        // Cannot create
        const createResponse = await makeRequest()
          .post('/api/roles')
          .set('Cookie', userCookie)
          .send({
            name: 'shouldFail',
            displayName: 'Should Fail',
            permissions: ['customer:read'],
          });
        expect(createResponse.status).toBe(403);

        // Cannot clone (which is also a create operation)
        const cloneResponse = await makeRequest()
          .post(`/api/roles/${adminRole.id}/clone`)
          .set('Cookie', userCookie)
          .send({
            name: 'cloneShouldFail',
            displayName: 'Clone Should Fail',
          });
        expect(cloneResponse.status).toBe(403);
      });
    });
  });

  // ============================================================================
  // Platform Role Filtering Tests
  // ============================================================================

  describe('Platform Role Filtering Tests', () => {
    let platformRole: Role;

    beforeEach(async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a platform role for testing
      platformRole = em.create(Role, {
        id: uuid(),
        name: 'platformTestRole',
        displayName: 'Platform Test Role',
        permissions: ['*'],
        type: RoleType.PLATFORM,
        isDefault: false,
      });
      em.persist(platformRole);
      await em.flush();
    });

    describe('Company user (non-internal)', () => {
      it('should not see platform roles in GET /roles response', async () => {
        // testUser is a company user by default (userType is undefined or 'company')
        const response = await makeRequest()
          .get('/api/roles')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.roles).toBeDefined();

        // Verify platform role is NOT in the response
        const platformRoleInResponse = response.body.roles.find(
          (r: { type: string }) => r.type === 'platform',
        );
        expect(platformRoleInResponse).toBeUndefined();

        // Verify the specific platform role is not in the response
        const specificPlatformRole = response.body.roles.find(
          (r: { id: string }) => r.id === platformRole.id,
        );
        expect(specificPlatformRole).toBeUndefined();
      });

      it('should still see system and company roles', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create a company-specific role
        const companyRole = em.create(Role, {
          id: uuid(),
          name: 'companyTestRole',
          displayName: 'Company Test Role',
          permissions: ['customer:read'],
          type: RoleType.COMPANY,
          company: testCompany,
        });
        em.persist(companyRole);
        await em.flush();

        const response = await makeRequest()
          .get('/api/roles')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);

        // Verify system role is in the response
        const systemRole = response.body.roles.find(
          (r: { type: string }) => r.type === 'system',
        );
        expect(systemRole).toBeDefined();

        // Verify company role is in the response
        const companyRoleInResponse = response.body.roles.find(
          (r: { id: string }) => r.id === companyRole.id,
        );
        expect(companyRoleInResponse).toBeDefined();
        expect(companyRoleInResponse.type).toBe('company');
      });

      it('should not see platform roles even with superuser (*) permission', async () => {
        // testUser already has '*' permission via adminRole
        const response = await makeRequest()
          .get('/api/roles')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);

        // Even with superuser permission, platform roles should be hidden for company users
        const platformRoleInResponse = response.body.roles.find(
          (r: { type: string }) => r.type === 'platform',
        );
        expect(platformRoleInResponse).toBeUndefined();
      });
    });

    // Route handlers have been updated to use companyContext to support internal users
    describe('Internal user', () => {
      let internalUser: User;
      let internalUserCookie: string;
      let internalCompany: Company;

      beforeEach(async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create a company for the internal user's context
        internalCompany = em.create(Company, {
          id: uuid(),
          name: 'Internal Test Company',
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
        em.persist(internalCompany);

        // Create an internal user
        internalUser = em.create(User, {
          id: uuid(),
          email: `internal-${Date.now()}@platform.example.com`,
          passwordHash: await hashPassword('TestPassword123!'),
          nameFirst: 'Internal',
          nameLast: 'User',
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          userType: UserType.INTERNAL,
          company: internalCompany,
        });
        em.persist(internalUser);

        // Create a platform role with FULL company access for internal user
        // Internal users need a platform role (not system role) for permission resolution
        const internalPlatformRole = em.create(Role, {
          id: uuid(),
          name: `internalPlatformRole-${Date.now()}`,
          displayName: 'Internal Platform Role',
          permissions: ['platform:view_companies', 'platform:switch_company'],
          type: RoleType.PLATFORM,
          companyPermissions: ['*'], // Full access to all company permissions
        });
        em.persist(internalPlatformRole);

        // Assign platform role to internal user (no company for platform roles)
        const userRole = em.create(UserRole, {
          id: uuid(),
          user: internalUser,
          role: internalPlatformRole,
        });
        em.persist(userRole);

        // Create session for internal user with activeCompany set
        // Internal users need activeCompany (not just company) for companyContext
        const sid = uuid();
        const session = em.create(Session, {
          sid,
          user: internalUser,
          company: internalCompany,
          activeCompany: internalCompany, // Required for internal user companyContext
          data: { userId: internalUser.id },
          source: SessionSource.WEB,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          mfaVerified: false,
        });
        em.persist(session);
        await em.flush();

        internalUserCookie = `sid=${sid}`;
      });

      it('should see platform roles in GET /roles response', async () => {
        const response = await makeRequest()
          .get('/api/roles')
          .set('Cookie', internalUserCookie);

        expect(response.status).toBe(200);
        expect(response.body.roles).toBeDefined();

        // Verify platform role IS in the response for internal users
        const platformRoleInResponse = response.body.roles.find(
          (r: { id: string }) => r.id === platformRole.id,
        );
        expect(platformRoleInResponse).toBeDefined();
        expect(platformRoleInResponse.type).toBe('platform');
      });

      it('should see all role types (platform, system, and company)', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create a company-specific role for the internal company
        const companyRole = em.create(Role, {
          id: uuid(),
          name: 'internalCompanyTestRole',
          displayName: 'Internal Company Test Role',
          permissions: ['customer:read'],
          type: RoleType.COMPANY,
          company: internalCompany,
        });
        em.persist(companyRole);
        await em.flush();

        const response = await makeRequest()
          .get('/api/roles')
          .set('Cookie', internalUserCookie);

        expect(response.status).toBe(200);

        // Check for all role types
        const roles = response.body.roles as Array<{ type: string }>;
        const roleTypes = new Set(roles.map(r => r.type));

        expect(roleTypes.has('platform')).toBe(true);
        expect(roleTypes.has('system')).toBe(true);
        expect(roleTypes.has('company')).toBe(true);
      });
    });
  });
});
