import { Router } from 'express';
import OAuth2Server from 'oauth2-server';

import { getORM } from '../../lib/db';
import { OAuthModel } from '../../lib/oauth';

import { tokenSchema, revokeSchema } from './schemas';
import { createOAuth2Server } from './utils';

import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * POST /oauth/token
 * Exchange authorization code or refresh token for access token
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    const validation = tokenSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'invalid_request',
        error_description:
          validation.error.issues[0]?.message ?? 'Invalid request',
      });
      return;
    }

    const oauth2 = createOAuth2Server();

    const oauthRequest = new OAuth2Server.Request({
      method: 'POST',
      headers: {
        ...(req.headers as Record<string, string>),
        'content-type': 'application/x-www-form-urlencoded',
      },
      query: {},
      body: validation.data,
    });

    const oauthResponse = new OAuth2Server.Response(res);

    try {
      const token = await oauth2.token(oauthRequest, oauthResponse);

      res.status(200).json({
        access_token: token.accessToken,
        token_type: 'Bearer',
        expires_in: Math.floor(
          ((token.accessTokenExpiresAt?.getTime() ?? Date.now()) - Date.now()) /
            1000,
        ),
        refresh_token: token.refreshToken,
        scope: Array.isArray(token.scope) ? token.scope.join(' ') : token.scope,
      });
    } catch (oauthErr) {
      req.log.error({ err: oauthErr }, 'OAuth token error');
      const error = oauthErr as {
        code?: number;
        message?: string;
        name?: string;
      };
      res.status(error.code ?? 400).json({
        error: error.name ?? 'invalid_grant',
        error_description: error.message ?? 'Invalid grant',
      });
    }
  } catch (err) {
    req.log.error({ err }, 'OAuth token endpoint error');
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * POST /oauth/revoke
 * Revoke an access or refresh token
 */
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const validation = revokeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'invalid_request',
        error_description:
          validation.error.issues[0]?.message ?? 'Invalid request',
      });
      return;
    }

    const { token } = validation.data;
    const orm = getORM();
    const model = new OAuthModel(orm.em);

    const refreshToken = await model.getRefreshToken(token);
    if (refreshToken) {
      await model.revokeToken(refreshToken);
      res.status(200).json({ message: 'Token revoked' });
      return;
    }

    const accessToken = await model.getAccessToken(token);
    if (accessToken) {
      res.status(200).json({ message: 'Token revoked' });
      return;
    }

    res.status(200).json({ message: 'Token revoked' });
  } catch (err) {
    req.log.error({ err }, 'OAuth revoke error');
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * POST /oauth/introspect
 * Token introspection (RFC 7662)
 */
router.post('/introspect', async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token?: string };

    if (!token) {
      res.status(200).json({ active: false });
      return;
    }

    const orm = getORM();
    const model = new OAuthModel(orm.em);

    const accessToken = await model.getAccessToken(token);
    if (accessToken) {
      res.status(200).json({
        active: true,
        token_type: 'Bearer',
        scope: Array.isArray(accessToken.scope)
          ? accessToken.scope.join(' ')
          : accessToken.scope,
        client_id: accessToken.client['id'],
        exp: Math.floor(
          (accessToken.accessTokenExpiresAt?.getTime() ?? 0) / 1000,
        ),
      });
      return;
    }

    const refreshToken = await model.getRefreshToken(token);
    if (refreshToken) {
      res.status(200).json({
        active: true,
        token_type: 'refresh_token',
        scope: Array.isArray(refreshToken.scope)
          ? refreshToken.scope.join(' ')
          : refreshToken.scope,
        client_id: refreshToken.client['id'],
        exp: refreshToken.refreshTokenExpiresAt
          ? Math.floor(refreshToken.refreshTokenExpiresAt.getTime() / 1000)
          : undefined,
      });
      return;
    }

    res.status(200).json({ active: false });
  } catch (err) {
    req.log.error({ err }, 'OAuth introspect error');
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

export default router;
