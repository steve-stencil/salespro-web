/**
 * Integration tests for Company Logo Library routes.
 * Tests CRUD operations and default logo management.
 */
import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';

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
  SubscriptionTier,
  SessionLimitStrategy,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

describe('Company Logo Library Routes Integration Tests', () => {
  let testCompany: Company;
  let testUser: User;
  let adminRole: Role;
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
      name: 'Logo Library Test Company',
      maxSeats: 10,
      maxSessionsPerUser: 5,
      tier: SubscriptionTier.FREE,
      sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
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
    em.persist(testCompany);

    // Create admin role with all permissions
    adminRole = em.create(Role, {
      id: uuid(),
      name: `logoTestAdmin-${Date.now()}`,
      displayName: 'Logo Test Admin',
      permissions: ['*'],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRole);

    // Create admin user
    testUser = em.create(User, {
      id: uuid(),
      email: `admin-logo-${Date.now()}@example.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'Admin',
      nameLast: 'User',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: testCompany,
    });
    em.persist(testUser);

    // Assign admin role
    const userRole = em.create(UserRole, {
      id: uuid(),
      user: testUser,
      role: adminRole,
      company: testCompany,
    });
    em.persist(userRole);

    // Create session
    const sessionId = uuid();
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

    // Clean up in correct order (respecting FK constraints)
    // 1. office_settings references company_logo
    await em.nativeDelete('office_settings', {});
    // 2. office references company
    await em.nativeDelete('office', {});
    // 3. company_logo references file and company
    await em.nativeDelete('company_logo', {});
    // 4. file references user (uploaded_by_id) - must delete before user
    await em.nativeDelete('file', {});
    // 5. user_role references user, role, company
    await em.nativeDelete('user_role', {});
    // 6. session references user
    await em.nativeDelete('session', {});
    // 7. user references company
    await em.nativeDelete('user', {});
    // 8. role (no FK to other test tables)
    await em.nativeDelete('role', {});
    // 9. company (referenced by others, delete last)
    await em.nativeDelete('company', {});
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Create a logo file in the database
   */
  async function createLogoFile(name: string): Promise<File> {
    const orm = getORM();
    const em = orm.em.fork();

    const file = em.create(File, {
      id: uuid(),
      filename: `${name}.png`,
      storageKey: `${testCompany.id}/files/${uuid()}.png`,
      mimeType: 'image/png',
      size: 1024,
      visibility: FileVisibility.COMPANY,
      status: FileStatus.ACTIVE,
      company: testCompany,
      uploadedBy: testUser,
      thumbnailKey: `${testCompany.id}/thumbnails/${uuid()}_thumb.png`,
    });
    em.persist(file);
    await em.flush();

    return file;
  }

  /**
   * Create a company logo in the library
   */
  async function createCompanyLogo(
    name: string,
    setAsDefault = false,
  ): Promise<CompanyLogo> {
    const orm = getORM();
    const em = orm.em.fork();

    const file = await createLogoFile(name);

    const companyLogo = em.create(CompanyLogo, {
      id: uuid(),
      name,
      company: testCompany,
      file,
    });
    em.persist(companyLogo);

    if (setAsDefault) {
      const company = await em.findOne(Company, { id: testCompany.id });
      if (company) {
        company.defaultLogo = companyLogo;
      }
    }

    await em.flush();
    return companyLogo;
  }

  /**
   * Create a user with specific permissions
   */
  async function createUserWithPermissions(
    permissions: string[],
  ): Promise<{ user: User; cookie: string }> {
    const orm = getORM();
    const em = orm.em.fork();

    const role = em.create(Role, {
      id: uuid(),
      name: `testRole-${Date.now()}-${Math.random()}`,
      displayName: 'Test Role',
      permissions,
      type: RoleType.COMPANY,
      company: testCompany,
    });
    em.persist(role);

    const user = em.create(User, {
      id: uuid(),
      email: `test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'Test',
      nameLast: 'User',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: testCompany,
    });
    em.persist(user);

    const userRole = em.create(UserRole, {
      id: uuid(),
      user,
      role,
      company: testCompany,
    });
    em.persist(userRole);

    const sid = uuid();
    const session = em.create(Session, {
      sid,
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
    return { user, cookie: `sid=${sid}` };
  }

  // ============================================================================
  // GET /api/companies/logos - List logo library
  // ============================================================================

  describe('GET /api/companies/logos', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/companies/logos');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks company:read permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'user:read',
      ]);

      const response = await makeRequest()
        .get('/api/companies/logos')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });

    it('should return empty library for new company', async () => {
      const response = await makeRequest()
        .get('/api/companies/logos')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.logos).toEqual([]);
      expect(response.body.defaultLogoId).toBeNull();
    });

    it('should return logos in the library', async () => {
      await createCompanyLogo('Logo One');
      await createCompanyLogo('Logo Two');

      const response = await makeRequest()
        .get('/api/companies/logos')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.logos).toHaveLength(2);
      expect(
        response.body.logos.map((l: { name: string }) => l.name),
      ).toContain('Logo One');
      expect(
        response.body.logos.map((l: { name: string }) => l.name),
      ).toContain('Logo Two');
    });

    it('should return default logo ID when set', async () => {
      const logo = await createCompanyLogo('Default Logo', true);

      const response = await makeRequest()
        .get('/api/companies/logos')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.defaultLogoId).toBe(logo.id);
      expect(
        response.body.logos.find(
          (l: { id: string; isDefault: boolean }) => l.id === logo.id,
        )?.isDefault,
      ).toBe(true);
    });

    it('should include office usage count', async () => {
      const logo = await createCompanyLogo('Used Logo');

      // Create office with this logo
      const orm = getORM();
      const em = orm.em.fork();

      const office = em.create(Office, {
        id: uuid(),
        name: 'Test Office',
        company: testCompany,
        isActive: true,
      });
      em.persist(office);

      const settings = em.create(OfficeSettings, {
        id: uuid(),
        office,
        logo: em.getReference(CompanyLogo, logo.id),
      });
      em.persist(settings);
      await em.flush();

      const response = await makeRequest()
        .get('/api/companies/logos')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      const usedLogo = response.body.logos.find(
        (l: { id: string }) => l.id === logo.id,
      );
      expect(usedLogo.usedByOfficeCount).toBe(1);
    });
  });

  // ============================================================================
  // POST /api/companies/logos - Upload new logo
  // ============================================================================

  describe('POST /api/companies/logos', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest()
        .post('/api/companies/logos')
        .attach('logo', Buffer.from('test'), {
          filename: 'logo.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks company:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:read',
      ]);

      const response = await makeRequest()
        .post('/api/companies/logos')
        .set('Cookie', userCookie)
        .attach('logo', Buffer.from('test'), {
          filename: 'logo.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 when no file is provided', async () => {
      const response = await makeRequest()
        .post('/api/companies/logos')
        .set('Cookie', cookie)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No logo file provided');
    });

    it('should return 400 for invalid file type', async () => {
      const response = await makeRequest()
        .post('/api/companies/logos')
        .set('Cookie', cookie)
        .attach('logo', Buffer.from('test'), {
          filename: 'document.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid file type/i);
    });
  });

  // ============================================================================
  // PATCH /api/companies/logos/:id - Update logo name
  // ============================================================================

  describe('PATCH /api/companies/logos/:id', () => {
    it('should return 401 when not authenticated', async () => {
      const logo = await createCompanyLogo('Test Logo');

      const response = await makeRequest()
        .patch(`/api/companies/logos/${logo.id}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks company:update permission', async () => {
      const logo = await createCompanyLogo('Test Logo');
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:read',
      ]);

      const response = await makeRequest()
        .patch(`/api/companies/logos/${logo.id}`)
        .set('Cookie', userCookie)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent logo', async () => {
      const response = await makeRequest()
        .patch(`/api/companies/logos/${uuid()}`)
        .set('Cookie', cookie)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Logo not found');
    });

    it('should return 400 for empty name', async () => {
      const logo = await createCompanyLogo('Test Logo');

      const response = await makeRequest()
        .patch(`/api/companies/logos/${logo.id}`)
        .set('Cookie', cookie)
        .send({ name: '' });

      expect(response.status).toBe(400);
    });

    it('should update logo name successfully', async () => {
      const logo = await createCompanyLogo('Original Name');

      const response = await makeRequest()
        .patch(`/api/companies/logos/${logo.id}`)
        .set('Cookie', cookie)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logo updated');
      expect(response.body.logo.name).toBe('Updated Name');

      // Verify persisted
      const orm = getORM();
      const em = orm.em.fork();
      const updatedLogo = await em.findOne(CompanyLogo, { id: logo.id });
      expect(updatedLogo?.name).toBe('Updated Name');
    });
  });

  // ============================================================================
  // DELETE /api/companies/logos/:id - Delete logo
  // ============================================================================

  describe('DELETE /api/companies/logos/:id', () => {
    it('should return 401 when not authenticated', async () => {
      const logo = await createCompanyLogo('Test Logo');

      const response = await makeRequest().delete(
        `/api/companies/logos/${logo.id}`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks company:update permission', async () => {
      const logo = await createCompanyLogo('Test Logo');
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:read',
      ]);

      const response = await makeRequest()
        .delete(`/api/companies/logos/${logo.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent logo', async () => {
      const response = await makeRequest()
        .delete(`/api/companies/logos/${uuid()}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Logo not found');
    });

    it('should return 400 when trying to delete default logo', async () => {
      const logo = await createCompanyLogo('Default Logo', true);

      const response = await makeRequest()
        .delete(`/api/companies/logos/${logo.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/cannot delete the default logo/i);
    });

    it('should return 400 when logo is used by offices', async () => {
      const logo = await createCompanyLogo('Used Logo');

      // Create office using this logo
      const orm = getORM();
      const em = orm.em.fork();

      const office = em.create(Office, {
        id: uuid(),
        name: 'Test Office',
        company: testCompany,
        isActive: true,
      });
      em.persist(office);

      const settings = em.create(OfficeSettings, {
        id: uuid(),
        office,
        logo: em.getReference(CompanyLogo, logo.id),
      });
      em.persist(settings);
      await em.flush();

      const response = await makeRequest()
        .delete(`/api/companies/logos/${logo.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(
        /cannot delete logo.*used by.*office/i,
      );
    });

    it('should delete logo successfully', async () => {
      const logo = await createCompanyLogo('To Delete');

      const response = await makeRequest()
        .delete(`/api/companies/logos/${logo.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logo removed from library');

      // Verify deleted
      const orm = getORM();
      const em = orm.em.fork();
      const deletedLogo = await em.findOne(CompanyLogo, { id: logo.id });
      expect(deletedLogo).toBeNull();
    });
  });

  // ============================================================================
  // POST /api/companies/logos/:id/set-default - Set default logo
  // ============================================================================

  describe('POST /api/companies/logos/:id/set-default', () => {
    it('should return 401 when not authenticated', async () => {
      const logo = await createCompanyLogo('Test Logo');

      const response = await makeRequest().post(
        `/api/companies/logos/${logo.id}/set-default`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks company:update permission', async () => {
      const logo = await createCompanyLogo('Test Logo');
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:read',
      ]);

      const response = await makeRequest()
        .post(`/api/companies/logos/${logo.id}/set-default`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent logo', async () => {
      const response = await makeRequest()
        .post(`/api/companies/logos/${uuid()}/set-default`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Logo not found');
    });

    it('should set logo as default successfully', async () => {
      const logo = await createCompanyLogo('New Default');

      const response = await makeRequest()
        .post(`/api/companies/logos/${logo.id}/set-default`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Default logo updated');
      expect(response.body.logo.isDefault).toBe(true);

      // Verify persisted
      const orm = getORM();
      const em = orm.em.fork();
      const company = await em.findOne(
        Company,
        { id: testCompany.id },
        { populate: ['defaultLogo'] },
      );
      expect(company?.defaultLogo?.id).toBe(logo.id);
    });

    it('should replace existing default logo', async () => {
      const oldDefault = await createCompanyLogo('Old Default', true);
      const newDefault = await createCompanyLogo('New Default');

      const response = await makeRequest()
        .post(`/api/companies/logos/${newDefault.id}/set-default`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);

      // Verify new default is set
      const orm = getORM();
      const em = orm.em.fork();
      const company = await em.findOne(
        Company,
        { id: testCompany.id },
        { populate: ['defaultLogo'] },
      );
      expect(company?.defaultLogo?.id).toBe(newDefault.id);

      // Verify old default shows as not default
      const listResponse = await makeRequest()
        .get('/api/companies/logos')
        .set('Cookie', cookie);

      const oldLogoInList = listResponse.body.logos.find(
        (l: { id: string }) => l.id === oldDefault.id,
      );
      expect(oldLogoInList.isDefault).toBe(false);
    });
  });

  // ============================================================================
  // DELETE /api/companies/logos/default - Remove default logo
  // ============================================================================

  describe('DELETE /api/companies/logos/default', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().delete(
        '/api/companies/logos/default',
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks company:update permission', async () => {
      const { cookie: userCookie } = await createUserWithPermissions([
        'company:read',
      ]);

      const response = await makeRequest()
        .delete('/api/companies/logos/default')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
    });

    it('should remove default logo successfully', async () => {
      await createCompanyLogo('Default Logo', true);

      const response = await makeRequest()
        .delete('/api/companies/logos/default')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Default logo removed');

      // Verify removed
      const orm = getORM();
      const em = orm.em.fork();
      const company = await em.findOne(
        Company,
        { id: testCompany.id },
        { populate: ['defaultLogo'] },
      );
      expect(company?.defaultLogo).toBeUndefined();
    });

    it('should succeed even when no default is set', async () => {
      const response = await makeRequest()
        .delete('/api/companies/logos/default')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Cross-company security tests
  // ============================================================================

  describe('Cross-company security', () => {
    it('should not allow accessing logos from another company', async () => {
      // Create another company with a logo
      const orm = getORM();
      const em = orm.em.fork();

      const otherCompany = em.create(Company, {
        id: uuid(),
        name: 'Other Company',
        maxSeats: 5,
        maxSessionsPerUser: 2,
        tier: SubscriptionTier.FREE,
        sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
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
      em.persist(otherCompany);

      const otherFile = em.create(File, {
        id: uuid(),
        filename: 'other-logo.png',
        storageKey: `${otherCompany.id}/files/${uuid()}.png`,
        mimeType: 'image/png',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.ACTIVE,
        company: otherCompany,
        uploadedBy: testUser,
      });
      em.persist(otherFile);

      const otherLogo = em.create(CompanyLogo, {
        id: uuid(),
        name: 'Other Company Logo',
        company: otherCompany,
        file: otherFile,
      });
      em.persist(otherLogo);
      await em.flush();

      // Try to update the other company's logo
      const response = await makeRequest()
        .patch(`/api/companies/logos/${otherLogo.id}`)
        .set('Cookie', cookie)
        .send({ name: 'Hacked Name' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Logo not found');
    });

    it('should not allow deleting logos from another company', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const otherCompany = em.create(Company, {
        id: uuid(),
        name: 'Other Company',
        maxSeats: 5,
        maxSessionsPerUser: 2,
        tier: SubscriptionTier.FREE,
        sessionLimitStrategy: SessionLimitStrategy.REVOKE_OLDEST,
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
      em.persist(otherCompany);

      const otherFile = em.create(File, {
        id: uuid(),
        filename: 'other-logo.png',
        storageKey: `${otherCompany.id}/files/${uuid()}.png`,
        mimeType: 'image/png',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.ACTIVE,
        company: otherCompany,
        uploadedBy: testUser,
      });
      em.persist(otherFile);

      const otherLogo = em.create(CompanyLogo, {
        id: uuid(),
        name: 'Other Company Logo',
        company: otherCompany,
        file: otherFile,
      });
      em.persist(otherLogo);
      await em.flush();

      const response = await makeRequest()
        .delete(`/api/companies/logos/${otherLogo.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });
  });
});
