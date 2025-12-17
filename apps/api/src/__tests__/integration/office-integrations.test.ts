/**
 * Integration tests for office integrations routes.
 */

import crypto from 'crypto';

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
  User,
  Role,
  UserRole,
  Session,
  Office,
  OfficeIntegration,
  SessionSource,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import { makeRequest, waitForDatabase } from './helpers';

// Generate mock keys for testing
const mockPlaintextKey = crypto.randomBytes(32);
const mockEncryptedKey = crypto.randomBytes(64).toString('base64');

// Mock KMS module
vi.mock('../../lib/kms', () => ({
  generateDataKey: vi.fn().mockResolvedValue({
    plaintextKey: mockPlaintextKey,
    encryptedKey: mockEncryptedKey,
  }),
  decryptDataKey: vi.fn().mockResolvedValue(mockPlaintextKey),
  isKmsConfigured: vi.fn().mockReturnValue(true),
}));

describe('Office Integrations Routes Integration Tests', () => {
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
      name: 'integrationAdmin',
      displayName: 'Integration Admin',
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
      email: `test-integration-${Date.now()}@example.com`,
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

    // Clean up test data
    await em.nativeDelete(OfficeIntegration, {});
    await em.nativeDelete(Session, { company: testCompany.id });
    await em.nativeDelete(UserRole, { company: testCompany.id });
    await em.nativeDelete(User, { company: testCompany.id });
    await em.nativeDelete(Office, { company: testCompany.id });
    await em.nativeDelete(Role, { id: adminRole.id });
    await em.nativeDelete(Company, { id: testCompany.id });

    vi.clearAllMocks();
  });

  describe('GET /api/offices/:id/integrations', () => {
    it('should return empty list when no integrations exist', async () => {
      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}/integrations`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.integrations).toEqual([]);
    });

    it('should return list of integrations', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create test integrations
      const integration1 = em.create(OfficeIntegration, {
        id: uuid(),
        office: testOffice,
        integrationKey: 'salesforce',
        displayName: 'Salesforce CRM',
        config: { instanceUrl: 'https://test.salesforce.com' },
        isEnabled: true,
      });
      em.persist(integration1);

      const integration2 = em.create(OfficeIntegration, {
        id: uuid(),
        office: testOffice,
        integrationKey: 'hubspot',
        displayName: 'HubSpot',
        isEnabled: false,
      });
      em.persist(integration2);
      await em.flush();

      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}/integrations`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.integrations).toHaveLength(2);

      // Should not include credentials
      for (const integration of response.body.integrations) {
        expect(integration).not.toHaveProperty('credentials');
        expect(integration).toHaveProperty('hasCredentials');
      }
    });

    it('should filter by enabled status', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      em.persist(
        em.create(OfficeIntegration, {
          id: uuid(),
          office: testOffice,
          integrationKey: 'enabled-one',
          displayName: 'Enabled',
          isEnabled: true,
        }),
      );
      em.persist(
        em.create(OfficeIntegration, {
          id: uuid(),
          office: testOffice,
          integrationKey: 'disabled-one',
          displayName: 'Disabled',
          isEnabled: false,
        }),
      );
      await em.flush();

      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}/integrations`)
        .query({ enabledOnly: 'true' })
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.integrations).toHaveLength(1);
      expect(response.body.integrations[0].isEnabled).toBe(true);
    });

    it('should return 404 for non-existent office', async () => {
      const response = await makeRequest()
        .get(`/api/offices/${uuid()}/integrations`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get(
        `/api/offices/${testOffice.id}/integrations`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/offices/:id/integrations/:key', () => {
    it('should return specific integration', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const integration = em.create(OfficeIntegration, {
        id: uuid(),
        office: testOffice,
        integrationKey: 'salesforce',
        displayName: 'Salesforce CRM',
        config: { instanceUrl: 'https://test.salesforce.com' },
        isEnabled: true,
      });
      em.persist(integration);
      await em.flush();

      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}/integrations/salesforce`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.integration.integrationKey).toBe('salesforce');
      expect(response.body.integration.displayName).toBe('Salesforce CRM');
      expect(response.body.integration.config).toEqual({
        instanceUrl: 'https://test.salesforce.com',
      });
    });

    it('should return 404 for non-existent integration', async () => {
      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}/integrations/nonexistent`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });

    it('should validate integration key format', async () => {
      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}/integrations/INVALID KEY!`)
        .set('Cookie', cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('PUT /api/offices/:id/integrations/:key', () => {
    it('should create new integration', async () => {
      const response = await makeRequest()
        .put(`/api/offices/${testOffice.id}/integrations/salesforce`)
        .set('Cookie', cookie)
        .send({
          displayName: 'Salesforce CRM',
          credentials: {
            clientId: 'test-client-id',
            clientSecret: 'test-secret',
          },
          config: {
            instanceUrl: 'https://test.salesforce.com',
          },
          isEnabled: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Integration saved successfully');
      expect(response.body.integration.integrationKey).toBe('salesforce');
      expect(response.body.integration.hasCredentials).toBe(true);
      // Credentials should not be returned
      expect(response.body.integration).not.toHaveProperty('credentials');
    });

    it('should update existing integration', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const integration = em.create(OfficeIntegration, {
        id: uuid(),
        office: testOffice,
        integrationKey: 'salesforce',
        displayName: 'Old Name',
        isEnabled: true,
      });
      em.persist(integration);
      await em.flush();

      const response = await makeRequest()
        .put(`/api/offices/${testOffice.id}/integrations/salesforce`)
        .set('Cookie', cookie)
        .send({
          displayName: 'New Salesforce Name',
          isEnabled: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.integration.displayName).toBe('New Salesforce Name');
      expect(response.body.integration.isEnabled).toBe(false);
    });

    it('should encrypt credentials with KMS', async () => {
      const response = await makeRequest()
        .put(`/api/offices/${testOffice.id}/integrations/test-creds`)
        .set('Cookie', cookie)
        .send({
          displayName: 'Test Credentials',
          credentials: {
            apiKey: 'secret-api-key-123',
          },
        });

      expect(response.status).toBe(200);

      // Verify encryption in database
      const orm = getORM();
      const em = orm.em.fork();
      const saved = await em.findOne(OfficeIntegration, {
        office: testOffice.id,
        integrationKey: 'test-creds',
      });

      expect(saved).not.toBeNull();
      expect(saved!.encryptedCredentials).toBeDefined();
      expect(saved!.encryptedDataKey).toBeDefined();
      // Encrypted data key should be the mock value
      expect(saved!.encryptedDataKey).toBe(mockEncryptedKey);
      // Encrypted credentials should not contain the plaintext
      expect(saved!.encryptedCredentials).not.toContain('secret-api-key-123');
    });

    it('should return 400 for invalid request body', async () => {
      const response = await makeRequest()
        .put(`/api/offices/${testOffice.id}/integrations/test`)
        .set('Cookie', cookie)
        .send({
          // Missing required displayName
          credentials: {},
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 404 for non-existent office', async () => {
      const response = await makeRequest()
        .put(`/api/offices/${uuid()}/integrations/salesforce`)
        .set('Cookie', cookie)
        .send({
          displayName: 'Salesforce',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/offices/:id/integrations/:key', () => {
    it('should delete integration', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const integration = em.create(OfficeIntegration, {
        id: uuid(),
        office: testOffice,
        integrationKey: 'to-delete',
        displayName: 'To Delete',
        isEnabled: true,
      });
      em.persist(integration);
      await em.flush();

      const response = await makeRequest()
        .delete(`/api/offices/${testOffice.id}/integrations/to-delete`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Integration deleted successfully');

      // Verify deletion
      const deleted = await em.findOne(OfficeIntegration, {
        integrationKey: 'to-delete',
      });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent integration', async () => {
      const response = await makeRequest()
        .delete(`/api/offices/${testOffice.id}/integrations/nonexistent`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });
  });

  describe('Permission checks', () => {
    it('should deny access without SETTINGS_READ permission', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create role without settings permissions
      const limitedRole = em.create(Role, {
        id: uuid(),
        name: 'noSettingsRole',
        displayName: 'No Settings Role',
        permissions: [PERMISSIONS.OFFICE_READ],
        type: RoleType.COMPANY,
        isDefault: false,
        company: testCompany,
      });
      em.persist(limitedRole);

      const limitedUser = em.create(User, {
        id: uuid(),
        email: `no-settings-${Date.now()}@example.com`,
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

      const response = await makeRequest()
        .get(`/api/offices/${testOffice.id}/integrations`)
        .set('Cookie', limitedCookie);

      expect(response.status).toBe(403);
    });

    it('should deny create/update without SETTINGS_UPDATE permission', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create read-only role
      const readOnlyRole = em.create(Role, {
        id: uuid(),
        name: 'readOnlySettings',
        displayName: 'Read Only Settings',
        permissions: [PERMISSIONS.SETTINGS_READ],
        type: RoleType.COMPANY,
        isDefault: false,
        company: testCompany,
      });
      em.persist(readOnlyRole);

      const readOnlyUser = em.create(User, {
        id: uuid(),
        email: `readonly-int-${Date.now()}@example.com`,
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
        .put(`/api/offices/${testOffice.id}/integrations/test`)
        .set('Cookie', readOnlyCookie)
        .send({
          displayName: 'Test',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Cross-company security', () => {
    it('should not allow access to another company integrations', async () => {
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

      const otherIntegration = em.create(OfficeIntegration, {
        id: uuid(),
        office: otherOffice,
        integrationKey: 'secret-integration',
        displayName: 'Secret Integration',
        isEnabled: true,
      });
      em.persist(otherIntegration);
      await em.flush();

      // Try to access other company's integration
      const response = await makeRequest()
        .get(`/api/offices/${otherOffice.id}/integrations`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);

      // Clean up
      await em.nativeDelete(OfficeIntegration, { id: otherIntegration.id });
      await em.nativeDelete(Office, { id: otherOffice.id });
      await em.nativeDelete(Company, { id: otherCompany.id });
    });
  });
});
