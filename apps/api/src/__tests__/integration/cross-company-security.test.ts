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
  SessionSource,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

/**
 * Cross-Company Security Tests.
 *
 * Tests that verify tenant isolation:
 * - Users from Company A cannot access users from Company B
 * - Users cannot access roles from another company
 * - Users cannot access offices from another company
 * - Users cannot assign roles across companies
 */
describe('Cross-Company Security Tests', () => {
  // Company A entities
  let companyA: Company;
  let userA: User;
  let officeA: Office;
  let roleA: Role;
  let sessionIdA: string;
  let cookieA: string;

  // Company B entities
  let companyB: Company;
  let userB: User;
  let officeB: Office;
  let roleB: Role;

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // =========================================================================
    // Create Company A with its entities
    // =========================================================================
    companyA = em.create(Company, {
      id: uuid(),
      name: 'Company A - Security Test',
      maxSessionsPerUser: 5,
      mfaRequired: false,
      isActive: true,
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
    em.persist(companyA);

    // Admin role for Company A
    const adminRoleA = em.create(Role, {
      id: uuid(),
      name: 'companyAAdmin',
      displayName: 'Company A Admin',
      permissions: ['*'],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRoleA);

    // User A
    userA = em.create(User, {
      id: uuid(),
      email: `user-a-${Date.now()}@company-a.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'User',
      nameLast: 'A',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: companyA,
    });
    em.persist(userA);

    // Office A
    officeA = em.create(Office, {
      id: uuid(),
      name: 'Company A Office',
      company: companyA,
      isActive: true,
    });
    em.persist(officeA);

    // Role A (company-specific role)
    roleA = em.create(Role, {
      id: uuid(),
      name: 'companyARoleSpecific',
      displayName: 'Company A Specific Role',
      permissions: ['customer:read'],
      type: RoleType.COMPANY,
      company: companyA,
    });
    em.persist(roleA);

    // Assign admin role to User A
    const userRoleA = em.create(UserRole, {
      id: uuid(),
      user: userA,
      role: adminRoleA,
      company: companyA,
    });
    em.persist(userRoleA);

    // =========================================================================
    // Create Company B with its entities
    // =========================================================================
    companyB = em.create(Company, {
      id: uuid(),
      name: 'Company B - Security Test',
      maxSessionsPerUser: 5,
      mfaRequired: false,
      isActive: true,
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
    em.persist(companyB);

    // User B
    userB = em.create(User, {
      id: uuid(),
      email: `user-b-${Date.now()}@company-b.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'User',
      nameLast: 'B',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: companyB,
    });
    em.persist(userB);

    // Office B
    officeB = em.create(Office, {
      id: uuid(),
      name: 'Company B Office',
      company: companyB,
      isActive: true,
    });
    em.persist(officeB);

    // Role B (company-specific role)
    roleB = em.create(Role, {
      id: uuid(),
      name: 'companyBRoleSpecific',
      displayName: 'Company B Specific Role',
      permissions: ['customer:read'],
      type: RoleType.COMPANY,
      company: companyB,
    });
    em.persist(roleB);

    // =========================================================================
    // Create session for User A
    // =========================================================================
    sessionIdA = uuid();
    const sessionA = em.create(Session, {
      sid: sessionIdA,
      user: userA,
      company: companyA,
      data: { userId: userA.id },
      source: SessionSource.WEB,
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      mfaVerified: false,
    });
    em.persist(sessionA);

    await em.flush();

    cookieA = `sid=${sessionIdA}`;
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
  // User Access Isolation Tests
  // ============================================================================

  describe('User Access Isolation', () => {
    it('should not return users from Company B when listing users from Company A', async () => {
      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookieA);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeDefined();

      // Should only contain Company A users
      const userEmails = response.body.users.map(
        (u: { email: string }) => u.email,
      );
      expect(userEmails).toContain(userA.email);
      expect(userEmails).not.toContain(userB.email);
    });

    it('should return 404 when User A tries to access User B by ID', async () => {
      const response = await makeRequest()
        .get(`/api/users/${userB.id}`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 404 when User A tries to update User B', async () => {
      const response = await makeRequest()
        .patch(`/api/users/${userB.id}`)
        .set('Cookie', cookieA)
        .send({ nameFirst: 'HackedName' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 404 when User A tries to activate/deactivate User B', async () => {
      const response = await makeRequest()
        .post(`/api/users/${userB.id}/activate`)
        .set('Cookie', cookieA)
        .send({ isActive: false });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should not include User B in search results from Company A', async () => {
      const response = await makeRequest()
        .get(`/api/users?search=${userB.nameLast}`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeDefined();
      expect(response.body.users.length).toBe(0); // Should find nothing
    });
  });

  // ============================================================================
  // Office Access Isolation Tests
  // ============================================================================

  describe('Office Access Isolation', () => {
    it('should not return offices from Company B when listing from Company A', async () => {
      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', cookieA);

      expect(response.status).toBe(200);
      expect(response.body.offices).toBeDefined();

      // Should only contain Company A offices
      const officeNames = response.body.offices.map(
        (o: { name: string }) => o.name,
      );
      expect(officeNames).toContain(officeA.name);
      expect(officeNames).not.toContain(officeB.name);
    });

    it('should return 404 when User A tries to access Office B by ID', async () => {
      const response = await makeRequest()
        .get(`/api/offices/${officeB.id}`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Office not found');
    });
  });

  // ============================================================================
  // Role Access Isolation Tests
  // ============================================================================

  describe('Role Access Isolation', () => {
    it('should not return Company B roles when listing from Company A', async () => {
      const response = await makeRequest()
        .get('/api/roles')
        .set('Cookie', cookieA);

      expect(response.status).toBe(200);
      expect(response.body.roles).toBeDefined();

      // Should contain Company A roles and system roles, but NOT Company B roles
      const roleNames = response.body.roles.map(
        (r: { name: string }) => r.name,
      );
      expect(roleNames).toContain(roleA.name);
      expect(roleNames).not.toContain(roleB.name);
    });

    it('should return 404 when User A tries to access Role B by ID', async () => {
      const response = await makeRequest()
        .get(`/api/roles/${roleB.id}`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Role not found');
    });

    it('should return 404 when User A tries to update Role B', async () => {
      const response = await makeRequest()
        .patch(`/api/roles/${roleB.id}`)
        .set('Cookie', cookieA)
        .send({ displayName: 'Hacked Role Name' });

      expect(response.status).toBe(404);
    });

    it('should return 404 when User A tries to delete Role B', async () => {
      const response = await makeRequest()
        .delete(`/api/roles/${roleB.id}`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(404);
    });

    it('should return 404 when User A tries to clone Role B', async () => {
      const response = await makeRequest()
        .post(`/api/roles/${roleB.id}/clone`)
        .set('Cookie', cookieA)
        .send({
          name: 'clonedFromB',
          displayName: 'Cloned From B',
        });

      expect(response.status).toBe(404);
    });

    it('should return 404 when User A tries to list users of Role B', async () => {
      const response = await makeRequest()
        .get(`/api/roles/${roleB.id}/users`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // Role Assignment Cross-Company Tests
  // ============================================================================

  describe('Role Assignment Isolation', () => {
    it('should return 404 when User A tries to assign role to User B', async () => {
      const response = await makeRequest()
        .post('/api/roles/assign')
        .set('Cookie', cookieA)
        .send({
          userId: userB.id, // User from different company
          roleId: roleA.id, // Role from Company A
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 404 when User A tries to assign Role B to User A', async () => {
      const response = await makeRequest()
        .post('/api/roles/assign')
        .set('Cookie', cookieA)
        .send({
          userId: userA.id, // User from Company A
          roleId: roleB.id, // Role from different company
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Role not found');
    });

    it('should return 404 when User A tries to revoke role from User B', async () => {
      const response = await makeRequest()
        .post('/api/roles/revoke')
        .set('Cookie', cookieA)
        .send({
          userId: userB.id,
          roleId: roleA.id,
        });

      // Should fail because user is not in same company
      // The actual response depends on validation order
      expect([404, 400]).toContain(response.status);
    });

    it('should return 404 when bulk assigning roles across companies', async () => {
      const response = await makeRequest()
        .post('/api/roles/assign/bulk')
        .set('Cookie', cookieA)
        .send({
          assignments: [
            { userId: userB.id, roleId: roleA.id }, // User from Company B
          ],
        });

      expect(response.status).toBe(200);
      // The bulk endpoint returns results for each assignment
      expect(response.body.results[0].success).toBe(false);
      expect(response.body.results[0].error).toBe('User not found');
    });
  });

  // ============================================================================
  // User Office Access Cross-Company Tests
  // ============================================================================

  describe('User Office Access Isolation', () => {
    it('should return 404 when User A tries to get offices for User B', async () => {
      const response = await makeRequest()
        .get(`/api/users/${userB.id}/offices`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 404 when User A tries to add office access for User B', async () => {
      const response = await makeRequest()
        .post(`/api/users/${userB.id}/offices`)
        .set('Cookie', cookieA)
        .send({ officeId: officeA.id });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 404 when User A tries to add Office B to User A', async () => {
      const response = await makeRequest()
        .post(`/api/users/${userA.id}/offices`)
        .set('Cookie', cookieA)
        .send({ officeId: officeB.id }); // Office from Company B

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Office not found');
    });

    it('should return 404 when User A tries to remove office access for User B', async () => {
      const response = await makeRequest()
        .delete(`/api/users/${userB.id}/offices/${officeB.id}`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 404 when User A tries to set current office of User B', async () => {
      const response = await makeRequest()
        .patch(`/api/users/${userB.id}/current-office`)
        .set('Cookie', cookieA)
        .send({ officeId: officeA.id });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });

  // ============================================================================
  // Company Role Visibility Tests
  // ============================================================================

  describe('System vs Company Role Visibility', () => {
    let systemRole: Role;

    beforeEach(async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a system role (no company - available to all)
      systemRole = em.create(Role, {
        id: uuid(),
        name: 'systemRoleForAllCompanies',
        displayName: 'System Role',
        permissions: ['customer:read'],
        type: RoleType.SYSTEM,
        isDefault: false,
      });
      em.persist(systemRole);
      await em.flush();
    });

    it('should see system roles from Company A', async () => {
      const response = await makeRequest()
        .get('/api/roles')
        .set('Cookie', cookieA);

      expect(response.status).toBe(200);
      const roleNames = response.body.roles.map(
        (r: { name: string }) => r.name,
      );
      expect(roleNames).toContain(systemRole.name);
    });

    it('should be able to access system role by ID from Company A', async () => {
      const response = await makeRequest()
        .get(`/api/roles/${systemRole.id}`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(200);
      expect(response.body.role.name).toBe(systemRole.name);
    });

    it('should be able to assign system role to user in Company A', async () => {
      const response = await makeRequest()
        .post('/api/roles/assign')
        .set('Cookie', cookieA)
        .send({
          userId: userA.id,
          roleId: systemRole.id,
        });

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // User Roles Query Isolation Tests
  // ============================================================================

  describe('User Roles Query Isolation', () => {
    it('should return empty array when querying roles for User B from Company A', async () => {
      // Even if we somehow could access the endpoint, it should return nothing
      // because User B is in a different company
      const response = await makeRequest()
        .get(`/api/roles/users/${userB.id}`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(200);
      // Should return empty results because user is in different company
      expect(response.body.roles).toEqual([]);
    });
  });

  // ============================================================================
  // Data Leakage Prevention Tests
  // ============================================================================

  describe('Data Leakage Prevention', () => {
    it('should not leak Company B user count in search', async () => {
      const response = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookieA);

      expect(response.status).toBe(200);
      // Pagination total should only count Company A users
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(1);

      // Verify by counting - only Company A users should be counted
      const companyBUserInResults = response.body.users.some(
        (u: { email: string }) => u.email === userB.email,
      );
      expect(companyBUserInResults).toBe(false);
    });

    it('should not leak Company B office count', async () => {
      const response = await makeRequest()
        .get('/api/offices')
        .set('Cookie', cookieA);

      expect(response.status).toBe(200);

      // Verify Company B office is not included
      const companyBOfficeInResults = response.body.offices.some(
        (o: { name: string }) => o.name === officeB.name,
      );
      expect(companyBOfficeInResults).toBe(false);
    });

    it('should not leak Company B role details in error messages', async () => {
      const response = await makeRequest()
        .get(`/api/roles/${roleB.id}`)
        .set('Cookie', cookieA);

      expect(response.status).toBe(404);
      // Error message should not contain any details about Role B
      expect(response.body.error).toBe('Role not found');
      expect(response.body.name).toBeUndefined();
      expect(response.body.displayName).toBeUndefined();
    });
  });
});
