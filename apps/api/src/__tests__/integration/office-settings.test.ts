/**
 * Integration tests for office settings routes.
 * Storage and sharp are mocked in server-setup.ts
 */

import { v4 as uuid } from 'uuid';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  beforeEach,
  vi,
} from 'vitest';

import {
  RoleType,
  Company,
  CompanyLogo,
  User,
  Role,
  UserRole,
  Session,
  Office,
  OfficeSettings,
  File,
  FileStatus,
  FileVisibility,
  SessionSource,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import { makeRequest, waitForDatabase } from './helpers';

describe('Office Settings Routes Integration Tests', () => {
  let testCompany: Company;
  let testUser: User;
  let adminRole: Role;
  let testOffice: Office;
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

    // Create test office
    testOffice = em.create(Office, {
      id: uuid(),
      name: 'Test Office',
      company: testCompany,
      isActive: true,
    });
    em.persist(testOffice);

    // Create admin role with settings permissions
    adminRole = em.create(Role, {
      id: uuid(),
      name: 'settingsAdmin',
      displayName: 'Settings Admin',
      permissions: [
        PERMISSIONS.OFFICE_READ,
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.SETTINGS_UPDATE,
      ],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRole);

    // Create test user
    testUser = em.create(User, {
      id: uuid(),
      email: `test-settings-${Date.now()}@example.com`,
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

    cookie = `sid=${sessionId}`;
  });

  afterEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up test data in correct order
    await em.nativeDelete(OfficeSettings, {});
    await em.nativeDelete(CompanyLogo, { company: testCompany.id });
    await em.nativeDelete(File, { company: testCompany.id });
    await em.nativeDelete(Session, { company: testCompany.id });
    await em.nativeDelete(UserRole, { company: testCompany.id });
    await em.nativeDelete(User, { company: testCompany.id });
    await em.nativeDelete(Office, { company: testCompany.id });
    await em.nativeDelete(Role, { id: adminRole.id });
    await em.nativeDelete(Company, { id: testCompany.id });

    vi.clearAllMocks();
  });

  describe('GET /api/offices/:id/settings', () => {
    it('should return office settings (creates if not exists)', async () => {
      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}/settings`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.settings).toBeDefined();
      expect(response.body.settings.officeId).toBe(testOffice.id);
      expect(response.body.settings.logo).toBeNull();
    });

    it('should return settings with logo when set', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a logo file
      const logoFile = em.create(File, {
        id: uuid(),
        filename: 'logo.png',
        storageKey: `${testCompany.id}/files/logo.png`,
        mimeType: 'image/png',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.ACTIVE,
        company: testCompany,
        uploadedBy: testUser,
        thumbnailKey: `${testCompany.id}/thumbnails/logo_thumb.png`,
      });
      em.persist(logoFile);

      // Create company logo entry
      const companyLogo = em.create(CompanyLogo, {
        id: uuid(),
        name: 'Test Logo',
        company: testCompany,
        file: logoFile,
      });
      em.persist(companyLogo);

      // Create settings with logo
      const settings = em.create(OfficeSettings, {
        id: uuid(),
        office: testOffice,
        logo: companyLogo,
      });
      em.persist(settings);
      await em.flush();

      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}/settings`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.settings.logo).not.toBeNull();
      expect(response.body.settings.logo.id).toBe(companyLogo.id);
      expect(response.body.settings.logo.url).toBeDefined();
      expect(response.body.settings.logo.thumbnailUrl).toBeDefined();
    });

    it('should return 404 for non-existent office', async () => {
      const response = await makeRequest()
        .get(`/api/offices/${uuid()}/settings`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get(
        `/api/offices/${testOffice.id}/settings`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/offices/:id/settings/logo', () => {
    it('should upload logo successfully', async () => {
      // Create a simple 100x100 PNG buffer (smallest valid PNG)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        // ... minimal PNG data
      ]);

      const response = await makeRequest()
        .post(`/api/offices/${testOffice.id}/settings/logo`)
        .set('Cookie', cookie)
        .attach('logo', pngBuffer, {
          filename: 'logo.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        'Logo uploaded and selected successfully',
      );
      expect(response.body.settings).toBeDefined();
    });

    it('should return 400 without file', async () => {
      const response = await makeRequest()
        .post(`/api/offices/${testOffice.id}/settings/logo`)
        .set('Cookie', cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No logo file provided');
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest()
        .post(`/api/offices/${testOffice.id}/settings/logo`)
        .attach('logo', Buffer.from('test'), 'logo.png');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent office', async () => {
      const response = await makeRequest()
        .post(`/api/offices/${uuid()}/settings/logo`)
        .set('Cookie', cookie)
        .attach('logo', Buffer.from('test'), {
          filename: 'logo.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/offices/:id/settings/logo', () => {
    it('should remove logo successfully', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create logo file first
      const logoFile = em.create(File, {
        id: uuid(),
        filename: 'logo.png',
        storageKey: `${testCompany.id}/files/logo.png`,
        mimeType: 'image/png',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.ACTIVE,
        company: testCompany,
        uploadedBy: testUser,
      });
      em.persist(logoFile);

      // Create company logo entry
      const companyLogo = em.create(CompanyLogo, {
        id: uuid(),
        name: 'Test Logo',
        company: testCompany,
        file: logoFile,
      });
      em.persist(companyLogo);

      // Create settings with logo
      const settings = em.create(OfficeSettings, {
        id: uuid(),
        office: testOffice,
        logo: companyLogo,
      });
      em.persist(settings);
      await em.flush();

      const response = await makeRequest()
        .delete(`/api/offices/${testOffice.id}/settings/logo`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        'Logo removed successfully (now using company default)',
      );
      expect(response.body.settings.logo).toBeNull();
    });

    it('should return 404 for office without settings', async () => {
      const response = await makeRequest()
        .delete(`/api/offices/${testOffice.id}/settings/logo`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().delete(
        `/api/offices/${testOffice.id}/settings/logo`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe('Permission checks', () => {
    it('should deny settings read without SETTINGS_READ permission', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create role without settings permissions
      const limitedRole = em.create(Role, {
        id: uuid(),
        name: 'limitedRole',
        displayName: 'Limited Role',
        permissions: [PERMISSIONS.OFFICE_READ], // Only office read
        type: RoleType.COMPANY,
        isDefault: false,
        company: testCompany,
      });
      em.persist(limitedRole);

      // Create limited user
      const limitedUser = em.create(User, {
        id: uuid(),
        email: `limited-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Limited',
        nameLast: 'User',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(limitedUser);

      const limitedUserRole = em.create(UserRole, {
        id: uuid(),
        user: limitedUser,
        role: limitedRole,
        company: testCompany,
      });
      em.persist(limitedUserRole);

      const limitedSessionId = uuid();
      const limitedSession = em.create(Session, {
        sid: limitedSessionId,
        user: limitedUser,
        company: testCompany,
        data: { userId: limitedUser.id },
        source: SessionSource.WEB,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        mfaVerified: false,
      });
      em.persist(limitedSession);
      await em.flush();

      const limitedCookie = `sid=${limitedSessionId}`;

      // Try to access settings
      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}/settings`)
        .set('Cookie', limitedCookie);

      // Should succeed because it only needs OFFICE_READ for GET
      expect(response.status).toBe(200);
    });

    it('should deny logo upload without SETTINGS_UPDATE permission', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create role without settings update
      const readOnlyRole = em.create(Role, {
        id: uuid(),
        name: 'readOnlyRole',
        displayName: 'Read Only Role',
        permissions: [PERMISSIONS.SETTINGS_READ], // No update
        type: RoleType.COMPANY,
        isDefault: false,
        company: testCompany,
      });
      em.persist(readOnlyRole);

      const readOnlyUser = em.create(User, {
        id: uuid(),
        email: `readonly-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'ReadOnly',
        nameLast: 'User',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(readOnlyUser);

      const readOnlyUserRole = em.create(UserRole, {
        id: uuid(),
        user: readOnlyUser,
        role: readOnlyRole,
        company: testCompany,
      });
      em.persist(readOnlyUserRole);

      const readOnlySessionId = uuid();
      const readOnlySession = em.create(Session, {
        sid: readOnlySessionId,
        user: readOnlyUser,
        company: testCompany,
        data: { userId: readOnlyUser.id },
        source: SessionSource.WEB,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        mfaVerified: false,
      });
      em.persist(readOnlySession);
      await em.flush();

      const readOnlyCookie = `sid=${readOnlySessionId}`;

      const response = await makeRequest()
        .post(`/api/offices/${testOffice.id}/settings/logo`)
        .set('Cookie', readOnlyCookie)
        .attach('logo', Buffer.from('test'), {
          filename: 'logo.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Cross-company security', () => {
    it('should not allow access to another company office', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create another company and office
      const otherCompany = em.create(Company, {
        id: uuid(),
        name: 'Other Company',
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

      const otherOffice = em.create(Office, {
        id: uuid(),
        name: 'Other Office',
        company: otherCompany,
        isActive: true,
      });
      em.persist(otherOffice);
      await em.flush();

      // Try to access other company's office settings
      const response = await makeRequest()
        .get(`/api/offices/${otherOffice.id}/settings`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);

      // Clean up
      await em.nativeDelete(Office, { id: otherOffice.id });
      await em.nativeDelete(Company, { id: otherCompany.id });
    });
  });
});
