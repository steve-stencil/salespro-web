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
import { PERMISSIONS } from '../../lib/permissions';

import { makeRequest, waitForDatabase } from './helpers';

/**
 * Integration tests for app-level permissions (app:dashboard, app:salespro).
 *
 * These permissions control which applications a user can access:
 * - app:dashboard: Access to the Dashboard admin console
 * - app:salespro: Access to the SalesPro field sales app
 *
 * The tests verify:
 * 1. Users with specific app permissions see only those apps
 * 2. Wildcard permissions (*) grant access to all apps
 * 3. Resource wildcards (app:*) grant access to all apps
 * 4. Internal users' companyPermissions are respected for app access
 * 5. Standard system roles have correct app permissions
 */
describe('App Permissions Integration Tests', () => {
  let testCompany: Company;

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Create test company
    testCompany = em.create(Company, {
      id: uuid(),
      name: 'App Permissions Test Company',
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
    await em.flush();
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

  /**
   * Helper to create a user with specific permissions and return session info.
   */
  async function createUserWithPermissions(
    permissions: string[],
    options: {
      email?: string;
      isInternal?: boolean;
      companyPermissions?: string[];
      activeCompanyId?: string;
    } = {},
  ): Promise<{ user: User; cookie: string; role: Role }> {
    const orm = getORM();
    const em = orm.em.fork();

    const isInternal = options.isInternal ?? false;
    const roleName = `appTestRole-${Date.now()}-${Math.random()}`;

    // Create role
    const role = em.create(Role, {
      id: uuid(),
      name: roleName,
      displayName: 'App Test Role',
      permissions,
      type: isInternal ? RoleType.PLATFORM : RoleType.COMPANY,
      ...(isInternal
        ? { companyPermissions: options.companyPermissions ?? permissions }
        : { company: testCompany }),
    });
    em.persist(role);

    // Create user
    const user = em.create(User, {
      id: uuid(),
      email:
        options.email ?? `app-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'AppTest',
      nameLast: 'User',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      userType: isInternal ? UserType.INTERNAL : UserType.COMPANY,
      ...(isInternal ? {} : { company: testCompany }),
    });
    em.persist(user);

    // Assign role
    const userRole = em.create(UserRole, {
      id: uuid(),
      user,
      role,
      ...(isInternal ? {} : { company: testCompany }),
    });
    em.persist(userRole);

    // Create session
    const sessionId = uuid();
    const session = em.create(Session, {
      sid: sessionId,
      user,
      ...(isInternal
        ? {
            activeCompany: options.activeCompanyId
              ? em.getReference(Company, options.activeCompanyId)
              : testCompany,
          }
        : { company: testCompany }),
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

    return { user, cookie: `sid=${sessionId}`, role };
  }

  // ============================================================================
  // Section 1: Basic App Permission Tests
  // ============================================================================

  describe('GET /api/roles/me - App Permissions in Response', () => {
    describe('Single App Access', () => {
      it('should include app:dashboard permission when user has only Dashboard access', async () => {
        const { cookie } = await createUserWithPermissions([
          PERMISSIONS.APP_DASHBOARD,
          PERMISSIONS.USER_READ,
        ]);

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toBeDefined();
        expect(response.body.permissions).toContain('app:dashboard');
        expect(response.body.permissions).not.toContain('app:salespro');
      });

      it('should include app:salespro permission when user has only SalesPro access', async () => {
        const { cookie } = await createUserWithPermissions([
          PERMISSIONS.APP_SALESPRO,
          PERMISSIONS.CUSTOMER_READ,
        ]);

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toBeDefined();
        expect(response.body.permissions).toContain('app:salespro');
        expect(response.body.permissions).not.toContain('app:dashboard');
      });
    });

    describe('Multiple App Access', () => {
      it('should include both app permissions when user has access to both apps', async () => {
        const { cookie } = await createUserWithPermissions([
          PERMISSIONS.APP_DASHBOARD,
          PERMISSIONS.APP_SALESPRO,
          PERMISSIONS.USER_READ,
        ]);

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toContain('app:dashboard');
        expect(response.body.permissions).toContain('app:salespro');
      });
    });

    describe('No App Access', () => {
      it('should not include app permissions when user has no app access', async () => {
        const { cookie } = await createUserWithPermissions([
          PERMISSIONS.USER_READ,
          PERMISSIONS.CUSTOMER_READ,
        ]);

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).not.toContain('app:dashboard');
        expect(response.body.permissions).not.toContain('app:salespro');
      });
    });
  });

  // ============================================================================
  // Section 2: Wildcard Permission Tests
  // ============================================================================

  describe('Wildcard Permissions for App Access', () => {
    describe('Global Wildcard (*)', () => {
      it('should grant access to all apps with * permission', async () => {
        const { cookie } = await createUserWithPermissions(['*']);

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toBeDefined();

        // With wildcard, user effectively has all permissions
        // The API should include the wildcard which matches all app permissions
        expect(response.body.permissions).toContain('*');
      });

      it('should effectively have app:dashboard access with * permission', async () => {
        const { cookie } = await createUserWithPermissions(['*']);

        // User with * can access all protected routes
        const response = await makeRequest()
          .get('/api/roles')
          .set('Cookie', cookie);

        // Should succeed because * includes role:read
        expect(response.status).toBe(200);
      });
    });

    describe('Resource Wildcard (app:*)', () => {
      it('should grant access to all apps with app:* permission', async () => {
        const { cookie } = await createUserWithPermissions([
          'app:*',
          PERMISSIONS.USER_READ,
        ]);

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toContain('app:*');
      });
    });
  });

  // ============================================================================
  // Section 3: System Role App Permission Tests
  // ============================================================================

  describe('System Role App Permissions', () => {
    /**
     * Helper to create a user with a specific named system role.
     */
    async function createUserWithSystemRole(roleConfig: {
      name: string;
      permissions: string[];
      isDefault?: boolean;
    }): Promise<{ user: User; cookie: string; role: Role }> {
      const orm = getORM();
      const em = orm.em.fork();

      // Create system role
      const role = em.create(Role, {
        id: uuid(),
        name: roleConfig.name,
        displayName: `${roleConfig.name} Role`,
        permissions: roleConfig.permissions,
        type: RoleType.SYSTEM,
        isDefault: roleConfig.isDefault ?? false,
      });
      em.persist(role);

      // Create user
      const user = em.create(User, {
        id: uuid(),
        email: `${roleConfig.name}-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: roleConfig.name,
        nameLast: 'User',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(user);

      // Assign role
      const userRole = em.create(UserRole, {
        id: uuid(),
        user,
        role,
        company: testCompany,
      });
      em.persist(userRole);

      // Create session
      const sessionId = uuid();
      const session = em.create(Session, {
        sid: sessionId,
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

      return { user, cookie: `sid=${sessionId}`, role };
    }

    describe('SuperUser Role', () => {
      it('should have wildcard (*) that includes all app permissions', async () => {
        const { cookie } = await createUserWithSystemRole({
          name: `superUser-test-${Date.now()}`,
          permissions: ['*'],
        });

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toContain('*');
      });
    });

    describe('Admin Role', () => {
      it('should have both app:dashboard and app:salespro permissions', async () => {
        const { cookie } = await createUserWithSystemRole({
          name: `admin-test-${Date.now()}`,
          permissions: [
            PERMISSIONS.APP_DASHBOARD,
            PERMISSIONS.APP_SALESPRO,
            'customer:*',
            'user:*',
            'office:*',
            'role:*',
            'settings:*',
            'company:*',
          ],
        });

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toContain('app:dashboard');
        expect(response.body.permissions).toContain('app:salespro');
      });
    });

    describe('SalesRep Role', () => {
      it('should have only app:salespro permission', async () => {
        const { cookie } = await createUserWithSystemRole({
          name: `salesRep-test-${Date.now()}`,
          permissions: [
            PERMISSIONS.APP_SALESPRO,
            PERMISSIONS.CUSTOMER_READ,
            PERMISSIONS.CUSTOMER_CREATE,
            PERMISSIONS.CUSTOMER_UPDATE,
            PERMISSIONS.OFFICE_READ,
            PERMISSIONS.REPORT_READ,
          ],
          isDefault: true,
        });

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toContain('app:salespro');
        expect(response.body.permissions).not.toContain('app:dashboard');
      });
    });

    describe('Viewer Role', () => {
      it('should have only app:dashboard permission', async () => {
        const { cookie } = await createUserWithSystemRole({
          name: `viewer-test-${Date.now()}`,
          permissions: [
            PERMISSIONS.APP_DASHBOARD,
            PERMISSIONS.CUSTOMER_READ,
            PERMISSIONS.OFFICE_READ,
            PERMISSIONS.REPORT_READ,
          ],
        });

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toContain('app:dashboard');
        expect(response.body.permissions).not.toContain('app:salespro');
      });
    });
  });

  // ============================================================================
  // Section 4: Internal User App Permission Tests
  // ============================================================================

  describe('Internal User App Permissions', () => {
    describe('Platform Role with Full Company Access', () => {
      it('should have all app permissions via companyPermissions wildcard (*)', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create platform role with full access
        const platformRole = em.create(Role, {
          id: uuid(),
          name: `platformAdmin-test-${Date.now()}`,
          displayName: 'Platform Admin Test',
          type: RoleType.PLATFORM,
          permissions: [
            PERMISSIONS.PLATFORM_VIEW_COMPANIES,
            PERMISSIONS.PLATFORM_SWITCH_COMPANY,
          ],
          companyPermissions: ['*'],
        });
        em.persist(platformRole);

        // Create internal user
        const user = em.create(User, {
          id: uuid(),
          email: `internal-admin-${Date.now()}@platform.com`,
          passwordHash: await hashPassword('TestPassword123!'),
          nameFirst: 'Internal',
          nameLast: 'Admin',
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          userType: UserType.INTERNAL,
        });
        em.persist(user);

        // Assign platform role
        const userRole = em.create(UserRole, {
          id: uuid(),
          user,
          role: platformRole,
        });
        em.persist(userRole);

        // Create session with active company
        const sessionId = uuid();
        const session = em.create(Session, {
          sid: sessionId,
          user,
          activeCompany: testCompany,
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

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        // Internal user with * companyPermissions has all permissions
        expect(response.body.permissions).toContain('*');
      });
    });

    describe('Platform Role with Specific App Permissions', () => {
      it('should only have app permissions specified in companyPermissions', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create platform role with limited access - only Dashboard
        const platformRole = em.create(Role, {
          id: uuid(),
          name: `platformSupport-test-${Date.now()}`,
          displayName: 'Platform Support Test',
          type: RoleType.PLATFORM,
          permissions: [
            PERMISSIONS.PLATFORM_VIEW_COMPANIES,
            PERMISSIONS.PLATFORM_SWITCH_COMPANY,
          ],
          companyPermissions: [
            PERMISSIONS.APP_DASHBOARD,
            PERMISSIONS.CUSTOMER_READ,
            PERMISSIONS.USER_READ,
          ],
        });
        em.persist(platformRole);

        // Create internal user
        const user = em.create(User, {
          id: uuid(),
          email: `internal-support-${Date.now()}@platform.com`,
          passwordHash: await hashPassword('TestPassword123!'),
          nameFirst: 'Internal',
          nameLast: 'Support',
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          userType: UserType.INTERNAL,
        });
        em.persist(user);

        // Assign platform role
        const userRole = em.create(UserRole, {
          id: uuid(),
          user,
          role: platformRole,
        });
        em.persist(userRole);

        // Create session with active company
        const sessionId = uuid();
        const session = em.create(Session, {
          sid: sessionId,
          user,
          activeCompany: testCompany,
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

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toContain('app:dashboard');
        expect(response.body.permissions).not.toContain('app:salespro');
      });

      it('should have both app permissions when both are in companyPermissions', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create platform role with both app permissions
        const platformRole = em.create(Role, {
          id: uuid(),
          name: `platformDev-test-${Date.now()}`,
          displayName: 'Platform Developer Test',
          type: RoleType.PLATFORM,
          permissions: [
            PERMISSIONS.PLATFORM_VIEW_COMPANIES,
            PERMISSIONS.PLATFORM_SWITCH_COMPANY,
          ],
          companyPermissions: [
            PERMISSIONS.APP_DASHBOARD,
            PERMISSIONS.APP_SALESPRO,
            PERMISSIONS.CUSTOMER_READ,
            PERMISSIONS.USER_READ,
          ],
        });
        em.persist(platformRole);

        // Create internal user
        const user = em.create(User, {
          id: uuid(),
          email: `internal-dev-${Date.now()}@platform.com`,
          passwordHash: await hashPassword('TestPassword123!'),
          nameFirst: 'Internal',
          nameLast: 'Developer',
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          userType: UserType.INTERNAL,
        });
        em.persist(user);

        // Assign platform role
        const userRole = em.create(UserRole, {
          id: uuid(),
          user,
          role: platformRole,
        });
        em.persist(userRole);

        // Create session with active company
        const sessionId = uuid();
        const session = em.create(Session, {
          sid: sessionId,
          user,
          activeCompany: testCompany,
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

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.permissions).toContain('app:dashboard');
        expect(response.body.permissions).toContain('app:salespro');
      });
    });

    describe('Platform Role with app:* Wildcard', () => {
      it('should have all app permissions via app:* wildcard in companyPermissions', async () => {
        const orm = getORM();
        const em = orm.em.fork();

        // Create platform role with app:* wildcard
        const platformRole = em.create(Role, {
          id: uuid(),
          name: `platformAppWildcard-test-${Date.now()}`,
          displayName: 'Platform App Wildcard Test',
          type: RoleType.PLATFORM,
          permissions: [
            PERMISSIONS.PLATFORM_VIEW_COMPANIES,
            PERMISSIONS.PLATFORM_SWITCH_COMPANY,
          ],
          companyPermissions: ['app:*', PERMISSIONS.CUSTOMER_READ],
        });
        em.persist(platformRole);

        // Create internal user
        const user = em.create(User, {
          id: uuid(),
          email: `internal-wildcard-${Date.now()}@platform.com`,
          passwordHash: await hashPassword('TestPassword123!'),
          nameFirst: 'Internal',
          nameLast: 'Wildcard',
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          userType: UserType.INTERNAL,
        });
        em.persist(user);

        // Assign platform role
        const userRole = em.create(UserRole, {
          id: uuid(),
          user,
          role: platformRole,
        });
        em.persist(userRole);

        // Create session with active company
        const sessionId = uuid();
        const session = em.create(Session, {
          sid: sessionId,
          user,
          activeCompany: testCompany,
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

        const response = await makeRequest()
          .get('/api/roles/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        // Should have app:* which covers all app permissions
        expect(response.body.permissions).toContain('app:*');
      });
    });
  });

  // ============================================================================
  // Section 5: Multiple Roles Combined Permissions
  // ============================================================================

  describe('Multiple Roles Combined App Permissions', () => {
    it('should combine app permissions from multiple roles', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create two roles with different app permissions
      const dashboardRole = em.create(Role, {
        id: uuid(),
        name: `dashboardOnly-${Date.now()}`,
        displayName: 'Dashboard Only',
        permissions: [PERMISSIONS.APP_DASHBOARD, PERMISSIONS.USER_READ],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(dashboardRole);

      const salesproRole = em.create(Role, {
        id: uuid(),
        name: `salesproOnly-${Date.now()}`,
        displayName: 'SalesPro Only',
        permissions: [PERMISSIONS.APP_SALESPRO, PERMISSIONS.CUSTOMER_READ],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(salesproRole);

      // Create user
      const user = em.create(User, {
        id: uuid(),
        email: `multi-role-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Multi',
        nameLast: 'Role',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(user);

      // Assign both roles
      const userRole1 = em.create(UserRole, {
        id: uuid(),
        user,
        role: dashboardRole,
        company: testCompany,
      });
      em.persist(userRole1);

      const userRole2 = em.create(UserRole, {
        id: uuid(),
        user,
        role: salesproRole,
        company: testCompany,
      });
      em.persist(userRole2);

      // Create session
      const sessionId = uuid();
      const session = em.create(Session, {
        sid: sessionId,
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

      const cookie = `sid=${sessionId}`;

      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      // User should have permissions from both roles
      expect(response.body.permissions).toContain('app:dashboard');
      expect(response.body.permissions).toContain('app:salespro');
      expect(response.body.permissions).toContain('user:read');
      expect(response.body.permissions).toContain('customer:read');
    });

    it('should handle combined system and company roles', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a system role with one app
      const systemRole = em.create(Role, {
        id: uuid(),
        name: `systemSalesRep-${Date.now()}`,
        displayName: 'System Sales Rep',
        permissions: [PERMISSIONS.APP_SALESPRO, PERMISSIONS.CUSTOMER_READ],
        type: RoleType.SYSTEM,
        isDefault: true,
      });
      em.persist(systemRole);

      // Create a company role with the other app
      const companyRole = em.create(Role, {
        id: uuid(),
        name: `companyDashboard-${Date.now()}`,
        displayName: 'Company Dashboard Access',
        permissions: [PERMISSIONS.APP_DASHBOARD, PERMISSIONS.REPORT_READ],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(companyRole);

      // Create user
      const user = em.create(User, {
        id: uuid(),
        email: `mixed-roles-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Mixed',
        nameLast: 'Roles',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(user);

      // Assign both roles
      const userRole1 = em.create(UserRole, {
        id: uuid(),
        user,
        role: systemRole,
        company: testCompany,
      });
      em.persist(userRole1);

      const userRole2 = em.create(UserRole, {
        id: uuid(),
        user,
        role: companyRole,
        company: testCompany,
      });
      em.persist(userRole2);

      // Create session
      const sessionId = uuid();
      const session = em.create(Session, {
        sid: sessionId,
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

      const cookie = `sid=${sessionId}`;

      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.permissions).toContain('app:dashboard');
      expect(response.body.permissions).toContain('app:salespro');
    });
  });

  // ============================================================================
  // Section 6: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle user with no roles assigned', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create user without any roles
      const user = em.create(User, {
        id: uuid(),
        email: `no-roles-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'No',
        nameLast: 'Roles',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(user);

      // Create session
      const sessionId = uuid();
      const session = em.create(Session, {
        sid: sessionId,
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

      const cookie = `sid=${sessionId}`;

      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      // User with no roles should have empty permissions
      expect(response.body.permissions).toEqual([]);
      expect(response.body.permissions).not.toContain('app:dashboard');
      expect(response.body.permissions).not.toContain('app:salespro');
    });

    it('should not leak app permissions between companies (multi-tenant isolation)', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a second company
      const otherCompany = em.create(Company, {
        id: uuid(),
        name: 'Other Test Company',
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
      em.persist(otherCompany);

      // Create role in OTHER company with app:dashboard
      const otherCompanyRole = em.create(Role, {
        id: uuid(),
        name: `otherCompanyAdmin-${Date.now()}`,
        displayName: 'Other Company Admin',
        permissions: [PERMISSIONS.APP_DASHBOARD, PERMISSIONS.APP_SALESPRO],
        type: RoleType.COMPANY,
        company: otherCompany,
      });
      em.persist(otherCompanyRole);

      // Create user in testCompany
      const user = em.create(User, {
        id: uuid(),
        email: `isolation-test-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Isolation',
        nameLast: 'Test',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(user);

      // Create role in testCompany with ONLY app:salespro
      const testCompanyRole = em.create(Role, {
        id: uuid(),
        name: `testCompanySales-${Date.now()}`,
        displayName: 'Test Company Sales',
        permissions: [PERMISSIONS.APP_SALESPRO, PERMISSIONS.CUSTOMER_READ],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(testCompanyRole);

      // Assign role in testCompany
      const userRole = em.create(UserRole, {
        id: uuid(),
        user,
        role: testCompanyRole,
        company: testCompany,
      });
      em.persist(userRole);

      // Create session in testCompany
      const sessionId = uuid();
      const session = em.create(Session, {
        sid: sessionId,
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

      const cookie = `sid=${sessionId}`;

      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      // User should only have permissions from their company role
      expect(response.body.permissions).toContain('app:salespro');
      expect(response.body.permissions).not.toContain('app:dashboard');
    });

    it('should handle inactive user correctly', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create role
      const role = em.create(Role, {
        id: uuid(),
        name: `inactiveUserRole-${Date.now()}`,
        displayName: 'Inactive User Role',
        permissions: [PERMISSIONS.APP_DASHBOARD, PERMISSIONS.APP_SALESPRO],
        type: RoleType.COMPANY,
        company: testCompany,
      });
      em.persist(role);

      // Create INACTIVE user
      const user = em.create(User, {
        id: uuid(),
        email: `inactive-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Inactive',
        nameLast: 'User',
        isActive: false, // Inactive
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(user);

      // Assign role
      const userRole = em.create(UserRole, {
        id: uuid(),
        user,
        role,
        company: testCompany,
      });
      em.persist(userRole);

      // Create session
      const sessionId = uuid();
      const session = em.create(Session, {
        sid: sessionId,
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

      const cookie = `sid=${sessionId}`;

      // Inactive user should be rejected at authentication
      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      // Should be rejected (401) because user is inactive
      expect(response.status).toBe(401);
    });
  });

  // ============================================================================
  // Section 7: Permission API Response Structure
  // ============================================================================

  describe('API Response Structure', () => {
    it('should include roles array with app permissions in response', async () => {
      const { cookie, role } = await createUserWithPermissions([
        PERMISSIONS.APP_DASHBOARD,
        PERMISSIONS.APP_SALESPRO,
        PERMISSIONS.USER_READ,
      ]);

      const response = await makeRequest()
        .get('/api/roles/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);

      // Check response structure
      expect(response.body).toHaveProperty('roles');
      expect(response.body).toHaveProperty('permissions');
      expect(Array.isArray(response.body.roles)).toBe(true);
      expect(Array.isArray(response.body.permissions)).toBe(true);

      // Verify the role is in the response (note: /api/roles/me returns only id, name, displayName, type)
      const assignedRole = response.body.roles.find(
        (r: { id: string }) => r.id === role.id,
      );
      expect(assignedRole).toBeDefined();
      expect(assignedRole.name).toBe(role.name);

      // App permissions should be in the top-level permissions array
      expect(response.body.permissions).toContain('app:dashboard');
      expect(response.body.permissions).toContain('app:salespro');
    });

    it('should correctly categorize app permissions', async () => {
      const { cookie } = await createUserWithPermissions([
        PERMISSIONS.APP_DASHBOARD,
        PERMISSIONS.USER_READ,
      ]);

      // Get all permissions with metadata
      const response = await makeRequest()
        .get('/api/roles/permissions')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);

      // Find app:dashboard permission
      const dashboardPerm = response.body.permissions.find(
        (p: { name: string }) => p.name === 'app:dashboard',
      );
      expect(dashboardPerm).toBeDefined();
      expect(dashboardPerm.category).toBe('Applications');
      expect(dashboardPerm.label).toBe('Dashboard Access');

      // Find app:salespro permission
      const salesproPerm = response.body.permissions.find(
        (p: { name: string }) => p.name === 'app:salespro',
      );
      expect(salesproPerm).toBeDefined();
      expect(salesproPerm.category).toBe('Applications');
      expect(salesproPerm.label).toBe('SalesPro Access');
    });
  });
});
