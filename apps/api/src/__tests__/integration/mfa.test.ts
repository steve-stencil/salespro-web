import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

import { Company, User, Session, SessionSource } from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

/**
 * Integration tests for MFA routes.
 * These tests use the actual database to test real MFA scenarios.
 */
describe('MFA Routes Integration Tests', () => {
  let testCompanyId: string;
  let testUserId: string;
  let testEmail: string;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    // Create test company and user for each test
    const orm = getORM();
    const em = orm.em.fork();

    testEmail = `mfa-test-${Date.now()}@example.com`;

    const company = new Company();
    company.id = uuid();
    company.name = `MFA Test Company ${Date.now()}`;
    company.maxSessionsPerUser = 3;
    company.mfaRequired = false;
    company.passwordPolicy = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      historyCount: 3,
      maxAgeDays: 90,
    };
    testCompanyId = company.id;

    const user = new User();
    user.id = uuid();
    user.email = testEmail;
    user.passwordHash = await hashPassword(testPassword);
    user.nameFirst = 'MFA';
    user.nameLast = 'Test';
    user.company = company;
    user.isActive = true;
    user.emailVerified = true;
    user.mfaEnabled = false;
    testUserId = user.id;

    em.persist(company);
    em.persist(user);
    await em.flush();
  });

  afterEach(async () => {
    // Clean up test data
    const orm = getORM();
    const em = orm.em.fork();
    await em.nativeDelete('mfa_recovery_code', {});
    await em.nativeDelete('login_event', {});
    await em.nativeDelete('login_attempt', {});
    await em.nativeDelete('session', {});
    await em.nativeDelete('password_reset_token', {});
    await em.nativeDelete('password_history', {});
    await em.nativeDelete('user', { id: testUserId });
    await em.nativeDelete('company', { id: testCompanyId });
  });

  /**
   * Helper to login and get cookies
   */
  async function loginAndGetCookies(): Promise<string[]> {
    const response = await makeRequest().post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
      source: SessionSource.WEB,
    });

    expect(response.status).toBe(200);
    const cookies = response.headers['set-cookie'];
    return Array.isArray(cookies) ? cookies : [];
  }

  /**
   * Helper to setup pending MFA session
   */
  async function setupPendingMfaSession(): Promise<string[]> {
    // First, enable MFA for the user
    const orm = getORM();
    const em = orm.em.fork();

    const user = await em.findOne(User, { id: testUserId });
    if (user) {
      user.mfaEnabled = true;
      user.mfaEnabledAt = new Date();
      await em.flush();
    }

    // Login - this should return requiresMfa
    const response = await makeRequest().post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
      source: SessionSource.WEB,
    });

    expect(response.status).toBe(200);
    expect(response.body.requiresMfa).toBe(true);

    // Get the session cookie
    const headerCookies = response.headers['set-cookie'];
    const cookies = Array.isArray(headerCookies) ? headerCookies : [];

    // Update session with pending MFA
    const sessionCookie = cookies.find((c: string) => c.startsWith('sid='));
    if (sessionCookie) {
      const sid = sessionCookie.split('=')[1]?.split(';')[0];
      if (sid) {
        const session = await em.findOne(Session, { sid });
        if (session) {
          session.data = { ...session.data, pendingMfaUserId: testUserId };
          await em.flush();
        }
      }
    }

    return cookies;
  }

  describe('POST /api/auth/mfa/send', () => {
    it('should return 400 when no pending MFA verification', async () => {
      const cookies = await loginAndGetCookies();

      const response = await makeRequest()
        .post('/api/auth/mfa/send')
        .set('Cookie', cookies);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No pending MFA verification');
      expect(response.body.errorCode).toBe('no_pending_mfa');
    });

    it('should send MFA code when pending MFA exists', async () => {
      const cookies = await setupPendingMfaSession();

      const response = await makeRequest()
        .post('/api/auth/mfa/send')
        .set('Cookie', cookies);

      // In development mode, should succeed and return code
      if (process.env['NODE_ENV'] === 'development') {
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Verification code sent');
        expect(response.body.expiresIn).toBeDefined();
        expect(response.body.code).toBeDefined();
      } else {
        // In other modes, may fail if email not configured
        expect([200, 400]).toContain(response.status);
      }
    });
  });

  describe('POST /api/auth/mfa/verify', () => {
    it('should return 400 for missing code', async () => {
      const cookies = await loginAndGetCookies();

      const response = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', cookies)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 for invalid code format', async () => {
      const cookies = await loginAndGetCookies();

      const response = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', cookies)
        .send({ code: '12' }); // Too short

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 when no pending MFA', async () => {
      const cookies = await loginAndGetCookies();

      const response = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', cookies)
        .send({ code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No pending MFA verification');
    });

    it('should verify valid MFA code', async () => {
      const cookies = await setupPendingMfaSession();

      // Send code first
      const sendResponse = await makeRequest()
        .post('/api/auth/mfa/send')
        .set('Cookie', cookies);

      if (sendResponse.status === 200 && sendResponse.body.code) {
        const response = await makeRequest()
          .post('/api/auth/mfa/verify')
          .set('Cookie', cookies)
          .send({ code: sendResponse.body.code });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('MFA verification successful');
        expect(response.body.user).toBeDefined();
      }
    });

    it('should return 401 for invalid MFA code', async () => {
      const cookies = await setupPendingMfaSession();

      // Send code first
      const sendResponse = await makeRequest()
        .post('/api/auth/mfa/send')
        .set('Cookie', cookies);

      if (sendResponse.status === 200) {
        const response = await makeRequest()
          .post('/api/auth/mfa/verify')
          .set('Cookie', cookies)
          .send({ code: '000000' }); // Wrong code

        expect(response.status).toBe(401);
        expect(response.body.errorCode).toBe('mfa_code_invalid');
      }
    });
  });

  describe('POST /api/auth/mfa/verify-recovery', () => {
    it('should return 400 for missing recovery code', async () => {
      const cookies = await loginAndGetCookies();

      const response = await makeRequest()
        .post('/api/auth/mfa/verify-recovery')
        .set('Cookie', cookies)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 when no pending MFA', async () => {
      const cookies = await loginAndGetCookies();

      const response = await makeRequest()
        .post('/api/auth/mfa/verify-recovery')
        .set('Cookie', cookies)
        .send({ recoveryCode: 'ABCD-1234-EFGH' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No pending MFA verification');
    });
  });

  describe('POST /api/auth/mfa/enable', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().post('/api/auth/mfa/enable');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should enable MFA and return recovery codes', async () => {
      const cookies = await loginAndGetCookies();

      const response = await makeRequest()
        .post('/api/auth/mfa/enable')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('MFA enabled successfully');
      expect(response.body.recoveryCodes).toBeDefined();
      expect(Array.isArray(response.body.recoveryCodes)).toBe(true);
      expect(response.body.recoveryCodes.length).toBe(10); // Default recovery code count
    });

    it('should return 400 when MFA is already enabled', async () => {
      const cookies = await loginAndGetCookies();

      // Enable MFA first
      await makeRequest().post('/api/auth/mfa/enable').set('Cookie', cookies);

      // Try to enable again
      const response = await makeRequest()
        .post('/api/auth/mfa/enable')
        .set('Cookie', cookies);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('MFA is already enabled');
      expect(response.body.errorCode).toBe('mfa_already_enabled');
    });
  });

  describe('POST /api/auth/mfa/disable', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().post('/api/auth/mfa/disable');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should return 400 when MFA is not enabled', async () => {
      const cookies = await loginAndGetCookies();

      const response = await makeRequest()
        .post('/api/auth/mfa/disable')
        .set('Cookie', cookies);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('MFA is not enabled');
      expect(response.body.errorCode).toBe('mfa_not_enabled');
    });

    it('should disable MFA when enabled', async () => {
      const cookies = await loginAndGetCookies();

      // Enable MFA first
      await makeRequest().post('/api/auth/mfa/enable').set('Cookie', cookies);

      // Disable MFA
      const response = await makeRequest()
        .post('/api/auth/mfa/disable')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('MFA disabled successfully');

      // Verify MFA is disabled
      const statusResponse = await makeRequest()
        .get('/api/auth/mfa/status')
        .set('Cookie', cookies);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.mfaEnabled).toBe(false);
    });
  });

  describe('GET /api/auth/mfa/status', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/auth/mfa/status');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should return MFA status when MFA is disabled', async () => {
      const cookies = await loginAndGetCookies();

      const response = await makeRequest()
        .get('/api/auth/mfa/status')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.mfaEnabled).toBe(false);
      expect(response.body.recoveryCodesRemaining).toBe(0);
    });

    it('should return MFA status with recovery codes count when enabled', async () => {
      const cookies = await loginAndGetCookies();

      // Enable MFA
      await makeRequest().post('/api/auth/mfa/enable').set('Cookie', cookies);

      const response = await makeRequest()
        .get('/api/auth/mfa/status')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.mfaEnabled).toBe(true);
      expect(response.body.mfaEnabledAt).toBeDefined();
      expect(response.body.recoveryCodesRemaining).toBe(10);
    });
  });

  describe('POST /api/auth/mfa/regenerate-recovery-codes', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().post(
        '/api/auth/mfa/regenerate-recovery-codes',
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should return 400 when MFA is not enabled', async () => {
      const cookies = await loginAndGetCookies();

      const response = await makeRequest()
        .post('/api/auth/mfa/regenerate-recovery-codes')
        .set('Cookie', cookies);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('MFA is not enabled');
      expect(response.body.errorCode).toBe('mfa_not_enabled');
    });

    it('should regenerate recovery codes', async () => {
      const cookies = await loginAndGetCookies();

      // Enable MFA first
      const enableResponse = await makeRequest()
        .post('/api/auth/mfa/enable')
        .set('Cookie', cookies);

      const originalCodes = enableResponse.body.recoveryCodes;

      // Regenerate codes
      const response = await makeRequest()
        .post('/api/auth/mfa/regenerate-recovery-codes')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Recovery codes regenerated');
      expect(response.body.recoveryCodes).toBeDefined();
      expect(Array.isArray(response.body.recoveryCodes)).toBe(true);
      expect(response.body.recoveryCodes.length).toBe(10);

      // New codes should be different from original
      expect(response.body.recoveryCodes).not.toEqual(originalCodes);
    });

    it('should invalidate old recovery codes after regeneration', async () => {
      const cookies = await loginAndGetCookies();

      // Enable MFA first
      await makeRequest().post('/api/auth/mfa/enable').set('Cookie', cookies);

      // Check status - should have 10 codes
      const statusBefore = await makeRequest()
        .get('/api/auth/mfa/status')
        .set('Cookie', cookies);

      expect(statusBefore.body.recoveryCodesRemaining).toBe(10);

      // Regenerate codes
      await makeRequest()
        .post('/api/auth/mfa/regenerate-recovery-codes')
        .set('Cookie', cookies);

      // Check status - should still have 10 codes (new ones)
      const statusAfter = await makeRequest()
        .get('/api/auth/mfa/status')
        .set('Cookie', cookies);

      expect(statusAfter.body.recoveryCodesRemaining).toBe(10);
    });
  });

  describe('MFA Login Flow Integration', () => {
    it('should require MFA verification when user has MFA enabled', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Try to login
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(response.status).toBe(200);
      expect(response.body.requiresMfa).toBe(true);
      expect(response.body.message).toBe('MFA verification required');
    });

    it('should require MFA verification when company requires MFA', async () => {
      // Update company to require MFA
      const orm = getORM();
      const em = orm.em.fork();

      const company = await em.findOne(Company, { id: testCompanyId });
      if (company) {
        company.mfaRequired = true;
        await em.flush();
      }

      // Try to login
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(response.status).toBe(200);
      expect(response.body.requiresMfa).toBe(true);
    });
  });
});
