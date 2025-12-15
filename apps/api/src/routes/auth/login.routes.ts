import crypto from 'crypto';

import { Router } from 'express';

import { getORM } from '../../lib/db';
import { AuthService, LoginErrorCode } from '../../services';

import { loginSchema } from './schemas';
import { getClientIp, getUserAgent } from './utils';

import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

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

    if (result.requiresMfa) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (req.session && result.user) {
        req.session.pendingMfaUserId = result.user.id;
      }
      res.status(200).json({
        requiresMfa: true,
        message: 'MFA verification required',
      });
      return;
    }

    // Store user info in session if available
    // Note: Session data is also stored in our Session entity via AuthService
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.user && req.session) {
      req.session.userId = result.user.id;
      req.session.companyId = result.user.company.id;
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

    // If no session, try to look up session from our custom cookie
    if (!userId) {
      const sessionId = (req.cookies as Record<string, string>)['sid'];
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
        }
      }
    }

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
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
      company: {
        id: user.company.id,
        name: user.company.name,
      },
    });
  } catch (err) {
    req.log.error({ err }, 'Get current user error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
