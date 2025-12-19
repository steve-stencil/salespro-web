import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';

import { User, Role, UserRole, Session, UserCompany } from '../../entities';
import {
  UserType,
  RoleType,
  CompanyAccessLevel,
  SessionSource,
} from '../../entities/types';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import {
  makeRequest,
  waitForDatabase,
  createTestCompany,
  createPlatformRole,
  createTestOffice,
} from './helpers';

import type { Company, Office } from '../../entities';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Comprehensive tests for multi-company permission handling.
 *
 * Tests cover:
 * 1. COMPANY users: Permissions come from UserRole records per company
 * 2. INTERNAL users: Permissions come from company-level roles + platform permissions
 * 3. Permission isolation: Users only get permissions for their current company
 * 4. Edge cases: Users with company access but no roles
 */
describe('Multi-Company Permissions Integration Tests', () => {
  let companyA: Company;
  let companyB: Company;
  let officeA: Office;

  // Roles for testing
  let adminRole: Role;
  let salesRepRole: Role;
  let viewerRole: Role;

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Create two test companies
    companyA = await createTestCompany(em, { name: 'Company A' });
    companyB = await createTestCompany(em, { name: 'Company B' });

    // Create office for Company A
    officeA = await createTestOffice(em, companyA, 'Office A');

    // Create system roles (shared across companies)
    adminRole = em.create(Role, {
      id: uuid(),
      name: 'admin',
      displayName: 'Administrator',
      permissions: ['*'],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRole);

    salesRepRole = em.create(Role, {
      id: uuid(),
      name: 'salesRep',
      displayName: 'Sales Representative',
      permissions: [
        'customer:read',
        'customer:create',
        'customer:update',
        'office:read',
        'report:read',
        'settings:read',
      ],
      type: RoleType.SYSTEM,
      isDefault: true,
    });
    em.persist(salesRepRole);

    viewerRole = em.create(Role, {
      id: uuid(),
      name: 'viewer',
      displayName: 'Viewer',
      permissions: ['customer:read', 'office:read', 'report:read'],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(viewerRole);

    await em.flush();
  });

  afterEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up in correct order (respecting FK constraints)
    await em.nativeDelete('user_invite', {});
    await em.nativeDelete('user_office', {});
    await em.nativeDelete('user_company', {});
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
   * Create a COMPANY user with roles in specific companies.
   */
  async function createCompanyUser(
    em: EntityManager,
    homeCompany: Company,
    roleAssignments: Array<{ company: Company; role: Role }>,
    options: {
      email?: string;
      additionalCompanyAccess?: Company[];
    } = {},
  ): Promise<{
    user: User;
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
      company: homeCompany,
    });
    em.persist(user);

    // Create UserCompany for home company
    const homeUserCompany = em.create(UserCompany, {
      id: uuid(),
      user,
      company: homeCompany,
      isActive: true,
      joinedAt: new Date(),
    });
    em.persist(homeUserCompany);

    // Create UserCompany for additional companies
    const additionalCompanies = options.additionalCompanyAccess ?? [];
    for (const company of additionalCompanies) {
      if (company.id !== homeCompany.id) {
        const uc = em.create(UserCompany, {
          id: uuid(),
          user,
          company,
          isActive: true,
          joinedAt: new Date(),
        });
        em.persist(uc);
      }
    }

    // Assign roles in specified companies
    for (const { company, role } of roleAssignments) {
      const userRole = em.create(UserRole, {
        id: uuid(),
        user,
        role,
        company,
        assignedAt: new Date(),
      });
      em.persist(userRole);
    }

    await em.flush();

    // Create session with home company as active
    const sessionId = uuid();
    const session = em.create(Session, {
      sid: sessionId,
      user,
      company: homeCompany,
      activeCompany: homeCompany,
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

    return { user, cookie: `sid=${sessionId}`, sessionId };
  }

  /**
   * Create an INTERNAL user with a platform role and company-level roles.
   */
  async function createInternalUserWithRoles(
    em: EntityManager,
    platformRole: Role,
    companyRoleAssignments: Array<{ company: Company; role: Role }>,
    activeCompany: Company,
  ): Promise<{
    user: User;
    cookie: string;
    sessionId: string;
  }> {
    const passwordHash = await hashPassword('TestPassword123!');
    const user = em.create(User, {
      id: uuid(),
      email: `internal-${Date.now()}-${Math.random()}@platform.com`,
      passwordHash,
      nameFirst: 'Internal',
      nameLast: 'User',
      userType: UserType.INTERNAL,
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
    });
    em.persist(user);

    // Assign platform role (no company context)
    const platformUserRole = em.create(UserRole, {
      id: uuid(),
      user,
      role: platformRole,
      assignedAt: new Date(),
    });
    em.persist(platformUserRole);

    // Assign company-level roles
    for (const { company, role } of companyRoleAssignments) {
      const userRole = em.create(UserRole, {
        id: uuid(),
        user,
        role,
        company,
        assignedAt: new Date(),
      });
      em.persist(userRole);
    }

    await em.flush();

    // Create session with active company
    const sessionId = uuid();
    const session = em.create(Session, {
      sid: sessionId,
      user,
      activeCompany,
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

    return { user, cookie: `sid=${sessionId}`, sessionId };
  }

  /**
   * Switch a user's active company by updating their session.
   */
  async function switchUserCompany(
    em: EntityManager,
    sessionId: string,
    newCompany: Company,
  ): Promise<void> {
    const session = await em.findOne(Session, { sid: sessionId });
    if (session) {
      session.activeCompany = newCompany;
      await em.flush();
    }
  }

  // ============================================================================
  // COMPANY User Permission Tests
  // ============================================================================

  describe('COMPANY User Permission Isolation', () => {
    describe('GET /api/roles/me - Permission retrieval per company', () => {
      it('should return permissions from roles assigned in current company', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with admin role in Company A only
        const { cookie } = await createCompanyUser(
          em,
          companyA,
          [{ company: companyA, role: adminRole }],
          { additionalCompanyAccess: [companyB] },
        );

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.roles).toHaveLength(1);
        expect(response.body.roles[0].name).toBe('admin');
        // Should have wildcard permission from admin role
        expect(response.body.permissions).toContain('*');
      });

      it('should return EMPTY permissions when user has no roles in current company', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with admin role in Company A, but UserCompany access to B (no roles in B)
        const { cookie, sessionId } = await createCompanyUser(
          em,
          companyA,
          [{ company: companyA, role: adminRole }],
          { additionalCompanyAccess: [companyB] },
        );

        // Switch to Company B where user has NO roles
        await switchUserCompany(em, sessionId, companyB);

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        // User should have NO roles in Company B
        expect(response.body.roles).toHaveLength(0);
        // User should have NO permissions in Company B
        expect(response.body.permissions).toHaveLength(0);
      });

      it('should return different permissions when switching between companies', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with:
        // - Admin role in Company A (full permissions)
        // - Viewer role in Company B (read-only permissions)
        const { cookie, sessionId } = await createCompanyUser(
          em,
          companyA,
          [
            { company: companyA, role: adminRole },
            { company: companyB, role: viewerRole },
          ],
          { additionalCompanyAccess: [companyB] },
        );

        // Check permissions in Company A
        const responseA = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(responseA.status).toBe(200);
        expect(responseA.body.roles).toHaveLength(1);
        expect(responseA.body.roles[0].name).toBe('admin');
        expect(responseA.body.permissions).toContain('*');

        // Switch to Company B
        await switchUserCompany(em, sessionId, companyB);

        // Check permissions in Company B
        const responseB = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(responseB.status).toBe(200);
        expect(responseB.body.roles).toHaveLength(1);
        expect(responseB.body.roles[0].name).toBe('viewer');
        // Viewer only has read permissions
        expect(responseB.body.permissions).toContain('customer:read');
        expect(responseB.body.permissions).toContain('office:read');
        expect(responseB.body.permissions).not.toContain('*');
        expect(responseB.body.permissions).not.toContain('user:read');
      });

      it('should allow multiple roles per company', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with both salesRep and viewer roles in Company A
        const { cookie } = await createCompanyUser(em, companyA, [
          { company: companyA, role: salesRepRole },
          { company: companyA, role: viewerRole },
        ]);

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.roles).toHaveLength(2);

        // Permissions should be union of both roles
        expect(response.body.permissions).toContain('customer:read');
        expect(response.body.permissions).toContain('customer:create');
        expect(response.body.permissions).toContain('customer:update');
        expect(response.body.permissions).toContain('settings:read');
      });
    });

    describe('Permission-protected endpoints', () => {
      it('should allow access when user has required permission in current company', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with admin role (has user:read)
        const { cookie } = await createCompanyUser(em, companyA, [
          { company: companyA, role: adminRole },
        ]);

        const response = await makeRequest()
          .get('/api/users')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
      });

      it('should DENY access when user lacks permission in current company', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with viewer role (no user:read permission)
        const { cookie } = await createCompanyUser(em, companyA, [
          { company: companyA, role: viewerRole },
        ]);

        const response = await makeRequest()
          .get('/api/users')
          .set('Cookie', cookie);

        expect(response.status).toBe(403);
      });

      it('should DENY access when user has permission in OTHER company but not current', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with admin role in A, but no roles in B
        const { cookie, sessionId } = await createCompanyUser(
          em,
          companyA,
          [{ company: companyA, role: adminRole }],
          { additionalCompanyAccess: [companyB] },
        );

        // User has admin in Company A - can read users
        const responseA = await makeRequest()
          .get('/api/users')
          .set('Cookie', cookie);
        expect(responseA.status).toBe(200);

        // Switch to Company B (no roles)
        await switchUserCompany(em, sessionId, companyB);

        // User should NOT be able to read users in Company B
        const responseB = await makeRequest()
          .get('/api/users')
          .set('Cookie', cookie);
        expect(responseB.status).toBe(403);
      });
    });
  });

  // ============================================================================
  // INTERNAL User Permission Tests
  // ============================================================================

  describe('INTERNAL User Permission Handling', () => {
    it('should return platform permissions plus company permissions from platform role companyAccessLevel', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Platform users get company permissions from their platform role's
      // companyAccessLevel, NOT from company-specific roles
      const platformRole = await createPlatformRole(
        em,
        CompanyAccessLevel.FULL,
      );

      // Create internal user - platform users never have company roles
      const { cookie } = await createInternalUserWithRoles(
        em,
        platformRole,
        [], // Platform users never have company roles
        companyA,
      );

      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);

      // Should include platform permissions
      expect(response.body.permissions).toContain('platform:view_companies');
      expect(response.body.permissions).toContain('platform:switch_company');

      // FULL access level grants superuser permissions in any company
      expect(response.body.permissions).toContain('*');
    });

    it('should get company permissions from platform role companyAccessLevel, not company roles', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Platform users get company permissions from their platform role's companyAccessLevel,
      // NOT from company-specific UserRole assignments. They never have company roles.
      const platformRole = await createPlatformRole(
        em,
        CompanyAccessLevel.FULL,
      );

      // Create internal user - platform users don't have company roles
      const { cookie } = await createInternalUserWithRoles(
        em,
        platformRole,
        [], // Platform users never have company roles
        companyA,
      );

      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);

      // Should include platform permissions
      expect(response.body.permissions).toContain('platform:view_companies');
      expect(response.body.permissions).toContain('platform:switch_company');

      // FULL access level grants superuser permissions in any company
      expect(response.body.permissions).toContain('*');
    });

    it('should have SAME permissions in ALL companies based on platform role companyAccessLevel', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Platform users get the SAME permissions in ALL companies
      // based on their platform role's companyAccessLevel
      const platformRole = await createPlatformRole(
        em,
        CompanyAccessLevel.FULL,
      );

      // Create internal user - platform users don't have company-specific roles
      const { cookie, sessionId } = await createInternalUserWithRoles(
        em,
        platformRole,
        [], // Platform users never have company roles
        companyA,
      );

      // Check permissions in Company A
      const responseA = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(responseA.status).toBe(200);
      expect(responseA.body.permissions).toContain('*');
      expect(responseA.body.permissions).toContain('platform:view_companies');

      // Switch to Company B
      await switchUserCompany(em, sessionId, companyB);

      // Check permissions in Company B
      const responseB = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(responseB.status).toBe(200);
      // SAME permissions as Company A - platform role applies to ALL companies
      expect(responseB.body.permissions).toContain('*');
      expect(responseB.body.permissions).toContain('platform:view_companies');
    });
  });

  // ============================================================================
  // Company Switching Tests
  // ============================================================================

  describe('Company Switching', () => {
    it('should update session activeCompany on switch', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const { cookie } = await createCompanyUser(
        em,
        companyA,
        [
          { company: companyA, role: adminRole },
          { company: companyB, role: adminRole },
        ],
        { additionalCompanyAccess: [companyB] },
      );

      // Switch to Company B
      const switchResponse = await makeRequest()
        .post('/api/users/me/switch-company')
        .set('Cookie', cookie)
        .send({ companyId: companyB.id });

      expect(switchResponse.status).toBe(200);
      expect(switchResponse.body.activeCompany.id).toBe(companyB.id);
    });

    it('should deny switching to company without UserCompany access', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // User only has access to Company A (no UserCompany for B)
      const { cookie } = await createCompanyUser(em, companyA, [
        { company: companyA, role: adminRole },
      ]);

      const response = await makeRequest()
        .post('/api/users/me/switch-company')
        .set('Cookie', cookie)
        .send({ companyId: companyB.id });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('No active membership for this company');
    });

    it('should deny switching to deactivated membership', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const { user, cookie } = await createCompanyUser(em, companyA, [
        { company: companyA, role: adminRole },
      ]);

      // Create inactive UserCompany for B
      const inactiveUC = em.create(UserCompany, {
        id: uuid(),
        user,
        company: companyB,
        isActive: false, // Deactivated
        joinedAt: new Date(),
      });
      em.persist(inactiveUC);
      await em.flush();

      const response = await makeRequest()
        .post('/api/users/me/switch-company')
        .set('Cookie', cookie)
        .send({ companyId: companyB.id });

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle user with UserCompany access but NO UserRole records', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create user with UserCompany for both companies but NO UserRole records
      const passwordHash = await hashPassword('TestPassword123!');
      const user = em.create(User, {
        id: uuid(),
        email: `no-roles-${Date.now()}@example.com`,
        passwordHash,
        nameFirst: 'No',
        nameLast: 'Roles',
        userType: UserType.COMPANY,
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: companyA,
      });
      em.persist(user);

      // UserCompany access to both companies
      const ucA = em.create(UserCompany, {
        id: uuid(),
        user,
        company: companyA,
        isActive: true,
        joinedAt: new Date(),
      });
      em.persist(ucA);

      const ucB = em.create(UserCompany, {
        id: uuid(),
        user,
        company: companyB,
        isActive: true,
        joinedAt: new Date(),
      });
      em.persist(ucB);

      // NO UserRole records for this user!

      const sessionId = uuid();
      const session = em.create(Session, {
        sid: sessionId,
        user,
        company: companyA,
        activeCompany: companyA,
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

      const cookie = `sid=${sessionId}`;

      // User should have NO permissions
      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.roles).toHaveLength(0);
      expect(response.body.permissions).toHaveLength(0);

      // User should be denied access to protected endpoints
      const usersResponse = await makeRequest()
        .get('/api/users')
        .set('Cookie', cookie);
      expect(usersResponse.status).toBe(403);
    });

    it('should properly merge permissions from multiple roles in same company', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create two company-specific roles with different permissions
      const roleA = em.create(Role, {
        id: uuid(),
        name: `roleA-${Date.now()}`,
        displayName: 'Role A',
        permissions: ['customer:read', 'customer:create'],
        type: RoleType.COMPANY,
        company: companyA,
      });
      em.persist(roleA);

      const roleB = em.create(Role, {
        id: uuid(),
        name: `roleB-${Date.now()}`,
        displayName: 'Role B',
        permissions: ['user:read', 'office:read'],
        type: RoleType.COMPANY,
        company: companyA,
      });
      em.persist(roleB);
      await em.flush();

      // User has BOTH roles in Company A
      const { cookie } = await createCompanyUser(em, companyA, [
        { company: companyA, role: roleA },
        { company: companyA, role: roleB },
      ]);

      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.roles).toHaveLength(2);
      // Should have merged permissions from both roles
      expect(response.body.permissions).toContain('customer:read');
      expect(response.body.permissions).toContain('customer:create');
      expect(response.body.permissions).toContain('user:read');
      expect(response.body.permissions).toContain('office:read');
    });

    it('should NOT leak permissions between companies', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create company-specific role ONLY in Company A
      const companyAOnlyRole = em.create(Role, {
        id: uuid(),
        name: `companyARole-${Date.now()}`,
        displayName: 'Company A Only Role',
        permissions: ['special:permission'],
        type: RoleType.COMPANY,
        company: companyA,
      });
      em.persist(companyAOnlyRole);
      await em.flush();

      const { cookie, sessionId } = await createCompanyUser(
        em,
        companyA,
        [
          { company: companyA, role: companyAOnlyRole },
          { company: companyB, role: viewerRole },
        ],
        { additionalCompanyAccess: [companyB] },
      );

      // In Company A, should have special:permission
      const responseA = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);
      expect(responseA.body.permissions).toContain('special:permission');

      // Switch to Company B
      await switchUserCompany(em, sessionId, companyB);

      // In Company B, should NOT have special:permission
      const responseB = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);
      expect(responseB.body.permissions).not.toContain('special:permission');
      // But should have viewer permissions
      expect(responseB.body.permissions).toContain('customer:read');
    });
  });

  // ============================================================================
  // Invite Flow Tests
  // ============================================================================

  describe('Invite Flow Role Assignment', () => {
    it('should create invite for existing user with specified roles', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create admin in Company A to send invite
      const { cookie: adminCookie } = await createCompanyUser(em, companyA, [
        { company: companyA, role: adminRole },
      ]);

      // Create existing user in Company B
      const existingUser = em.create(User, {
        id: uuid(),
        email: `existing-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Existing',
        nameLast: 'User',
        userType: UserType.COMPANY,
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: companyB,
      });
      em.persist(existingUser);

      const existingUserCompany = em.create(UserCompany, {
        id: uuid(),
        user: existingUser,
        company: companyB,
        isActive: true,
        joinedAt: new Date(),
      });
      em.persist(existingUserCompany);
      await em.flush();

      // Create invite for existing user to join Company A with viewer role
      const inviteResponse = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: existingUser.email,
          roles: [viewerRole.id],
          currentOfficeId: officeA.id,
          allowedOfficeIds: [officeA.id],
        });

      // Verify invite was created successfully
      expect(inviteResponse.status).toBe(201);
      expect(inviteResponse.body.invite.isExistingUserInvite).toBe(true);
      expect(inviteResponse.body.message).toBe(
        'Invitation sent to existing user',
      );
    });

    it('should reject invite for user already in target company', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create admin in Company A
      const { cookie: adminCookie } = await createCompanyUser(em, companyA, [
        { company: companyA, role: adminRole },
      ]);

      // Create existing user ALREADY in Company A
      const existingUser = em.create(User, {
        id: uuid(),
        email: `existing-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Existing',
        nameLast: 'User',
        userType: UserType.COMPANY,
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: companyA,
      });
      em.persist(existingUser);

      // User already has UserCompany for A
      const existingUserCompany = em.create(UserCompany, {
        id: uuid(),
        user: existingUser,
        company: companyA,
        isActive: true,
        joinedAt: new Date(),
      });
      em.persist(existingUserCompany);
      await em.flush();

      // Try to invite user who is already in the company
      const inviteResponse = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: existingUser.email,
          roles: [viewerRole.id],
          currentOfficeId: officeA.id,
          allowedOfficeIds: [officeA.id],
        });

      // Should be rejected
      expect(inviteResponse.status).toBe(400);
      expect(inviteResponse.body.error).toBe(
        'User is already a member of this company',
      );
    });
  });

  // ============================================================================
  // Platform Permissions for Internal Users
  // ============================================================================

  describe('Internal User Platform Operations', () => {
    it('should allow platform operations with company context', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const platformRole = await createPlatformRole(
        em,
        CompanyAccessLevel.FULL,
        {
          platformPermissions: [
            PERMISSIONS.PLATFORM_VIEW_COMPANIES,
            PERMISSIONS.PLATFORM_SWITCH_COMPANY,
            PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS,
          ],
        },
      );
      const { cookie } = await createInternalUserWithRoles(
        em,
        platformRole,
        [{ company: companyA, role: adminRole }],
        companyA,
      );

      // Should be able to view companies
      const companiesResponse = await makeRequest()
        .get('/api/platform/companies')
        .set('Cookie', cookie);
      expect(companiesResponse.status).toBe(200);
    });

    it('should allow switching between companies for internal users', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const platformRole = await createPlatformRole(
        em,
        CompanyAccessLevel.FULL,
      );
      const { cookie } = await createInternalUserWithRoles(
        em,
        platformRole,
        [{ company: companyA, role: adminRole }],
        companyA,
      );

      // Switch to Company B
      const switchResponse = await makeRequest()
        .post('/api/platform/switch-company')
        .set('Cookie', cookie)
        .send({ companyId: companyB.id });

      expect(switchResponse.status).toBe(200);
      expect(switchResponse.body.activeCompany.id).toBe(companyB.id);
    });
  });

  // ============================================================================
  // Login Flow and Role Selection Tests
  // ============================================================================

  describe('Login Flow and Role Selection', () => {
    /**
     * Helper to extract session cookie from login response headers.
     */
    function extractSessionCookie(
      headers: Record<string, string | string[] | undefined>,
    ): string {
      const cookies = headers['set-cookie'];
      if (Array.isArray(cookies)) {
        const sidCookie = cookies.find((c: string) => c.startsWith('sid='));
        if (sidCookie) return sidCookie;
      } else if (typeof cookies === 'string' && cookies.startsWith('sid=')) {
        return cookies;
      }
      throw new Error('No session cookie found in response');
    }

    /**
     * Helper to create a user with password for login testing.
     */
    async function createUserForLogin(
      em: EntityManager,
      homeCompany: Company,
      roleAssignments: Array<{ company: Company; role: Role }>,
      options: {
        email?: string;
        password?: string;
        additionalCompanyAccess?: Company[];
        userType?: UserType;
      } = {},
    ): Promise<{
      user: User;
      email: string;
      password: string;
    }> {
      const email =
        options.email ?? `login-${Date.now()}-${Math.random()}@example.com`;
      const password = options.password ?? 'TestPassword123!';
      const passwordHash = await hashPassword(password);

      const user = em.create(User, {
        id: uuid(),
        email,
        passwordHash,
        nameFirst: 'Login',
        nameLast: 'Test',
        userType: options.userType ?? UserType.COMPANY,
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: homeCompany,
      });
      em.persist(user);

      // Create UserCompany for home company
      const homeUserCompany = em.create(UserCompany, {
        id: uuid(),
        user,
        company: homeCompany,
        isActive: true,
        joinedAt: new Date(),
        lastAccessedAt: new Date(),
      });
      em.persist(homeUserCompany);

      // Create UserCompany for additional companies
      const additionalCompanies = options.additionalCompanyAccess ?? [];
      for (const [i, company] of additionalCompanies.entries()) {
        if (company.id !== homeCompany.id) {
          const uc = em.create(UserCompany, {
            id: uuid(),
            user,
            company,
            isActive: true,
            joinedAt: new Date(),
            // Older lastAccessedAt so home company is selected first
            lastAccessedAt: new Date(Date.now() - (i + 1) * 1000),
          });
          em.persist(uc);
        }
      }

      // Assign roles in specified companies
      for (const { company, role } of roleAssignments) {
        const userRole = em.create(UserRole, {
          id: uuid(),
          user,
          role,
          company,
          assignedAt: new Date(),
        });
        em.persist(userRole);
      }

      await em.flush();

      return { user, email, password };
    }

    describe('Single Company User', () => {
      it('should return roles for the single company on login', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with admin role in Company A only
        const { email, password } = await createUserForLogin(em, companyA, [
          { company: companyA, role: adminRole },
        ]);

        // Login
        const loginResponse = await makeRequest()
          .post('/api/auth/login')
          .send({ email, password });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body.activeCompany).toBeDefined();
        expect(loginResponse.body.activeCompany.id).toBe(companyA.id);
        expect(loginResponse.body.canSwitchCompanies).toBe(false);

        // Get the session cookie
        const sidCookie = extractSessionCookie(loginResponse.headers);

        // Check roles - should have admin role from Company A
        const rolesResponse = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        expect(rolesResponse.status).toBe(200);
        expect(rolesResponse.body.roles).toHaveLength(1);
        expect(rolesResponse.body.roles[0].name).toBe('admin');
        expect(rolesResponse.body.permissions).toContain('*');
      });

      it('should return empty roles if user has no roles in their only company', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with NO roles (only UserCompany access)
        const { email, password } = await createUserForLogin(
          em,
          companyA,
          [], // No roles
        );

        // Login
        const loginResponse = await makeRequest()
          .post('/api/auth/login')
          .send({ email, password });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body.activeCompany.id).toBe(companyA.id);

        const sidCookie = extractSessionCookie(loginResponse.headers);

        // Check roles - should have NO roles
        const rolesResponse = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        expect(rolesResponse.status).toBe(200);
        expect(rolesResponse.body.roles).toHaveLength(0);
        expect(rolesResponse.body.permissions).toHaveLength(0);
      });
    });

    describe('Multi-Company User', () => {
      it('should return ONLY the active company roles on login, not all company roles', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with DIFFERENT roles in DIFFERENT companies
        // Admin in Company A, Viewer in Company B
        const { email, password } = await createUserForLogin(
          em,
          companyA,
          [
            { company: companyA, role: adminRole },
            { company: companyB, role: viewerRole },
          ],
          { additionalCompanyAccess: [companyB] },
        );

        // Login - should auto-select Company A (most recently accessed)
        const loginResponse = await makeRequest()
          .post('/api/auth/login')
          .send({ email, password });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body.activeCompany.id).toBe(companyA.id);
        expect(loginResponse.body.canSwitchCompanies).toBe(true);

        const sidCookie = extractSessionCookie(loginResponse.headers);

        // Check roles - should have ONLY Company A's admin role
        const rolesResponse = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        expect(rolesResponse.status).toBe(200);

        // Should have ONLY admin role (from Company A), NOT viewer role (from Company B)
        expect(rolesResponse.body.roles).toHaveLength(1);
        expect(rolesResponse.body.roles[0].name).toBe('admin');
        expect(rolesResponse.body.permissions).toContain('*');

        // Should NOT have viewer-specific permissions that would indicate Company B roles leaked
        // (viewer has customer:read, office:read, report:read but admin has '*' which covers all)
        // The key test is that we only have 1 role, not 2
      });

      it('should change roles when switching to a different company', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with admin in A, viewer in B
        const { email, password } = await createUserForLogin(
          em,
          companyA,
          [
            { company: companyA, role: adminRole },
            { company: companyB, role: viewerRole },
          ],
          { additionalCompanyAccess: [companyB] },
        );

        // Login
        const loginResponse = await makeRequest()
          .post('/api/auth/login')
          .send({ email, password });

        const sidCookie = extractSessionCookie(loginResponse.headers);

        // Verify initial roles (Company A - admin)
        const initialRoles = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        expect(initialRoles.body.roles).toHaveLength(1);
        expect(initialRoles.body.roles[0].name).toBe('admin');
        expect(initialRoles.body.permissions).toContain('*');

        // Switch to Company B
        const switchResponse = await makeRequest()
          .post('/api/users/me/switch-company')
          .set('Cookie', sidCookie)
          .send({ companyId: companyB.id });

        expect(switchResponse.status).toBe(200);
        expect(switchResponse.body.activeCompany.id).toBe(companyB.id);

        // Check roles after switch - should now have ONLY Company B's viewer role
        const afterSwitchRoles = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        expect(afterSwitchRoles.body.roles).toHaveLength(1);
        expect(afterSwitchRoles.body.roles[0].name).toBe('viewer');

        // Viewer permissions - should NOT have '*' anymore
        expect(afterSwitchRoles.body.permissions).not.toContain('*');
        expect(afterSwitchRoles.body.permissions).toContain('customer:read');
        expect(afterSwitchRoles.body.permissions).toContain('office:read');
      });

      it('should return empty roles after switching to company where user has no roles', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create user with admin in A, NO roles in B (but has UserCompany access)
        const { email, password } = await createUserForLogin(
          em,
          companyA,
          [{ company: companyA, role: adminRole }], // Only role in Company A
          { additionalCompanyAccess: [companyB] }, // Has access to B, but no roles
        );

        // Login
        const loginResponse = await makeRequest()
          .post('/api/auth/login')
          .send({ email, password });

        const sidCookie = extractSessionCookie(loginResponse.headers);

        // Verify initial roles (Company A - admin)
        const initialRoles = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        expect(initialRoles.body.roles).toHaveLength(1);
        expect(initialRoles.body.permissions).toContain('*');

        // Switch to Company B (where user has NO roles)
        await makeRequest()
          .post('/api/users/me/switch-company')
          .set('Cookie', sidCookie)
          .send({ companyId: companyB.id });

        // Check roles after switch - should have NO roles in Company B
        const afterSwitchRoles = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        expect(afterSwitchRoles.body.roles).toHaveLength(0);
        expect(afterSwitchRoles.body.permissions).toHaveLength(0);
      });
    });

    describe('Internal Platform User', () => {
      it('should return platform permissions plus company permissions from platform role', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Platform users get company permissions from their platform role's
        // companyAccessLevel, NOT from company-specific roles
        const platformRole = await createPlatformRole(
          em,
          CompanyAccessLevel.FULL,
          {
            platformPermissions: [
              PERMISSIONS.PLATFORM_VIEW_COMPANIES,
              PERMISSIONS.PLATFORM_SWITCH_COMPANY,
            ],
          },
        );

        // Create internal user - platform users never have company roles
        const email = `internal-${Date.now()}@platform.com`;
        const password = 'TestPassword123!';
        const passwordHash = await hashPassword(password);

        const user = em.create(User, {
          id: uuid(),
          email,
          passwordHash,
          nameFirst: 'Internal',
          nameLast: 'User',
          userType: UserType.INTERNAL,
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          company: companyA,
        });
        em.persist(user);

        // Assign platform role only - platform users never have company roles
        const platformUserRole = em.create(UserRole, {
          id: uuid(),
          user,
          role: platformRole,
          assignedAt: new Date(),
        });
        em.persist(platformUserRole);

        await em.flush();

        // Login
        const loginResponse = await makeRequest()
          .post('/api/auth/login')
          .send({ email, password });

        expect(loginResponse.status).toBe(200);

        const sidCookie = extractSessionCookie(loginResponse.headers);

        // Check roles - should have platform permissions plus company permissions from platform role
        const rolesResponse = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        expect(rolesResponse.status).toBe(200);

        // Should have platform permissions
        expect(rolesResponse.body.permissions).toContain(
          'platform:view_companies',
        );
        expect(rolesResponse.body.permissions).toContain(
          'platform:switch_company',
        );

        // FULL access level grants superuser permissions in any company
        expect(rolesResponse.body.permissions).toContain('*');
      });

      it('should get company permissions from platform role companyAccessLevel after login', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Platform users get company permissions from their platform role's
        // companyAccessLevel, not from company-specific roles
        const platformRole = await createPlatformRole(
          em,
          CompanyAccessLevel.FULL,
          {
            platformPermissions: [
              PERMISSIONS.PLATFORM_VIEW_COMPANIES,
              PERMISSIONS.PLATFORM_SWITCH_COMPANY,
            ],
          },
        );

        // Create internal user - platform users don't have company roles
        const email = `internal-${Date.now()}@platform.com`;
        const password = 'TestPassword123!';
        const passwordHash = await hashPassword(password);

        const user = em.create(User, {
          id: uuid(),
          email,
          passwordHash,
          nameFirst: 'Internal',
          nameLast: 'User',
          userType: UserType.INTERNAL,
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          company: companyA,
        });
        em.persist(user);

        // Assign platform role only - platform users never have company roles
        const platformUserRole = em.create(UserRole, {
          id: uuid(),
          user,
          role: platformRole,
          assignedAt: new Date(),
        });
        em.persist(platformUserRole);

        await em.flush();

        // Login
        const loginResponse = await makeRequest()
          .post('/api/auth/login')
          .send({ email, password });

        const sidCookie = extractSessionCookie(loginResponse.headers);

        // Check roles
        const rolesResponse = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        expect(rolesResponse.status).toBe(200);

        // Should have platform permissions
        expect(rolesResponse.body.permissions).toContain(
          'platform:view_companies',
        );
        expect(rolesResponse.body.permissions).toContain(
          'platform:switch_company',
        );

        // FULL access level grants superuser permissions in any company
        expect(rolesResponse.body.permissions).toContain('*');
      });

      it('should keep SAME permissions when switching companies (platform role applies to all)', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Platform users get the SAME permissions from their platform role
        // in ALL companies - permissions don't change when switching
        const platformRole = await createPlatformRole(
          em,
          CompanyAccessLevel.FULL,
          {
            platformPermissions: [
              PERMISSIONS.PLATFORM_VIEW_COMPANIES,
              PERMISSIONS.PLATFORM_SWITCH_COMPANY,
            ],
          },
        );

        // Create internal user
        const email = `internal-${Date.now()}@platform.com`;
        const password = 'TestPassword123!';
        const passwordHash = await hashPassword(password);

        const user = em.create(User, {
          id: uuid(),
          email,
          passwordHash,
          nameFirst: 'Internal',
          nameLast: 'User',
          userType: UserType.INTERNAL,
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          company: companyA,
        });
        em.persist(user);

        // Assign platform role only - platform users never have company roles
        const platformUserRole = em.create(UserRole, {
          id: uuid(),
          user,
          role: platformRole,
          assignedAt: new Date(),
        });
        em.persist(platformUserRole);

        await em.flush();

        // Login
        const loginResponse = await makeRequest()
          .post('/api/auth/login')
          .send({ email, password });

        const sidCookie = extractSessionCookie(loginResponse.headers);

        // Check initial roles (Company A)
        const initialRoles = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        // Should have platform + FULL access permissions
        expect(initialRoles.body.permissions).toContain(
          'platform:view_companies',
        );
        expect(initialRoles.body.permissions).toContain('*');

        // Switch to Company B using platform switch endpoint
        await makeRequest()
          .post('/api/platform/switch-company')
          .set('Cookie', sidCookie)
          .send({ companyId: companyB.id });

        // Check roles after switch
        const afterSwitchRoles = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', sidCookie);

        // Should STILL have platform permissions
        expect(afterSwitchRoles.body.permissions).toContain(
          'platform:view_companies',
        );
        expect(afterSwitchRoles.body.permissions).toContain(
          'platform:switch_company',
        );

        // Should STILL have FULL access - platform role applies to ALL companies
        expect(afterSwitchRoles.body.permissions).toContain('*');
      });
    });
  });
});
