import { Router } from 'express';
import OAuth2Server from 'oauth2-server';

import { getORM } from '../../lib/db';
import { OAUTH_SCOPES, parseScopes } from '../../lib/oauth';

import { authorizeSchema } from './schemas';
import { createOAuth2Server } from './utils';

import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * GET /oauth/authorize
 * Show authorization consent screen
 */
router.get('/authorize', async (req: Request, res: Response) => {
  try {
    const validation = authorizeSchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({
        error: 'invalid_request',
        error_description:
          validation.error.issues[0]?.message ?? 'Invalid request',
      });
      return;
    }

    const {
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
    } = validation.data;

    const userId = req.session.userId;
    if (!userId) {
      const returnUrl = encodeURIComponent(req.originalUrl);
      res.redirect(`/api/auth/login?return_to=${returnUrl}`);
      return;
    }

    const orm = getORM();
    const em = orm.em.fork();
    const { OAuthClient } = await import('../../entities');

    const client = await em.findOne(OAuthClient, {
      clientId: client_id,
      isActive: true,
    });

    if (!client) {
      res.status(400).json({
        error: 'invalid_client',
        error_description: 'Client not found',
      });
      return;
    }

    if (!client.redirectUris.includes(redirect_uri)) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid redirect URI',
      });
      return;
    }

    const requestedScopes = parseScopes(scope);
    const invalidScopes = requestedScopes.filter(
      s => !client.allowedScopes.includes(s),
    );

    if (invalidScopes.length > 0) {
      res.status(400).json({
        error: 'invalid_scope',
        error_description: `Invalid scopes: ${invalidScopes.join(', ')}`,
      });
      return;
    }

    if (client.requirePkce && !code_challenge) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'PKCE code_challenge required for this client',
      });
      return;
    }

    const scopeDescriptions = requestedScopes.map(s => ({
      scope: s,
      description: OAUTH_SCOPES[s]?.description ?? s,
    }));

    res.status(200).json({
      client: {
        id: client.clientId,
        name: client.name,
        logoUrl: client.logoUrl,
      },
      scopes: scopeDescriptions,
      state,
      code_challenge,
      code_challenge_method,
      redirect_uri,
    });
  } catch (err) {
    req.log.error({ err }, 'OAuth authorize error');
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * POST /oauth/authorize
 * Handle authorization consent (grant or deny)
 */
router.post('/authorize', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Authentication required',
      });
      return;
    }

    const {
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
      approved,
    } = req.body as {
      client_id: string;
      redirect_uri: string;
      scope?: string;
      state: string;
      code_challenge?: string;
      code_challenge_method?: string;
      approved: boolean;
    };

    if (!approved) {
      const errorUrl = new URL(redirect_uri);
      errorUrl.searchParams.set('error', 'access_denied');
      errorUrl.searchParams.set('error_description', 'User denied the request');
      errorUrl.searchParams.set('state', state);
      res.redirect(errorUrl.toString());
      return;
    }

    const oauth2 = createOAuth2Server();
    const oauthRequest = new OAuth2Server.Request({
      method: 'POST',
      headers: req.headers as Record<string, string>,
      query: {},
      body: {
        client_id,
        redirect_uri,
        response_type: 'code',
        scope,
        state,
        code_challenge,
        code_challenge_method,
      },
    });

    const oauthResponse = new OAuth2Server.Response(res);

    try {
      (oauthRequest as OAuth2Server.Request & { user?: { id: string } }).user =
        { id: userId };

      const code = await oauth2.authorize(oauthRequest, oauthResponse, {
        authenticateHandler: {
          handle: () => ({ id: userId }),
        },
      });

      const successUrl = new URL(redirect_uri);
      successUrl.searchParams.set('code', code.authorizationCode);
      successUrl.searchParams.set('state', state);
      res.redirect(successUrl.toString());
    } catch (oauthErr) {
      req.log.error({ err: oauthErr }, 'OAuth authorization error');
      const errorUrl = new URL(redirect_uri);
      errorUrl.searchParams.set('error', 'server_error');
      errorUrl.searchParams.set('state', state);
      res.redirect(errorUrl.toString());
    }
  } catch (err) {
    req.log.error({ err }, 'OAuth authorize POST error');
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

export default router;
