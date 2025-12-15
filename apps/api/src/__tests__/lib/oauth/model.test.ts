import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock crypto module
vi.mock('../../../lib/crypto', () => ({
  generateSecureToken: vi.fn().mockReturnValue('mock-token-12345'),
  hashToken: vi.fn().mockReturnValue('hashed-token'),
  verifyPassword: vi.fn(),
  getTokenPrefix: vi.fn().mockReturnValue('mock-'),
}));

import { OAuthClientType } from '../../../entities';
import {
  hashToken,
  verifyPassword,
  generateSecureToken,
} from '../../../lib/crypto';
import { OAuthModel } from '../../../lib/oauth/model';

import type { EntityManager } from '@mikro-orm/core';
import type OAuth2Server from 'oauth2-server';

/**
 * Create a mock EntityManager
 */
function createMockEm() {
  const forkedEm = {
    findOne: vi.fn(),
    find: vi.fn(),
    count: vi.fn(),
    persist: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    nativeDelete: vi.fn().mockResolvedValue(0),
    nativeUpdate: vi.fn().mockResolvedValue(0),
  };

  return {
    fork: vi.fn().mockReturnValue(forkedEm),
    forkedEm,
  };
}

/**
 * Create mock OAuth client
 */
function createMockOAuthClient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'client-123',
    clientId: 'test-client-id',
    clientSecretHash: 'hashed-secret',
    clientType: OAuthClientType.CONFIDENTIAL,
    name: 'Test Client',
    redirectUris: ['http://localhost:3000/callback'],
    grants: ['authorization_code', 'refresh_token'],
    allowedScopes: [
      'read:profile',
      'write:profile',
      'read:data',
      'offline_access',
    ],
    isActive: true,
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 86400 * 14,
    ...overrides,
  };
}

/**
 * Create mock user
 */
function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    isActive: true,
    ...overrides,
  };
}

/**
 * Create mock authorization code
 */
function createMockAuthCode(overrides: Record<string, unknown> = {}) {
  const client = createMockOAuthClient();
  const user = createMockUser();

  return {
    id: 'code-123',
    codeHash: 'hashed-code',
    expiresAt: new Date(Date.now() + 60000),
    redirectUri: 'http://localhost:3000/callback',
    scope: ['read:profile', 'read:data'],
    client,
    user,
    usedAt: null,
    codeChallenge: undefined,
    codeChallengeMethod: undefined,
    ...overrides,
  };
}

/**
 * Create mock OAuth token
 */
function createMockToken(overrides: Record<string, unknown> = {}) {
  const client = createMockOAuthClient();
  const user = createMockUser();

  return {
    id: 'token-123',
    accessTokenHash: 'hashed-access-token',
    accessTokenExpiresAt: new Date(Date.now() + 3600000),
    refreshTokenHash: 'hashed-refresh-token',
    refreshTokenExpiresAt: new Date(Date.now() + 86400000 * 14),
    refreshTokenFamily: 'family-123',
    scope: ['read:profile', 'read:data'],
    client,
    user,
    revokedAt: null,
    revokedReason: null,
    replacedByTokenId: null,
    ...overrides,
  };
}

