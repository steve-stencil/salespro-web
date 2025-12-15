import { Router } from 'express';

import { getORM } from '../../lib/db';
import { AuthService, LoginErrorCode } from '../../services';

import { loginSchema } from './schemas';
import { getClientIp, getUserAgent } from './utils';

import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

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

    const deviceId = req.headers['x-device-id'];
    const result = await authService.login({
      email,
      password,
      source,
      rememberMe,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      deviceId: typeof deviceId === 'string' ? deviceId : undefined,
      sessionId: req.sessionID,
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
      req.session.pendingMfaUserId = result.user.id;
      res.status(200).json({
        requiresMfa: true,
        message: 'MFA verification required',
      });
      return;
    }

    if (result.user) {
      req.session.userId = result.user.id;
      req.session.companyId = result.user.company.id;
    }

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
    const sessionId = req.sessionID;

    // Only call authService.logout if user is authenticated
    if (req.session.userId) {
      const orm = getORM();
      const authService = new AuthService(orm.em);
      await authService.logout(sessionId, getClientIp(req), getUserAgent(req));
    }

    // Destroy session
    req.session.destroy(err => {
      if (err) {
        req.log.error({ err }, 'Session destroy error');
      }
    });

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
    const userId = req.session.userId;

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
