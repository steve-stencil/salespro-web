import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { Company, User, Role, UserRole, Session } from '../../entities';
import { UserType, RoleType } from '../../entities/types';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import { getTestServer } from './server-setup';

describe('Internal Users Routes', () => {
  let baseUrl: string;
  let testCompany: Company;
  let adminUser: User;
  let platformAdminRole: Role;
  let platformSupportRole: Role;
  let sessionCookie: string;
  let createdUserId: string;

  beforeAll(async () => {
    const { baseUrl: url } = getTestServer();
    baseUrl = url;

    const orm = getORM();
    const em = orm.em.fork();

    // Create test company
    testCompany = em.create(Company, {
      name: 'Internal Users Test Company',
      isActive: true,
    });
    em.persist(testCompany);

    // Create platform roles
    platformAdminRole = em.create(Role, {
      name: 'platformAdminTest',
      displayName: 'Platform Admin Test',
      type: RoleType.PLATFORM,
      companyPermissions: ['*'], // Full access in any company
      permissions: [
        PERMISSIONS.PLATFORM_ADMIN,
        PERMISSIONS.PLATFORM_VIEW_COMPANIES,
        PERMISSIONS.PLATFORM_SWITCH_COMPANY,
        PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS,
      ],
    });

    platformSupportRole = em.create(Role, {
      name: 'platformSupportTest',
      displayName: 'Platform Support Test',
      type: RoleType.PLATFORM,
      companyPermissions: [
        // Read-only access
        PERMISSIONS.CUSTOMER_READ,
        PERMISSIONS.USER_READ,
        PERMISSIONS.OFFICE_READ,
        PERMISSIONS.ROLE_READ,
        PERMISSIONS.REPORT_READ,
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.COMPANY_READ,
        PERMISSIONS.FILE_READ,
      ],
      permissions: [
        PERMISSIONS.PLATFORM_VIEW_COMPANIES,
        PERMISSIONS.PLATFORM_SWITCH_COMPANY,
      ],
    });
    em.persist([platformAdminRole, platformSupportRole]);

    // Create admin internal user
    const pwHash = await hashPassword('adminpass123');
    adminUser = em.create(User, {
      email: 'admin-internal@test.com',
      passwordHash: pwHash,
      userType: UserType.INTERNAL,
      isActive: true,
      emailVerified: true,
    });
    em.persist(adminUser);

    await em.flush();

    // Assign platform admin role to admin user
    const userRole = em.create(UserRole, {
      user: adminUser,
      role: platformAdminRole,
      assignedAt: new Date(),
    });
    em.persist(userRole);
    await em.flush();
  });

  afterAll(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up test data
    await em.nativeDelete(UserRole, {});
    await em.nativeDelete(Session, {});
    await em.nativeDelete(User, {
      email: {
        $in: ['admin-internal@test.com', 'new-internal@test.com'],
      },
    });
    await em.nativeDelete(Role, {
      name: { $in: ['platformAdminTest', 'platformSupportTest'] },
    });
    await em.nativeDelete(Company, { name: 'Internal Users Test Company' });
  });

  beforeEach(async () => {
    // Login as admin internal user before each test
    const loginRes = await request(baseUrl).post('/api/auth/login').send({
      email: 'admin-internal@test.com',
      password: 'adminpass123',
    });

    sessionCookie = loginRes.headers['set-cookie']?.[0] ?? '';
  });

  describe('GET /internal-users', () => {
    it('should list internal users', async () => {
      const res = await request(baseUrl)
        .get('/api/internal-users')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.users).toBeDefined();
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(baseUrl).get('/api/internal-users');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /internal-users/roles', () => {
    it('should list platform roles', async () => {
      const res = await request(baseUrl)
        .get('/api/internal-users/roles')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.roles).toBeDefined();
      expect(Array.isArray(res.body.roles)).toBe(true);
      expect(res.body.roles.length).toBeGreaterThanOrEqual(2);
    });

    it('should include companyPermissions in roles', async () => {
      const res = await request(baseUrl)
        .get('/api/internal-users/roles')
        .set('Cookie', sessionCookie);

      const adminRole = res.body.roles.find(
        (r: { name: string }) => r.name === 'platformAdminTest',
      );
      expect(adminRole).toBeDefined();
      expect(adminRole.companyPermissions).toContain('*');
    });
  });

  describe('POST /internal-users', () => {
    it('should create a new internal user', async () => {
      const res = await request(baseUrl)
        .post('/api/internal-users')
        .set('Cookie', sessionCookie)
        .send({
          email: 'new-internal@test.com',
          password: 'newpass123',
          nameFirst: 'New',
          nameLast: 'Internal',
          platformRoleId: platformSupportRole.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe('new-internal@test.com');
      expect(res.body.platformRole.id).toBe(platformSupportRole.id);

      createdUserId = res.body.id;
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(baseUrl)
        .post('/api/internal-users')
        .set('Cookie', sessionCookie)
        .send({
          email: 'invalid-email',
          password: 'newpass123',
          platformRoleId: platformSupportRole.id,
        });

      expect(res.status).toBe(400);
    });

    it('should return 409 for duplicate email', async () => {
      const res = await request(baseUrl)
        .post('/api/internal-users')
        .set('Cookie', sessionCookie)
        .send({
          email: 'admin-internal@test.com',
          password: 'newpass123',
          platformRoleId: platformSupportRole.id,
        });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /internal-users/:id', () => {
    it('should get internal user details', async () => {
      const res = await request(baseUrl)
        .get(`/api/internal-users/${adminUser.id}`)
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(adminUser.id);
      expect(res.body.email).toBe('admin-internal@test.com');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(baseUrl)
        .get('/api/internal-users/00000000-0000-4000-a000-000000000000')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /internal-users/:id', () => {
    it('should update internal user', async () => {
      // First, make sure createdUserId exists from the POST test
      if (!createdUserId) {
        const createRes = await request(baseUrl)
          .post('/api/internal-users')
          .set('Cookie', sessionCookie)
          .send({
            email: 'new-internal@test.com',
            password: 'newpass123',
            platformRoleId: platformSupportRole.id,
          });
        createdUserId = createRes.body.id;
      }

      const res = await request(baseUrl)
        .patch(`/api/internal-users/${createdUserId}`)
        .set('Cookie', sessionCookie)
        .send({
          nameFirst: 'Updated',
          nameLast: 'User',
        });

      expect(res.status).toBe(200);
      expect(res.body.nameFirst).toBe('Updated');
      expect(res.body.nameLast).toBe('User');
    });
  });

  describe('DELETE /internal-users/:id', () => {
    it('should delete internal user', async () => {
      // Ensure we have a user to delete
      if (!createdUserId) {
        const createRes = await request(baseUrl)
          .post('/api/internal-users')
          .set('Cookie', sessionCookie)
          .send({
            email: 'new-internal@test.com',
            password: 'newpass123',
            platformRoleId: platformSupportRole.id,
          });
        createdUserId = createRes.body.id;
      }

      const res = await request(baseUrl)
        .delete(`/api/internal-users/${createdUserId}`)
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(204);

      // Verify deletion
      const getRes = await request(baseUrl)
        .get(`/api/internal-users/${createdUserId}`)
        .set('Cookie', sessionCookie);

      expect(getRes.status).toBe(404);
    });
  });
});
