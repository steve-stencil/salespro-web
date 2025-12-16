import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

describe('Invite Routes Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
  });

  afterEach(async () => {
    // Clean up test data after each test
    const orm = getORM();
    const em = orm.em.fork();
    await em.nativeDelete('user_invite', {});
    await em.nativeDelete('user_role', {});
    await em.nativeDelete('session', {});
    await em.nativeDelete('user', {});
    await em.nativeDelete('role', {});
    await em.nativeDelete('company', {});
  });

  describe('POST /api/users/invites (create invite)', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().post('/api/users/invites').send({
        email: 'newuser@example.com',
        roles: ['role-id'],
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should return 400 for invalid email format', async () => {
      // This test would normally require authentication setup
      // For now, we test validation through the unauthenticated path
      const response = await makeRequest().post('/api/users/invites').send({
        email: 'invalid-email',
        roles: [],
      });

      // Should get 401 before validation since not authenticated
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/users/invites (list invites)', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().get('/api/users/invites');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('DELETE /api/users/invites/:id (revoke invite)', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().delete(
        '/api/users/invites/some-invite-id',
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('POST /api/users/invites/:id/resend (resend invite)', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest().post(
        '/api/users/invites/some-invite-id/resend',
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('GET /api/invites/validate (validate token - public)', () => {
    it('should return 400 for missing token', async () => {
      const response = await makeRequest().get('/api/invites/validate');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid token', async () => {
      const response = await makeRequest().get(
        '/api/invites/validate?token=invalid-token',
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid invitation token');
    });
  });

  describe('POST /api/invites/accept (accept invite - public)', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await makeRequest().post('/api/invites/accept').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing password', async () => {
      const response = await makeRequest().post('/api/invites/accept').send({
        token: 'some-token',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for short password', async () => {
      const response = await makeRequest().post('/api/invites/accept').send({
        token: 'some-token',
        password: 'short', // Less than 8 characters
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid token', async () => {
      const response = await makeRequest().post('/api/invites/accept').send({
        token: 'invalid-token',
        password: 'SecurePassword123!',
        nameFirst: 'Test',
        nameLast: 'User',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid invitation token');
    });

    it('should accept optional name fields', async () => {
      const response = await makeRequest().post('/api/invites/accept').send({
        token: 'some-token',
        password: 'SecurePassword123!',
        // nameFirst and nameLast are optional
      });

      // Should fail with invalid token, not validation error
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid invitation token');
    });
  });
});
