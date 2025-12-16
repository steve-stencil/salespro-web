import { Router } from 'express';

import authRoutes from './auth';
import fileRoutes from './files';
import internalUserRoutes from './internal-users';
import oauthRoutes from './oauth';
import officeRoutes from './offices';
import platformRoutes from './platform';
import roleRoutes from './roles';
import userRoutes from './users';

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

// User management routes
r.use('/users', userRoutes);

// Office management routes
r.use('/offices', officeRoutes);

// File management routes
r.use('/files', fileRoutes);

// Platform routes (internal users only)
r.use('/platform', platformRoutes);

// Internal user management routes
r.use('/internal-users', internalUserRoutes);

export default r;
