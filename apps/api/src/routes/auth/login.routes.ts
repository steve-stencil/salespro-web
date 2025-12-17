import crypto from 'crypto';

import { Router } from 'express';

import { getORM } from '../../lib/db';
import { AuthService, LoginErrorCode } from '../../services';
import { sendMfaCode } from '../../services/auth/mfa';

import { loginSchema } from './schemas';
import { getClientIp, getUserAgent } from './utils';

import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

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
 * Get or create a session ID for login
 * If session exists, regenerate it for security
 * If no session, generate a new UUID
 */
async function getOrCreateSessionId(req: Request): Promise<string> {
  // Session may be undefined when saveUninitialized: false
  const session = req.session;

  // If session exists, regenerate for security (prevents session fixation)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (session?.regenerate) {
    return new Promise((resolve, reject) => {
      session.regenerate((err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve(req.sessionID);
        }
      });
    });
  }

  // No session yet, generate a new UUID (database expects UUID format)
  return crypto.randomUUID();
}

/**
 * POST /auth/login
 * Authenticate user and create session
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.flatten(),
      });
      return;
    }

    const { email, password, source, rememberMe } = validation.data;
    const orm = getORM();
    const authService = new AuthService(orm.em);

    // Get or create session ID for login
    // If session exists, regenerate for security (prevents session fixation)
    const sessionId = await getOrCreateSessionId(req);

    const deviceId = req.headers['x-device-id'];
    const result = await authService.login({
      email,
      password,
      source,
      rememberMe,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      deviceId: typeof deviceId === 'string' ? deviceId : undefined,
      sessionId,
    });

    if (!result.success) {
      const status =
        result.errorCode === LoginErrorCode.ACCOUNT_LOCKED ? 423 : 401;
      res.status(status).json({
        error: result.error,
        errorCode: result.errorCode,
      });
      return;
    }

    if (result.requiresMfa && result.user) {
      // Create a temporary MFA session in the database
      // This session will be upgraded to a full session after MFA verification
      const { Session } = await import('../../entities');
      const em = orm.em.fork();

      const now = new Date();
      const mfaSessionExpiry = 10 * 60 * 1000; // 10 minutes for MFA verification

      // Check if session already exists (created by express-session middleware)
      let session = await em.findOne(Session, { sid: sessionId });
      if (!session) {
        session = new Session();
        session.sid = sessionId;
        session.createdAt = now;
        em.persist(session);
      }

      // Always set MFA session properties (whether new or existing)
      // This ensures short expiry even if express-session created the session first
      session.expiresAt = new Date(now.getTime() + mfaSessionExpiry);
      session.absoluteExpiresAt = new Date(now.getTime() + mfaSessionExpiry);
      session.user = result.user;
      session.company = result.user.company;
      session.source = source;
      session.ipAddress = getClientIp(req);
      session.userAgent = getUserAgent(req);
      session.mfaVerified = false;
      session.lastActivityAt = now;

      // Store pendingMfaUserId and rememberMe in session data (MikroORM entity)
      // rememberMe is needed to extend session expiration after MFA verification
      session.data = {
        ...session.data,
        pendingMfaUserId: result.user.id,
        rememberMe,
      };
      await em.flush();

      // Also store in express-session so it persists when middleware saves
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (req.session) {
        req.session.pendingMfaUserId = result.user.id;
        req.session.rememberMe = rememberMe;
      }

      // Send MFA code via email
      const mfaResult = await sendMfaCode(em, result.user.id);
      if (!mfaResult.success) {
        req.log.error(
          { error: mfaResult.error, errorCode: mfaResult.errorCode },
          'Failed to send MFA code',
        );
        // Continue even if email fails in development (code is stored)
        // In production, this would be a problem
      }

      // Set session cookie for MFA flow
      res.cookie('sid', sessionId, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes for MFA verification
        path: '/',
      });

      // Return response with code expiry info
      const response: {
        requiresMfa: boolean;
        message: string;
        expiresIn?: number;
        code?: string;
      } = {
        requiresMfa: true,
        message:
          'MFA verification required. A code has been sent to your email.',
        expiresIn: mfaResult.expiresIn,
      };

      // Include code in development mode for testing
      if (mfaResult.code) {
        response.code = mfaResult.code;
      }

      res.status(200).json(response);
      return;
    }

    // Store user info in session if available
    // Note: Session data is also stored in our Session entity via AuthService
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.user && req.session) {
      req.session.userId = result.user.id;
      req.session.companyId = result.user.company?.id;
    }

    // Set session cookie manually since we created the session directly in DB
    // This ensures the browser has the session ID for subsequent requests
    res.cookie('sid', sessionId, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.status(200).json({
      message: 'Login successful',
      user: result.user
        ? {
            id: result.user.id,
            email: result.user.email,
            nameFirst: result.user.nameFirst,
            nameLast: result.user.nameLast,
          }
        : undefined,
    });
  } catch (err) {
    req.log.error({ err }, 'Login error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/logout
 * Destroy current session
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // Get session ID from cookie (prefer this) or express-session
    const cookieSessionId = (req.cookies as Record<string, string>)['sid'];
    const sessionId = cookieSessionId ?? req.sessionID;

    // Try to logout even if req.session.userId is not set
    // (session data might be stored in DB but not loaded into express-session)
    if (sessionId) {
      const orm = getORM();
      const authService = new AuthService(orm.em);
      await authService.logout(sessionId, getClientIp(req), getUserAgent(req));
    }

    // Destroy express-session if it exists
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (req.session?.destroy) {
      req.session.destroy(err => {
        if (err) {
          req.log.error({ err }, 'Session destroy error');
        }
      });
    }

    res.clearCookie('sid');
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    req.log.error({ err }, 'Logout error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // First try express-session (may be undefined when saveUninitialized: false)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    let userId = req.session?.userId;
    let mfaVerified = true; // Assume verified unless we find otherwise

    // If no session, try to look up session from our custom cookie
    if (!userId) {
      const rawCookie = (req.cookies as Record<string, string | undefined>)[
        'sid'
      ];
      const sessionId = rawCookie ? parseSessionIdFromCookie(rawCookie) : null;
      if (sessionId) {
        const orm = getORM();
        const em = orm.em.fork();
        const { Session } = await import('../../entities');

        const session = await em.findOne(
          Session,
          { sid: sessionId },
          { populate: ['user'] },
        );

        if (session?.user && !session.isExpired) {
          userId = session.user.id;
          mfaVerified = session.mfaVerified;
        }
      }
    }

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // If MFA is required but not yet verified, return requiresMfa flag
    // This allows the frontend to redirect to MFA verification page
    if (!mfaVerified) {
      res.status(200).json({ requiresMfa: true });
      return;
    }

    const orm = getORM();
    const em = orm.em.fork();
    const { User } = await import('../../entities');

    const user = await em.findOne(
      User,
      { id: userId },
      { populate: ['company'] },
    );

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      id: user.id,
      email: user.email,
      nameFirst: user.nameFirst,
      nameLast: user.nameLast,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      userType: user.userType,
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, 'Get current user error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
