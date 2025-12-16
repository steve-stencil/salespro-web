import { ApiKey } from '../entities';
import { hashToken } from '../lib/crypto';
import { getORM } from '../lib/db';

import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** API key context attached to request */
export type ApiKeyContext = {
  apiKeyId: string;
  companyId: string;
  userId: string;
  scopes: string[];
};

/**
 * Middleware that requires API key authentication.
 * API keys can be passed via:
 * - X-API-Key header
 * - Authorization header with "ApiKey" scheme
 *
 * @param requiredScopes - Optional scopes that must be present in the API key
 */
export function requireApiKey(requiredScopes?: string[]): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Extract API key from headers
      let apiKey = req.headers['x-api-key'];

      // Also check Authorization header
      if (!apiKey) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('ApiKey ')) {
          apiKey = authHeader.slice(7);
        }
      }

      if (!apiKey || typeof apiKey !== 'string') {
        res.status(401).json({
          error: 'unauthorized',
          error_description: 'API key required',
        });
        return;
      }

      // Validate API key
      const orm = getORM();
      const em = orm.em.fork();

      const keyHash = hashToken(apiKey);
      const key = await em.findOne(
        ApiKey,
        {
          keyHash,
          isActive: true,
          revokedAt: null,
        },
        {
          populate: ['company', 'createdBy'],
        },
      );

      if (!key) {
        res.status(401).json({
          error: 'invalid_api_key',
          error_description: 'Invalid API key',
        });
        return;
      }

      // Check expiration
      if (key.expiresAt && key.expiresAt < new Date()) {
        res.status(401).json({
          error: 'expired_api_key',
          error_description: 'API key has expired',
        });
        return;
      }

      // Check required scopes
      if (requiredScopes && requiredScopes.length > 0) {
        const hasAllScopes = requiredScopes.every(s => key.scopes.includes(s));

        if (!hasAllScopes) {
          res.status(403).json({
            error: 'insufficient_scope',
            error_description: `Required scopes: ${requiredScopes.join(', ')}`,
          });
          return;
        }
      }

      // Update last used
      key.lastUsedAt = new Date();
      if (req.ip) {
        key.lastUsedIp = req.ip;
      }
      await em.flush();

      // Attach API key context to request
      const apiKeyContext: ApiKeyContext = {
        apiKeyId: key.id,
        companyId: key.company.id,
        userId: key.createdBy.id,
        scopes: key.scopes,
      };

      (req as Request & { apiKey?: ApiKeyContext }).apiKey = apiKeyContext;

      next();
    } catch (err) {
      req.log.error({ err }, 'API key middleware error');
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  };
}
