import { getORM } from '../lib/db';

import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Middleware that requires session-based authentication.
 * Returns 401 if the user is not authenticated via session.
 */
export function requireAuth(): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      // Optionally load the user and attach to request
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

      if (!user) {
        // User no longer exists or is deactivated
        req.session.destroy(() => {});
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found',
        });
        return;
      }

      if (!user.isActive) {
        req.session.destroy(() => {});
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Account is deactivated',
        });
        return;
      }

      // Check force logout
      if (user.forceLogoutAt) {
        const sessionCreatedAt = req.session.cookie.expires
          ? new Date(
              req.session.cookie.expires.getTime() -
                (req.session.cookie.maxAge ?? 0),
            )
          : new Date(0);

        if (sessionCreatedAt < user.forceLogoutAt) {
          req.session.destroy(() => {});
          res.status(401).json({
            error: 'Unauthorized',
            message: 'Session expired, please login again',
          });
          return;
        }
      }

      // Attach user to request for downstream use
      (req as Request & { user?: typeof user }).user = user;

      next();
    } catch (err) {
      req.log.error({ err }, 'Auth middleware error');
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware that requires MFA verification for authenticated users.
 * Must be used after requireAuth().
 */
export function requireMfa(): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (
        req as Request & {
          user?: { mfaEnabled: boolean; company?: { mfaRequired: boolean } };
        }
      ).user;

      if (!user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      // Check if MFA is required for this user
      const mfaRequired = user.mfaEnabled || user.company?.mfaRequired;

      if (!mfaRequired) {
        // MFA not required, continue
        next();
        return;
      }

      // Check if session has verified MFA
      const orm = getORM();
      const em = orm.em.fork();
      const { Session } = await import('../entities');

      const session = await em.findOne(Session, { sid: req.sessionID });

      if (!session?.mfaVerified) {
        res.status(403).json({
          error: 'MFA Required',
          message: 'Multi-factor authentication verification required',
          requiresMfa: true,
        });
        return;
      }

      next();
    } catch (err) {
      req.log.error({ err }, 'MFA middleware error');
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
