import { Router } from 'express';

import { getORM } from '../../lib/db';
import {
  sendMfaCode,
  verifyMfaCode,
  verifyMfaRecoveryCode,
  enableMfa,
  disableMfa,
  getRecoveryCodeCount,
  regenerateRecoveryCodes,
  MfaErrorCode,
} from '../../services/auth/mfa';

import { mfaVerifySchema, mfaRecoverySchema } from './schemas';
import { getClientIp, getUserAgent } from './utils';

import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * Session data from database
 */
type SessionFromCookie = {
  sessionId: string;
  userId: string | undefined;
  pendingMfaUserId: string | undefined;
};

/**
 * Get session from database using cookie
 * This is more reliable than express-session which may have a different session ID
 */
async function getSessionFromCookie(
  req: Request,
): Promise<SessionFromCookie | null> {
  const sessionId = (req.cookies as Record<string, string>)['sid'];
  if (!sessionId) {
    return null;
  }

  const orm = getORM();
  const em = orm.em.fork();
  const { Session } = await import('../../entities');
  const session = await em.findOne(Session, { sid: sessionId });

  if (!session || session.isExpired) {
    return null;
  }

  const data = session.data;
  const pendingMfaUserId = data['pendingMfaUserId'];
  return {
    sessionId,
    userId: session.user?.id,
    pendingMfaUserId:
      typeof pendingMfaUserId === 'string' ? pendingMfaUserId : undefined,
  };
}

/**
 * Get pending MFA user ID from database session
 */
async function getPendingMfaUserId(req: Request): Promise<string | undefined> {
  const sessionData = await getSessionFromCookie(req);
  return sessionData?.pendingMfaUserId;
}

/**
 * Get authenticated user ID from database session
 */
async function getAuthenticatedUserId(
  req: Request,
): Promise<string | undefined> {
  const sessionData = await getSessionFromCookie(req);
  return sessionData?.userId;
}

/**
 * POST /auth/mfa/send
 * Send MFA verification code to user's email
 * Requires pendingMfaUserId in session (set after login when MFA required)
 */
