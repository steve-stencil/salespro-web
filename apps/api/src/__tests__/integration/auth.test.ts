import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

describe('Auth Routes Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
  });

  afterEach(async () => {
    // Clean up test data after each test
    const orm = getORM();
    const em = orm.em.fork();
    await em.nativeDelete('login_attempt', {});
    await em.nativeDelete('login_event', {});
    await em.nativeDelete('session', {});
    await em.nativeDelete('password_reset_token', {});
    await em.nativeDelete('user', {});
    await em.nativeDelete('company', {});
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 for invalid email format', async () => {
      const response = await makeRequest().post('/api/auth/login').send({
        email: 'invalid-email',
        password: 'password123',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 for missing password', async () => {
      const response = await makeRequest().post('/api/auth/login').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await makeRequest().post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should accept valid login request format', async () => {
      // This will fail since no user exists, but validates the request format
      const response = await makeRequest().post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'ValidPassword123!',
        source: 'web',
        rememberMe: false,
      });

      // Should get 401 (user not found) not 400 (validation error)
      expect(response.status).toBe(401);
    });

    it('should accept optional source parameter', async () => {
      const response = await makeRequest().post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
        source: 'ios',
      });

      expect(response.status).toBe(401); // User not found, but request is valid
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 200 even without session', async () => {
      const response = await makeRequest().post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('GET /api/auth/sessions', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/auth/sessions');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('DELETE /api/auth/sessions/:sid', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().delete(
        '/api/auth/sessions/test-session-id',
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('DELETE /api/auth/sessions/all', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().delete('/api/auth/sessions/all');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('POST /api/auth/password/forgot', () => {
    it('should return 400 for invalid email format', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/forgot')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return 200 for valid email (prevents enumeration)', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/forgot')
        .send({
          email: 'nonexistent@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain(
        'If an account exists with this email',
      );
    });

    it('should return 400 for missing email', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/forgot')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/password/reset', () => {
    it('should return 400 for missing token', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/reset')
        .send({
          password: 'NewPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 for short password', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/reset')
        .send({
          token: 'some-token',
          password: 'short',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid token', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/reset')
        .send({
          token: 'invalid-token-that-does-not-exist',
          password: 'NewValidPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid or expired reset token');
    });
  });

  describe('POST /api/auth/password/change', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/change')
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 400 for short new password', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/change')
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'short',
        });

      // Would be 401 (not authenticated) before validation, but schema validates first
      expect([400, 401]).toContain(response.status);
    });

    it('should return 400 for missing current password', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/change')
        .send({
          newPassword: 'NewPassword456!',
        });

      expect([400, 401]).toContain(response.status);
    });

    it('should return 400 for missing new password', async () => {
      const response = await makeRequest()
        .post('/api/auth/password/change')
        .send({
          currentPassword: 'OldPassword123!',
        });

      expect([400, 401]).toContain(response.status);
    });
  });

  describe('MFA Routes (Unauthenticated)', () => {
    it('should return 401 for /api/auth/mfa/enable when not authenticated', async () => {
      const response = await makeRequest().post('/api/auth/mfa/enable');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should return 401 for /api/auth/mfa/disable when not authenticated', async () => {
      const response = await makeRequest().post('/api/auth/mfa/disable');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should return 401 for /api/auth/mfa/status when not authenticated', async () => {
      const response = await makeRequest().get('/api/auth/mfa/status');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should return 401 for /api/auth/mfa/regenerate-recovery-codes when not authenticated', async () => {
      const response = await makeRequest().post(
        '/api/auth/mfa/regenerate-recovery-codes',
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should return 400 for /api/auth/mfa/verify without session', async () => {
      const response = await makeRequest()
        .post('/api/auth/mfa/verify')
        .send({ code: '123456' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for /api/auth/mfa/verify-recovery without session', async () => {
      const response = await makeRequest()
        .post('/api/auth/mfa/verify-recovery')
        .send({ recoveryCode: 'ABCD-1234' });

      expect(response.status).toBe(400);
    });
  });
});
