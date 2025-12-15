import { z } from 'zod';

import { SessionSource } from '../../entities';

/** Extend express-session types */
declare module 'express-session' {
  interface SessionData {
    userId?: string | undefined;
    companyId?: string | undefined;
    pendingMfaUserId?: string | undefined;
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
