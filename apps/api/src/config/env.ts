import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  /** Session secret for express-session (required in production) */
  SESSION_SECRET: z.string().optional(),

  // AWS SES Configuration
  /** AWS region for SES (e.g., us-east-1) */
  AWS_REGION: z.string().default('us-east-1'),
  /** Verified sender email address in SES */
  SES_FROM_EMAIL: z.email().optional(),
  /** Frontend app URL for password reset links */
  APP_URL: z.url().default('http://localhost:5173'),
});

export const env = EnvSchema.parse(process.env);

export type Env = typeof env;
