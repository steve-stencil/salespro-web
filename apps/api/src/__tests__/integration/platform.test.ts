import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { Company, User, Role, UserRole, Session } from '../../entities';
import { UserType, RoleType } from '../../entities/types';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import { getTestServer } from './server-setup';

describe('Platform Routes', () => {
  let baseUrl: string;
  let testCompany1: Company;
  let testCompany2: Company;
  let internalUser: User;
  let companyUser: User;
  let platformAdminRole: Role;
  let platformSupportRole: Role;
  let sessionCookie: string;

  beforeAll(async () => {
    const { baseUrl: url } = getTestServer();
    baseUrl = url;

    const orm = getORM();
    const em = orm.em.fork();

    // Create test companies
    testCompany1 = em.create(Company, {
      name: 'Test Company 1',
      isActive: true,
    });
    testCompany2 = em.create(Company, {
      name: 'Test Company 2',
      isActive: true,
    });
    em.persist([testCompany1, testCompany2]);

    // Create platform roles
    platformAdminRole = em.create(Role, {
      name: 'platformAdmin',
      displayName: 'Platform Admin',
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
      name: 'platformSupport',
      displayName: 'Platform Support',
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

    // Create internal user
    const pwHash = await hashPassword('testpass123');
    internalUser = em.create(User, {
      email: 'internal@test.com',
      passwordHash: pwHash,
      userType: UserType.INTERNAL,
      isActive: true,
      emailVerified: true,
    });
    em.persist(internalUser);

    // Create company user (reuse the same password hash)
    companyUser = em.create(User, {
      email: 'company@test.com',
      passwordHash: pwHash,
      userType: UserType.COMPANY,
      company: testCompany1,
      isActive: true,
      emailVerified: true,
    });
    em.persist(companyUser);

    await em.flush();

    // Assign platform admin role to internal user
    const userRole = em.create(UserRole, {
      user: internalUser,
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
    await em.nativeDelete(UserRole, { user: internalUser });
    await em.nativeDelete(UserRole, { user: companyUser });
    await em.nativeDelete(Session, {});
    await em.nativeDelete(User, {
      email: { $in: ['internal@test.com', 'company@test.com'] },
    });
    await em.nativeDelete(Role, { type: RoleType.PLATFORM });
    await em.nativeDelete(Company, {
      name: { $in: ['Test Company 1', 'Test Company 2'] },
    });
  });

  beforeEach(async () => {
    // Login as internal user before each test
    const loginRes = await request(baseUrl).post('/api/auth/login').send({
      email: 'internal@test.com',
      password: 'testpass123',
    });

    sessionCookie = loginRes.headers['set-cookie']?.[0] ?? '';
  });

  describe('GET /platform/companies', () => {
    it('should list all companies for internal users', async () => {
      const res = await request(baseUrl)
        .get('/api/platform/companies')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.companies).toBeDefined();
      expect(Array.isArray(res.body.companies)).toBe(true);
      expect(res.body.companies.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 403 for company users', async () => {
      // Login as company user
      const loginRes = await request(baseUrl).post('/api/auth/login').send({
        email: 'company@test.com',
        password: 'testpass123',
      });
      const companyCookie = loginRes.headers['set-cookie']?.[0] ?? '';

      const res = await request(baseUrl)
        .get('/api/platform/companies')
        .set('Cookie', companyCookie);

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(baseUrl).get('/api/platform/companies');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /platform/companies/:id', () => {
    it('should get company details for internal users', async () => {
      const res = await request(baseUrl)
        .get(`/api/platform/companies/${testCompany1.id}`)
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testCompany1.id);
      expect(res.body.name).toBe('Test Company 1');
    });

    it('should return 404 for non-existent company', async () => {
      const res = await request(baseUrl)
        .get('/api/platform/companies/00000000-0000-4000-a000-000000000000')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /platform/active-company', () => {
    it('should return null when no company is selected', async () => {
      const res = await request(baseUrl)
        .get('/api/platform/active-company')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.activeCompany).toBeNull();
    });
  });

  describe('POST /platform/switch-company', () => {
    it('should switch active company for internal users', async () => {
      const res = await request(baseUrl)
        .post('/api/platform/switch-company')
        .set('Cookie', sessionCookie)
        .send({ companyId: testCompany1.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.activeCompany.id).toBe(testCompany1.id);
      expect(res.body.activeCompany.name).toBe('Test Company 1');

      // Verify active company is set
      const activeRes = await request(baseUrl)
        .get('/api/platform/active-company')
        .set('Cookie', sessionCookie);

      expect(activeRes.body.activeCompany.id).toBe(testCompany1.id);
    });

    it('should return 404 for non-existent company', async () => {
      const res = await request(baseUrl)
        .post('/api/platform/switch-company')
        .set('Cookie', sessionCookie)
        .send({ companyId: '00000000-0000-4000-a000-000000000000' });

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid company ID', async () => {
      const res = await request(baseUrl)
        .post('/api/platform/switch-company')
        .set('Cookie', sessionCookie)
        .send({ companyId: 'invalid-id' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /platform/active-company', () => {
    it('should clear active company', async () => {
      // First switch to a company
      await request(baseUrl)
        .post('/api/platform/switch-company')
        .set('Cookie', sessionCookie)
        .send({ companyId: testCompany1.id });

      // Then clear it
      const res = await request(baseUrl)
        .delete('/api/platform/active-company')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.activeCompany).toBeNull();
    });
  });
});
