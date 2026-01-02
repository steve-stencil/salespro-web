/**
 * Shared types and utilities for SalesPro Web.
 *
 * This package contains types, schemas, and utilities that are shared
 * across the API and Web applications (and any future apps).
 *
 * Usage:
 *   import type { User, LoginRequest } from '@shared/types';
 *   import { ErrorCode, getErrorMessage } from '@shared/types';
 *   import { formatPrice, flattenCategoryTree } from '@shared/utils';
 */

// Re-export all types
export * from './types';

// Re-export all utilities
export * from './utils';
