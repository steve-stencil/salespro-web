import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { User, UserCompany, Session } from '../../entities';
import {
  UserType,
  SessionSource,
  CompanyAccessLevel,
} from '../../entities/types';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import {
  makeRequest,
  waitForDatabase,
  createCompanySetup,
  createTestCompany,
  createTestRole,
  createPlatformRole,
  createInternalUser,
} from './helpers';

import type { Company } from '../../entities';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Create a user with UserCompany record for multi-company testing.
 */
async function createUserWithCompanyAccess(
  em: EntityManager,
  company: Company,
  options: {
    email?: string;
    isActive?: boolean;
    isPinned?: boolean;
    lastAccessedAt?: Date;
  } = {},
): Promise<{
  user: User;
  userCompany: UserCompany;
  cookie: string;
  sessionId: string;
}> {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = em.create(User, {
    id: uuid(),
    email: options.email ?? `user-${Date.now()}-${Math.random()}@example.com`,
    passwordHash,
    nameFirst: 'Test',
    nameLast: 'User',
    userType: UserType.COMPANY,
    isActive: true,
    emailVerified: true,
    mfaEnabled: false,
    company,
  });
  em.persist(user);

  const userCompany = em.create(UserCompany, {
    id: uuid(),
    user,
    company,
    isActive: options.isActive ?? true,
    isPinned: options.isPinned ?? false,
    joinedAt: new Date(),
    lastAccessedAt: options.lastAccessedAt,
  });
  em.persist(userCompany);

  const sessionId = uuid();
  const session = em.create(Session, {
    sid: sessionId,
    user,
    company,
    activeCompany: company,
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

  return { user, userCompany, cookie: `sid=${sessionId}`, sessionId };
}

/**
 * Add a user to an additional company.
 */
async function addUserToCompany(
  em: EntityManager,
  user: User,
  company: Company,
  options: {
    isActive?: boolean;
    isPinned?: boolean;
    lastAccessedAt?: Date;
  } = {},
): Promise<UserCompany> {
  const userCompany = em.create(UserCompany, {
    id: uuid(),
    user,
    company,
    isActive: options.isActive ?? true,
    isPinned: options.isPinned ?? false,
    joinedAt: new Date(),
    lastAccessedAt: options.lastAccessedAt,
  });
  em.persist(userCompany);
  await em.flush();
  return userCompany;
}

describe('Multi-Company Access Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
  });

  afterEach(async () => {
    // Clean up test data after each test
    const orm = getORM();
    const em = orm.em.fork();
    await em.nativeDelete('internal_user_company', {});
    await em.nativeDelete('user_company', {});
    await em.nativeDelete('user_invite', {});
    await em.nativeDelete('user_office', {});
    await em.nativeDelete('user_role', {});
    await em.nativeDelete('session', {});
    await em.nativeDelete('office', {});
    await em.nativeDelete('user', {});
    await em.nativeDelete('role', {});
    await em.nativeDelete('company', {});
  });

  describe('GET /api/users/me/companies (list user companies)', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/users/me/companies');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return companies for a company user with single membership', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company = await createTestCompany(em);
      const { cookie } = await createUserWithCompanyAccess(em, company);

      const response = await makeRequest()
        .get('/api/users/me/companies')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].id).toBe(company.id);
      expect(response.body.total).toBe(1);
    });

    it('should return multiple companies for a user with multi-company access', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company1 = await createTestCompany(em, { name: 'Company A' });
      const company2 = await createTestCompany(em, { name: 'Company B' });

      const { user, cookie } = await createUserWithCompanyAccess(em, company1);
      await addUserToCompany(em, user, company2);

      const response = await makeRequest()
        .get('/api/users/me/companies')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should return recent companies sorted by lastAccessedAt', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company1 = await createTestCompany(em, { name: 'Company A' });
      const company2 = await createTestCompany(em, { name: 'Company B' });

      const now = new Date();
      const { user, cookie } = await createUserWithCompanyAccess(em, company1, {
        lastAccessedAt: new Date(now.getTime() - 1000),
      });
      await addUserToCompany(em, user, company2, {
        lastAccessedAt: now,
      });

      const response = await makeRequest()
        .get('/api/users/me/companies')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      // Recent should be sorted by lastAccessedAt DESC
      expect(response.body.recent).toBeDefined();
      if (response.body.recent.length > 0) {
        expect(response.body.recent[0].name).toBe('Company B');
      }
    });

    it('should return pinned companies separately', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company1 = await createTestCompany(em, { name: 'Company A' });
      const company2 = await createTestCompany(em, { name: 'Company B' });

      const { user, cookie } = await createUserWithCompanyAccess(em, company1, {
        isPinned: true,
      });
      await addUserToCompany(em, user, company2, { isPinned: false });

      const response = await makeRequest()
        .get('/api/users/me/companies')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.pinned).toBeDefined();
      expect(response.body.pinned).toHaveLength(1);
      expect(response.body.pinned[0].name).toBe('Company A');
    });

    it('should filter by search query', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company1 = await createTestCompany(em, { name: 'Alpha Corp' });
      const company2 = await createTestCompany(em, { name: 'Beta Inc' });

      const { user, cookie } = await createUserWithCompanyAccess(em, company1);
      await addUserToCompany(em, user, company2);

      const response = await makeRequest()
        .get('/api/users/me/companies?search=Alpha')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].name).toBe('Alpha Corp');
    });

    it('should only return active memberships', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company1 = await createTestCompany(em, { name: 'Active Company' });
      const company2 = await createTestCompany(em, {
        name: 'Inactive Company',
      });

      const { user, cookie } = await createUserWithCompanyAccess(em, company1);
      await addUserToCompany(em, user, company2, { isActive: false });

      const response = await makeRequest()
        .get('/api/users/me/companies')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].name).toBe('Active Company');
    });
  });

  describe('GET /api/users/me/active-company', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/users/me/active-company');

      expect(response.status).toBe(401);
    });

    it('should return current active company from session', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company = await createTestCompany(em, { name: 'Test Company' });
      const { cookie } = await createUserWithCompanyAccess(em, company);

      const response = await makeRequest()
        .get('/api/users/me/active-company')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.activeCompany).toBeDefined();
      expect(response.body.activeCompany.id).toBe(company.id);
      expect(response.body.activeCompany.name).toBe('Test Company');
    });
  });

  describe('POST /api/users/me/switch-company', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest()
        .post('/api/users/me/switch-company')
        .send({ companyId: uuid() });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid company ID format', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company = await createTestCompany(em);
      const { cookie } = await createUserWithCompanyAccess(em, company);

      const response = await makeRequest()
        .post('/api/users/me/switch-company')
        .set('Cookie', cookie)
        .send({ companyId: 'invalid-uuid' });

      expect(response.status).toBe(400);
    });

    it('should switch to another company the user has access to', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company1 = await createTestCompany(em, { name: 'Company A' });
      const company2 = await createTestCompany(em, { name: 'Company B' });

      const { user, cookie } = await createUserWithCompanyAccess(em, company1);
      await addUserToCompany(em, user, company2);

      const response = await makeRequest()
        .post('/api/users/me/switch-company')
        .set('Cookie', cookie)
        .send({ companyId: company2.id });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Company switched successfully');
      expect(response.body.activeCompany.id).toBe(company2.id);
    });

    it('should return 403 when switching to company user has no access to', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company1 = await createTestCompany(em, { name: 'Company A' });
      const company2 = await createTestCompany(em, { name: 'Company B' });

      const { cookie } = await createUserWithCompanyAccess(em, company1);
      // User does NOT have access to company2

      const response = await makeRequest()
        .post('/api/users/me/switch-company')
        .set('Cookie', cookie)
        .send({ companyId: company2.id });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('No active membership for this company');
    });

    it('should return 403 when switching to deactivated membership', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company1 = await createTestCompany(em, { name: 'Company A' });
      const company2 = await createTestCompany(em, { name: 'Company B' });

      const { user, cookie } = await createUserWithCompanyAccess(em, company1);
      await addUserToCompany(em, user, company2, { isActive: false });

      const response = await makeRequest()
        .post('/api/users/me/switch-company')
        .set('Cookie', cookie)
        .send({ companyId: company2.id });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent company', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company = await createTestCompany(em);
      const { cookie } = await createUserWithCompanyAccess(em, company);

      const response = await makeRequest()
        .post('/api/users/me/switch-company')
        .set('Cookie', cookie)
        .send({ companyId: uuid() });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Company not found');
    });
  });

  describe('PATCH /api/users/me/companies/:companyId (pin/unpin)', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest()
        .patch(`/api/users/me/companies/${uuid()}`)
        .send({ isPinned: true });

      expect(response.status).toBe(401);
    });

    it('should pin a company', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company = await createTestCompany(em);
      const { cookie } = await createUserWithCompanyAccess(em, company, {
        isPinned: false,
      });

      const response = await makeRequest()
        .patch(`/api/users/me/companies/${company.id}`)
        .set('Cookie', cookie)
        .send({ isPinned: true });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Company pinned');
    });

    it('should unpin a company', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company = await createTestCompany(em);
      const { cookie } = await createUserWithCompanyAccess(em, company, {
        isPinned: true,
      });

      const response = await makeRequest()
        .patch(`/api/users/me/companies/${company.id}`)
        .set('Cookie', cookie)
        .send({ isPinned: false });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Company unpinned');
    });

    it('should return 404 for company user has no access to', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const company1 = await createTestCompany(em, { name: 'Company A' });
      const company2 = await createTestCompany(em, { name: 'Company B' });

      const { cookie } = await createUserWithCompanyAccess(em, company1);

      const response = await makeRequest()
        .patch(`/api/users/me/companies/${company2.id}`)
        .set('Cookie', cookie)
        .send({ isPinned: true });

      expect(response.status).toBe(404);
    });
  });

  describe('Internal User Company Restrictions', () => {
    it('should allow unrestricted internal user to list all companies', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      await createTestCompany(em, { name: 'Company A' });
      await createTestCompany(em, { name: 'Company B' });

      const platformRole = await createPlatformRole(
        em,
        CompanyAccessLevel.FULL,
      );
      const { cookie } = await createInternalUser(em, platformRole);

      const response = await makeRequest()
        .get('/api/users/me/companies')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeGreaterThanOrEqual(2);
    });

    it('should restrict internal user to specific companies when UserCompany records exist', async () => {
      const orm = getORM();
      const em = orm.em.fork();
      const companyA = await createTestCompany(em, {
        name: 'Restricted Company A',
      });
      const companyB = await createTestCompany(em, {
        name: 'Restricted Company B',
      });
      await createTestCompany(em, { name: 'Unrestricted Company' });

      const platformRole = await createPlatformRole(
        em,
        CompanyAccessLevel.FULL,
      );
      const { user, cookie } = await createInternalUser(em, platformRole);

      // Add internal user company restrictions using UserCompany
      const uc1 = em.create(UserCompany, {
        id: uuid(),
        user,
        company: companyA,
        isActive: true,
        joinedAt: new Date(),
      });
      const uc2 = em.create(UserCompany, {
        id: uuid(),
        user,
        company: companyB,
        isActive: true,
        joinedAt: new Date(),
      });
      em.persist(uc1);
      em.persist(uc2);
      await em.flush();

      const response = await makeRequest()
        .get('/api/users/me/companies')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      // Should only see the restricted companies
      expect(response.body.results).toHaveLength(2);
      const companyNames = response.body.results.map(
        (c: { name: string }) => c.name,
      );
      expect(companyNames).toContain('Restricted Company A');
      expect(companyNames).toContain('Restricted Company B');
      expect(companyNames).not.toContain('Unrestricted Company');
    });
  });

  describe('Existing User Invite Flow', () => {
    it('should create invite for existing user to join another company', async () => {
      const {
        adminCookie,
        company: company1,
        office,
      } = await createCompanySetup({
        createOffice: true,
      });
      const orm = getORM();
      const em = orm.em.fork();
      const role = await createTestRole(em, company1, ['user:read']);

      // Create second company with its own admin
      const company2 = await createTestCompany(em, { name: 'Second Company' });

      // Create a user in the second company
      const passwordHash = await hashPassword('TestPassword123!');
      const existingUser = em.create(User, {
        id: uuid(),
        email: 'existing@example.com',
        passwordHash,
        nameFirst: 'Existing',
        nameLast: 'User',
        userType: UserType.COMPANY,
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: company2,
      });
      em.persist(existingUser);

      // Create UserCompany for existing user in second company
      const uc = em.create(UserCompany, {
        id: uuid(),
        user: existingUser,
        company: company2,
        isActive: true,
        joinedAt: new Date(),
      });
      em.persist(uc);
      await em.flush();

      // Now invite existing user to first company (from admin of company1)
      const response = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: 'existing@example.com',
          roles: [role.id],
          currentOfficeId: office!.id,
          allowedOfficeIds: [office!.id],
        });

      expect(response.status).toBe(201);
      expect(response.body.invite.isExistingUserInvite).toBe(true);
      expect(response.body.message).toBe('Invitation sent to existing user');
    });

    it('should reject invite for user already in target company', async () => {
      const { adminCookie, company, office } = await createCompanySetup({
        createOffice: true,
      });
      const orm = getORM();
      const em = orm.em.fork();
      const role = await createTestRole(em, company, ['user:read']);

      // Create existing user in the same company
      const passwordHash = await hashPassword('TestPassword123!');
      const existingUser = em.create(User, {
        id: uuid(),
        email: 'existing@example.com',
        passwordHash,
        nameFirst: 'Existing',
        nameLast: 'User',
        userType: UserType.COMPANY,
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company,
      });
      em.persist(existingUser);

      // Create UserCompany for existing user
      const uc = em.create(UserCompany, {
        id: uuid(),
        user: existingUser,
        company,
        isActive: true,
        joinedAt: new Date(),
      });
      em.persist(uc);
      await em.flush();

      // Try to invite user who is already in the company
      const response = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: 'existing@example.com',
          roles: [role.id],
          currentOfficeId: office!.id,
          allowedOfficeIds: [office!.id],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'User is already a member of this company',
      );
    });

    it('should reject invite for internal platform users', async () => {
      const { adminCookie, company, office } = await createCompanySetup({
        createOffice: true,
      });
      const orm = getORM();
      const em = orm.em.fork();
      const role = await createTestRole(em, company, ['user:read']);

      // Create internal user
      const passwordHash = await hashPassword('TestPassword123!');
      const internalUser = em.create(User, {
        id: uuid(),
        email: 'internal@platform.com',
        passwordHash,
        nameFirst: 'Internal',
        nameLast: 'User',
        userType: UserType.INTERNAL,
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
      });
      em.persist(internalUser);
      await em.flush();

      // Try to invite internal user to company
      const response = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: 'internal@platform.com',
          roles: [role.id],
          currentOfficeId: office!.id,
          allowedOfficeIds: [office!.id],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Internal platform users cannot be invited to companies',
      );
    });
  });

  describe('Internal User Company Access Management', () => {
    it('should list internal user company restrictions', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create admin internal user
      const adminRole = await createPlatformRole(em, CompanyAccessLevel.FULL, {
        platformPermissions: ['platform:manage_internal_users'],
      });
      const { cookie: adminCookie } = await createInternalUser(em, adminRole);

      // Create target internal user
      const targetRole = await createPlatformRole(em, CompanyAccessLevel.FULL);
      const { user: targetUser } = await createInternalUser(em, targetRole, {
        email: 'target@platform.com',
      });

      // Add company restrictions using UserCompany
      const company = await createTestCompany(em, {
        name: 'Restricted Company',
      });
      const uc = em.create(UserCompany, {
        id: uuid(),
        user: targetUser,
        company,
        isActive: true,
        joinedAt: new Date(),
      });
      em.persist(uc);
      await em.flush();

      const response = await makeRequest()
        .get(`/api/internal-users/${targetUser.id}/companies`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.hasRestrictions).toBe(true);
      expect(response.body.companies).toHaveLength(1);
      expect(response.body.companies[0].name).toBe('Restricted Company');
    });

    it('should add company access restriction for internal user', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create admin internal user
      const adminRole = await createPlatformRole(em, CompanyAccessLevel.FULL, {
        platformPermissions: ['platform:manage_internal_users'],
      });
      const { cookie: adminCookie } = await createInternalUser(em, adminRole);

      // Create target internal user (unrestricted)
      const targetRole = await createPlatformRole(em, CompanyAccessLevel.FULL);
      const { user: targetUser } = await createInternalUser(em, targetRole, {
        email: 'target@platform.com',
      });

      // Create company to restrict to
      const company = await createTestCompany(em, { name: 'New Company' });

      const response = await makeRequest()
        .post(`/api/internal-users/${targetUser.id}/companies`)
        .set('Cookie', adminCookie)
        .send({ companyId: company.id });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Company access granted');
      expect(response.body.companyAccess.companyId).toBe(company.id);
    });

    it('should remove company access restriction for internal user', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create admin internal user
      const adminRole = await createPlatformRole(em, CompanyAccessLevel.FULL, {
        platformPermissions: ['platform:manage_internal_users'],
      });
      const { cookie: adminCookie } = await createInternalUser(em, adminRole);

      // Create target internal user with restriction
      const targetRole = await createPlatformRole(em, CompanyAccessLevel.FULL);
      const { user: targetUser } = await createInternalUser(em, targetRole, {
        email: 'target@platform.com',
      });

      const company = await createTestCompany(em, {
        name: 'Restricted Company',
      });
      const uc = em.create(UserCompany, {
        id: uuid(),
        user: targetUser,
        company,
        isActive: true,
        joinedAt: new Date(),
      });
      em.persist(uc);
      await em.flush();

      const response = await makeRequest()
        .delete(`/api/internal-users/${targetUser.id}/companies/${company.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Company access removed');
    });
  });
});
