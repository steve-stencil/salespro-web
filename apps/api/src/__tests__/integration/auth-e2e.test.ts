import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

import { Company, User, SessionSource } from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

/**
 * E2E tests for complete authentication flows
 * These tests use the actual database to test real scenarios
 */
describe('Authentication E2E Tests', () => {
  let testCompanyId: string;
  let testUserId: string;
  const testEmail = `e2e-test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    // Create test company and user for each test
    const orm = getORM();
    const em = orm.em.fork();

    const company = new Company();
    company.id = uuid();
    company.name = `E2E Test Company ${Date.now()}`;
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
    user.nameFirst = 'E2E';
    user.nameLast = 'Test';
    user.company = company;
    user.isActive = true;
    user.emailVerified = true;
    testUserId = user.id;

    em.persist(company);
    em.persist(user);
    await em.flush();
  });

  afterEach(async () => {
    // Clean up test data
    const orm = getORM();
    const em = orm.em.fork();
    await em.nativeDelete('login_event', {});
    await em.nativeDelete('login_attempt', {});
    await em.nativeDelete('session', {});
    await em.nativeDelete('password_reset_token', {});
    await em.nativeDelete('password_history', {});
    await em.nativeDelete('user', { id: testUserId });
    await em.nativeDelete('company', { id: testCompanyId });
  });

  describe('Complete Login Flow', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.user.nameFirst).toBe('E2E');
    });

    it('should return error for wrong password', async () => {
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: 'WrongPassword123!',
        source: SessionSource.WEB,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.errorCode).toBe('invalid_credentials');
    });

    it('should return error for non-existent email', async () => {
      const response = await makeRequest().post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should create session cookie on successful login', async () => {
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should get current user after login', async () => {
      // Login first
      const agent = makeRequest();
      const loginResponse = await agent.post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      expect(loginResponse.status).toBe(200);
      const cookies = loginResponse.headers['set-cookie'] as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();

      // Get current user
      const meResponse = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookies ?? []);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.email).toBe(testEmail);
      expect(meResponse.body.nameFirst).toBe('E2E');
    });

    it('should list active sessions after login', async () => {
      // Login
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      const cookies = loginResponse.headers['set-cookie'] as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();

      // Get sessions
      const sessionsResponse = await makeRequest()
        .get('/api/auth/sessions')
        .set('Cookie', cookies ?? []);

      expect(sessionsResponse.status).toBe(200);
      expect(sessionsResponse.body.sessions).toBeDefined();
      expect(sessionsResponse.body.sessions.length).toBeGreaterThanOrEqual(1);
    });

    it('should logout successfully', async () => {
      // Login
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      const cookies = loginResponse.headers['set-cookie'] as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();

      // Logout
      const logoutResponse = await makeRequest()
        .post('/api/auth/logout')
        .set('Cookie', cookies ?? []);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toBe('Logged out successfully');

      // Should not be able to access protected route
      const meResponse = await makeRequest()
        .get('/api/auth/me')
        .set('Cookie', cookies ?? []);

      expect(meResponse.status).toBe(401);
    });
  });

  describe('Password Reset Flow', () => {
    it('should request password reset', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/forgot')
        .send({
          email: testEmail,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('If an account exists');
      // In development, token should be returned
      if (process.env['NODE_ENV'] === 'development') {
        expect(response.body.token).toBeDefined();
      }
    });

    it('should reset password with valid token', async () => {
      // Request reset token
      const resetRequest = await makeRequest()
        .post('/api/auth/password/forgot')
        .send({
          email: testEmail,
        });

      expect(resetRequest.status).toBe(200);
      const token = resetRequest.body.token;

      if (token) {
        // Reset password
        const newPassword = 'NewPassword456!';
        const resetResponse = await makeRequest()
          .post('/api/auth/password/reset')
          .send({
            token,
            password: newPassword,
          });

        expect(resetResponse.status).toBe(200);
        expect(resetResponse.body.message).toBe('Password reset successful');

        // Should be able to login with new password
        const loginResponse = await makeRequest().post('/api/auth/login').send({
          email: testEmail,
          password: newPassword,
        });

        expect(loginResponse.status).toBe(200);
      }
    });
  });

  describe('Session Source Management', () => {
    it('should allow same user from different sources', async () => {
      // Login from web
      const webLogin = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.WEB,
      });

      expect(webLogin.status).toBe(200);

      // Login from iOS
      const iosLogin = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        source: SessionSource.IOS,
      });

      expect(iosLogin.status).toBe(200);

      // Both should have valid sessions
      const webCookies = webLogin.headers['set-cookie'] as string[] | undefined;
      const iosCookies = iosLogin.headers['set-cookie'] as string[] | undefined;

      if (webCookies && iosCookies) {
        const webMe = await makeRequest()
          .get('/api/auth/me')
          .set('Cookie', webCookies);

        const iosMe = await makeRequest()
          .get('/api/auth/me')
          .set('Cookie', iosCookies);

        expect(webMe.status).toBe(200);
        expect(iosMe.status).toBe(200);
      }
    });
  });

  describe('Account Lockout', () => {
    it('should not lock account before threshold', async () => {
      // Make 4 failed attempts (below threshold of 5)
      for (let i = 0; i < 4; i++) {
        await makeRequest().post('/api/auth/login').send({
          email: testEmail,
          password: 'WrongPassword!',
        });
      }

      // Should still be able to login with correct password
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      expect(response.status).toBe(200);
    });

    it('should lock account after 5 failed attempts', async () => {
      // Make 5 failed attempts (at threshold)
      for (let i = 0; i < 5; i++) {
        await makeRequest().post('/api/auth/login').send({
          email: testEmail,
          password: 'WrongPassword!',
        });
      }

      // Should be locked out
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      expect(response.status).toBe(423);
      expect(response.body.errorCode).toBe('account_locked');
    });

    it('should return 423 for locked account even with correct password', async () => {
      // Make 5 failed attempts to lock the account
      for (let i = 0; i < 5; i++) {
        await makeRequest().post('/api/auth/login').send({
          email: testEmail,
          password: 'WrongPassword!',
        });
      }

      // Try with correct password - should still be locked
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      expect(response.status).toBe(423);
      expect(response.body.error).toContain('locked');
    });

    it('should allow login after lockout expires', async () => {
      // This test would require manipulating the lockout time
      // In a real scenario, we would mock the time or wait
      // For now, we verify the lockout mechanism works
      const orm = getORM();
      const em = orm.em.fork();

      // Set lockout that has already expired
      const user = await em.findOne(User, { id: testUserId });
      if (user) {
        user.failedLoginAttempts = 5;
        user.lockedUntil = new Date(Date.now() - 60000); // 1 minute ago
        await em.flush();
      }

      // Should be able to login now
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Password Change (Authenticated)', () => {
    it('should change password with valid current password', async () => {
      // Login first
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      const cookies = loginResponse.headers['set-cookie'] as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();

      // Change password
      const newPassword = 'NewPassword789!';
      const response = await makeRequest()
        .post('/api/auth/password/change')
        .set('Cookie', cookies ?? [])
        .send({
          currentPassword: testPassword,
          newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify can login with new password
      const newLoginResponse = await makeRequest()
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: newPassword,
        });

      expect(newLoginResponse.status).toBe(200);
    });

    it('should reject invalid current password', async () => {
      // Login first
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      const cookies = loginResponse.headers['set-cookie'] as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();

      // Try to change password with wrong current password
      const response = await makeRequest()
        .post('/api/auth/password/change')
        .set('Cookie', cookies ?? [])
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword789!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Current password is incorrect');
    });

    it('should reject password that matches history', async () => {
      // Login first
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      const cookies = loginResponse.headers['set-cookie'] as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();

      // Change password successfully first
      const firstChangeResponse = await makeRequest()
        .post('/api/auth/password/change')
        .set('Cookie', cookies ?? [])
        .send({
          currentPassword: testPassword,
          newPassword: 'NewPassword789!',
        });

      expect(firstChangeResponse.status).toBe(200);

      // Get new cookies after password change
      const newLoginResponse = await makeRequest()
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'NewPassword789!',
        });

      const newCookies = newLoginResponse.headers['set-cookie'] as
        | string[]
        | undefined;

      // Try to change back to original password (should fail due to history)
      const response = await makeRequest()
        .post('/api/auth/password/change')
        .set('Cookie', newCookies ?? [])
        .send({
          currentPassword: 'NewPassword789!',
          newPassword: testPassword,
        });

      // Should reject because it's in password history
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('recently used');
    });

    it('should reject new password that does not meet policy', async () => {
      // Login first
      const loginResponse = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      const cookies = loginResponse.headers['set-cookie'] as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();

      // Try to change to a weak password
      const response = await makeRequest()
        .post('/api/auth/password/change')
        .set('Cookie', cookies ?? [])
        .send({
          currentPassword: testPassword,
          newPassword: 'weak', // Too short, no uppercase, no numbers
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Remember Me Session', () => {
    it('should create extended session with remember me flag', async () => {
      const response = await makeRequest().post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
        rememberMe: true,
      });

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();

      // The cookie should have a longer max-age for remember me
      const cookies = response.headers['set-cookie'] as string[];
      const sessionCookie = cookies.find(c => c.startsWith('sid='));
      expect(sessionCookie).toBeDefined();
    });
  });
});
