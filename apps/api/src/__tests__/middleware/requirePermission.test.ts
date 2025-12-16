/* eslint-disable @typescript-eslint/unbound-method */
import { v4 as uuid } from 'uuid';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
} from '../../middleware/requirePermission';

import type { User, Company } from '../../entities';
import type { Request, Response, NextFunction } from 'express';

// Mock dependencies
vi.mock('../../lib/db', () => ({
  getORM: vi.fn(() => ({
    em: {
      fork: vi.fn(() => ({})),
    },
  })),
}));

// Mock PermissionService - now uses checkPermission for both user types
const mockCheckPermission = vi.fn();

vi.mock('../../services/PermissionService', () => ({
  PermissionService: class MockPermissionService {
    checkPermission = mockCheckPermission;
  },
}));

// Mock isPlatformPermission
vi.mock('../../lib/permissions', () => ({
  isPlatformPermission: vi.fn(() => false),
}));

/**
 * Create a mock request with authenticated user and company context
 * This matches the AuthenticatedRequest type from requireAuth middleware
 */
function createMockRequest(options?: {
  user?: Partial<User>;
  companyContext?: Partial<Company>;
  isInternalUser?: boolean;
}): Request {
  return {
    user: options?.user
      ? {
          id: options.user.id ?? uuid(),
          ...options.user,
        }
      : undefined,
    companyContext: options?.companyContext
      ? {
          id: options.companyContext.id ?? uuid(),
          ...options.companyContext,
        }
      : undefined,
    isInternalUser: options?.isInternalUser ?? false,
    log: {
      error: vi.fn(),
    },
  } as unknown as Request;
}

/**
 * Create a mock response
 */
function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('requirePermission middleware', () => {
  let mockNext: NextFunction;
  let mockRes: Response;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
    mockRes = createMockResponse();
  });

  describe('requirePermission', () => {
    it('should call next() when user has required permission', async () => {
      const userId = uuid();
      const companyId = uuid();
      const mockReq = createMockRequest({
        user: { id: userId },
        companyContext: { id: companyId },
      });

      mockCheckPermission.mockResolvedValue(true);

      const middleware = requirePermission('customer:read');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockCheckPermission).toHaveBeenCalledWith(
        userId,
        'customer:read',
        companyId,
      );
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks permission', async () => {
      const mockReq = createMockRequest({
        user: { id: uuid() },
        companyContext: { id: uuid() },
      });

      mockCheckPermission.mockResolvedValue(false);

      const middleware = requirePermission('customer:delete');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Missing required permission: customer:delete',
        requiredPermission: 'customer:delete',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockReq = createMockRequest();

      const middleware = requirePermission('customer:read');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should return 400 for internal user with no company context', async () => {
      const mockReq = createMockRequest({
        user: { id: uuid() },
        companyContext: undefined,
        isInternalUser: true,
      });

      const middleware = requirePermission('customer:read');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'No active company selected. Switch to a company first.',
      });
    });

    it('should return 401 for company user with no company context', async () => {
      const mockReq = createMockRequest({
        user: { id: uuid() },
        companyContext: undefined,
        isInternalUser: false,
      });

      const middleware = requirePermission('customer:read');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 500 on unexpected error', async () => {
      const mockReq = createMockRequest({
        user: { id: uuid() },
        companyContext: { id: uuid() },
      });

      mockCheckPermission.mockRejectedValue(new Error('Database error'));

      const middleware = requirePermission('customer:read');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
    });
  });

  describe('requireAllPermissions', () => {
    it('should call next() when user has all required permissions', async () => {
      const mockReq = createMockRequest({
        user: { id: uuid() },
        companyContext: { id: uuid() },
      });

      // checkPermission is called for each permission
      mockCheckPermission.mockResolvedValue(true);

      const middleware = requireAllPermissions([
        'customer:read',
        'customer:delete',
      ]);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockCheckPermission).toHaveBeenCalledTimes(2);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when user lacks any required permission', async () => {
      const mockReq = createMockRequest({
        user: { id: uuid() },
        companyContext: { id: uuid() },
      });

      // First permission passes, second fails
      mockCheckPermission
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const middleware = requireAllPermissions([
        'customer:read',
        'customer:delete',
      ]);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Missing required permissions',
        requiredPermissions: ['customer:read', 'customer:delete'],
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockReq = createMockRequest();

      const middleware = requireAllPermissions(['customer:read']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAnyPermission', () => {
    it('should call next() when user has at least one permission', async () => {
      const mockReq = createMockRequest({
        user: { id: uuid() },
        companyContext: { id: uuid() },
      });

      // First permission fails, second passes
      mockCheckPermission
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const middleware = requireAnyPermission(['customer:read', 'admin:*']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockCheckPermission).toHaveBeenCalledTimes(2);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when user has none of the permissions', async () => {
      const mockReq = createMockRequest({
        user: { id: uuid() },
        companyContext: { id: uuid() },
      });

      mockCheckPermission.mockResolvedValue(false);

      const middleware = requireAnyPermission(['customer:delete', 'admin:*']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Missing required permissions (need at least one)',
        requiredPermissions: ['customer:delete', 'admin:*'],
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockReq = createMockRequest();

      const middleware = requireAnyPermission(['customer:read']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 500 on unexpected error', async () => {
      const mockReq = createMockRequest({
        user: { id: uuid() },
        companyContext: { id: uuid() },
      });

      mockCheckPermission.mockRejectedValue(new Error('Service error'));

      const middleware = requireAnyPermission(['customer:read']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
