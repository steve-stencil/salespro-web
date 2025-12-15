import { vi } from 'vitest';

// Mock environment variables
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] =
  'postgresql://postgres:postgres@localhost:5433/salespro_test';
process.env['PORT'] = '3001';
process.env['SESSION_SECRET'] =
  'test-session-secret-at-least-32-characters-long';

// Mock pino logger
vi.mock('pino', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

// Mock pino-http
vi.mock('pino-http', () => ({
  __esModule: true,
  default: vi.fn(
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  ),
}));
