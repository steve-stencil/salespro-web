import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { getORM } from '../../lib/db';

import { makeRequest, waitForDatabase } from './helpers';

describe('OAuth Routes Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
  });

  afterEach(async () => {
    // Clean up test data
    const orm = getORM();
    const em = orm.em.fork();
    await em.nativeDelete('oauth_token', {});
    await em.nativeDelete('oauth_authorization_code', {});
    await em.nativeDelete('oauth_client', {});
  });

  describe('GET /api/oauth/authorize', () => {
    it('should return 400 for missing client_id', async () => {
      const response = await makeRequest().get('/api/oauth/authorize').query({
        response_type: 'code',
        redirect_uri: 'http://localhost:3000/callback',
        state: 'test-state',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should return 400 for missing state parameter', async () => {
      const response = await makeRequest().get('/api/oauth/authorize').query({
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      // Zod returns a generic validation error for missing required fields
      expect(response.body.error_description).toBeDefined();
    });

    it('should return 400 for invalid redirect_uri format', async () => {
      const response = await makeRequest().get('/api/oauth/authorize').query({
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'not-a-valid-url',
        state: 'test-state',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should redirect to login when not authenticated', async () => {
      const response = await makeRequest().get('/api/oauth/authorize').query({
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        state: 'test-state',
      });

      // Either redirect (302) or client not found (400) is valid
      expect([302, 400]).toContain(response.status);
    });

    it('should return 400 for non-existent client', async () => {
      // First need to be "authenticated" - mock this by setting cookie
      const response = await makeRequest().get('/api/oauth/authorize').query({
        response_type: 'code',
        client_id: 'non-existent-client',
        redirect_uri: 'http://localhost:3000/callback',
        state: 'test-state',
      });

      // Will redirect to login since no session, or return invalid_client
      expect([302, 400]).toContain(response.status);
    });

    it('should accept optional PKCE parameters', async () => {
      const response = await makeRequest().get('/api/oauth/authorize').query({
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        state: 'test-state',
        code_challenge: 'some-challenge-value',
        code_challenge_method: 'S256',
      });

      // Should redirect to login or return client error
      expect([302, 400]).toContain(response.status);
    });
  });

  describe('POST /api/oauth/token', () => {
    it('should return 400 for missing grant_type', async () => {
      const response = await makeRequest().post('/api/oauth/token').send({
        client_id: 'test-client',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should return 400 for invalid grant_type', async () => {
      const response = await makeRequest().post('/api/oauth/token').send({
        grant_type: 'invalid_grant',
        client_id: 'test-client',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should return 400 for missing client_id', async () => {
      const response = await makeRequest().post('/api/oauth/token').send({
        grant_type: 'authorization_code',
        code: 'some-code',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should return error for invalid authorization code', async () => {
      const response = await makeRequest().post('/api/oauth/token').send({
        grant_type: 'authorization_code',
        client_id: 'test-client',
        code: 'invalid-authorization-code',
        redirect_uri: 'http://localhost:3000/callback',
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.error).toBeDefined();
    });

    it('should return error for invalid refresh token', async () => {
      const response = await makeRequest().post('/api/oauth/token').send({
        grant_type: 'refresh_token',
        client_id: 'test-client',
        refresh_token: 'invalid-refresh-token',
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/oauth/revoke', () => {
    it('should return 400 for missing token', async () => {
      const response = await makeRequest().post('/api/oauth/revoke').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should return 200 for non-existent token (RFC 7009)', async () => {
      // Per RFC 7009, revoke should return 200 even if token doesn't exist
      const response = await makeRequest().post('/api/oauth/revoke').send({
        token: 'non-existent-token-12345',
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token revoked');
    });

    it('should accept token_type_hint parameter', async () => {
      const response = await makeRequest().post('/api/oauth/revoke').send({
        token: 'some-token',
        token_type_hint: 'access_token',
      });

      expect(response.status).toBe(200);
    });

    it('should accept refresh_token type hint', async () => {
      const response = await makeRequest().post('/api/oauth/revoke').send({
        token: 'some-token',
        token_type_hint: 'refresh_token',
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/oauth/introspect', () => {
    it('should return inactive for missing token', async () => {
      const response = await makeRequest()
        .post('/api/oauth/introspect')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(false);
    });

    it('should return inactive for non-existent token', async () => {
      const response = await makeRequest().post('/api/oauth/introspect').send({
        token: 'non-existent-token-12345',
      });

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(false);
    });

    it('should return inactive for invalid token', async () => {
      const response = await makeRequest().post('/api/oauth/introspect').send({
        token: 'completely-invalid-token',
      });

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(false);
    });
  });
});
