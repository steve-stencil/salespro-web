import { Router } from 'express';

import authRoutes from './auth';
import companyRoutes from './companies';
import companyLogoRoutes from './company-logos';
import documentTemplateRoutes from './document-templates';
import documentTypeRoutes from './document-types';
import etlRoutes from './etl';
import fileRoutes from './files';
import internalUserRoutes from './internal-users';
import inviteRoutes from './invites';
import mobileRoutes from './mobile';
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

// User invite management routes (protected) - MUST be before /users to avoid /:id conflict
r.use('/users/invites', inviteRoutes);

// User management routes
r.use('/users', userRoutes);

// Public invite routes (validate and accept)
r.use('/invites', inviteRoutes);

// Office management routes
r.use('/offices', officeRoutes);

// Company logo library routes (must be before /companies to avoid conflicts)
r.use('/companies/logos', companyLogoRoutes);

// Company settings routes
r.use('/companies', companyRoutes);

// File management routes
r.use('/files', fileRoutes);

// Document template routes (ingest/ETL)
r.use('/document-templates', documentTemplateRoutes);

// Document type routes
r.use('/document-types', documentTypeRoutes);

// ETL routes for template import
r.use('/etl', etlRoutes);

// Mobile app routes
r.use('/mobile', mobileRoutes);

// Platform routes (internal users only)
r.use('/platform', platformRoutes);

// Internal user management routes
r.use('/internal-users', internalUserRoutes);

export default r;