router.post('/mfa/send', async (req: Request, res: Response) => {
  try {
    const pendingMfaUserId = await getPendingMfaUserId(req);
    if (!pendingMfaUserId) {
      res.status(400).json({
        error: 'No pending MFA verification',
        errorCode: MfaErrorCode.NO_PENDING_MFA,
      });
      return;
    }

    const orm = getORM();
    const result = await sendMfaCode(orm.em.fork(), pendingMfaUserId);

    if (!result.success) {
      res.status(400).json({
        error: result.error,
        errorCode: result.errorCode,
      });
      return;
    }

    res.status(200).json({
      message: 'Verification code sent',
      expiresIn: result.expiresIn,
      code: result.code, // Only present in development mode
    });
  } catch (err) {
    req.log.error({ err }, 'MFA send code error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/mfa/verify
 * Verify MFA code and complete login
 */
router.post('/mfa/verify', async (req: Request, res: Response) => {
  try {
    const validation = mfaVerifySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.flatten(),
      });
      return;
    }

    const sessionId = (req.cookies as Record<string, string>)['sid'];
    const pendingMfaUserId = await getPendingMfaUserId(req);
    if (!pendingMfaUserId) {
      res.status(400).json({
        error: 'No pending MFA verification',
        errorCode: MfaErrorCode.NO_PENDING_MFA,
      });
      return;
    }

    const { code } = validation.data;
    const orm = getORM();
    const result = await verifyMfaCode(
      orm.em.fork(),
      pendingMfaUserId,
      code,
      sessionId ?? req.sessionID,
      getClientIp(req),
      getUserAgent(req),
    );

    if (!result.success) {
      const status = result.errorCode === MfaErrorCode.CODE_EXPIRED ? 410 : 401;
      res.status(status).json({
        error: result.error,
        errorCode: result.errorCode,
      });
      return;
    }

    // Clear pending MFA from database session and mark as verified
    if (sessionId) {
      const em = orm.em.fork();
      const { Session } = await import('../../entities');
      const session = await em.findOne(Session, { sid: sessionId });
      if (session) {
        const data = { ...session.data };
        delete data['pendingMfaUserId'];
        session.data = data;
        session.mfaVerified = true;
        await em.flush();
      }
    }

    res.status(200).json({
      message: 'MFA verification successful',
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
    req.log.error({ err }, 'MFA verify error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/mfa/verify-recovery
 * Verify MFA using a recovery code
 */
router.post('/mfa/verify-recovery', async (req: Request, res: Response) => {
  try {
    const validation = mfaRecoverySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.flatten(),
      });
      return;
    }

    const sessionId = (req.cookies as Record<string, string>)['sid'];
    const pendingMfaUserId = await getPendingMfaUserId(req);
    if (!pendingMfaUserId) {
      res.status(400).json({
        error: 'No pending MFA verification',
        errorCode: MfaErrorCode.NO_PENDING_MFA,
      });
      return;
    }

    const { recoveryCode } = validation.data;
    const orm = getORM();
    const result = await verifyMfaRecoveryCode(
      orm.em.fork(),
      pendingMfaUserId,
      recoveryCode,
      sessionId ?? req.sessionID,
      getClientIp(req),
      getUserAgent(req),
    );

    if (!result.success) {
      res.status(401).json({
        error: result.error,
        errorCode: result.errorCode,
      });
      return;
    }

    // Clear pending MFA from database session and mark as verified
    if (sessionId) {
      const em = orm.em.fork();
      const { Session } = await import('../../entities');
      const session = await em.findOne(Session, { sid: sessionId });
      if (session) {
        const data = { ...session.data };
        delete data['pendingMfaUserId'];
        session.data = data;
        session.mfaVerified = true;
        await em.flush();
      }
    }

    res.status(200).json({
      message: 'Recovery code verification successful',
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
    req.log.error({ err }, 'MFA recovery verify error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/mfa/enable
 * Enable MFA for the authenticated user
 */
router.post('/mfa/enable', async (req: Request, res: Response) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const orm = getORM();
    const result = await enableMfa(
      orm.em.fork(),
      userId,
      getClientIp(req),
      getUserAgent(req),
    );

    if (!result.success) {
      res.status(400).json({
        error: result.error,
        errorCode: result.errorCode,
      });
      return;
    }

    res.status(200).json({
      message: 'MFA enabled successfully',
      recoveryCodes: result.recoveryCodes,
    });
  } catch (err) {
    req.log.error({ err }, 'MFA enable error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/mfa/disable
 * Disable MFA for the authenticated user
 */
router.post('/mfa/disable', async (req: Request, res: Response) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const orm = getORM();
    const result = await disableMfa(
      orm.em.fork(),
      userId,
      getClientIp(req),
      getUserAgent(req),
    );

    if (!result.success) {
      res.status(400).json({
        error: result.error,
        errorCode: result.errorCode,
      });
      return;
    }

    res.status(200).json({
      message: 'MFA disabled successfully',
    });
  } catch (err) {
    req.log.error({ err }, 'MFA disable error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/mfa/status
 * Get MFA status for the authenticated user
 */
router.get('/mfa/status', async (req: Request, res: Response) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const orm = getORM();
    const em = orm.em.fork();

    const { User } = await import('../../entities');
    const user = await em.findOne(User, { id: userId });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const recoveryCodeCount = user.mfaEnabled
      ? await getRecoveryCodeCount(em, userId)
      : 0;

    res.status(200).json({
      mfaEnabled: user.mfaEnabled,
      mfaEnabledAt: user.mfaEnabledAt,
      recoveryCodesRemaining: recoveryCodeCount,
    });
  } catch (err) {
    req.log.error({ err }, 'MFA status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/mfa/regenerate-recovery-codes
 * Regenerate recovery codes for the authenticated user
 */
router.post(
  '/mfa/regenerate-recovery-codes',
  async (req: Request, res: Response) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const orm = getORM();
      const result = await regenerateRecoveryCodes(
        orm.em.fork(),
        userId,
        getClientIp(req),
        getUserAgent(req),
      );

      if (!result.success) {
        res.status(400).json({
          error: result.error,
          errorCode: result.errorCode,
        });
        return;
      }

      res.status(200).json({
        message: 'Recovery codes regenerated',
        recoveryCodes: result.recoveryCodes,
      });
    } catch (err) {
      req.log.error({ err }, 'MFA regenerate recovery codes error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
