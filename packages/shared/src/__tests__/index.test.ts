import { describe, it, expect } from 'vitest';

import {
  ErrorCode,
  ERROR_MESSAGES,
  getErrorMessage,
  isClientError,
  isServerError,
  isRetryableError,
} from '../index';

import type {
  ApiError,
  LoginRequest,
  CurrentUser,
  Pagination,
  Role,
  UserListItem,
} from '../index';

describe('Shared Package', () => {
  describe('Type Exports', () => {
    it('should export auth types', () => {
      // Type check - this tests that the types compile correctly
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
        source: 'web',
        rememberMe: true,
      };
      expect(loginRequest.email).toBe('test@example.com');
    });

    it('should export user types', () => {
      const user: CurrentUser = {
        id: '123',
        email: 'test@example.com',
        nameFirst: 'John',
        nameLast: 'Doe',
        emailVerified: true,
        mfaEnabled: false,
        userType: 'company',
        company: { id: 'company-1', name: 'Test Company' },
      };
      expect(user.id).toBe('123');
    });

    it('should export pagination types', () => {
      const pagination: Pagination = {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
      };
      expect(pagination.totalPages).toBe(5);
    });

    it('should export role types', () => {
      const role: Role = {
        id: 'role-1',
        name: 'admin',
        displayName: 'Administrator',
        type: 'system',
        permissions: ['user:read', 'user:create'],
        isDefault: false,
        isSystemRole: true,
        createdAt: new Date().toISOString(),
      };
      expect(role.type).toBe('system');
    });

    it('should export user list item types', () => {
      const userItem: UserListItem = {
        id: '123',
        email: 'test@example.com',
        isActive: true,
        mfaEnabled: false,
        emailVerified: true,
        currentOffice: { id: 'office-1', name: 'HQ' },
        roles: [{ id: 'role-1', name: 'admin', displayName: 'Admin' }],
        createdAt: new Date().toISOString(),
      };
      expect(userItem.isActive).toBe(true);
    });
  });

  describe('Error Code Enum', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });

    it('should have user-friendly messages for all error codes', () => {
      // Verify all error codes have corresponding messages
      const codes = Object.values(ErrorCode);
      codes.forEach(code => {
        expect(ERROR_MESSAGES[code]).toBeDefined();
        expect(typeof ERROR_MESSAGES[code]).toBe('string');
      });
    });
  });

  describe('Error Helper Functions', () => {
    const validationError: ApiError = {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      timestamp: new Date().toISOString(),
    };

    const serverError: ApiError = {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Something went wrong',
      timestamp: new Date().toISOString(),
    };

    const connectionError: ApiError = {
      code: ErrorCode.CONNECTION_ERROR,
      message: 'Connection lost',
      timestamp: new Date().toISOString(),
    };

    describe('getErrorMessage', () => {
      it('should return the error message if available', () => {
        expect(getErrorMessage(validationError)).toBe('Validation failed');
      });

      it('should return default message if error message is empty', () => {
        const errorWithoutMessage: ApiError = {
          code: ErrorCode.UNAUTHORIZED,
          message: '',
          timestamp: new Date().toISOString(),
        };
        expect(getErrorMessage(errorWithoutMessage)).toBe(
          ERROR_MESSAGES[ErrorCode.UNAUTHORIZED],
        );
      });
    });

    describe('isClientError', () => {
      it('should return true for client errors', () => {
        expect(isClientError(validationError)).toBe(true);
      });

      it('should return false for server errors', () => {
        expect(isClientError(serverError)).toBe(false);
      });
    });

    describe('isServerError', () => {
      it('should return true for server errors', () => {
        expect(isServerError(serverError)).toBe(true);
      });

      it('should return false for client errors', () => {
        expect(isServerError(validationError)).toBe(false);
      });
    });

    describe('isRetryableError', () => {
      it('should return true for retryable errors', () => {
        expect(isRetryableError(connectionError)).toBe(true);
      });

      it('should return false for non-retryable errors', () => {
        expect(isRetryableError(validationError)).toBe(false);
      });
    });
  });
});
