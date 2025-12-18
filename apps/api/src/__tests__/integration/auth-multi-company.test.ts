import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { User, UserCompany, Session } from '../../entities';
import { UserType, SessionSource } from '../../entities/types';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase, createTestCompany } from './helpers';

import type { Company } from '../../entities';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Create a company user with session and UserCompany memberships.
 */
async function createMultiCompanyUser(
  em: EntityManager,
  companies: Company[],
  options: {
    email?: string;
    password?: string;
  } = {},
): Promise<{
  user: User;
  cookie: string;
  sessionId: string;
  password: string;
}> {
  const password = options.password ?? 'TestPassword123!';
  const passwordHash = await hashPassword(password);
  const primaryCompany = companies[0];

  // Create user
  const user = em.create(User, {
    id: uuid(),
    email:
      options.email ?? `multiuser-${Date.now()}-${Math.random()}@example.com`,
    passwordHash,
    nameFirst: 'Multi',
    nameLast: 'User',
    userType: UserType.COMPANY,
    isActive: true,
    emailVerified: true,
    mfaEnabled: false,
    company: primaryCompany,
  });
  em.persist(user);

  // Create UserCompany memberships for all companies
  for (const company of companies) {
    const userCompany = em.create(UserCompany, {
      id: uuid(),
      user,
      company,
      isActive: true,
      joinedAt: new Date(),
    });
    em.persist(userCompany);
  }

  // Create session
  const sessionId = uuid();
  const session = em.create(Session, {
    sid: sessionId,
    user,
    company: primaryCompany,
    activeCompany: primaryCompany,
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

  return { user, cookie: `sid=${sessionId}`, sessionId, password };
}

/**
 * Create a single-company user with session.
 */
async function createSingleCompanyUser(
  em: EntityManager,
  company: Company,
  options: {
    email?: string;
    password?: string;
  } = {},
): Promise<{
  user: User;
  cookie: string;
  sessionId: string;
  password: string;
}> {
  const password = options.password ?? 'TestPassword123!';
  const passwordHash = await hashPassword(password);

  // Create user
  const user = em.create(User, {
    id: uuid(),
    email:
      options.email ?? `singleuser-${Date.now()}-${Math.random()}@example.com`,
    passwordHash,
    nameFirst: 'Single',
    nameLast: 'User',
    userType: UserType.COMPANY,
    isActive: true,
    emailVerified: true,
    mfaEnabled: false,
    company,
  });
  em.persist(user);

  // Create single UserCompany membership
  const userCompany = em.create(UserCompany, {
    id: uuid(),
    user,
    company,
    isActive: true,
    joinedAt: new Date(),
  });
  em.persist(userCompany);

  // Create session
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

  return { user, cookie: `sid=${sessionId}`, sessionId, password };
}

describe('Multi-Company Auth Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
  });

  afterEach(async () => {
    // Clean up test data after each test
    const orm = getORM();
    const em = orm.em.fork();
    await em.nativeDelete('user_company', {});
    await em.nativeDelete('user_role', {});
    await em.nativeDelete('session', {});
    await em.nativeDelete('user', {});
    await em.nativeDelete('role', {});
    await em.nativeDelete('company', {});
  });

  describe('GET /api/auth/me - canSwitchCompanies', () => {
    it('should return canSwitchCompanies: true for user with multiple companies', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create two companies
      const company1 = await createTestCompany(em, { name: 'Company A' });
      const company2 = await createTestCompany(em, { name: 'Company B' });

      // Create user with access to both
      const { cookie } = await createMultiCompanyUser(em, [company1, company2]);

      const response = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.canSwitchCompanies).toBe(true);
    });

    it('should return canSwitchCompanies: false for user with single company', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const company = await createTestCompany(em, { name: 'Solo Company' });
      const { cookie } = await createSingleCompanyUser(em, company);

      const response = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.canSwitchCompanies).toBe(false);
    });

    it('should return the active company from session, not home company', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const company1 = await createTestCompany(em, { name: 'Home Company' });
      const company2 = await createTestCompany(em, { name: 'Active Company' });

      const { cookie, sessionId } = await createMultiCompanyUser(em, [
        company1,
        company2,
      ]);

      // Update session to have company2 as active
      const session = await em.findOne(Session, { sid: sessionId });
      if (session) {
        session.activeCompany = company2;
        await em.flush();
      }

      const response = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.company.id).toBe(company2.id);
      expect(response.body.company.name).toBe('Active Company');
    });

    it('should only count active memberships for canSwitchCompanies', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const company1 = await createTestCompany(em, { name: 'Active Company' });
      const company2 = await createTestCompany(em, {
        name: 'Inactive Company',
      });

      // Create user with both companies
      const { user, cookie } = await createMultiCompanyUser(em, [
        company1,
        company2,
      ]);

      // Deactivate the second membership
      const uc2 = await em.findOne(UserCompany, {
        user: user.id,
        company: company2.id,
      });
      if (uc2) {
        uc2.isActive = false;
        await em.flush();
      }

      const response = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      // Only one active membership, so can't switch
      expect(response.body.canSwitchCompanies).toBe(false);
    });
  });

  describe('POST /api/auth/login - canSwitchCompanies', () => {
    it('should return canSwitchCompanies: true on login for multi-company user', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const company1 = await createTestCompany(em, { name: 'Company A' });
      const company2 = await createTestCompany(em, { name: 'Company B' });

      const email = `login-test-${Date.now()}@example.com`;
      await createMultiCompanyUser(em, [company1, company2], { email });

      const response = await makeRequest().post('/api/auth/login').send({
        email,
        password: 'TestPassword123!',
        source: 'web',
      });

      expect(response.status).toBe(200);
      expect(response.body.canSwitchCompanies).toBe(true);
    });

    it('should return canSwitchCompanies: false on login for single-company user', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const company = await createTestCompany(em, { name: 'Solo Company' });

      const email = `single-login-${Date.now()}@example.com`;
      await createSingleCompanyUser(em, company, { email });

      const response = await makeRequest().post('/api/auth/login').send({
        email,
        password: 'TestPassword123!',
        source: 'web',
      });

      expect(response.status).toBe(200);
      expect(response.body.canSwitchCompanies).toBe(false);
    });

    it('should return activeCompany in login response', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const company1 = await createTestCompany(em, { name: 'First Company' });
      const company2 = await createTestCompany(em, { name: 'Second Company' });

      const email = `active-company-${Date.now()}@example.com`;
      await createMultiCompanyUser(em, [company1, company2], { email });

      const response = await makeRequest().post('/api/auth/login').send({
        email,
        password: 'TestPassword123!',
        source: 'web',
      });

      expect(response.status).toBe(200);
      expect(response.body.activeCompany).toBeDefined();
      expect(response.body.activeCompany.id).toBeDefined();
      expect(response.body.activeCompany.name).toBeDefined();
    });
  });

  describe('Company switching after login', () => {
    it('should switch company and reflect in /auth/me', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const company1 = await createTestCompany(em, { name: 'Company A' });
      const company2 = await createTestCompany(em, { name: 'Company B' });

      const { cookie } = await createMultiCompanyUser(em, [company1, company2]);

      // Initial /auth/me should show company1
      const initialResponse = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(initialResponse.status).toBe(200);
      expect(initialResponse.body.company.id).toBe(company1.id);

      // Switch to company2
      const switchResponse = await makeRequest()
        .post('/api/users/me/switch-company')
        .set('Cookie', cookie)
        .send({ companyId: company2.id });

      expect(switchResponse.status).toBe(200);
      expect(switchResponse.body.activeCompany.id).toBe(company2.id);

      // /auth/me should now show company2
      const afterSwitchResponse = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(afterSwitchResponse.status).toBe(200);
      expect(afterSwitchResponse.body.company.id).toBe(company2.id);
      expect(afterSwitchResponse.body.company.name).toBe('Company B');
    });
  });
});
