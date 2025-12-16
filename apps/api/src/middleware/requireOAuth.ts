import { getORM } from '../lib/db';
import { OAuthModel, parseScopes } from '../lib/oauth';

import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** OAuth token context attached to request */
export type OAuthContext = {
  userId: string;
  clientId: string;
  scopes: string[];
};

/**
 * Middleware that requires OAuth bearer token authentication.
 * Validates the access token and attaches context to the request.
 *
 * @param requiredScopes - Optional scopes that must be present in the token
 */
export function requireOAuth(requiredScopes?: string[]): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Extract bearer token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'unauthorized',
          error_description: 'Bearer token required',
        });
        return;
      }

      const token = authHeader.slice(7);

      if (!token) {
        res.status(401).json({
          error: 'unauthorized',
          error_description: 'Bearer token required',
        });
        return;
      }

      // Validate token
      const orm = getORM();
      const model = new OAuthModel(orm.em);

      const accessToken = await model.getAccessToken(token);

      if (!accessToken) {
        res.status(401).json({
          error: 'invalid_token',
          error_description: 'Invalid or expired access token',
        });
        return;
      }

      // Check required scopes
      if (requiredScopes && requiredScopes.length > 0) {
        const tokenScopes = Array.isArray(accessToken.scope)
          ? accessToken.scope
          : parseScopes(accessToken.scope);

        const hasAllScopes = requiredScopes.every(s => tokenScopes.includes(s));

        if (!hasAllScopes) {
          res.status(403).json({
            error: 'insufficient_scope',
            error_description: `Required scopes: ${requiredScopes.join(', ')}`,
          });
          return;
        }
      }

      // Attach OAuth context to request
      const oauthContext: OAuthContext = {
        userId: accessToken.user['id'] as string,
        clientId: accessToken.client['id'],
        scopes: Array.isArray(accessToken.scope)
          ? accessToken.scope
          : parseScopes(accessToken.scope),
      };

      (req as Request & { oauth?: OAuthContext }).oauth = oauthContext;

      next();
    } catch (err) {
      req.log.error({ err }, 'OAuth middleware error');
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  };
}

/**
 * Middleware that accepts either session auth or OAuth bearer token.
 * Use this for endpoints that should work with both authentication methods.
 */
export function requireAuthOrOAuth(requiredScopes?: string[]): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Check for session auth first
      const userId = req.session.userId;
      if (userId) {
        // Load user for session auth
        const orm = getORM();
        const em = orm.em.fork();
        const { User } = await import('../entities');

        const user = await em.findOne(
          User,
          { id: userId },
          {
            populate: ['company'],
          },
        );

        if (user && user.isActive) {
          (req as Request & { user?: typeof user }).user = user;
          next();
          return;
        }
      }

      // Fall back to OAuth
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const orm = getORM();
        const model = new OAuthModel(orm.em);

        const accessToken = await model.getAccessToken(token);

        if (accessToken) {
          // Check scopes if required
          if (requiredScopes && requiredScopes.length > 0) {
            const tokenScopes = Array.isArray(accessToken.scope)
              ? accessToken.scope
              : parseScopes(accessToken.scope);

            const hasAllScopes = requiredScopes.every(s =>
              tokenScopes.includes(s),
            );

            if (!hasAllScopes) {
              res.status(403).json({
                error: 'insufficient_scope',
                error_description: `Required scopes: ${requiredScopes.join(', ')}`,
              });
              return;
            }
          }

          const oauthContext: OAuthContext = {
            userId: accessToken.user['id'] as string,
            clientId: accessToken.client['id'],
            scopes: Array.isArray(accessToken.scope)
              ? accessToken.scope
              : parseScopes(accessToken.scope),
          };

          (req as Request & { oauth?: OAuthContext }).oauth = oauthContext;
          next();
          return;
        }
      }

      // No valid authentication
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Authentication required',
      });
    } catch (err) {
      req.log.error({ err }, 'Auth or OAuth middleware error');
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  };
}
