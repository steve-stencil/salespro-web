import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { getORM } from '../../lib/db';

import {
  makeRequest,
  waitForDatabase,
  createCompanySetup,
  createTestOffice,
  createTestRole,
} from './helpers';

describe('Invite Routes Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
  });

  afterEach(async () => {
    // Clean up test data after each test
    const orm = getORM();
    const em = orm.em.fork();
    await em.nativeDelete('user_invite', {});
    await em.nativeDelete('user_office', {});
    await em.nativeDelete('user_role', {});
    await em.nativeDelete('session', {});
    await em.nativeDelete('office', {});
    await em.nativeDelete('user', {});
    await em.nativeDelete('role', {});
    await em.nativeDelete('company', {});
  });

  describe('POST /api/users/invites (create invite)', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest()
        .post('/api/users/invites')
        .send({
          email: 'newuser@example.com',
          roles: ['role-id'],
          currentOfficeId: 'office-id',
          allowedOfficeIds: ['office-id'],
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should return 400 when currentOfficeId is missing', async () => {
      const { adminCookie, company } = await createCompanySetup({
        createOffice: true,
      });
      const orm = getORM();
      const em = orm.em.fork();
      const role = await createTestRole(em, company, ['user:read']);

      const response = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: 'newuser@example.com',
          roles: [role.id],
          allowedOfficeIds: ['some-office-id'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 when allowedOfficeIds is missing', async () => {
      const { adminCookie, company } = await createCompanySetup({
        createOffice: true,
      });
      const orm = getORM();
      const em = orm.em.fork();
      const role = await createTestRole(em, company, ['user:read']);

      const response = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: 'newuser@example.com',
          roles: [role.id],
          currentOfficeId: 'some-office-id',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 when allowedOfficeIds is empty', async () => {
      const { adminCookie, company } = await createCompanySetup({
        createOffice: true,
      });
      const orm = getORM();
      const em = orm.em.fork();
      const role = await createTestRole(em, company, ['user:read']);

      const response = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: 'newuser@example.com',
          roles: [role.id],
          currentOfficeId: 'some-office-id',
          allowedOfficeIds: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 when currentOfficeId is not in allowedOfficeIds', async () => {
      const { adminCookie, company } = await createCompanySetup({
        createOffice: true,
      });
      const orm = getORM();
      const em = orm.em.fork();
      const office1 = await createTestOffice(em, company, 'Office 1');
      const office2 = await createTestOffice(em, company, 'Office 2');
      const role = await createTestRole(em, company, ['user:read']);

      const response = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: 'newuser@example.com',
          roles: [role.id],
          currentOfficeId: office1.id,
          allowedOfficeIds: [office2.id], // office1 not in this list
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 when roles is empty', async () => {
      const { adminCookie, office } = await createCompanySetup({
        createOffice: true,
      });

      const response = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: 'newuser@example.com',
          roles: [],
          currentOfficeId: office!.id,
          allowedOfficeIds: [office!.id],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should create invite successfully with valid data', async () => {
      const { adminCookie, company, office } = await createCompanySetup({
        createOffice: true,
      });
      const orm = getORM();
      const em = orm.em.fork();
      const role = await createTestRole(em, company, ['user:read']);

      const response = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: 'newuser@example.com',
          roles: [role.id],
          currentOfficeId: office!.id,
          allowedOfficeIds: [office!.id],
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Invitation sent successfully');
      expect(response.body.invite).toBeDefined();
      expect(response.body.invite.email).toBe('newuser@example.com');
    });

    it('should create invite with multiple allowed offices', async () => {
      const { adminCookie, company } = await createCompanySetup();
      const orm = getORM();
      const em = orm.em.fork();
      const office1 = await createTestOffice(em, company, 'Office 1');
      const office2 = await createTestOffice(em, company, 'Office 2');
      const role = await createTestRole(em, company, ['user:read']);

      const response = await makeRequest()
        .post('/api/users/invites')
        .set('Cookie', adminCookie)
        .send({
          email: 'newuser@example.com',
          roles: [role.id],
          currentOfficeId: office1.id,
          allowedOfficeIds: [office1.id, office2.id],
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Invitation sent successfully');
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
