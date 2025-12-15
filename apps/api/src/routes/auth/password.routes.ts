import { Router } from 'express';

import { getORM } from '../../lib/db';
import { AuthService } from '../../services';

import {
  passwordResetRequestSchema,
  passwordResetSchema,
  passwordChangeSchema,
} from './schemas';
import { getClientIp, getUserAgent } from './utils';

import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * POST /auth/password/forgot
 * Request password reset email
 */
router.post('/password/forgot', async (req: Request, res: Response) => {
  try {
    const validation = passwordResetRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.flatten(),
      });
      return;
    }

    const { email } = validation.data;
    const orm = getORM();
    const authService = new AuthService(orm.em);

    const result = await authService.requestPasswordReset(
      email,
      getClientIp(req),
      getUserAgent(req),
    );

    const response: { message: string; token?: string } = {
      message:
        'If an account exists with this email, a reset link has been sent',
    };

    if (result.token) {
      response.token = result.token;
    }

    res.status(200).json(response);
  } catch (err) {
    req.log.error({ err }, 'Password reset request error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/password/reset
 * Reset password with token
 */
router.post('/password/reset', async (req: Request, res: Response) => {
  try {
    const validation = passwordResetSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.flatten(),
      });
      return;
    }

    const { token, password } = validation.data;
    const orm = getORM();
    const authService = new AuthService(orm.em);

    const result = await authService.resetPassword(
      token,
      password,
      getClientIp(req),
      getUserAgent(req),
    );

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    req.log.error({ err }, 'Password reset error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/password/change
 * Change password (authenticated)
 */
router.post('/password/change', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const validation = passwordChangeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.flatten(),
      });
      return;
    }

    const { currentPassword, newPassword } = validation.data;
    const orm = getORM();
    const authService = new AuthService(orm.em);

    const result = await authService.changePassword(
      userId,
      currentPassword,
      newPassword,
      getClientIp(req),
      getUserAgent(req),
    );

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    req.log.error({ err }, 'Password change error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
