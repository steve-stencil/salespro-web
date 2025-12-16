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

  // S3 Storage Configuration (optional - falls back to local storage if not set)
  /** S3 bucket name for file storage */
  S3_BUCKET: z.string().optional(),
  /** S3 region (defaults to AWS_REGION if not set) */
  S3_REGION: z.string().optional(),

  // File Upload Configuration
  /** Maximum file size in megabytes (default: 10MB) */
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  /** Comma-separated list of allowed MIME types/extensions */
  ALLOWED_FILE_TYPES: z
    .string()
    .default('image/*,application/pdf,.doc,.docx,.xls,.xlsx'),
});

export const env = EnvSchema.parse(process.env);

export type Env = typeof env;
