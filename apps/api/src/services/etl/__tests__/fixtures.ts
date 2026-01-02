/**
 * Test Fixtures for ETL Migration Tests
 *
 * Provides factory functions for creating consistent test data
 * across migration-related tests.
 */

import { v4 as uuid } from 'uuid';

import type { MigrationSessionStatus } from '../../../entities';
import type {
  LegacyAdditionalDetailObject,
  LegacyCategoryConfig,
  LegacySourceOffice,
  RawSourceMSI,
  RawSourceOffice,
  RawSourcePGI,
} from '../types';

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

// ============================================================================
// Price Guide Fixtures
// ============================================================================

/**
 * Create a mock legacy category config.
 */
export function createMockCategoryConfig(
  overrides?: Partial<LegacyCategoryConfig>,
): LegacyCategoryConfig {
  return {
    name: overrides?.name ?? `Category-${uuid().slice(0, 8)}`,
    order: overrides?.order ?? 0,
    type: overrides?.type ?? 'default',
    objectId: overrides?.objectId,
    isLocked: overrides?.isLocked,
  };
}

/**
 * Create multiple mock category configs.
 */
export function createMockCategoryConfigs(
  count: number,
): LegacyCategoryConfig[] {
  return Array.from({ length: count }, (_, i) =>
    createMockCategoryConfig({
      name: `Category ${i + 1}`,
      order: i + 1,
    }),
  );
}

/**
 * Create a mock raw source MSI.
 */
