/**
 * Integration tests for price guide import/export routes.
 * Tests API endpoints for exporting and importing pricing data via Excel.
 */
import ExcelJS from 'exceljs';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';
import {
  createTestOption,
  createDefaultPriceTypesWithOffice,
  createTestOptionPrice,
  createTestCategory,
  createTestMeasureSheetItem,
  linkOptionToMeasureSheetItem,
  createTestTag,
  assignTagToEntity,
} from '../factories/price-guide';

import {
  createCompanySetup,
  createTestOffice,
  createUserWithPermissions,
} from './auth-test-helpers';
import { makeRequest, getTestApp } from './helpers';

import type { CompanySetup } from './auth-test-helpers';
import type {
  Office,
  PriceGuideOption,
  PriceObjectType,
  PriceGuideCategory,
  Tag,
} from '../../entities';
import type { TaggableEntityType } from '../../entities/price-guide/types';
import type { EntityManager } from '@mikro-orm/core';

describe('Price Guide Import/Export Routes', () => {
  let setup: CompanySetup;
  let office: Office;
  let office2: Office;
  let em: EntityManager;
  let priceTypes: PriceObjectType[];
  let testOptions: PriceGuideOption[];
  let testCategory: PriceGuideCategory;
  let testTag: Tag;

  beforeAll(() => {
    // Ensure test server is available
    getTestApp();
  });

  beforeEach(async () => {
    const orm = getORM();
    em = orm.em.fork();

    // Create company with office
    setup = await createCompanySetup({ createOffice: true });
    office = setup.office!;

    // Create second office
    office2 = await createTestOffice(em, setup.company, 'Office 2');

    // Create price types and assign to offices
    priceTypes = await createDefaultPriceTypesWithOffice(
      em,
      setup.company,
      office,
    );

    // Create test category
    testCategory = await createTestCategory(em, setup.company, {
      name: 'Windows',
    });

    // Create test tag
    testTag = await createTestTag(em, setup.company, {
      name: 'Premium',
      color: '#FF5733',
    });

    // Create test options with pricing
    testOptions = [];
    for (let i = 0; i < 3; i++) {
      const option = await createTestOption(em, setup.company, {
        name: `Test Window ${i + 1}`,
        brand: `Brand ${i + 1}`,
        itemCode: `WIN-00${i + 1}`,
      });
      testOptions.push(option);

      // Add pricing for each price type
      for (const pt of priceTypes) {
        await createTestOptionPrice(em, option, office, pt, {
          amount: (i + 1) * 100 + pt.sortOrder * 10,
        });
      }
    }

    // Link first option to category via MSI
    const msi = await createTestMeasureSheetItem(
      em,
      setup.company,
      testCategory,
      {
        name: 'Double Hung Window',
      },
    );
    await linkOptionToMeasureSheetItem(em, msi, testOptions[0]!);

    // Tag second option
    await assignTagToEntity(
      em,
      testTag,
      'OPTION' as TaggableEntityType,
      testOptions[1]!.id,
    );
  });

  /**
   * Helper: Create a valid Excel buffer for import testing.
   */
  async function createValidExcelBuffer(
    rows: Array<{
      optionId: string;
      officeId: string;
      optionName?: string;
      officeName?: string;
      prices: Record<string, number>;
    }>,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Option Prices');

    const headers = [
      'Option Name',
      'Brand',
      'Item Code',
      'Office Name',
      ...priceTypes.map(pt => pt.name),
      'Total',
      'Option ID',
      'Office ID',
    ];

    worksheet.addRow(headers);

    for (const row of rows) {
      const priceValues = priceTypes.map(pt => row.prices[pt.id] ?? 0);
      const total = priceValues.reduce((sum, val) => sum + val, 0);

      worksheet.addRow([
        row.optionName ?? 'Test Option',
        'Brand',
        'ITEM-001',
        row.officeName ?? 'Test Office',
        ...priceValues,
        total,
        row.optionId,
        row.officeId,
      ]);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Helper: Create an invalid file buffer.
   */
  function createInvalidFileBuffer(): Buffer {
    return Buffer.from('This is not a valid Excel file');
  }

  // ===========================================================================
  // Export Routes
  // ===========================================================================

  describe('GET /api/price-guide/pricing/options/export', () => {
    it('should export option prices as Excel file', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export')
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.xlsx');
    });

    it('should filter export by office IDs', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export')
        .query({ officeIds: office.id })
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
    });

    it('should filter export by option IDs', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export')
        .query({ optionIds: testOptions[0]!.id })
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
    });

    it('should filter export by category IDs (cascades to children)', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export')
        .query({ categoryIds: testCategory.id })
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
    });

    it('should filter export by tag IDs', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export')
        .query({ tagIds: testTag.id })
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
    });

    it('should filter export by multiple IDs (comma-separated)', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export')
        .query({ optionIds: `${testOptions[0]!.id},${testOptions[1]!.id}` })
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get(
        '/api/price-guide/pricing/options/export',
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 without price_guide:import_export permission', async () => {
      const noPermsUser = await createUserWithPermissions(
        em,
        setup.company,
        [PERMISSIONS.SETTINGS_READ], // Different permission
      );

      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export')
        .set('Cookie', noPermsUser.cookie);

      expect(response.status).toBe(403);
    });

    it('should allow export with price_guide:import_export permission', async () => {
      const exportUser = await createUserWithPermissions(em, setup.company, [
        PERMISSIONS.PRICE_GUIDE_IMPORT_EXPORT,
      ]);

      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export')
        .set('Cookie', exportUser.cookie);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/price-guide/pricing/options/export/count', () => {
    it('should return estimated row count for export', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export/count')
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.estimatedRows).toBeDefined();
      expect(typeof response.body.estimatedRows).toBe('number');
      // 3 options × 1 office = 3 rows (only first office has price type assignments)
      expect(response.body.estimatedRows).toBeGreaterThanOrEqual(3);
    });

    it('should return count filtered by office', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export/count')
        .query({ officeIds: office.id })
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.estimatedRows).toBeGreaterThan(0);
    });

    it('should return 0 when no matching options', async () => {
      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export/count')
        .query({ optionIds: '00000000-0000-0000-0000-000000000000' })
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.estimatedRows).toBe(0);
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get(
        '/api/price-guide/pricing/options/export/count',
      );

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // Import Preview Route
  // ===========================================================================

  describe('POST /api/price-guide/pricing/options/import/preview', () => {
    it('should preview a valid import file', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: 500 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBeDefined();
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalRows).toBe(1);
      expect(response.body.errors).toBeDefined();
      expect(response.body.preview).toBeDefined();
    });

    it('should return validation errors for invalid file', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: 'invalid-uuid',
          officeId: 'invalid-uuid',
          prices: { [priceTypes[0]!.id]: 500 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.summary.errors).toBeGreaterThan(0);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should return 400 when no file uploaded', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });

    it('should return 500 for corrupt file', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', createInvalidFileBuffer(), 'corrupt.xlsx');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Preview failed');
    });

    it('should return 401 without authentication', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: 500 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(401);
    });

    it('should return 403 without price_guide:import_export permission', async () => {
      const noPermsUser = await createUserWithPermissions(em, setup.company, [
        PERMISSIONS.SETTINGS_READ,
      ]);

      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: 500 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', noPermsUser.cookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(403);
    });

    it('should handle file with many errors and limit error count', async () => {
      const rows = [];
      for (let i = 0; i < 150; i++) {
        rows.push({
          optionId: 'invalid-uuid',
          officeId: 'invalid-uuid',
          prices: { [priceTypes[0]!.id]: 100 },
        });
      }

      const buffer = await createValidExcelBuffer(rows);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      // Errors array should be limited to 100
      expect(response.body.errors.length).toBeLessThanOrEqual(100);
      // But total error count should reflect actual errors
      expect(response.body.summary.errors).toBeGreaterThan(100);
    });
  });

  // ===========================================================================
  // Import Route
  // ===========================================================================

  describe('POST /api/price-guide/pricing/options/import', () => {
    it('should import valid file synchronously for small imports', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office2.id, // Using office2 to create new prices
          prices: { [priceTypes[0]!.id]: 999 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      // Small imports return 200 with immediate result
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.created).toBeDefined();
      expect(response.body.updated).toBeDefined();
      expect(response.body.skipped).toBeDefined();
    });

    it('should return 400 when validation fails and skipErrors is false', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: 'invalid-uuid',
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: 500 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.preview).toBeDefined();
    });

    it('should import with skipErrors=true continuing past errors', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: 'invalid-uuid', // Invalid - will be skipped
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: 500 },
        },
        {
          optionId: testOptions[0]!.id, // Valid - will be processed
          officeId: office2.id,
          prices: { [priceTypes[0]!.id]: 888 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import')
        .field('skipErrors', 'true')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 when no file uploaded', async () => {
      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import')
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });

    it('should return 401 without authentication', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: 500 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import')
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(401);
    });

    it('should return 403 without price_guide:import_export permission', async () => {
      const noPermsUser = await createUserWithPermissions(em, setup.company, [
        PERMISSIONS.SETTINGS_READ,
      ]);

      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: 500 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import')
        .set('Cookie', noPermsUser.cookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(403);
    });

    it('should update existing prices when values change', async () => {
      // First, check current price
      const getResponse1 = await makeRequest()
        .get(`/api/price-guide/pricing/options/${testOptions[0]!.id}`)
        .set('Cookie', setup.adminCookie);

      const originalPrice =
        getResponse1.body.pricing[0]?.prices[priceTypes[0]!.id];

      // Import with new price
      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: 12345 },
        },
      ]);

      const importResponse = await makeRequest()
        .post('/api/price-guide/pricing/options/import')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(importResponse.status).toBe(200);

      // Verify price was updated
      const getResponse2 = await makeRequest()
        .get(`/api/price-guide/pricing/options/${testOptions[0]!.id}`)
        .set('Cookie', setup.adminCookie);

      const newPrice = getResponse2.body.pricing[0]?.prices[priceTypes[0]!.id];
      expect(newPrice).toBe(12345);
      expect(newPrice).not.toBe(originalPrice);
    });
  });

  // ===========================================================================
  // Import Job Status Route
  // ===========================================================================

  describe('GET /api/price-guide/pricing/options/import/:jobId', () => {
    it('should return 404 for non-existent job', async () => {
      const response = await makeRequest()
        .get(
          '/api/price-guide/pricing/options/import/00000000-0000-0000-0000-000000000000',
        )
        .set('Cookie', setup.adminCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Import job not found');
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest().get(
        '/api/price-guide/pricing/options/import/00000000-0000-0000-0000-000000000000',
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 without price_guide:import_export permission', async () => {
      const noPermsUser = await createUserWithPermissions(em, setup.company, [
        PERMISSIONS.SETTINGS_READ,
      ]);

      const response = await makeRequest()
        .get(
          '/api/price-guide/pricing/options/import/00000000-0000-0000-0000-000000000000',
        )
        .set('Cookie', noPermsUser.cookie);

      expect(response.status).toBe(403);
    });
  });

  // ===========================================================================
  // File Type Validation
  // ===========================================================================

  describe('File Type Validation', () => {
    it('should reject non-Excel files by MIME type', async () => {
      const textBuffer = Buffer.from('name,price\noption1,100');

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', textBuffer, {
          filename: 'data.csv',
          contentType: 'text/csv',
        });

      // Multer should reject based on MIME type
      expect(response.status).toBe(500);
    });

    it('should accept .xlsx files', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: 500 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, {
          filename: 'test.xlsx',
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

      expect(response.status).toBe(200);
    });
  });

  // ===========================================================================
  // Cross-Company Security
  // ===========================================================================

  describe('Cross-Company Security', () => {
    it('should not export options from other companies', async () => {
      // Create another company with options
      const otherSetup = await createCompanySetup({ createOffice: true });
      const otherPriceTypes = await createDefaultPriceTypesWithOffice(
        em,
        otherSetup.company,
        otherSetup.office!,
      );
      const otherOption = await createTestOption(em, otherSetup.company, {
        name: 'Other Company Option',
      });
      for (const pt of otherPriceTypes) {
        await createTestOptionPrice(em, otherOption, otherSetup.office!, pt, {
          amount: 999,
        });
      }

      // Export from first company
      const response = await makeRequest()
        .get('/api/price-guide/pricing/options/export')
        .set('Cookie', setup.adminCookie)
        .responseType('arraybuffer');

      expect(response.status).toBe(200);

      // Parse the exported Excel file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(response.body as ArrayBuffer);

      const worksheet = workbook.getWorksheet(1);
      let foundOtherOption = false;

      worksheet?.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        const cellValue = row.getCell(1).value;
        // Handle various cell value types
        let optionName = '';
        if (typeof cellValue === 'string') {
          optionName = cellValue;
        } else if (
          typeof cellValue === 'number' ||
          typeof cellValue === 'boolean'
        ) {
          optionName = cellValue.toString();
        } else if (
          cellValue &&
          typeof cellValue === 'object' &&
          'richText' in cellValue
        ) {
          // Handle rich text
          const richText = cellValue as { richText: Array<{ text: string }> };
          optionName = richText.richText.map(rt => rt.text).join('');
        }
        if (optionName === 'Other Company Option') {
          foundOtherOption = true;
        }
      });

      expect(foundOtherOption).toBe(false);
    });

    it('should reject import of options from other companies', async () => {
      // Create another company with an option
      const otherSetup = await createCompanySetup({ createOffice: true });
      const otherOption = await createTestOption(em, otherSetup.company, {
        name: 'Other Company Option',
      });

      // Try to import using other company's option ID
      const buffer = await createValidExcelBuffer([
        {
          optionId: otherOption.id, // Option from different company
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: 500 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(
        response.body.errors.some((e: { message: string }) =>
          e.message.includes('not found in company'),
        ),
      ).toBe(true);
    });

    it('should reject import of offices from other companies', async () => {
      // Create another company with an office
      const otherSetup = await createCompanySetup({ createOffice: true });

      // Try to import using other company's office ID
      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: otherSetup.office!.id, // Office from different company
          prices: { [priceTypes[0]!.id]: 500 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(
        response.body.errors.some((e: { message: string }) =>
          e.message.includes('not found in company'),
        ),
      ).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle empty import file (headers only)', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Option Prices');

      worksheet.addRow([
        'Option Name',
        'Brand',
        'Item Code',
        'Office Name',
        ...priceTypes.map(pt => pt.name),
        'Total',
        'Option ID',
        'Office ID',
      ]);

      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'empty.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.summary.totalRows).toBe(0);
    });

    it('should handle zero price values', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office2.id,
          prices: { [priceTypes[0]!.id]: 0 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle decimal price values', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office2.id,
          prices: { [priceTypes[0]!.id]: 99.99 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle whitespace in UUID cells', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Option Prices');

      worksheet.addRow([
        'Option Name',
        'Brand',
        'Item Code',
        'Office Name',
        ...priceTypes.map(pt => pt.name),
        'Total',
        'Option ID',
        'Office ID',
      ]);

      // Add row with whitespace around UUIDs
      worksheet.addRow([
        'Test Option',
        'Brand',
        'ITEM-001',
        'Office',
        ...priceTypes.map(() => 100),
        400,
        `  ${testOptions[0]!.id}  `, // Whitespace
        `  ${office.id}  `, // Whitespace
      ]);

      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(200);
      // Should trim whitespace and validate successfully
      expect(response.body.summary.totalRows).toBe(1);
    });

    it('should reject negative price values', async () => {
      const buffer = await createValidExcelBuffer([
        {
          optionId: testOptions[0]!.id,
          officeId: office.id,
          prices: { [priceTypes[0]!.id]: -100 },
        },
      ]);

      const response = await makeRequest()
        .post('/api/price-guide/pricing/options/import/preview')
        .set('Cookie', setup.adminCookie)
        .attach('file', buffer, 'test-import.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(
        response.body.errors.some((e: { message: string }) =>
          e.message.includes('non-negative'),
        ),
      ).toBe(true);
    });
  });
});
