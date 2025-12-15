import { Router } from 'express';

import authRoutes from './auth';
import oauthRoutes from './oauth';
import roleRoutes from './roles';

import type { Request, Response, Router as ExpressRouter } from 'express';

const r: ExpressRouter = Router();

// Health check endpoints
r.get('/healthz', (_req: Request, res: Response) => res.json({ status: 'ok' }));
r.get('/readyz', (_req: Request, res: Response) =>
  res.json({ status: 'ready' }),
);

// Auth routes
r.use('/auth', authRoutes);

// OAuth routes
r.use('/oauth', oauthRoutes);

// Role & Permission routes
r.use('/roles', roleRoutes);

export default r;
