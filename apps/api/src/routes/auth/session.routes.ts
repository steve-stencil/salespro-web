import { Router } from 'express';

import { getORM } from '../../lib/db';
import { AuthService } from '../../services';

import { getClientIp, getUserAgent } from './utils';

import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * GET /auth/sessions
 * Get user's active sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const orm = getORM();
    const authService = new AuthService(orm.em);

    const sessions = await authService.getUserSessions(userId);

    res.status(200).json({
      sessions: sessions.map(s => ({
        id: s.sid,
        source: s.source,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
        isCurrent: s.sid === req.sessionID,
      })),
    });
  } catch (err) {
    req.log.error({ err }, 'Get sessions error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /auth/sessions/:sid
 * Revoke a specific session
 */
router.delete('/sessions/:sid', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { sid } = req.params;
    if (!sid) {
      res.status(400).json({ error: 'Session ID required' });
      return;
    }

    const orm = getORM();
    const authService = new AuthService(orm.em);

    const success = await authService.revokeSession(
      userId,
      sid,
      getClientIp(req),
      getUserAgent(req),
    );

    if (!success) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.status(200).json({ message: 'Session revoked' });
  } catch (err) {
    req.log.error({ err }, 'Revoke session error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /auth/sessions/all
 * Logout all sessions except current
 */
router.delete('/sessions/all', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const orm = getORM();
    const authService = new AuthService(orm.em);

    const count = await authService.logoutAllSessions(
      userId,
      req.sessionID,
      getClientIp(req),
      getUserAgent(req),
    );

    res.status(200).json({
      message: 'All other sessions logged out',
      count,
    });
  } catch (err) {
    req.log.error({ err }, 'Logout all sessions error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
