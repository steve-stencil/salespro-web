/**
 * Integration tests for Platform Roles API endpoints.
 *
 * Tests the /platform/roles endpoints for managing platform roles
 * that control internal user permissions.
 */
import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';

import { Company, Role, UserRole } from '../../entities';
import { RoleType } from '../../entities/types';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import {
  createTestCompany,
  createPlatformRole,
  createInternalUser,
  cleanupTestData,
} from './auth-test-helpers';
import { makeRequest, waitForDatabase } from './helpers';

import type { EntityManager } from '@mikro-orm/core';

describe('Platform Roles API Integration Tests', () => {
  let em: EntityManager;
  let testCompany: Company;
  let adminPlatformRole: Role;
  let adminCookie: string;

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    const orm = getORM();
    em = orm.em.fork();

    // Create a test company for context
    testCompany = await createTestCompany(em, { name: 'Platform Test Company' });

    // Create platform admin role with all platform permissions
    adminPlatformRole = await createPlatformRole(em, ['*'], {
      name: `platform-admin-${Date.now()}`,
      displayName: 'Platform Admin',
      platformPermissions: [
        PERMISSIONS.PLATFORM_ADMIN,
        PERMISSIONS.PLATFORM_VIEW_COMPANIES,
        PERMISSIONS.PLATFORM_SWITCH_COMPANY,
        PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS,
      ],
    });

    // Create internal admin user
    const { cookie } = await createInternalUser(em, adminPlatformRole, {
      switchToCompany: testCompany,
    });
    adminCookie = cookie;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  // ===========================================================================
  // GET /platform/roles
  // ===========================================================================

  describe('GET /platform/roles', () => {
    it('should return all platform roles with user counts', async () => {
      const response = await makeRequest()
        .get('/api/platform/roles')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.roles).toBeDefined();
      expect(Array.isArray(response.body.roles)).toBe(true);

      // Should include the admin platform role we created
      const adminRole = response.body.roles.find(
        (r: { id: string }) => r.id === adminPlatformRole.id,
      );
      expect(adminRole).toBeDefined();
      expect(adminRole.userCount).toBe(1); // Our admin user
      expect(adminRole.companyPermissions).toContain('*');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/platform/roles');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks platform:admin permission', async () => {
      // Create a limited platform role without admin permission
      const limitedRole = await createPlatformRole(em, ['*'], {
        name: `limited-${Date.now()}`,
        displayName: 'Limited Platform Role',
        platformPermissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
      });

      const { cookie } = await createInternalUser(em, limitedRole, {
        switchToCompany: testCompany,
      });

      const response = await makeRequest()
        .get('/api/platform/roles')
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
    });

    it('should return 403 for company users (non-internal)', async () => {
      const orm = getORM();
      const localEm = orm.em.fork();

      // Create a company user with admin permissions
      const companyRole = localEm.create(Role, {
        id: uuid(),
        name: `company-admin-${Date.now()}`,
        displayName: 'Company Admin',
        permissions: ['*'],
        type: RoleType.SYSTEM,
      });
      localEm.persist(companyRole);

      const { User, Session, SessionSource } = await import('../../entities');
      const { hashPassword } = await import('../../lib/crypto');

      const user = localEm.create(User, {
        id: uuid(),
        email: `company-user-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Company',
        nameLast: 'User',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      localEm.persist(user);

      const userRole = localEm.create(UserRole, {
        id: uuid(),
        user,
        role: companyRole,
        company: testCompany,
      });
      localEm.persist(userRole);

      const sessionId = uuid();
      const session = localEm.create(Session, {
        sid: sessionId,
        user,
        company: testCompany,
        data: { userId: user.id },
        source: SessionSource.WEB,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        expiresAt: new Date(Date.now() + 86400000),
        absoluteExpiresAt: new Date(Date.now() + 86400000 * 30),
        mfaVerified: false,
      });
      localEm.persist(session);
      await localEm.flush();

      const response = await makeRequest()
        .get('/api/platform/roles')
        .set('Cookie', `sid=${sessionId}`);

      expect(response.status).toBe(403);
    });
  });

  // ===========================================================================
  // GET /platform/roles/:id
  // ===========================================================================

  describe('GET /platform/roles/:id', () => {
    it('should return a specific platform role', async () => {
      const response = await makeRequest()
        .get(`/api/platform/roles/${adminPlatformRole.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(adminPlatformRole.id);
      expect(response.body.name).toBe(adminPlatformRole.name);
      expect(response.body.displayName).toBe(adminPlatformRole.displayName);
      expect(response.body.companyPermissions).toContain('*');
      expect(response.body.userCount).toBe(1);
    });

    it('should return 404 for non-existent role', async () => {
      const response = await makeRequest()
        .get(`/api/platform/roles/${uuid()}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Platform role not found');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await makeRequest()
        .get('/api/platform/roles/invalid-uuid')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid role ID format');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get(
        `/api/platform/roles/${adminPlatformRole.id}`,
      );

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // POST /platform/roles
  // ===========================================================================

  describe('POST /platform/roles', () => {
    it('should create a new platform role', async () => {
      const roleData = {
        name: `new-platform-role-${Date.now()}`,
        displayName: 'New Platform Role',
        description: 'A test platform role',
        permissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
        companyPermissions: ['customer:read', 'user:read'],
      };

      const response = await makeRequest()
        .post('/api/platform/roles')
        .set('Cookie', adminCookie)
        .send(roleData);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(roleData.name);
      expect(response.body.displayName).toBe(roleData.displayName);
      expect(response.body.description).toBe(roleData.description);
      expect(response.body.permissions).toContain(
        PERMISSIONS.PLATFORM_VIEW_COMPANIES,
      );
      expect(response.body.companyPermissions).toContain('customer:read');
      expect(response.body.userCount).toBe(0);
    });

    it('should create a platform role with full company access', async () => {
      const roleData = {
        name: `full-access-role-${Date.now()}`,
        displayName: 'Full Access Role',
        permissions: [PERMISSIONS.PLATFORM_ADMIN],
        companyPermissions: ['*'],
      };

      const response = await makeRequest()
        .post('/api/platform/roles')
        .set('Cookie', adminCookie)
        .send(roleData);

      expect(response.status).toBe(201);
      expect(response.body.companyPermissions).toContain('*');
    });

    it('should return 400 when missing required fields', async () => {
      const response = await makeRequest()
        .post('/api/platform/roles')
        .set('Cookie', adminCookie)
        .send({
          name: 'incomplete-role',
          // Missing displayName and permissions
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 when permissions array is empty', async () => {
      const response = await makeRequest()
        .post('/api/platform/roles')
        .set('Cookie', adminCookie)
        .send({
          name: 'empty-perms-role',
          displayName: 'Empty Permissions Role',
          permissions: [],
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 when no platform permission is included', async () => {
      const response = await makeRequest()
        .post('/api/platform/roles')
        .set('Cookie', adminCookie)
        .send({
          name: 'no-platform-perms',
          displayName: 'No Platform Permissions',
          permissions: ['customer:read'], // Only company permission
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('platform permission');
    });

    it('should return 409 for duplicate role name', async () => {
      const roleName = `duplicate-test-${Date.now()}`;

      // Create first role
      await makeRequest()
        .post('/api/platform/roles')
        .set('Cookie', adminCookie)
        .send({
          name: roleName,
          displayName: 'First Role',
          permissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
        });

      // Try to create duplicate
      const response = await makeRequest()
        .post('/api/platform/roles')
        .set('Cookie', adminCookie)
        .send({
          name: roleName,
          displayName: 'Duplicate Role',
          permissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should return 400 for invalid role name format', async () => {
      const response = await makeRequest()
        .post('/api/platform/roles')
        .set('Cookie', adminCookie)
        .send({
          name: '123-invalid-start', // Starts with number
          displayName: 'Invalid Name Role',
          permissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
        });

      expect(response.status).toBe(400);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest()
        .post('/api/platform/roles')
        .send({
          name: 'unauthorized-role',
          displayName: 'Unauthorized Role',
          permissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
        });

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // PATCH /platform/roles/:id
  // ===========================================================================

  describe('PATCH /platform/roles/:id', () => {
    let editableRole: Role;

    beforeEach(async () => {
      editableRole = await createPlatformRole(em, ['user:read'], {
        name: `editable-role-${Date.now()}`,
        displayName: 'Editable Role',
        platformPermissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
      });
    });

    it('should update display name', async () => {
      const response = await makeRequest()
        .patch(`/api/platform/roles/${editableRole.id}`)
        .set('Cookie', adminCookie)
        .send({
          displayName: 'Updated Display Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.displayName).toBe('Updated Display Name');
    });

    it('should update description', async () => {
      const response = await makeRequest()
        .patch(`/api/platform/roles/${editableRole.id}`)
        .set('Cookie', adminCookie)
        .send({
          description: 'Updated description',
        });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Updated description');
    });

    it('should update permissions', async () => {
      const response = await makeRequest()
        .patch(`/api/platform/roles/${editableRole.id}`)
        .set('Cookie', adminCookie)
        .send({
          permissions: [
            PERMISSIONS.PLATFORM_VIEW_COMPANIES,
            PERMISSIONS.PLATFORM_SWITCH_COMPANY,
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.permissions).toContain(
        PERMISSIONS.PLATFORM_VIEW_COMPANIES,
      );
      expect(response.body.permissions).toContain(
        PERMISSIONS.PLATFORM_SWITCH_COMPANY,
      );
    });

    it('should update company permissions', async () => {
      const response = await makeRequest()
        .patch(`/api/platform/roles/${editableRole.id}`)
        .set('Cookie', adminCookie)
        .send({
          companyPermissions: ['*'],
        });

      expect(response.status).toBe(200);
      expect(response.body.companyPermissions).toContain('*');
    });

    it('should return 400 when removing all platform permissions', async () => {
      const response = await makeRequest()
        .patch(`/api/platform/roles/${editableRole.id}`)
        .set('Cookie', adminCookie)
        .send({
          permissions: ['customer:read'], // Only company permission
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('platform permission');
    });

    it('should return 404 for non-existent role', async () => {
      const response = await makeRequest()
        .patch(`/api/platform/roles/${uuid()}`)
        .set('Cookie', adminCookie)
        .send({
          displayName: 'Updated',
        });

      expect(response.status).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest()
        .patch(`/api/platform/roles/${editableRole.id}`)
        .send({
          displayName: 'Unauthorized Update',
        });

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // DELETE /platform/roles/:id
  // ===========================================================================

  describe('DELETE /platform/roles/:id', () => {
    it('should delete a platform role with no users', async () => {
      // Create a role with no users assigned
      const deletableRole = await createPlatformRole(em, ['user:read'], {
        name: `deletable-role-${Date.now()}`,
        displayName: 'Deletable Role',
        platformPermissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
      });

      const response = await makeRequest()
        .delete(`/api/platform/roles/${deletableRole.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(204);

      // Verify role is deleted
      const getResponse = await makeRequest()
        .get(`/api/platform/roles/${deletableRole.id}`)
        .set('Cookie', adminCookie);

      expect(getResponse.status).toBe(404);
    });

    it('should return 400 when trying to delete role with assigned users', async () => {
      // adminPlatformRole has a user assigned
      const response = await makeRequest()
        .delete(`/api/platform/roles/${adminPlatformRole.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('user(s) are assigned');
    });

    it('should return 404 for non-existent role', async () => {
      const response = await makeRequest()
        .delete(`/api/platform/roles/${uuid()}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await makeRequest()
        .delete('/api/platform/roles/invalid-uuid')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(400);
    });

    it('should return 401 when not authenticated', async () => {
      const deletableRole = await createPlatformRole(em, ['user:read'], {
        name: `deletable-unauth-${Date.now()}`,
        displayName: 'Deletable Unauth Role',
        platformPermissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
      });

      const response = await makeRequest().delete(
        `/api/platform/roles/${deletableRole.id}`,
      );

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // Authorization Tests
  // ===========================================================================

  describe('Authorization Tests', () => {
    it('should allow platform:admin to perform all operations', async () => {
      // List
      const listResponse = await makeRequest()
        .get('/api/platform/roles')
        .set('Cookie', adminCookie);
      expect(listResponse.status).toBe(200);

      // Create
      const createResponse = await makeRequest()
        .post('/api/platform/roles')
        .set('Cookie', adminCookie)
        .send({
          name: `auth-test-role-${Date.now()}`,
          displayName: 'Auth Test Role',
          permissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
        });
      expect(createResponse.status).toBe(201);

      // Read
      const readResponse = await makeRequest()
        .get(`/api/platform/roles/${createResponse.body.id}`)
        .set('Cookie', adminCookie);
      expect(readResponse.status).toBe(200);

      // Update
      const updateResponse = await makeRequest()
        .patch(`/api/platform/roles/${createResponse.body.id}`)
        .set('Cookie', adminCookie)
        .send({
          displayName: 'Updated Auth Test Role',
        });
      expect(updateResponse.status).toBe(200);

      // Delete
      const deleteResponse = await makeRequest()
        .delete(`/api/platform/roles/${createResponse.body.id}`)
        .set('Cookie', adminCookie);
      expect(deleteResponse.status).toBe(204);
    });

    it('should deny all operations to users without platform:admin', async () => {
      const limitedRole = await createPlatformRole(em, ['*'], {
        name: `limited-auth-${Date.now()}`,
        displayName: 'Limited Auth Role',
        platformPermissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
      });

      const { cookie: limitedCookie } = await createInternalUser(
        em,
        limitedRole,
        { switchToCompany: testCompany },
      );

      // List
      const listResponse = await makeRequest()
        .get('/api/platform/roles')
        .set('Cookie', limitedCookie);
      expect(listResponse.status).toBe(403);

      // Create
      const createResponse = await makeRequest()
        .post('/api/platform/roles')
        .set('Cookie', limitedCookie)
        .send({
          name: 'should-fail',
          displayName: 'Should Fail',
          permissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
        });
      expect(createResponse.status).toBe(403);

      // Read
      const readResponse = await makeRequest()
        .get(`/api/platform/roles/${adminPlatformRole.id}`)
        .set('Cookie', limitedCookie);
      expect(readResponse.status).toBe(403);

      // Update
      const updateResponse = await makeRequest()
        .patch(`/api/platform/roles/${adminPlatformRole.id}`)
        .set('Cookie', limitedCookie)
        .send({
          displayName: 'Should Fail Update',
        });
      expect(updateResponse.status).toBe(403);

      // Delete - create a deletable role first as admin
      const deletableRole = await createPlatformRole(em, ['user:read'], {
        name: `deletable-limited-${Date.now()}`,
        displayName: 'Deletable Limited',
        platformPermissions: [PERMISSIONS.PLATFORM_VIEW_COMPANIES],
      });

      const deleteResponse = await makeRequest()
        .delete(`/api/platform/roles/${deletableRole.id}`)
        .set('Cookie', limitedCookie);
      expect(deleteResponse.status).toBe(403);
    });
  });
});
