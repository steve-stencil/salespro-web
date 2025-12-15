import { getORM } from '../lib/db';
import { PermissionService } from '../services/PermissionService';

import type { User, Company } from '../entities';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Extended request type with user attached by requireAuth middleware
 */
type AuthenticatedRequest = Request & {
  user?: User & { company?: Company };
};

/**
 * Middleware that requires a specific permission.
 * Must be used AFTER requireAuth() middleware.
 *
 * @param permission - The permission string to check (e.g., 'customer:read')
 * @returns Express middleware handler
 *
 * @example
 * ```typescript
 * router.get('/customers', requireAuth(), requirePermission('customer:read'), handler);
 * ```
 */
export function requirePermission(permission: string): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const company = user?.company;

      if (!user || !company) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      const hasAccess = await permissionService.hasPermission(
        user.id,
        permission,
        company.id,
      );

      if (!hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Missing required permission: ${permission}`,
          requiredPermission: permission,
        });
        return;
      }

      next();
    } catch (err) {
      req.log.error({ err }, 'Permission middleware error');
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware that requires ALL of the specified permissions.
 * Must be used AFTER requireAuth() middleware.
 *
 * @param permissions - Array of permission strings to check
 * @returns Express middleware handler
 *
 * @example
 * ```typescript
 * router.delete('/customers/:id', requireAuth(), requireAllPermissions(['customer:read', 'customer:delete']), handler);
 * ```
 */
export function requireAllPermissions(permissions: string[]): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const company = user?.company;

      if (!user || !company) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      const hasAccess = await permissionService.hasAllPermissions(
        user.id,
        permissions,
        company.id,
      );

      if (!hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Missing required permissions',
          requiredPermissions: permissions,
        });
        return;
      }

      next();
    } catch (err) {
      req.log.error({ err }, 'Permission middleware error');
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware that requires ANY of the specified permissions.
 * Must be used AFTER requireAuth() middleware.
 *
 * @param permissions - Array of permission strings to check (user needs at least one)
 * @returns Express middleware handler
 *
 * @example
 * ```typescript
 * router.get('/reports', requireAuth(), requireAnyPermission(['report:read', 'admin:*']), handler);
 * ```
 */
export function requireAnyPermission(permissions: string[]): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const company = user?.company;

      if (!user || !company) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      const hasAccess = await permissionService.hasAnyPermission(
        user.id,
        permissions,
        company.id,
      );

      if (!hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Missing required permissions (need at least one)',
          requiredPermissions: permissions,
        });
        return;
      }

      next();
    } catch (err) {
      req.log.error({ err }, 'Permission middleware error');
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
