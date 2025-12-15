import {
  OAuthClient,
  OAuthToken,
  OAuthAuthorizationCode,
  User,
  OAuthClientType,
} from '../../entities';
import {
  generateSecureToken,
  hashToken,
  verifyPassword,
  getTokenPrefix,
} from '../crypto';

import { verifyCodeChallenge, isValidChallengeMethod } from './pkce';
import { validateScopes, parseScopes } from './scopes';

import type { CodeChallengeMethod } from './pkce';
import type { EntityManager } from '@mikro-orm/core';
import type OAuth2Server from 'oauth2-server';

/**
 * OAuth 2.0 model implementation for oauth2-server.
 * Implements the model interface to work with MikroORM entities.
 */
export class OAuthModel
  implements OAuth2Server.AuthorizationCodeModel, OAuth2Server.RefreshTokenModel
{
  constructor(private readonly em: EntityManager) {}

  // ==================== Client Methods ====================

  /**
   * Get a client by client ID
   */
  async getClient(
    clientId: string,
    clientSecret: string | null,
  ): Promise<OAuth2Server.Client | OAuth2Server.Falsey> {
    const em = this.em.fork();

    const client = await em.findOne(OAuthClient, {
      clientId,
      isActive: true,
    });

    if (!client) {
      return false;
    }

    // For confidential clients, verify the secret
    if (client.clientType === OAuthClientType.CONFIDENTIAL) {
      if (!clientSecret || !client.clientSecretHash) {
        return false;
      }

      // Client secrets are stored hashed
      const secretHash = hashToken(clientSecret);
      if (secretHash !== client.clientSecretHash) {
        return false;
      }
    }

    return {
      id: client.id,
      grants: client.grants,
      redirectUris: client.redirectUris,
      accessTokenLifetime: client.accessTokenLifetime,
      refreshTokenLifetime: client.refreshTokenLifetime,
    };
  }

  // ==================== User Methods ====================

  /**
   * Get a user by username and password (for password grant - not used in our case)
   */
  async getUser(
    username: string,
    password: string,
  ): Promise<OAuth2Server.User | OAuth2Server.Falsey> {
    const em = this.em.fork();

    const user = await em.findOne(User, {
      email: username.toLowerCase(),
      isActive: true,
    });

    if (!user) {
      return false;
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return false;
    }

    return { id: user.id };
  }

  // ==================== Authorization Code Methods ====================

  /**
   * Generate an authorization code
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generateAuthorizationCode(
    _client: OAuth2Server.Client,
    _user: OAuth2Server.User,
    _scope: string[],
  ): Promise<string> {
    // Generate a secure random code
    return generateSecureToken(32);
  }

  /**
   * Save an authorization code
   */
  async saveAuthorizationCode(
    code: Pick<
      OAuth2Server.AuthorizationCode,
      'authorizationCode' | 'expiresAt' | 'redirectUri' | 'scope'
    > & {
      codeChallenge?: string;
      codeChallengeMethod?: string;
    },
    client: OAuth2Server.Client,
    user: OAuth2Server.User,
  ): Promise<OAuth2Server.AuthorizationCode | OAuth2Server.Falsey> {
    const em = this.em.fork();

    const clientId = client['id'];
    const userId = user['id'] as string;

    const oauthClient = await em.findOne(OAuthClient, { id: clientId });
    const oauthUser = await em.findOne(User, { id: userId });

    if (!oauthClient || !oauthUser) {
      return false;
    }

    const authCode = new OAuthAuthorizationCode();
    authCode.codeHash = hashToken(code.authorizationCode);
    authCode.expiresAt = code.expiresAt;
    authCode.redirectUri = code.redirectUri;
    authCode.scope = Array.isArray(code.scope) ? code.scope : [];
    authCode.client = oauthClient;
    authCode.user = oauthUser;

    // PKCE support
    if (code.codeChallenge) {
      authCode.codeChallenge = code.codeChallenge;
      if (code.codeChallengeMethod) {
        authCode.codeChallengeMethod = code.codeChallengeMethod;
      }
    }

    em.persist(authCode);
    await em.flush();

    return {
      authorizationCode: code.authorizationCode,
      expiresAt: code.expiresAt,
      redirectUri: code.redirectUri,
      scope: code.scope,
      client: { id: clientId, grants: client.grants },
      user: { id: userId },
    };
  }

  /**
   * Get an authorization code
   */
  async getAuthorizationCode(
    authorizationCode: string,
  ): Promise<OAuth2Server.AuthorizationCode | OAuth2Server.Falsey> {
    const em = this.em.fork();

    const codeHash = hashToken(authorizationCode);
    const authCode = await em.findOne(
      OAuthAuthorizationCode,
      {
        codeHash,
        usedAt: null,
      },
      {
        populate: ['client', 'user'],
      },
    );

    if (!authCode) {
      return false;
    }

    // Check if expired
    if (authCode.expiresAt < new Date()) {
      return false;
    }

    return {
      authorizationCode,
      expiresAt: authCode.expiresAt,
      redirectUri: authCode.redirectUri,
      scope: authCode.scope,
      client: {
        id: authCode.client.id,
        grants: authCode.client.grants,
      },
      user: { id: authCode.user.id },
      codeChallenge: authCode.codeChallenge,
      codeChallengeMethod: authCode.codeChallengeMethod,
    };
  }

  /**
   * Revoke an authorization code (mark as used)
   */
  async revokeAuthorizationCode(
    code: OAuth2Server.AuthorizationCode,
  ): Promise<boolean> {
    const em = this.em.fork();

    const codeHash = hashToken(code.authorizationCode);
    const authCode = await em.findOne(OAuthAuthorizationCode, { codeHash });

    if (!authCode) {
      return false;
    }

    authCode.usedAt = new Date();
    await em.flush();

    return true;
  }

  // ==================== Token Methods ====================

  /**
   * Generate an access token
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generateAccessToken(
    _client: OAuth2Server.Client,
    _user: OAuth2Server.User,
    _scope: string | string[],
  ): Promise<string> {
    return generateSecureToken(32);
  }

  /**
   * Generate a refresh token
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generateRefreshToken(
    _client: OAuth2Server.Client,
    _user: OAuth2Server.User,
    _scope: string | string[],
  ): Promise<string> {
    return generateSecureToken(32);
  }

  /**
   * Save an access token (and optionally refresh token)
   */
  async saveToken(
    token: Pick<
      OAuth2Server.Token,
      | 'accessToken'
      | 'accessTokenExpiresAt'
      | 'refreshToken'
      | 'refreshTokenExpiresAt'
      | 'scope'
    >,
    client: OAuth2Server.Client,
    user: OAuth2Server.User,
  ): Promise<OAuth2Server.Token | OAuth2Server.Falsey> {
    const em = this.em.fork();

    const clientId = client['id'];
    const userId = user['id'] as string;

    const oauthClient = await em.findOne(OAuthClient, { id: clientId });
    const oauthUser = await em.findOne(User, { id: userId });

    if (!oauthClient || !oauthUser) {
      return false;
    }

    const oauthToken = new OAuthToken();
    oauthToken.accessTokenHash = hashToken(token.accessToken);
    oauthToken.accessTokenPrefix = getTokenPrefix(token.accessToken);
    oauthToken.accessTokenExpiresAt =
      token.accessTokenExpiresAt ?? new Date(Date.now() + 3600 * 1000);
    oauthToken.scope = Array.isArray(token.scope)
      ? token.scope
      : parseScopes(token.scope);
    oauthToken.client = oauthClient;
    oauthToken.user = oauthUser;

    // Refresh token (if present)
    if (token.refreshToken) {
      oauthToken.refreshTokenHash = hashToken(token.refreshToken);
      oauthToken.refreshTokenPrefix = getTokenPrefix(token.refreshToken);
      if (token.refreshTokenExpiresAt) {
        oauthToken.refreshTokenExpiresAt = token.refreshTokenExpiresAt;
      }
      // Generate a family ID for token rotation tracking
      oauthToken.refreshTokenFamily = generateSecureToken(16);
    }

    em.persist(oauthToken);
    await em.flush();

    return {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      scope: oauthToken.scope,
      client: { id: clientId, grants: client.grants },
      user: { id: userId },
    };
  }

  /**
   * Get an access token
   */
  async getAccessToken(
    accessToken: string,
  ): Promise<OAuth2Server.Token | OAuth2Server.Falsey> {
    const em = this.em.fork();

    const tokenHash = hashToken(accessToken);
    const token = await em.findOne(
      OAuthToken,
      {
        accessTokenHash: tokenHash,
        revokedAt: null,
      },
      {
        populate: ['client', 'user'],
      },
    );

    if (!token) {
      return false;
    }

    // Check if expired
    if (token.accessTokenExpiresAt < new Date()) {
      return false;
    }

    return {
      accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      scope: token.scope,
      client: {
        id: token.client.id,
        grants: token.client.grants,
      },
      user: { id: token.user.id },
    };
  }

  /**
   * Get a refresh token
   */
  async getRefreshToken(
    refreshToken: string,
  ): Promise<OAuth2Server.RefreshToken | OAuth2Server.Falsey> {
    const em = this.em.fork();

    const tokenHash = hashToken(refreshToken);
    const token = await em.findOne(
      OAuthToken,
      {
        refreshTokenHash: tokenHash,
        revokedAt: null,
      },
      {
        populate: ['client', 'user'],
      },
    );

    if (!token) {
      return false;
    }

    // Check if token was already used (rotation)
    if (token.replacedByTokenId) {
      // Token reuse detected - revoke entire family
      await this.revokeTokenFamily(
        em,
        token.refreshTokenFamily ?? '',
        'suspicious_reuse',
      );
      return false;
    }

    // Check if expired
    if (
      token.refreshTokenExpiresAt &&
      token.refreshTokenExpiresAt < new Date()
    ) {
      return false;
    }

    return {
      refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt ?? undefined,
      scope: token.scope,
      client: {
        id: token.client.id,
        grants: token.client.grants,
      },
      user: { id: token.user.id },
    };
  }

  /**
   * Revoke a refresh token
   */
  async revokeToken(token: OAuth2Server.RefreshToken): Promise<boolean> {
    const em = this.em.fork();

    const tokenHash = hashToken(token.refreshToken);
    const oauthToken = await em.findOne(OAuthToken, {
      refreshTokenHash: tokenHash,
    });

    if (!oauthToken) {
      return false;
    }

    oauthToken.revokedAt = new Date();
    oauthToken.revokedReason = 'user_logout';
    await em.flush();

    return true;
  }

  // ==================== Scope Methods ====================

  /**
   * Validate requested scopes
   */
  async validateScope(
    _user: OAuth2Server.User,
    client: OAuth2Server.Client,
    scope: string | string[],
  ): Promise<string[] | OAuth2Server.Falsey> {
    const em = this.em.fork();

    const clientId = client['id'];
    const oauthClient = await em.findOne(OAuthClient, { id: clientId });
    if (!oauthClient) {
      return false;
    }

    const requestedScopes = Array.isArray(scope) ? scope : parseScopes(scope);

    // If no scopes requested, use client defaults
    if (requestedScopes.length === 0) {
      return oauthClient.allowedScopes;
    }

    const { valid } = validateScopes(
      requestedScopes,
      oauthClient.allowedScopes,
    );

    if (!valid) {
      return false;
    }

    return requestedScopes;
  }

  /**
   * Verify scope for access token
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyScope(
    token: OAuth2Server.Token,
    scope: string | string[],
  ): Promise<boolean> {
    const requestedScopes = Array.isArray(scope) ? scope : parseScopes(scope);
    const tokenScopes = token.scope ?? [];
    const tokenScopesArray = Array.isArray(tokenScopes)
      ? tokenScopes
      : parseScopes(tokenScopes);

    return requestedScopes.every(s => tokenScopesArray.includes(s));
  }

  // ==================== PKCE Methods ====================

  /**
   * Validate PKCE code verifier
   */
  validateCodeChallenge(
    code: OAuth2Server.AuthorizationCode & {
      codeChallenge?: string;
      codeChallengeMethod?: string;
    },
    codeVerifier: string,
  ): boolean {
    if (!code.codeChallenge) {
      return true; // PKCE not required
    }

    if (!codeVerifier) {
      return false; // PKCE required but no verifier provided
    }

    const method = (code.codeChallengeMethod ?? 'S256') as CodeChallengeMethod;
    if (!isValidChallengeMethod(method)) {
      return false;
    }

    return verifyCodeChallenge(codeVerifier, code.codeChallenge, method);
  }

  // ==================== Helper Methods ====================

  /**
   * Revoke all tokens in a family (for security when token reuse is detected)
   */
  private async revokeTokenFamily(
    em: EntityManager,
    familyId: string,
    reason: string,
  ): Promise<void> {
    await em.nativeUpdate(
      OAuthToken,
      {
        refreshTokenFamily: familyId,
        revokedAt: null,
      },
      {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    );
  }
}