export function createMockSourceMSI(
  overrides?: Partial<RawSourceMSI>,
): RawSourceMSI {
  const objectId = overrides?.objectId ?? `msi-${uuid().slice(0, 8)}`;
  return {
    objectId,
    itemName: overrides?.itemName ?? `Test MSI ${objectId}`,
    itemNote: overrides?.itemNote,
    category: overrides?.category ?? 'Default Category',
    subCategory: overrides?.subCategory,
    subSubCategories: overrides?.subSubCategories,
    measurementType: overrides?.measurementType ?? 'each',
    orderNumber_: overrides?.orderNumber_,
    shouldShowSwitch: overrides?.shouldShowSwitch ?? false,
    defaultQty: overrides?.defaultQty ?? 1,
    formulaID: overrides?.formulaID,
    qtyFormula: overrides?.qtyFormula,
    image: overrides?.image,
    items: overrides?.items,
    accessories: overrides?.accessories,
    includedOffices: overrides?.includedOffices,
    additionalDetailObjects: overrides?.additionalDetailObjects,
    tagTitle: overrides?.tagTitle,
    tagInputType: overrides?.tagInputType,
    tagRequired: overrides?.tagRequired,
    tagPickerOptions: overrides?.tagPickerOptions,
    tagParams: overrides?.tagParams,
    placeholders: overrides?.placeholders,
    sourceCompanyId:
      overrides?.sourceCompanyId ?? `company-${uuid().slice(0, 8)}`,
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Create multiple mock source MSIs.
 */
export function createMockSourceMSIs(
  count: number,
  sourceCompanyId?: string,
): RawSourceMSI[] {
  const companyId = sourceCompanyId ?? `company-${uuid().slice(0, 8)}`;
  return Array.from({ length: count }, (_, i) =>
    createMockSourceMSI({
      objectId: `msi-${i + 1}`,
      itemName: `MSI ${i + 1}`,
      category: 'Test Category',
      subCategory: `Sub ${(i % 3) + 1}`,
      sourceCompanyId: companyId,
    }),
  );
}

/**
 * Create a mock raw source PGI (Option).
 */
export function createMockSourceOption(
  overrides?: Partial<RawSourcePGI>,
): RawSourcePGI {
  const objectId = overrides?.objectId ?? `opt-${uuid().slice(0, 8)}`;
  return {
    objectId,
    isAccessory: false,
    displayTitle: overrides?.displayTitle ?? `Test Option ${objectId}`,
    subCategory2: overrides?.subCategory2,
    itemPrices: overrides?.itemPrices ?? [],
    itemCodes: overrides?.itemCodes,
    sourceCompanyId:
      overrides?.sourceCompanyId ?? `company-${uuid().slice(0, 8)}`,
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Create a mock raw source PGI (UpCharge).
 */
export function createMockSourceUpCharge(
  overrides?: Partial<RawSourcePGI>,
): RawSourcePGI {
  const objectId = overrides?.objectId ?? `uc-${uuid().slice(0, 8)}`;
  return {
    objectId,
    isAccessory: true,
    name: overrides?.name ?? `Test UpCharge ${objectId}`,
    info: overrides?.info,
    identifier: overrides?.identifier,
    accessoryPrices: overrides?.accessoryPrices ?? [],
    percentagePrice: overrides?.percentagePrice ?? false,
    disabledParents: overrides?.disabledParents,
    additionalDetails: overrides?.additionalDetails,
    placeholders: overrides?.placeholders,
    sourceCompanyId:
      overrides?.sourceCompanyId ?? `company-${uuid().slice(0, 8)}`,
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Create multiple mock source options.
 */
export function createMockSourceOptions(
  count: number,
  sourceCompanyId?: string,
): RawSourcePGI[] {
  const companyId = sourceCompanyId ?? `company-${uuid().slice(0, 8)}`;
  return Array.from({ length: count }, (_, i) =>
    createMockSourceOption({
      objectId: `opt-${i + 1}`,
      displayTitle: `Option ${i + 1}`,
      sourceCompanyId: companyId,
      itemPrices: [
        { officeId: 'office-1', total: 100 + i * 10 },
        { officeId: 'office-2', total: 150 + i * 10 },
      ],
    }),
  );
}

/**
 * Create multiple mock source upcharges.
 */
export function createMockSourceUpCharges(
  count: number,
  sourceCompanyId?: string,
): RawSourcePGI[] {
  const companyId = sourceCompanyId ?? `company-${uuid().slice(0, 8)}`;
  return Array.from({ length: count }, (_, i) =>
    createMockSourceUpCharge({
      objectId: `uc-${i + 1}`,
      name: `UpCharge ${i + 1}`,
      sourceCompanyId: companyId,
    }),
  );
}

/**
 * Create a mock legacy additional detail object.
 */
export function createMockAdditionalDetail(
  overrides?: Partial<LegacyAdditionalDetailObject>,
): LegacyAdditionalDetailObject {
  return {
    objectId: overrides?.objectId ?? `ad-${uuid().slice(0, 8)}`,
    title: overrides?.title ?? 'Test Field',
    inputType: overrides?.inputType ?? 'default',
    cellType: overrides?.cellType,
    required: overrides?.required ?? false,
    shouldCopy: overrides?.shouldCopy ?? false,
    placeholder: overrides?.placeholder,
    note: overrides?.note,
    defaultValue: overrides?.defaultValue,
    notAddedReplacement: overrides?.notAddedReplacement,
    pickerValues: overrides?.pickerValues,
    dateDisplayFormat: overrides?.dateDisplayFormat,
    minSizePickerWidth: overrides?.minSizePickerWidth,
    maxSizePickerWidth: overrides?.maxSizePickerWidth,
    minSizePickerHeight: overrides?.minSizePickerHeight,
    maxSizePickerHeight: overrides?.maxSizePickerHeight,
    minSizePickerDepth: overrides?.minSizePickerDepth,
    maxSizePickerDepth: overrides?.maxSizePickerDepth,
    unitedInchSuffix: overrides?.unitedInchSuffix,
    disableTemplatePhotoLinking: overrides?.disableTemplatePhotoLinking,
  };
}

/**
 * Create a mock MSI with full category hierarchy.
 */
export function createMockMSIWithHierarchy(
  category: string,
  subCategory?: string,
  subSubCategories?: string,
): RawSourceMSI {
  return createMockSourceMSI({
    category,
    subCategory,
    subSubCategories,
  });
}

// ============================================================================
// MongoDB Document Fixtures for Price Guide
// ============================================================================

/**
 * Create a mock MongoDB MSI document structure.
 */
export function createMockMongoMSIDoc(
  sourceCompanyId: string,
  overrides?: Partial<{
    _id: string;
    itemName: string;
    category: string;
    subCategory: string;
    _created_at: Date;
  }>,
): {
  _id: string;
  itemName: string;
  category: string;
  subCategory?: string;
  measurementType: string;
  _p_company: string;
  _created_at: Date;
  _updated_at: Date;
} {
  const now = new Date();
  return {
    _id: overrides?._id ?? `msi-${uuid().slice(0, 8)}`,
    itemName: overrides?.itemName ?? 'Test MSI',
    category: overrides?.category ?? 'Test Category',
    subCategory: overrides?.subCategory,
    measurementType: 'each',
    _p_company: `Company$${sourceCompanyId}`,
    _created_at: overrides?._created_at ?? now,
    _updated_at: now,
  };
}

/**
 * Create a mock MongoDB PGI document structure.
 */
export function createMockMongoPGIDoc(
  sourceCompanyId: string,
  isAccessory: boolean,
  overrides?: Partial<{
    _id: string;
    displayTitle: string;
    name: string;
    _created_at: Date;
  }>,
): {
  _id: string;
  isAccessory: boolean;
  displayTitle?: string;
  name?: string;
  _p_company: string;
  _created_at: Date;
  _updated_at: Date;
} {
  const now = new Date();
  return {
    _id: overrides?._id ?? `pgi-${uuid().slice(0, 8)}`,
    isAccessory,
    displayTitle: isAccessory
      ? undefined
      : (overrides?.displayTitle ?? 'Test Option'),
    name: isAccessory ? (overrides?.name ?? 'Test UpCharge') : undefined,
    _p_company: `Company$${sourceCompanyId}`,
    _created_at: overrides?._created_at ?? now,
    _updated_at: now,
  };
}

/**
 * Create a mock MongoDB CustomConfig document structure.
 */
export function createMockMongoCustomConfigDoc(
  overrides?: Partial<{
    _id: string;
    categories_: LegacyCategoryConfig[];
  }>,
): {
  _id: string;
  categories_: LegacyCategoryConfig[];
  _created_at: Date;
  _updated_at: Date;
} {
  const now = new Date();
  return {
    _id: overrides?._id ?? `config-${uuid().slice(0, 8)}`,
    categories_: overrides?.categories_ ?? [
      { name: 'Windows', order: 1, type: 'default' },
      { name: 'Doors', order: 2, type: 'detail' },
    ],
    _created_at: now,
    _updated_at: now,
  };
}
