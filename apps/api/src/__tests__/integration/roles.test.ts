import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';

import {
  RoleType,
  Company,
  User,
  Role,
  UserRole,
  Session,
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
        expirationDays: 90,
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
      source: 'web',
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
      await em.nativeDelete('user_role', { user: testUser.id });

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

    it('should return 403 when trying to modify system role', async () => {
      const response = await makeRequest()
        .patch(`/api/roles/${adminRole.id}`)
        .set('Cookie', cookie)
        .send({
          displayName: 'Modified System Role',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot modify system roles');
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
      expect(response.body.message).toBe('Role deleted');
    });

    it('should return 403 when trying to delete system role', async () => {
      const response = await makeRequest()
        .delete(`/api/roles/${adminRole.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot delete system roles');
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
      expect(response.body.message).toBe('Role assigned');
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
      expect(response.body.message).toBe('Role revoked');
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
});
