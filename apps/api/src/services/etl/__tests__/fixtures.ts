/**
 * Test Fixtures for ETL Migration Tests
 *
 * Provides factory functions for creating consistent test data
 * across migration-related tests.
 */

import { v4 as uuid } from 'uuid';

import type { MigrationSessionStatus } from '../../../entities';
import type { RawSourceOffice, LegacySourceOffice } from '../types';

// ============================================================================
// Source Office Fixtures
// ============================================================================

/**
 * Create a mock raw source office from legacy MongoDB.
 */
export function createMockSourceOffice(
  overrides?: Partial<RawSourceOffice>,
): RawSourceOffice {
  const objectId = overrides?.objectId ?? `office-${uuid().slice(0, 8)}`;
  return {
    objectId,
    name: overrides?.name ?? `Test Office ${objectId}`,
    sourceCompanyId:
      overrides?.sourceCompanyId ?? `company-${uuid().slice(0, 8)}`,
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Create a mock legacy source office for preview UI.
 */
export function createMockLegacyOffice(
  overrides?: Partial<LegacySourceOffice>,
): LegacySourceOffice {
  const objectId = overrides?.objectId ?? `office-${uuid().slice(0, 8)}`;
  return {
    objectId,
    name: overrides?.name ?? `Test Office ${objectId}`,
  };
}

/**
 * Create multiple mock source offices.
 */
export function createMockSourceOffices(
  count: number,
  sourceCompanyId?: string,
): RawSourceOffice[] {
  const companyId = sourceCompanyId ?? `company-${uuid().slice(0, 8)}`;
  return Array.from({ length: count }, (_, i) =>
    createMockSourceOffice({
      objectId: `office-${i + 1}`,
      name: `Office ${i + 1}`,
      sourceCompanyId: companyId,
    }),
  );
}

// ============================================================================
// Migration Session Fixtures
// ============================================================================

/**
 * Create a mock migration session response.
 */
export function createMockSessionResponse(
  overrides?: Partial<{
    id: string;
    status: MigrationSessionStatus | string;
    sourceCompanyId: string;
    totalCount: number;
    importedCount: number;
    skippedCount: number;
    errorCount: number;
    errors: Array<{ sourceId: string; error: string }>;
    createdAt: string;
    completedAt: string | null;
  }>,
): {
  id: string;
  status: string;
  sourceCompanyId: string;
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ sourceId: string; error: string }>;
  createdAt: string;
  completedAt: string | null;
} {
  return {
    id: overrides?.id ?? uuid(),
    status: overrides?.status ?? 'pending',
    sourceCompanyId:
      overrides?.sourceCompanyId ?? `company-${uuid().slice(0, 8)}`,
    totalCount: overrides?.totalCount ?? 0,
    importedCount: overrides?.importedCount ?? 0,
    skippedCount: overrides?.skippedCount ?? 0,
    errorCount: overrides?.errorCount ?? 0,
    errors: overrides?.errors ?? [],
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    completedAt: overrides?.completedAt ?? null,
  };
}

// ============================================================================
// Batch Import Fixtures
// ============================================================================

/**
 * Create a mock batch import result.
 */
export function createMockBatchResult(
  overrides?: Partial<{
    importedCount: number;
    skippedCount: number;
    errorCount: number;
    errors: Array<{ sourceId: string; error: string }>;
    hasMore: boolean;
  }>,
): {
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ sourceId: string; error: string }>;
  hasMore: boolean;
} {
  return {
    importedCount: overrides?.importedCount ?? 0,
    skippedCount: overrides?.skippedCount ?? 0,
    errorCount: overrides?.errorCount ?? 0,
    errors: overrides?.errors ?? [],
    hasMore: overrides?.hasMore ?? false,
  };
}

// ============================================================================
// Source Company Fixtures
// ============================================================================

/**
 * Create a mock source company ID for testing.
 */
export function createMockSourceCompanyId(): string {
  return `srcCompany-${uuid().slice(0, 8)}`;
}

// ============================================================================
// MongoDB Document Fixtures (for query tests)
// ============================================================================

/**
 * Create a mock MongoDB Office document structure.
 */
export function createMockMongoOfficeDoc(
  sourceCompanyId: string,
  overrides?: Partial<{
    _id: string;
    name: string;
    _created_at: Date;
    _updated_at: Date;
  }>,
): {
  _id: string;
  name: string;
  _p_company: string;
  _created_at: Date;
  _updated_at: Date;
} {
  const now = new Date();
  return {
    _id: overrides?._id ?? `office-${uuid().slice(0, 8)}`,
    name: overrides?.name ?? 'Test Office',
    _p_company: `Company$${sourceCompanyId}`,
    _created_at: overrides?._created_at ?? now,
    _updated_at: overrides?._updated_at ?? now,
  };
}

/**
 * Create a mock MongoDB User document with company pointer.
 */
export function createMockMongoUserDoc(
  sourceCompanyId: string,
  overrides?: Partial<{
    _id: string;
    username: string;
    email: string;
  }>,
): {
  _id: string;
  username: string;
  email: string;
  _p_company: string;
} {
  return {
    _id: overrides?._id ?? `user-${uuid().slice(0, 8)}`,
    username: overrides?.username ?? 'testuser',
    email: overrides?.email ?? 'test@example.com',
    _p_company: `Company$${sourceCompanyId}`,
  };
}

// ============================================================================
// Error Fixtures
// ============================================================================

/**
 * Create mock import error entries.
 */
export function createMockImportErrors(
  count: number,
): Array<{ sourceId: string; error: string }> {
  return Array.from({ length: count }, (_, i) => ({
    sourceId: `failed-office-${i + 1}`,
    error: `Import failed for office ${i + 1}: duplicate entry`,
  }));
}
