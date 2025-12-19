import { getORM } from '../lib/db';
import { isPlatformPermission } from '../lib/permissions';
import { PermissionService } from '../services/PermissionService';

import type { User, Company } from '../entities';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Extended request type with user and context attached by requireAuth middleware
 */
type AuthenticatedRequest = Request & {
  user?: User & { company?: Company };
  isInternalUser?: boolean;
  companyContext?: Company;
};

/**
 * Middleware that requires a specific permission.
 * Must be used AFTER requireAuth() middleware.
 *
 * Handles both company users and internal users:
 * - Company users: checks their assigned roles in their company
 * - Internal users: for platform permissions, checks platform role;
 *   for company permissions, checks platform role's companyPermissions
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
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const isInternalUser = authReq.isInternalUser;
      const companyContext = authReq.companyContext;

      if (!user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      // For platform permissions, internal users don't need company context
      if (isPlatformPermission(permission)) {
        if (!isInternalUser) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Platform permissions require an internal user account',
            requiredPermission: permission,
          });
          return;
        }

        const hasAccess =
          await permissionService.hasInternalUserPlatformPermission(
            user.id,
            permission,
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
        return;
      }

      // For company/resource permissions, need a company context
      if (!companyContext) {
        if (isInternalUser) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'No active company selected. Switch to a company first.',
          });
        } else {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required',
          });
        }
        return;
      }

      // Use universal permission check that handles both user types
      const hasAccess = await permissionService.checkPermission(
        user.id,
        permission,
        companyContext.id,
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
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const companyContext = authReq.companyContext;

      if (!user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      if (!companyContext) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'No active company context',
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      // Check all permissions using universal check
      const results = await Promise.all(
        permissions.map(perm =>
          permissionService.checkPermission(user.id, perm, companyContext.id),
        ),
      );

      const hasAccess = results.every(Boolean);

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
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const companyContext = authReq.companyContext;

      if (!user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      if (!companyContext) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'No active company context',
        });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork();
      const permissionService = new PermissionService(em);

      // Check any permission using universal check
      const results = await Promise.all(
        permissions.map(perm =>
          permissionService.checkPermission(user.id, perm, companyContext.id),
        ),
      );

      const hasAccess = results.some(Boolean);

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

/**
 * Middleware that requires the user to be an internal platform user.
 * Must be used AFTER requireAuth() middleware.
 *
 * @returns Express middleware handler
 *
 * @example
 * ```typescript
 * router.get('/platform/companies', requireAuth(), requireInternalUser(), handler);
 * ```
 */
export function requireInternalUser(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!authReq.isInternalUser) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'This endpoint requires an internal platform user account',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that requires an active company context.
 * For internal users, they must have switched to a company.
 * For company users, this is always true after authentication.
 * Must be used AFTER requireAuth() middleware.
 *
 * @returns Express middleware handler
 */
export function requireCompanyContext(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!authReq.companyContext) {
      res.status(400).json({
        error: 'Bad Request',
        message: authReq.isInternalUser
          ? 'No active company selected. Please switch to a company first.'
          : 'No company context available',
      });
      return;
    }

    next();
  };
}
