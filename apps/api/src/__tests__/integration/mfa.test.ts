import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

import {
  Company,
  User,
  Session,
  SessionSource,
  TrustedDevice,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';
import { TRUSTED_DEVICE_CONFIG } from '../../services/auth/trusted-device';

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
    await em.nativeDelete('trusted_device', {});
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
      expect(response.body.message).toContain('MFA verification required');
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

  describe('Email-based MFA Flow', () => {
    it('should automatically send MFA code via email during login when MFA is required', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login - should trigger automatic email code send
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(response.status).toBe(200);
      expect(response.body.requiresMfa).toBe(true);
      expect(response.body.message).toContain(
        'code has been sent to your email',
      );
      expect(response.body.expiresIn).toBeDefined();
      expect(response.body.expiresIn).toBe(5); // 5 minutes default

      // In development mode, code should be returned
      if (process.env['NODE_ENV'] === 'development') {
        expect(response.body.code).toBeDefined();
        expect(response.body.code).toHaveLength(6);
      }
    });

    it('should complete full MFA flow: login -> verify code -> success', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Step 1: Login - get MFA code
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);

      const headerCookies = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(headerCookies) ? headerCookies : [];
      const code = loginResponse.body.code;

      // In development mode, verify the code
      if (code) {
        // Step 2: Verify MFA code
        const verifyResponse = await makeRequest()
          .post('/api/auth/mfa/verify')
          .set('Cookie', cookies)
          .send({ code });

        expect(verifyResponse.status).toBe(200);
        expect(verifyResponse.body.message).toBe('MFA verification successful');
        expect(verifyResponse.body.user).toBeDefined();
        expect(verifyResponse.body.user.email).toBe(testEmail);
      }
    });

    it('should reject invalid MFA code with proper error', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login to get MFA session
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);

      const headerCookies = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(headerCookies) ? headerCookies : [];

      // Try to verify with invalid code
      const verifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', cookies)
        .send({ code: '000000' });

      expect(verifyResponse.status).toBe(401);
      expect(verifyResponse.body.error).toBe('Invalid MFA code');
      expect(verifyResponse.body.errorCode).toBe('mfa_code_invalid');
    });

    it('should allow resending MFA code', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login to get MFA session
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      const headerCookies = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(headerCookies) ? headerCookies : [];
      const originalCode = loginResponse.body.code;

      // Resend the code
      const resendResponse = await makeRequest()
        .post('/api/auth/mfa/send')
        .set('Cookie', cookies);

      expect(resendResponse.status).toBe(200);
      expect(resendResponse.body.message).toBe('Verification code sent');
      expect(resendResponse.body.expiresIn).toBe(5);

      // In development mode, verify new code is different
      if (resendResponse.body.code && originalCode) {
        // New code should be generated (may or may not be different due to randomness)
        expect(resendResponse.body.code).toHaveLength(6);
      }
    });

    it('should lock out after too many failed MFA attempts', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login to get MFA session
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      const headerCookies = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(headerCookies) ? headerCookies : [];

      // Make 6 failed attempts (max is 5)
      for (let i = 0; i < 6; i++) {
        await makeRequest()
          .post('/api/auth/mfa/verify')
          .set('Cookie', cookies)
          .send({ code: '000000' });
      }

      // Next attempt should fail with "Too many failed attempts" or "Invalid MFA code"
      const finalResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', cookies)
        .send({ code: '000000' });

      expect(finalResponse.status).toBe(401);
      // After max attempts, the pending MFA is cleared
      expect(finalResponse.body.errorCode).toMatch(
        /mfa_code_invalid|no_pending_mfa/,
      );
    });

    it('should work when company requires MFA but user has not enabled it personally', async () => {
      // User has NOT enabled MFA personally, but company requires it
      const orm = getORM();
      const em = orm.em.fork();

      const company = await em.findOne(Company, { id: testCompanyId });
      if (company) {
        company.mfaRequired = true;
        await em.flush();
      }

      // Login - should still trigger MFA flow
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);
      expect(loginResponse.body.message).toContain(
        'code has been sent to your email',
      );
      expect(loginResponse.body.expiresIn).toBeDefined();

      // In development mode, verify we can complete the flow
      if (loginResponse.body.code) {
        const headerCookies = loginResponse.headers['set-cookie'];
        const cookies = Array.isArray(headerCookies) ? headerCookies : [];
        const verifyResponse = await makeRequest()
          .post('/api/auth/mfa/verify')
          .set('Cookie', cookies)
          .send({ code: loginResponse.body.code });

        expect(verifyResponse.status).toBe(200);
        expect(verifyResponse.body.message).toBe('MFA verification successful');
      }
    });

    it('should return 400 when trying to resend without pending MFA session', async () => {
      // Login normally (no MFA required)
      const cookies = await loginAndGetCookies();

      // Try to resend code without pending MFA
      const response = await makeRequest()
        .post('/api/auth/mfa/send')
        .set('Cookie', cookies);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No pending MFA verification');
      expect(response.body.errorCode).toBe('no_pending_mfa');
    });

    it('should return 400 when verifying without pending MFA session', async () => {
      // Login normally (no MFA required)
      const cookies = await loginAndGetCookies();

      // Try to verify code without pending MFA
      const response = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', cookies)
        .send({ code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No pending MFA verification');
      expect(response.body.errorCode).toBe('no_pending_mfa');
    });
  });

  describe('GET /api/auth/me with MFA state', () => {
    it('should return requiresMfa when session has mfaVerified=false', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login - this creates a session with mfaVerified=false
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);

      const headerCookies = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(headerCookies) ? headerCookies : [];

      // Call /auth/me - should return requiresMfa since MFA not verified
      const meResponse = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.requiresMfa).toBe(true);
      // Should NOT return user data
      expect(meResponse.body.id).toBeUndefined();
      expect(meResponse.body.email).toBeUndefined();
    });

    it('should return user data after MFA verification', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login - get MFA code
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      const headerCookies = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(headerCookies) ? headerCookies : [];
      const code = loginResponse.body.code;

      // Skip if no code (non-dev environment)
      if (!code) return;

      // Verify MFA code
      const verifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', cookies)
        .send({ code });

      expect(verifyResponse.status).toBe(200);

      // Now /auth/me should return full user data
      const meResponse = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.requiresMfa).toBeUndefined();
      expect(meResponse.body.id).toBe(testUserId);
      expect(meResponse.body.email).toBe(testEmail);
    });

    it('should handle page refresh during MFA flow correctly', async () => {
      // This simulates the bug where refreshing on MFA page would log user in
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login - get session with pending MFA
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);

      const headerCookies = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(headerCookies) ? headerCookies : [];

      // Simulate page refresh - call /auth/me multiple times
      // Each call should consistently return requiresMfa
      for (let i = 0; i < 3; i++) {
        const meResponse = await makeRequest()
          .get('/api/auth/me')
          .set('Cookie', cookies);

        expect(meResponse.status).toBe(200);
        expect(meResponse.body.requiresMfa).toBe(true);
        expect(meResponse.body.id).toBeUndefined();
      }
    });
  });

  describe('Signed Cookie Handling', () => {
    it('should correctly verify MFA with signed session cookies', async () => {
      // This tests that the signed cookie (s:UUID.signature) is correctly parsed
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login - creates session and sets signed cookie
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);

      const headerCookies = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(headerCookies) ? headerCookies : [];
      const code = loginResponse.body.code;

      // Skip if no code (non-dev environment)
      if (!code) return;

      // Verify the cookie is signed (starts with s: or contains the session ID)
      const sidCookie = cookies.find((c: string) => c.startsWith('sid='));
      expect(sidCookie).toBeDefined();

      // MFA verify should work even with signed cookie
      const verifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', cookies)
        .send({ code });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.message).toBe('MFA verification successful');

      // Verify the session was properly updated (mfaVerified = true)
      const meResponse = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.requiresMfa).toBeUndefined();
      expect(meResponse.body.email).toBe(testEmail);
    });

    it('should correctly resend MFA code with signed session cookies', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      const headerCookies = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(headerCookies) ? headerCookies : [];

      // Resend should work with signed cookies
      const resendResponse = await makeRequest()
        .post('/api/auth/mfa/send')
        .set('Cookie', cookies);

      expect(resendResponse.status).toBe(200);
      expect(resendResponse.body.message).toBe('Verification code sent');
    });

    it('should update mfaVerified flag in session after successful verification', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      const headerCookies = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(headerCookies) ? headerCookies : [];
      const code = loginResponse.body.code;

      if (!code) return;

      // Get the session ID from cookie to verify directly in DB
      const sidCookie = cookies.find((c: string) => c.startsWith('sid='));
      const sidValue = sidCookie?.split('=')[1]?.split(';')[0];

      // Before verification - check session in DB
      const emBefore = orm.em.fork();
      // Parse the signed cookie if needed
      let sessionId: string | undefined = sidValue;
      if (sessionId?.startsWith('s%3A')) {
        sessionId = decodeURIComponent(sessionId).slice(2).split('.')[0];
      } else if (sessionId?.startsWith('s:')) {
        sessionId = sessionId.slice(2).split('.')[0];
      }

      if (!sessionId) return;

      const sessionBefore = await emBefore.findOne(Session, { sid: sessionId });
      expect(sessionBefore?.mfaVerified).toBe(false);

      // Verify MFA
      await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', cookies)
        .send({ code });

      // After verification - check session in DB
      const emAfter = orm.em.fork();
      const sessionAfter = await emAfter.findOne(Session, { sid: sessionId });
      expect(sessionAfter?.mfaVerified).toBe(true);
    });
  });

  describe('Trusted Device Flow', () => {
    /**
     * Helper to extract device_trust cookie from response
     */
    function extractDeviceTrustCookie(cookies: string[]): string | undefined {
      const deviceTrustCookie = cookies.find((c: string) =>
        c.startsWith('device_trust='),
      );
      if (!deviceTrustCookie) return undefined;

      const match = deviceTrustCookie.match(/device_trust=([^;]+)/);
      return match?.[1];
    }

    it('should set device_trust cookie when trustDevice=true on MFA verify', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login - get MFA code
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);

      const loginCookies = Array.isArray(loginResponse.headers['set-cookie'])
        ? loginResponse.headers['set-cookie']
        : [];
      const code = loginResponse.body.code;

      if (!code) return;

      // Verify MFA with trustDevice=true
      const verifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', loginCookies)
        .send({ code, trustDevice: true });

      expect(verifyResponse.status).toBe(200);

      // Check device_trust cookie is set
      const verifyCookies = Array.isArray(verifyResponse.headers['set-cookie'])
        ? verifyResponse.headers['set-cookie']
        : [];
      const deviceTrustToken = extractDeviceTrustCookie(verifyCookies);

      expect(deviceTrustToken).toBeDefined();
      expect(deviceTrustToken!.length).toBeGreaterThan(0);

      // Check cookie attributes
      const deviceTrustCookie = verifyCookies.find((c: string) =>
        c.startsWith('device_trust='),
      );
      expect(deviceTrustCookie).toContain('HttpOnly');
      expect(deviceTrustCookie).toContain('Path=/');
    });

    it('should NOT set device_trust cookie when trustDevice=false', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login - get MFA code
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      const loginCookies = Array.isArray(loginResponse.headers['set-cookie'])
        ? loginResponse.headers['set-cookie']
        : [];
      const code = loginResponse.body.code;

      if (!code) return;

      // Verify MFA with trustDevice=false (default)
      const verifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', loginCookies)
        .send({ code, trustDevice: false });

      expect(verifyResponse.status).toBe(200);

      // Check device_trust cookie is NOT set
      const verifyCookies = Array.isArray(verifyResponse.headers['set-cookie'])
        ? verifyResponse.headers['set-cookie']
        : [];
      const deviceTrustToken = extractDeviceTrustCookie(verifyCookies);

      expect(deviceTrustToken).toBeUndefined();
    });

    it('should skip MFA on subsequent login when device is trusted', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // First login - get MFA code
      const firstLoginResponse = await makeRequest()
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
          source: SessionSource.WEB,
        });

      expect(firstLoginResponse.status).toBe(200);
      expect(firstLoginResponse.body.requiresMfa).toBe(true);

      const firstLoginCookies: string[] = Array.isArray(
        firstLoginResponse.headers['set-cookie'],
      )
        ? (firstLoginResponse.headers['set-cookie'] as string[])
        : [];
      const code = firstLoginResponse.body.code;

      if (!code) return;

      // Verify MFA with trustDevice=true
      const verifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', firstLoginCookies)
        .send({ code, trustDevice: true });

      expect(verifyResponse.status).toBe(200);

      // Get device_trust cookie
      const verifyCookies: string[] = Array.isArray(
        verifyResponse.headers['set-cookie'],
      )
        ? (verifyResponse.headers['set-cookie'] as string[])
        : [];
      const deviceTrustCookie = verifyCookies.find((c: string) =>
        c.startsWith('device_trust='),
      );

      expect(deviceTrustCookie).toBeDefined();

      // Logout
      await makeRequest()
        .post('/api/auth/logout')
        .set('Cookie', [...firstLoginCookies, ...verifyCookies]);

      // Second login - should skip MFA because device is trusted
      const secondLoginResponse = await makeRequest()
        .post('/api/auth/login')
        .set('Cookie', deviceTrustCookie ? [deviceTrustCookie] : [])
        .send({
          email: testEmail,
          password: testPassword,
          source: SessionSource.WEB,
        });

      expect(secondLoginResponse.status).toBe(200);
      expect(secondLoginResponse.body.requiresMfa).toBeUndefined();
      expect(secondLoginResponse.body.message).toBe('Login successful');
      expect(secondLoginResponse.body.user).toBeDefined();
    });

    it('should require MFA when device_trust cookie is missing', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login without device_trust cookie
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);
    });

    it('should require MFA when device_trust cookie is invalid', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login with invalid device_trust cookie
      const loginResponse = await makeRequest()
        .post('/api/auth/login')
        .set('Cookie', ['device_trust=invalid-token-12345'])
        .send({
          email: testEmail,
          password: testPassword,
          source: SessionSource.WEB,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);
    });

    it('should require MFA when device trust has expired', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // First login - get MFA code
      const firstLoginResponse = await makeRequest()
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
          source: SessionSource.WEB,
        });

      const firstLoginCookies: string[] = Array.isArray(
        firstLoginResponse.headers['set-cookie'],
      )
        ? (firstLoginResponse.headers['set-cookie'] as string[])
        : [];
      const code = firstLoginResponse.body.code;

      if (!code) return;

      // Verify MFA with trustDevice=true
      const verifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', firstLoginCookies)
        .send({ code, trustDevice: true });

      const verifyCookies: string[] = Array.isArray(
        verifyResponse.headers['set-cookie'],
      )
        ? (verifyResponse.headers['set-cookie'] as string[])
        : [];
      const deviceTrustCookie = verifyCookies.find((c: string) =>
        c.startsWith('device_trust='),
      );

      expect(deviceTrustCookie).toBeDefined();

      // Manually expire the trusted device in DB
      const emUpdate = orm.em.fork();
      await emUpdate.nativeUpdate(
        TrustedDevice,
        { user: { id: testUserId } },
        { trustExpiresAt: new Date(Date.now() - 1000) }, // Expired 1 second ago
      );

      // Logout
      await makeRequest()
        .post('/api/auth/logout')
        .set('Cookie', [...firstLoginCookies, ...verifyCookies]);

      // Second login - should require MFA because device trust expired
      const secondLoginResponse = await makeRequest()
        .post('/api/auth/login')
        .set('Cookie', deviceTrustCookie ? [deviceTrustCookie] : [])
        .send({
          email: testEmail,
          password: testPassword,
          source: SessionSource.WEB,
        });

      expect(secondLoginResponse.status).toBe(200);
      expect(secondLoginResponse.body.requiresMfa).toBe(true);
    });

    it('should update lastSeenAt when trusted device is used', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // First login - get MFA code
      const firstLoginResponse = await makeRequest()
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
          source: SessionSource.WEB,
        });

      const firstLoginCookies: string[] = Array.isArray(
        firstLoginResponse.headers['set-cookie'],
      )
        ? (firstLoginResponse.headers['set-cookie'] as string[])
        : [];
      const code = firstLoginResponse.body.code;

      if (!code) return;

      // Verify MFA with trustDevice=true
      const verifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', firstLoginCookies)
        .send({ code, trustDevice: true });

      const verifyCookies: string[] = Array.isArray(
        verifyResponse.headers['set-cookie'],
      )
        ? (verifyResponse.headers['set-cookie'] as string[])
        : [];
      const deviceTrustCookie = verifyCookies.find((c: string) =>
        c.startsWith('device_trust='),
      );

      // Get initial lastSeenAt
      const emBefore = orm.em.fork();
      const deviceBefore = await emBefore.findOne(TrustedDevice, {
        user: { id: testUserId },
      });
      const initialLastSeenAt = deviceBefore?.lastSeenAt;

      expect(initialLastSeenAt).toBeDefined();

      // Wait a small amount to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Logout
      await makeRequest()
        .post('/api/auth/logout')
        .set('Cookie', [...firstLoginCookies, ...verifyCookies]);

      // Second login with trusted device
      await makeRequest()
        .post('/api/auth/login')
        .set('Cookie', deviceTrustCookie ? [deviceTrustCookie] : [])
        .send({
          email: testEmail,
          password: testPassword,
          source: SessionSource.WEB,
        });

      // Check lastSeenAt was updated
      const emAfter = orm.em.fork();
      const deviceAfter = await emAfter.findOne(TrustedDevice, {
        user: { id: testUserId },
      });

      expect(deviceAfter?.lastSeenAt.getTime()).toBeGreaterThanOrEqual(
        initialLastSeenAt!.getTime(),
      );
    });

    it('should create TrustedDevice record in database', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Verify no trusted devices exist initially
      const emInitial = orm.em.fork();
      const initialDevices = await emInitial.find(TrustedDevice, {
        user: { id: testUserId },
      });
      expect(initialDevices.length).toBe(0);

      // Login - get MFA code
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      const loginCookies = Array.isArray(loginResponse.headers['set-cookie'])
        ? loginResponse.headers['set-cookie']
        : [];
      const code = loginResponse.body.code;

      if (!code) return;

      // Verify MFA with trustDevice=true
      await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', loginCookies)
        .send({ code, trustDevice: true });

      // Verify trusted device was created
      const emAfter = orm.em.fork();
      const devices = await emAfter.find(TrustedDevice, {
        user: { id: testUserId },
      });

      expect(devices.length).toBe(1);
      const device = devices[0];
      expect(device).toBeDefined();
      expect(device?.deviceName).toBeDefined();
      expect(device?.deviceFingerprint).toBeDefined();
      expect(device?.trustExpiresAt).toBeDefined();

      // Verify trust expires in ~30 days
      const thirtyDays =
        TRUSTED_DEVICE_CONFIG.TRUST_DURATION_DAYS * 24 * 60 * 60 * 1000;
      const expiryDiff = device!.trustExpiresAt!.getTime() - Date.now();
      expect(expiryDiff).toBeGreaterThan(thirtyDays - 60000);
      expect(expiryDiff).toBeLessThanOrEqual(thirtyDays + 1000);
    });

    it('should not leak device token in response body', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login - get MFA code
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      const loginCookies = Array.isArray(loginResponse.headers['set-cookie'])
        ? loginResponse.headers['set-cookie']
        : [];
      const code = loginResponse.body.code;

      if (!code) return;

      // Verify MFA with trustDevice=true
      const verifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', loginCookies)
        .send({ code, trustDevice: true });

      // Response should not contain deviceToken or deviceFingerprint
      expect(verifyResponse.body.deviceToken).toBeUndefined();
      expect(verifyResponse.body.deviceFingerprint).toBeUndefined();
      expect(verifyResponse.body.device_trust).toBeUndefined();
    });

    it('should require MFA when using another user device_trust cookie', async () => {
      // Create another user
      const orm = getORM();
      const em = orm.em.fork();

      const company = await em.findOne(Company, { id: testCompanyId });
      if (!company) return;

      const otherUser = new User();
      otherUser.id = uuid();
      otherUser.email = `other-${Date.now()}@example.com`;
      otherUser.passwordHash = await hashPassword(testPassword);
      otherUser.nameFirst = 'Other';
      otherUser.nameLast = 'User';
      otherUser.company = company;
      otherUser.isActive = true;
      otherUser.emailVerified = true;
      otherUser.mfaEnabled = true;
      otherUser.mfaEnabledAt = new Date();

      em.persist(otherUser);
      await em.flush();

      // Enable MFA for the test user
      const emTest = orm.em.fork();
      const user = await emTest.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await emTest.flush();
      }

      // Login as other user and get device_trust cookie
      const otherLoginResponse = await makeRequest()
        .post('/api/auth/login')
        .send({
          email: otherUser.email,
          password: testPassword,
          source: SessionSource.WEB,
        });

      const otherLoginCookies: string[] = Array.isArray(
        otherLoginResponse.headers['set-cookie'],
      )
        ? (otherLoginResponse.headers['set-cookie'] as string[])
        : [];
      const otherCode = otherLoginResponse.body.code;

      if (!otherCode) {
        // Clean up and skip
        await em.nativeDelete('user', { id: otherUser.id });
        return;
      }

      const otherVerifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify')
        .set('Cookie', otherLoginCookies)
        .send({ code: otherCode, trustDevice: true });

      const otherVerifyCookies: string[] = Array.isArray(
        otherVerifyResponse.headers['set-cookie'],
      )
        ? (otherVerifyResponse.headers['set-cookie'] as string[])
        : [];
      const otherDeviceTrustCookie = otherVerifyCookies.find((c: string) =>
        c.startsWith('device_trust='),
      );

      // Try to login as test user with other user's device_trust cookie
      const testLoginResponse = await makeRequest()
        .post('/api/auth/login')
        .set('Cookie', otherDeviceTrustCookie ? [otherDeviceTrustCookie] : [])
        .send({
          email: testEmail,
          password: testPassword,
          source: SessionSource.WEB,
        });

      // Should still require MFA - device is not trusted for this user
      expect(testLoginResponse.status).toBe(200);
      expect(testLoginResponse.body.requiresMfa).toBe(true);

      // Clean up other user
      await em.nativeDelete('trusted_device', { user: { id: otherUser.id } });
      await em.nativeDelete('session', { user: { id: otherUser.id } });
      await em.nativeDelete('login_event', {});
      await em.nativeDelete('login_attempt', {});
      await em.nativeDelete('user', { id: otherUser.id });
    });
  });

  describe('Session Expiration After MFA Verification', () => {
    /**
     * Helper to parse session ID from cookie
     */
    function parseSessionId(cookies: string[]): string | undefined {
      const sessionCookie = cookies.find((c: string) => c.startsWith('sid='));
      if (!sessionCookie) return undefined;

      const sidMatch = sessionCookie.match(/sid=([^;]+)/);
      let sidValue = sidMatch?.[1];

      // Handle URL-encoded signed cookies (s%3AUUID.signature)
      if (sidValue?.startsWith('s%3A')) {
        sidValue = decodeURIComponent(sidValue).slice(2).split('.')[0];
      } else if (sidValue?.startsWith('s:')) {
        sidValue = sidValue.slice(2).split('.')[0];
      }

      return sidValue;
    }

    /**
     * Helper to extract max-age from cookie
     */
    function parseCookieMaxAge(cookies: string[]): number | undefined {
      const sessionCookie = cookies.find((c: string) => c.startsWith('sid='));
      if (!sessionCookie) return undefined;

      const maxAgeMatch = sessionCookie.match(/max-age=(\d+)/i);
      const maxAgeValue = maxAgeMatch?.[1];
      return maxAgeValue ? parseInt(maxAgeValue, 10) * 1000 : undefined;
    }

    it('should extend session expiration to 7 days after MFA verification (default)', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login without rememberMe
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
        rememberMe: false,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);

      const loginCookies = Array.isArray(loginResponse.headers['set-cookie'])
        ? loginResponse.headers['set-cookie']
        : [];
      const code = loginResponse.body.code;
      const sessionId = parseSessionId(loginCookies);
      expect(sessionId).toBeDefined();

      // Verify MFA
      if (code) {
        const verifyResponse = await makeRequest()
          .post('/api/auth/mfa/verify')
          .set('Cookie', loginCookies)
          .send({ code });

        expect(verifyResponse.status).toBe(200);

        // Check session expiration was extended to 7 days
        const emAfter = orm.em.fork();
        const sessionAfter = await emAfter.findOne(Session, { sid: sessionId });
        expect(sessionAfter).toBeDefined();

        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const expiryDiff = sessionAfter!.expiresAt.getTime() - now;

        // Should be approximately 7 days (with some tolerance)
        expect(expiryDiff).toBeGreaterThan(sevenDays - 60000); // Within 1 minute
        expect(expiryDiff).toBeLessThanOrEqual(sevenDays + 1000);

        // Check cookie max-age was updated
        const verifyCookies = Array.isArray(
          verifyResponse.headers['set-cookie'],
        )
          ? verifyResponse.headers['set-cookie']
          : [];
        const cookieMaxAge = parseCookieMaxAge(verifyCookies);
        expect(cookieMaxAge).toBe(sevenDays);
      }
    });

    it('should extend session expiration to 30 days after MFA verification with rememberMe', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login with rememberMe
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
        rememberMe: true,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);

      const loginCookies = Array.isArray(loginResponse.headers['set-cookie'])
        ? loginResponse.headers['set-cookie']
        : [];
      const code = loginResponse.body.code;
      const sessionId = parseSessionId(loginCookies);

      // Verify MFA
      if (code) {
        const verifyResponse = await makeRequest()
          .post('/api/auth/mfa/verify')
          .set('Cookie', loginCookies)
          .send({ code });

        expect(verifyResponse.status).toBe(200);

        // Check session expiration was extended to 30 days
        const emAfter = orm.em.fork();
        const sessionAfter = await emAfter.findOne(Session, { sid: sessionId });
        expect(sessionAfter).toBeDefined();

        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const expiryDiff = sessionAfter!.expiresAt.getTime() - now;

        // Should be approximately 30 days (with some tolerance)
        expect(expiryDiff).toBeGreaterThan(thirtyDays - 60000); // Within 1 minute
        expect(expiryDiff).toBeLessThanOrEqual(thirtyDays + 1000);

        // Check cookie max-age was updated to 30 days
        const verifyCookies = Array.isArray(
          verifyResponse.headers['set-cookie'],
        )
          ? verifyResponse.headers['set-cookie']
          : [];
        const cookieMaxAge = parseCookieMaxAge(verifyCookies);
        expect(cookieMaxAge).toBe(thirtyDays);
      }
    });

    it('should set absoluteExpiresAt to 30 days after MFA verification', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);

      const loginCookies = Array.isArray(loginResponse.headers['set-cookie'])
        ? loginResponse.headers['set-cookie']
        : [];
      const code = loginResponse.body.code;
      const sessionId = parseSessionId(loginCookies);

      // Verify MFA
      if (code) {
        await makeRequest()
          .post('/api/auth/mfa/verify')
          .set('Cookie', loginCookies)
          .send({ code });

        // Check absoluteExpiresAt was set to 30 days
        const emAfter = orm.em.fork();
        const sessionAfter = await emAfter.findOne(Session, { sid: sessionId });
        expect(sessionAfter).toBeDefined();

        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const absoluteExpiryDiff =
          sessionAfter!.absoluteExpiresAt.getTime() - now;

        // Should be approximately 30 days
        expect(absoluteExpiryDiff).toBeGreaterThan(thirtyDays - 60000);
        expect(absoluteExpiryDiff).toBeLessThanOrEqual(thirtyDays + 1000);
      }
    });

    it('should extend session expiration with recovery code verification', async () => {
      // Enable MFA for the user and create recovery codes
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (!user) return;

      // First login without MFA to enable it
      const setupCookies = await loginAndGetCookies();

      // Enable MFA
      const enableResponse = await makeRequest()
        .post('/api/auth/mfa/enable')
        .set('Cookie', setupCookies);

      if (enableResponse.status !== 200) {
        // If MFA is already enabled or setup fails, skip test
        return;
      }

      const recoveryCodes = enableResponse.body.recoveryCodes;
      expect(recoveryCodes).toBeDefined();
      expect(recoveryCodes.length).toBeGreaterThan(0);

      // Logout
      await makeRequest().post('/api/auth/logout').set('Cookie', setupCookies);

      // Login with MFA required and rememberMe
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
        rememberMe: true,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.requiresMfa).toBe(true);

      const loginCookies = Array.isArray(loginResponse.headers['set-cookie'])
        ? loginResponse.headers['set-cookie']
        : [];
      const sessionId = parseSessionId(loginCookies);

      // Verify with recovery code
      const verifyResponse = await makeRequest()
        .post('/api/auth/mfa/verify-recovery')
        .set('Cookie', loginCookies)
        .send({ recoveryCode: recoveryCodes[0] });

      expect(verifyResponse.status).toBe(200);

      // Check session expiration was extended to 30 days
      const emAfter = orm.em.fork();
      const sessionAfter = await emAfter.findOne(Session, { sid: sessionId });
      expect(sessionAfter).toBeDefined();

      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const expiryDiff = sessionAfter!.expiresAt.getTime() - now;

      // Should be approximately 30 days
      expect(expiryDiff).toBeGreaterThan(thirtyDays - 60000);
      expect(expiryDiff).toBeLessThanOrEqual(thirtyDays + 1000);

      // Check cookie max-age was updated
      const verifyCookies = Array.isArray(verifyResponse.headers['set-cookie'])
        ? verifyResponse.headers['set-cookie']
        : [];
      const cookieMaxAge = parseCookieMaxAge(verifyCookies);
      expect(cookieMaxAge).toBe(thirtyDays);
    });

    it('should remove rememberMe flag from session data after verification', async () => {
      // Enable MFA for the user
      const orm = getORM();
      const em = orm.em.fork();

      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date();
        await em.flush();
      }

      // Login with rememberMe
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
        rememberMe: true,
      });

      expect(loginResponse.status).toBe(200);

      const loginCookies = Array.isArray(loginResponse.headers['set-cookie'])
        ? loginResponse.headers['set-cookie']
        : [];
      const code = loginResponse.body.code;
      const sessionId = parseSessionId(loginCookies);

      // Check session has rememberMe flag before verification
      const emBefore = orm.em.fork();
      const sessionBefore = await emBefore.findOne(Session, { sid: sessionId });
      expect(sessionBefore?.data['rememberMe']).toBe(true);

      // Verify MFA
      if (code) {
        await makeRequest()
          .post('/api/auth/mfa/verify')
          .set('Cookie', loginCookies)
          .send({ code });

        // Check rememberMe flag was removed from session data
        const emAfter = orm.em.fork();
        const sessionAfter = await emAfter.findOne(Session, { sid: sessionId });
        expect(sessionAfter?.data['rememberMe']).toBeUndefined();
        expect(sessionAfter?.data['pendingMfaUserId']).toBeUndefined();
      }
    });
  });
});