describe('OAuthModel', () => {
  let model: OAuthModel;
  let mockEm: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm = createMockEm();
    model = new OAuthModel(mockEm as unknown as EntityManager);
  });

  describe('getClient', () => {
    it('should return false when client not found', async () => {
      mockEm.forkedEm.findOne.mockResolvedValue(null);

      const result = await model.getClient('test-client-id', 'secret');

      expect(result).toBe(false);
    });

    it('should return false when client is inactive', async () => {
      mockEm.forkedEm.findOne.mockResolvedValue(null); // findOne with isActive: true returns null

      const result = await model.getClient('test-client-id', 'secret');

      expect(result).toBe(false);
    });

    it('should return false when confidential client has no secret provided', async () => {
      const client = createMockOAuthClient();
      mockEm.forkedEm.findOne.mockResolvedValue(client);

      const result = await model.getClient('test-client-id', null);

      expect(result).toBe(false);
    });

    it('should return false when confidential client secret is wrong', async () => {
      const client = createMockOAuthClient({
        clientSecretHash: 'different-hash',
      });
      mockEm.forkedEm.findOne.mockResolvedValue(client);
      vi.mocked(hashToken).mockReturnValue('hashed-wrong-secret');

      const result = await model.getClient('test-client-id', 'wrong-secret');

      expect(result).toBe(false);
    });

    it('should return client when credentials are valid', async () => {
      const client = createMockOAuthClient({
        clientSecretHash: 'correct-hash',
      });
      mockEm.forkedEm.findOne.mockResolvedValue(client);
      vi.mocked(hashToken).mockReturnValue('correct-hash');

      const result = await model.getClient('test-client-id', 'correct-secret');

      expect(result).toMatchObject({
        id: 'client-123',
        grants: ['authorization_code', 'refresh_token'],
        redirectUris: ['http://localhost:3000/callback'],
      });
    });

    it('should skip secret check for public clients', async () => {
      const client = createMockOAuthClient({
        clientType: OAuthClientType.PUBLIC,
      });
      mockEm.forkedEm.findOne.mockResolvedValue(client);

      const result = await model.getClient('test-client-id', null);

      expect(result).toMatchObject({
        id: 'client-123',
      });
    });
  });

  describe('getUser', () => {
    it('should return false when user not found', async () => {
      mockEm.forkedEm.findOne.mockResolvedValue(null);

      const result = await model.getUser('test@example.com', 'password');

      expect(result).toBe(false);
    });

    it('should return false when password is invalid', async () => {
      const user = createMockUser();
      mockEm.forkedEm.findOne.mockResolvedValue(user);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      const result = await model.getUser('test@example.com', 'wrong-password');

      expect(result).toBe(false);
    });

    it('should return user when credentials are valid', async () => {
      const user = createMockUser();
      mockEm.forkedEm.findOne.mockResolvedValue(user);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await model.getUser(
        'test@example.com',
        'correct-password',
      );

      expect(result).toEqual({ id: 'user-123' });
    });

    it('should normalize email to lowercase', async () => {
      mockEm.forkedEm.findOne.mockResolvedValue(null);

      await model.getUser('TEST@EXAMPLE.COM', 'password');

      expect(mockEm.forkedEm.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ email: 'test@example.com' }),
      );
    });
  });

  describe('generateAuthorizationCode', () => {
    it('should generate a secure token', async () => {
      const client = { id: 'client-123', grants: [] } as OAuth2Server.Client;
      const user = { id: 'user-123' } as OAuth2Server.User;

      const code = await model.generateAuthorizationCode(client, user, [
        'openid',
      ]);

      expect(code).toBe('mock-token-12345');
      expect(generateSecureToken).toHaveBeenCalledWith(32);
    });
  });

  describe('saveAuthorizationCode', () => {
    it('should return false when client not found', async () => {
      mockEm.forkedEm.findOne.mockResolvedValueOnce(null);

      const result = await model.saveAuthorizationCode(
        {
          authorizationCode: 'code-123',
          expiresAt: new Date(),
          redirectUri: 'http://localhost:3000/callback',
          scope: ['openid'],
        },
        { id: 'client-123', grants: [] },
        { id: 'user-123' },
      );

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      const client = createMockOAuthClient();
      mockEm.forkedEm.findOne
        .mockResolvedValueOnce(client)
        .mockResolvedValueOnce(null);

      const result = await model.saveAuthorizationCode(
        {
          authorizationCode: 'code-123',
          expiresAt: new Date(),
          redirectUri: 'http://localhost:3000/callback',
          scope: ['openid'],
        },
        { id: 'client-123', grants: [] },
        { id: 'user-123' },
      );

      expect(result).toBe(false);
    });

    it('should save authorization code with PKCE', async () => {
      const client = createMockOAuthClient();
      const user = createMockUser();
      mockEm.forkedEm.findOne
        .mockResolvedValueOnce(client)
        .mockResolvedValueOnce(user);

      const result = await model.saveAuthorizationCode(
        {
          authorizationCode: 'code-123',
          expiresAt: new Date(Date.now() + 60000),
          redirectUri: 'http://localhost:3000/callback',
          scope: ['read:profile'],
          codeChallenge: 'challenge-123',
          codeChallengeMethod: 'S256',
        },
        { id: 'client-123', grants: ['authorization_code'] },
        { id: 'user-123' },
      );

      expect(result).toMatchObject({
        authorizationCode: 'code-123',
        redirectUri: 'http://localhost:3000/callback',
      });
      expect(mockEm.forkedEm.persist).toHaveBeenCalled();
      expect(mockEm.forkedEm.flush).toHaveBeenCalled();
    });
  });

  describe('getAuthorizationCode', () => {
    it('should return false when code not found', async () => {
      mockEm.forkedEm.findOne.mockResolvedValue(null);

      const result = await model.getAuthorizationCode('invalid-code');

      expect(result).toBe(false);
    });

    it('should return false when code is expired', async () => {
      const authCode = createMockAuthCode({
        expiresAt: new Date(Date.now() - 1000),
      });
      mockEm.forkedEm.findOne.mockResolvedValue(authCode);

      const result = await model.getAuthorizationCode('expired-code');

      expect(result).toBe(false);
    });

    it('should return authorization code when valid', async () => {
      const authCode = createMockAuthCode();
      mockEm.forkedEm.findOne.mockResolvedValue(authCode);

      const result = await model.getAuthorizationCode('valid-code');

      expect(result).toMatchObject({
        authorizationCode: 'valid-code',
        redirectUri: 'http://localhost:3000/callback',
        scope: ['read:profile', 'read:data'],
      });
    });

    it('should include PKCE fields when present', async () => {
      const authCode = createMockAuthCode({
        codeChallenge: 'challenge-123',
        codeChallengeMethod: 'S256',
      });
      mockEm.forkedEm.findOne.mockResolvedValue(authCode);

      const result = (await model.getAuthorizationCode(
        'valid-code',
      )) as OAuth2Server.AuthorizationCode & {
        codeChallenge?: string;
        codeChallengeMethod?: string;
      };

      expect(result.codeChallenge).toBe('challenge-123');
      expect(result.codeChallengeMethod).toBe('S256');
    });
  });

  describe('revokeAuthorizationCode', () => {
    it('should return false when code not found', async () => {
      mockEm.forkedEm.findOne.mockResolvedValue(null);

      const result = await model.revokeAuthorizationCode({
        authorizationCode: 'invalid-code',
        expiresAt: new Date(),
        redirectUri: 'http://localhost:3000/callback',
        client: { id: 'client-123', grants: [] },
        user: { id: 'user-123' },
      });

      expect(result).toBe(false);
    });

    it('should mark code as used', async () => {
      const authCode = createMockAuthCode();
      mockEm.forkedEm.findOne.mockResolvedValue(authCode);

      const result = await model.revokeAuthorizationCode({
        authorizationCode: 'valid-code',
        expiresAt: new Date(),
        redirectUri: 'http://localhost:3000/callback',
        client: { id: 'client-123', grants: [] },
        user: { id: 'user-123' },
      });

      expect(result).toBe(true);
      expect(authCode.usedAt).toBeDefined();
      expect(mockEm.forkedEm.flush).toHaveBeenCalled();
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a secure token', async () => {
      const token = await model.generateAccessToken(
        { id: 'client-123', grants: [] },
        { id: 'user-123' },
        ['openid'],
      );

      expect(token).toBe('mock-token-12345');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a secure token', async () => {
      const token = await model.generateRefreshToken(
        { id: 'client-123', grants: [] },
        { id: 'user-123' },
        ['openid'],
      );

      expect(token).toBe('mock-token-12345');
    });
  });

  describe('saveToken', () => {
    it('should return false when client not found', async () => {
      mockEm.forkedEm.findOne.mockResolvedValueOnce(null);

      const result = await model.saveToken(
        {
          accessToken: 'access-token',
          accessTokenExpiresAt: new Date(),
          scope: ['openid'],
        },
        { id: 'client-123', grants: [] },
        { id: 'user-123' },
      );

      expect(result).toBe(false);
    });

    it('should save token with refresh token', async () => {
      const client = createMockOAuthClient();
      const user = createMockUser();
      mockEm.forkedEm.findOne
        .mockResolvedValueOnce(client)
        .mockResolvedValueOnce(user);

      const result = await model.saveToken(
        {
          accessToken: 'access-token',
          accessTokenExpiresAt: new Date(Date.now() + 3600000),
          refreshToken: 'refresh-token',
          refreshTokenExpiresAt: new Date(Date.now() + 86400000),
          scope: ['read:profile'],
        },
        { id: 'client-123', grants: ['authorization_code', 'refresh_token'] },
        { id: 'user-123' },
      );

      expect(result).toMatchObject({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        scope: ['read:profile'],
      });
      expect(mockEm.forkedEm.persist).toHaveBeenCalled();
      expect(mockEm.forkedEm.flush).toHaveBeenCalled();
    });
  });

  describe('getAccessToken', () => {
    it('should return false when token not found', async () => {
      mockEm.forkedEm.findOne.mockResolvedValue(null);

      const result = await model.getAccessToken('invalid-token');

      expect(result).toBe(false);
    });

    it('should return false when token is expired', async () => {
      const token = createMockToken({
        accessTokenExpiresAt: new Date(Date.now() - 1000),
      });
      mockEm.forkedEm.findOne.mockResolvedValue(token);

      const result = await model.getAccessToken('expired-token');

      expect(result).toBe(false);
    });

    it('should return token when valid', async () => {
      const token = createMockToken();
      mockEm.forkedEm.findOne.mockResolvedValue(token);

      const result = await model.getAccessToken('valid-token');

      expect(result).toMatchObject({
        accessToken: 'valid-token',
        scope: ['read:profile', 'read:data'],
      });
    });
  });

  describe('getRefreshToken', () => {
    it('should return false when token not found', async () => {
      mockEm.forkedEm.findOne.mockResolvedValue(null);

      const result = await model.getRefreshToken('invalid-token');

      expect(result).toBe(false);
    });

    it('should return false and revoke family when token was already used', async () => {
      const token = createMockToken({
        replacedByTokenId: 'new-token-id',
      });
      mockEm.forkedEm.findOne.mockResolvedValue(token);

      const result = await model.getRefreshToken('reused-token');

      expect(result).toBe(false);
      expect(mockEm.forkedEm.nativeUpdate).toHaveBeenCalled();
    });

    it('should return false when token is expired', async () => {
      const token = createMockToken({
        refreshTokenExpiresAt: new Date(Date.now() - 1000),
      });
      mockEm.forkedEm.findOne.mockResolvedValue(token);

      const result = await model.getRefreshToken('expired-token');

      expect(result).toBe(false);
    });

    it('should return refresh token when valid', async () => {
      const token = createMockToken();
      mockEm.forkedEm.findOne.mockResolvedValue(token);

      const result = await model.getRefreshToken('valid-token');

      expect(result).toMatchObject({
        refreshToken: 'valid-token',
        scope: ['read:profile', 'read:data'],
      });
    });
  });

  describe('revokeToken', () => {
    it('should return false when token not found', async () => {
      mockEm.forkedEm.findOne.mockResolvedValue(null);

      const result = await model.revokeToken({
        refreshToken: 'invalid-token',
        client: { id: 'client-123', grants: [] },
        user: { id: 'user-123' },
      });

      expect(result).toBe(false);
    });

    it('should revoke token', async () => {
      const token = createMockToken();
      mockEm.forkedEm.findOne.mockResolvedValue(token);

      const result = await model.revokeToken({
        refreshToken: 'valid-token',
        client: { id: 'client-123', grants: [] },
        user: { id: 'user-123' },
      });

      expect(result).toBe(true);
      expect(token.revokedAt).toBeDefined();
      expect(token.revokedReason).toBe('user_logout');
      expect(mockEm.forkedEm.flush).toHaveBeenCalled();
    });
  });

  describe('validateScope', () => {
    it('should return false when client not found', async () => {
      mockEm.forkedEm.findOne.mockResolvedValue(null);

      const result = await model.validateScope(
        { id: 'user-123' },
        { id: 'client-123', grants: [] },
        ['openid'],
      );

      expect(result).toBe(false);
    });

    it('should return client default scopes when none requested', async () => {
      const client = createMockOAuthClient();
      mockEm.forkedEm.findOne.mockResolvedValue(client);

      const result = await model.validateScope(
        { id: 'user-123' },
        { id: 'client-123', grants: [] },
        [],
      );

      expect(result).toEqual([
        'read:profile',
        'write:profile',
        'read:data',
        'offline_access',
      ]);
    });

    it('should return requested scopes when valid', async () => {
      const client = createMockOAuthClient();
      mockEm.forkedEm.findOne.mockResolvedValue(client);

      const result = await model.validateScope(
        { id: 'user-123' },
        { id: 'client-123', grants: [] },
        ['read:profile', 'read:data'],
      );

      expect(result).toEqual(['read:profile', 'read:data']);
    });

    it('should return false when invalid scope requested', async () => {
      const client = createMockOAuthClient();
      mockEm.forkedEm.findOne.mockResolvedValue(client);

      const result = await model.validateScope(
        { id: 'user-123' },
        { id: 'client-123', grants: [] },
        ['invalid-scope'],
      );

      expect(result).toBe(false);
    });

    it('should handle string scope', async () => {
      const client = createMockOAuthClient();
      mockEm.forkedEm.findOne.mockResolvedValue(client);

      const result = await model.validateScope(
        { id: 'user-123' },
        { id: 'client-123', grants: [] },
        'read:profile read:data',
      );

      expect(result).toEqual(['read:profile', 'read:data']);
    });
  });

  describe('verifyScope', () => {
    it('should return true when token has all requested scopes', async () => {
      const result = await model.verifyScope(
        {
          accessToken: 'token',
          client: { id: 'client-123', grants: [] },
          user: { id: 'user-123' },
          scope: ['read:profile', 'read:data', 'write:profile'],
        },
        ['read:profile', 'read:data'],
      );

      expect(result).toBe(true);
    });

    it('should return false when token is missing requested scope', async () => {
      const result = await model.verifyScope(
        {
          accessToken: 'token',
          client: { id: 'client-123', grants: [] },
          user: { id: 'user-123' },
          scope: ['read:profile'],
        },
        ['read:profile', 'read:data'],
      );

      expect(result).toBe(false);
    });

    it('should handle string scope', async () => {
      const result = await model.verifyScope(
        {
          accessToken: 'token',
          client: { id: 'client-123', grants: [] },
          user: { id: 'user-123' },
          scope: ['read:profile', 'read:data'],
        },
        'read:profile',
      );

      expect(result).toBe(true);
    });
  });

  describe('validateCodeChallenge', () => {
    it('should return true when no code challenge', () => {
      const result = model.validateCodeChallenge(
        {
          authorizationCode: 'code',
          expiresAt: new Date(),
          redirectUri: 'http://localhost:3000/callback',
          client: { id: 'client-123', grants: [] },
          user: { id: 'user-123' },
        },
        'verifier',
      );

      expect(result).toBe(true);
    });

    it('should return false when code challenge exists but no verifier', () => {
      const result = model.validateCodeChallenge(
        {
          authorizationCode: 'code',
          expiresAt: new Date(),
          redirectUri: 'http://localhost:3000/callback',
          client: { id: 'client-123', grants: [] },
          user: { id: 'user-123' },
          codeChallenge: 'challenge',
        },
        '',
      );

      expect(result).toBe(false);
    });

    it('should return false for invalid challenge method', () => {
      const result = model.validateCodeChallenge(
        {
          authorizationCode: 'code',
          expiresAt: new Date(),
          redirectUri: 'http://localhost:3000/callback',
          client: { id: 'client-123', grants: [] },
          user: { id: 'user-123' },
          codeChallenge: 'challenge',
          codeChallengeMethod: 'invalid',
        },
        'verifier',
      );

      expect(result).toBe(false);
    });
  });
});
