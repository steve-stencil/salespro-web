import { UserType } from '../entities/types';
import { getORM } from '../lib/db';

import type { User, Company, Session } from '../entities';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Extended request type with user and context attached by requireAuth middleware
 */
export type AuthenticatedRequest = Request & {
  /** The authenticated user */
  user?: User;
  /** Whether the user is an internal platform user */
  isInternalUser?: boolean;
  /** The company context for this request:
   * - For company users: their fixed company
   * - For internal users: their active company from session (may be undefined)
   */
  companyContext?: Company;
};

/**
 * UUID v4 validation regex
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Parse session ID from cookie value.
 * Express-session signed cookies have format: s:UUID.signature
 * This extracts just the UUID part.
 */
function parseSessionIdFromCookie(cookieValue: string): string | null {
  if (!cookieValue) return null;

  // If it's a signed cookie (starts with s:), extract the session ID
  if (cookieValue.startsWith('s:')) {
    const dotIndex = cookieValue.indexOf('.', 2);
    const sessionId =
      dotIndex > 2 ? cookieValue.slice(2, dotIndex) : cookieValue.slice(2);
    return UUID_REGEX.test(sessionId) ? sessionId : null;
  }

  // If it's already a plain UUID
  return UUID_REGEX.test(cookieValue) ? cookieValue : null;
}

/**
 * Middleware that requires session-based authentication.
 * Returns 401 if the user is not authenticated via session.
 *
 * First tries express-session, then falls back to looking up
 * the session from the database via the 'sid' cookie.
 */
export function requireAuth(): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // First try express-session (may be undefined when saveUninitialized: false)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      let userId = req.session?.userId;

      // If no session, try to look up session from our custom cookie
      if (!userId) {
        const rawCookie = (req.cookies as Record<string, string | undefined>)[
          'sid'
        ];
        const sessionId = rawCookie
          ? parseSessionIdFromCookie(rawCookie)
          : null;
        if (sessionId) {
          const orm = getORM();
          const em = orm.em.fork();
          const { Session } = await import('../entities');

          const session = await em.findOne(
            Session,
            { sid: sessionId },
            { populate: ['user'] },
          );

          if (session?.user && !session.isExpired) {
            userId = session.user.id;
          }
        }
      }

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      // Load the user and session, attach to request
      const orm = getORM();
      const em = orm.em.fork();
      const { User: UserEntity, Session: SessionEntity } = await import(
        '../entities'
      );

      const user = await em.findOne(
        UserEntity,
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

      // Load session entity for internal users (to get activeCompany)
      let sessionEntity: Session | null = null;
      let activeCompany: Company | undefined;

      if ((user.userType as UserType) === UserType.INTERNAL) {
        const rawCookie = (req.cookies as Record<string, string | undefined>)[
          'sid'
        ];
        const sessionId = rawCookie
          ? parseSessionIdFromCookie(rawCookie)
          : null;
        if (sessionId) {
          sessionEntity = await em.findOne(
            SessionEntity,
            { sid: sessionId },
            { populate: ['activeCompany'] },
          );
          activeCompany = sessionEntity?.activeCompany;
        }
      }

      // Attach user and context to request for downstream use
      const isInternalUser = (user.userType as UserType) === UserType.INTERNAL;
      const extendedReq = req as AuthenticatedRequest;
      extendedReq.user = user;
      extendedReq.isInternalUser = isInternalUser;

      // For internal users, use activeCompany from session; for company users, use their fixed company
      extendedReq.companyContext = isInternalUser
        ? activeCompany
        : user.company;

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
