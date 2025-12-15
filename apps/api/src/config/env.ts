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
});

export const env = EnvSchema.parse(process.env);

export type Env = typeof env;
