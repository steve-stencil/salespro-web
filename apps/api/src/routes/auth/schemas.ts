import { z } from 'zod';

import { SessionSource } from '../../entities';

/** Extend express-session types */
declare module 'express-session' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Must use interface for module augmentation (interfaces merge, types don't)
  interface SessionData {
    userId?: string | undefined;
    companyId?: string | undefined;
    pendingMfaUserId?: string | undefined;
    /** Used to extend session after MFA verification */
    rememberMe?: boolean | undefined;
  }
}

/** Login request validation schema */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  source: z.nativeEnum(SessionSource).optional().default(SessionSource.WEB),
  rememberMe: z.boolean().optional().default(false),
});

/** Password reset request schema */
export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

/** Password reset schema */
export const passwordResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

/** Password change schema */
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/** MFA code verification schema */
export const mfaVerifySchema = z.object({
  code: z.string().length(6, 'MFA code must be 6 digits'),
  /** Whether to trust this device for future logins (skip MFA for 30 days) */
  trustDevice: z.boolean().optional().default(false),
});

/** MFA recovery code verification schema */
export const mfaRecoverySchema = z.object({
  recoveryCode: z.string().min(8, 'Invalid recovery code format'),
});
