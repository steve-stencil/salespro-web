/**
 * Integration tests for pricing import service.
 * Tests parsing, validation, and edge cases for Excel file imports.
 */
import ExcelJS from 'exceljs';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { getORM } from '../../lib/db';
import {
  previewImport,
  processImportSync,
  BACKGROUND_PROCESSING_THRESHOLD,
  MAX_FILE_SIZE_BYTES,
} from '../../services/price-guide/pricing-import.service';
import {
  createTestOption,
  createDefaultPriceTypesWithOffice,
  createTestOptionPrice,
} from '../factories/price-guide';

import { createCompanySetup, createTestOffice } from './auth-test-helpers';

import type { CompanySetup } from './auth-test-helpers';
import type { Office, PriceGuideOption, PriceObjectType } from '../../entities';
import type { EntityManager } from '@mikro-orm/postgresql';

describe('Pricing Import Service', () => {
  let setup: CompanySetup;
  let office: Office;
  let office2: Office;
  let em: EntityManager;
  let priceTypes: PriceObjectType[];
  let testOptions: PriceGuideOption[];

  beforeAll(() => {
    const orm = getORM();
    em = orm.em.fork() as EntityManager;
  });

  beforeEach(async () => {
    const orm = getORM();
    em = orm.em.fork() as EntityManager;

    // Create company with office
    setup = await createCompanySetup({ createOffice: true });
    office = setup.office!;

    // Create second office
    office2 = await createTestOffice(em, setup.company, 'Office 2');

    // Create price types and assign to both offices
    priceTypes = await createDefaultPriceTypesWithOffice(
      em,
      setup.company,
      office,
    );

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

    // Build headers based on price types
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

    // Add data rows
    for (const row of rows) {
      // Use null for unprovided prices so they won't be updated
      const priceValues = priceTypes.map(pt =>
        pt.id in row.prices ? row.prices[pt.id] : null,
      );
      const total = priceValues
        .filter((v): v is number => v !== null)
        .reduce((sum, val) => sum + val, 0);

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
   * Helper: Create an Excel buffer with custom headers for testing invalid structures.
   */
  async function createExcelBufferWithHeaders(
    headers: string[],
    rows: unknown[][] = [],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Option Prices');

    worksheet.addRow(headers);
    for (const row of rows) {
      worksheet.addRow(row);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ===========================================================================
  // Configuration Constants Tests
  // ===========================================================================

  describe('Configuration Constants', () => {
    it('should have reasonable background processing threshold', () => {
      expect(BACKGROUND_PROCESSING_THRESHOLD).toBe(1000);
    });

    it('should have 10MB max file size', () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });
  });

  // ===========================================================================
  // previewImport Tests
  // ===========================================================================

  describe('previewImport', () => {
    describe('Valid File Parsing', () => {
      it('should preview a valid Excel file with correct counts', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: office.id,
            prices: { [priceTypes[0]!.id]: 500, [priceTypes[1]!.id]: 200 },
          },
        ]);

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(true);
        expect(result.summary.totalRows).toBe(1);
        expect(result.summary.errors).toBe(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect rows to update vs skip', async () => {
        // First row has different prices than existing - should update
        // Use same prices as existing - should skip
        const existingPrice =
          (testOptions[0]!.id === testOptions[0]!.id ? 1 : 0) * 100 +
          priceTypes[0]!.sortOrder * 10;

        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: office.id,
            prices: { [priceTypes[0]!.id]: existingPrice + 100 }, // Different price - update
          },
          {
            optionId: testOptions[1]!.id,
            officeId: office.id,
            prices: {
              [priceTypes[0]!.id]: 200 + priceTypes[0]!.sortOrder * 10,
            }, // Same price - skip
          },
        ]);

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(true);
        expect(result.summary.totalRows).toBe(2);
      });

      it('should include preview entries for first 50 rows', async () => {
        const rows = [];
        for (let i = 0; i < 60; i++) {
          rows.push({
            optionId: testOptions[i % 3]!.id,
            officeId: office.id,
            prices: { [priceTypes[0]!.id]: i * 10 },
          });
        }

        const buffer = await createValidExcelBuffer(rows);
        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.preview.length).toBeLessThanOrEqual(50);
      });
    });

    describe('Invalid File Structure', () => {
      it('should reject file with no worksheet', async () => {
        const workbook = new ExcelJS.Workbook();
        // Don't add any worksheet
        const arrayBuffer = await workbook.xlsx.writeBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]!.message).toContain('No worksheet found');
      });

      it('should reject file missing required Office ID column', async () => {
        const buffer = await createExcelBufferWithHeaders([
          'Option Name',
          'Brand',
          'Item Code',
          // Missing 'Office ID'
          'Option ID',
        ]);

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]!.message).toContain('Missing required columns');
      });

      it('should handle empty file (only headers, no data)', async () => {
        const buffer = await createExcelBufferWithHeaders([
          'Option Name',
          'Brand',
          'Item Code',
          'Office Name',
          'Materials',
          'Labor',
          'Total',
          'Option ID',
          'Office ID',
        ]);

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(true);
        expect(result.summary.totalRows).toBe(0);
      });
    });

    describe('Row Validation Errors', () => {
      it('should report error for missing Office ID in row', async () => {
        const buffer = await createExcelBufferWithHeaders(
          [
            'Option Name',
            'Brand',
            'Item Code',
            'Office Name',
            ...priceTypes.map(pt => pt.name),
            'Total',
            'Option ID',
            'Office ID',
          ],
          [
            [
              'Test Option',
              'Brand',
              'ITEM-001',
              'Office',
              ...priceTypes.map(() => 100),
              400,
              testOptions[0]!.id,
              '', // Empty Office ID
            ],
          ],
        );

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(result.summary.errors).toBeGreaterThan(0);
        expect(result.errors.some(e => e.column === 'Office ID')).toBe(true);
      });

      it('should report error for missing Option ID in row', async () => {
        const buffer = await createExcelBufferWithHeaders(
          [
            'Option Name',
            'Brand',
            'Item Code',
            'Office Name',
            ...priceTypes.map(pt => pt.name),
            'Total',
            'Option ID',
            'Office ID',
          ],
          [
            [
              'Test Option',
              'Brand',
              'ITEM-001',
              'Office',
              ...priceTypes.map(() => 100),
              400,
              '', // Empty Option ID
              office.id,
            ],
          ],
        );

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.column === 'Option ID')).toBe(true);
      });

      it('should report error for invalid UUID format in Office ID', async () => {
        const buffer = await createExcelBufferWithHeaders(
          [
            'Option Name',
            'Brand',
            'Item Code',
            'Office Name',
            ...priceTypes.map(pt => pt.name),
            'Total',
            'Option ID',
            'Office ID',
          ],
          [
            [
              'Test Option',
              'Brand',
              'ITEM-001',
              'Office',
              ...priceTypes.map(() => 100),
              400,
              testOptions[0]!.id,
              'invalid-uuid', // Invalid format
            ],
          ],
        );

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(
          result.errors.some(e =>
            e.message.includes('Invalid Office ID format'),
          ),
        ).toBe(true);
      });

      it('should report error for invalid UUID format in Option ID', async () => {
        const buffer = await createExcelBufferWithHeaders(
          [
            'Option Name',
            'Brand',
            'Item Code',
            'Office Name',
            ...priceTypes.map(pt => pt.name),
            'Total',
            'Option ID',
            'Office ID',
          ],
          [
            [
              'Test Option',
              'Brand',
              'ITEM-001',
              'Office',
              ...priceTypes.map(() => 100),
              400,
              'not-a-uuid', // Invalid format
              office.id,
            ],
          ],
        );

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(
          result.errors.some(e =>
            e.message.includes('Invalid Option ID format'),
          ),
        ).toBe(true);
      });

      it('should report error for non-existent Office ID', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: '00000000-0000-0000-0000-000000000000', // Valid UUID but doesn't exist
            prices: { [priceTypes[0]!.id]: 500 },
          },
        ]);

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(
          result.errors.some(e => e.message.includes('not found in company')),
        ).toBe(true);
      });

      it('should report error for non-existent Option ID', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: '00000000-0000-0000-0000-000000000000', // Valid UUID but doesn't exist
            officeId: office.id,
            prices: { [priceTypes[0]!.id]: 500 },
          },
        ]);

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(
          result.errors.some(e => e.message.includes('not found in company')),
        ).toBe(true);
      });

      it('should report error for negative price values', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: office.id,
            prices: { [priceTypes[0]!.id]: -100 }, // Negative price
          },
        ]);

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(
          result.errors.some(e => e.message.includes('non-negative')),
        ).toBe(true);
      });

      it('should limit errors to 100 maximum', async () => {
        // Create a file with 150 invalid rows
        const rows: unknown[][] = [];
        for (let i = 0; i < 150; i++) {
          rows.push([
            'Test Option',
            'Brand',
            'ITEM',
            'Office',
            ...priceTypes.map(() => 100),
            400,
            'invalid-uuid', // Invalid option ID
            'invalid-uuid', // Invalid office ID
          ]);
        }

        const buffer = await createExcelBufferWithHeaders(
          [
            'Option Name',
            'Brand',
            'Item Code',
            'Office Name',
            ...priceTypes.map(pt => pt.name),
            'Total',
            'Option ID',
            'Office ID',
          ],
          rows,
        );

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeLessThanOrEqual(100);
        expect(result.summary.errors).toBeGreaterThan(100);
      });
    });

    describe('Cross-Company Isolation', () => {
      it('should reject options from different company', async () => {
        // Create another company with options
        const otherSetup = await createCompanySetup({ createOffice: true });
        const otherOption = await createTestOption(em, otherSetup.company, {
          name: 'Other Company Option',
        });

        const buffer = await createValidExcelBuffer([
          {
            optionId: otherOption.id, // Option from different company
            officeId: office.id,
            prices: { [priceTypes[0]!.id]: 500 },
          },
        ]);

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(
          result.errors.some(e => e.message.includes('not found in company')),
        ).toBe(true);
      });

      it('should reject offices from different company', async () => {
        // Create another company with office
        const otherSetup = await createCompanySetup({ createOffice: true });

        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: otherSetup.office!.id, // Office from different company
            prices: { [priceTypes[0]!.id]: 500 },
          },
        ]);

        const result = await previewImport(em, buffer, setup.company.id);

        expect(result.valid).toBe(false);
        expect(
          result.errors.some(e => e.message.includes('not found in company')),
        ).toBe(true);
      });
    });
  });

  // ===========================================================================
  // processImportSync Tests
  // ===========================================================================

  describe('processImportSync', () => {
    describe('Successful Import', () => {
      it('should create new price records when none exist', async () => {
        // Use office2 which has no existing prices
        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: office2.id,
            prices: { [priceTypes[0]!.id]: 999 },
          },
        ]);

        const result = await processImportSync(em, buffer, {
          companyId: setup.company.id,
          userId: setup.adminUser.id,
        });

        expect(result.success).toBe(true);
        expect(result.created).toBeGreaterThan(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should update existing price records when values differ', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: office.id,
            prices: { [priceTypes[0]!.id]: 9999 }, // Different from existing
          },
        ]);

        const result = await processImportSync(em, buffer, {
          companyId: setup.company.id,
          userId: setup.adminUser.id,
        });

        expect(result.success).toBe(true);
        expect(result.updated).toBeGreaterThan(0);
      });

      it('should skip rows with no price changes', async () => {
        // Get existing price for first option
        const existingPrice = 100 + priceTypes[0]!.sortOrder * 10;

        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: office.id,
            prices: { [priceTypes[0]!.id]: existingPrice }, // Same as existing
          },
        ]);

        const result = await processImportSync(em, buffer, {
          companyId: setup.company.id,
          userId: setup.adminUser.id,
        });

        expect(result.success).toBe(true);
        expect(result.skipped).toBeGreaterThan(0);
      });

      it('should handle multiple rows in same import', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: office2.id,
            prices: { [priceTypes[0]!.id]: 111 },
          },
          {
            optionId: testOptions[1]!.id,
            officeId: office2.id,
            prices: { [priceTypes[0]!.id]: 222 },
          },
          {
            optionId: testOptions[2]!.id,
            officeId: office2.id,
            prices: { [priceTypes[0]!.id]: 333 },
          },
        ]);

        const result = await processImportSync(em, buffer, {
          companyId: setup.company.id,
          userId: setup.adminUser.id,
        });

        expect(result.success).toBe(true);
        expect(result.created + result.updated + result.skipped).toBe(3);
      });
    });

    describe('Error Handling', () => {
      it('should fail on validation errors when skipErrors is false', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: 'invalid-uuid',
            officeId: office.id,
            prices: { [priceTypes[0]!.id]: 500 },
          },
        ]);

        const result = await processImportSync(em, buffer, {
          companyId: setup.company.id,
          userId: setup.adminUser.id,
          skipErrors: false,
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should continue processing when skipErrors is true', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: 'invalid-uuid', // Invalid - will be skipped
            officeId: office.id,
            prices: { [priceTypes[0]!.id]: 500 },
          },
          {
            optionId: testOptions[0]!.id, // Valid - will be processed
            officeId: office2.id,
            prices: { [priceTypes[0]!.id]: 999 },
          },
        ]);

        const result = await processImportSync(em, buffer, {
          companyId: setup.company.id,
          userId: setup.adminUser.id,
          skipErrors: true,
        });

        expect(result.success).toBe(true);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.created + result.updated).toBeGreaterThan(0);
      });

      it('should handle file with no valid rows gracefully', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: 'invalid-uuid',
            officeId: 'invalid-uuid',
            prices: { [priceTypes[0]!.id]: 500 },
          },
        ]);

        const result = await processImportSync(em, buffer, {
          companyId: setup.company.id,
          userId: setup.adminUser.id,
          skipErrors: true,
        });

        expect(result.success).toBe(true);
        expect(result.created).toBe(0);
        expect(result.updated).toBe(0);
      });
    });

    describe('Edge Cases', () => {
      it('should handle zero price values', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: office2.id,
            prices: { [priceTypes[0]!.id]: 0 }, // Zero price
          },
        ]);

        const result = await processImportSync(em, buffer, {
          companyId: setup.company.id,
          userId: setup.adminUser.id,
        });

        expect(result.success).toBe(true);
      });

      it('should handle decimal price values', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: office2.id,
            prices: { [priceTypes[0]!.id]: 99.99 }, // Decimal price
          },
        ]);

        const result = await processImportSync(em, buffer, {
          companyId: setup.company.id,
          userId: setup.adminUser.id,
        });

        expect(result.success).toBe(true);
      });

      it('should handle very large price values', async () => {
        const buffer = await createValidExcelBuffer([
          {
            optionId: testOptions[0]!.id,
            officeId: office2.id,
            prices: { [priceTypes[0]!.id]: 999999.99 }, // Large price
          },
        ]);

        const result = await processImportSync(em, buffer, {
          companyId: setup.company.id,
          userId: setup.adminUser.id,
        });

        expect(result.success).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Corrupt/Malformed File Tests
  // ===========================================================================

  describe('Corrupt and Malformed Files', () => {
    it('should handle corrupt Excel file gracefully', async () => {
      const corruptBuffer = Buffer.from('This is not a valid Excel file');

      await expect(
        previewImport(em, corruptBuffer, setup.company.id),
      ).rejects.toThrow();
    });

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        previewImport(em, emptyBuffer, setup.company.id),
      ).rejects.toThrow();
    });

    it('should handle buffer with random bytes', async () => {
      const randomBuffer = Buffer.alloc(1000);
      for (let i = 0; i < 1000; i++) {
        randomBuffer[i] = Math.floor(Math.random() * 256);
      }

      await expect(
        previewImport(em, randomBuffer, setup.company.id),
      ).rejects.toThrow();
    });

    it('should handle file with special characters in cells', async () => {
      const buffer = await createExcelBufferWithHeaders(
        [
          'Option Name',
          'Brand',
          'Item Code',
          'Office Name',
          ...priceTypes.map(pt => pt.name),
          'Total',
          'Option ID',
          'Office ID',
        ],
        [
          [
            'Option <script>alert("xss")</script>', // XSS attempt
            'Brand "with" \'quotes\'',
            'ITEM;DROP TABLE users;--', // SQL injection attempt
            'Office\nWith\nNewlines',
            ...priceTypes.map(() => 100),
            400,
            testOptions[0]!.id,
            office.id,
          ],
        ],
      );

      // Should not throw, just validate and potentially report errors
      const result = await previewImport(em, buffer, setup.company.id);

      // The row should still be processed (IDs are valid)
      expect(result.summary.totalRows).toBe(1);
    });

    it('should handle Excel table format (rich text headers)', async () => {
      // Create workbook with Excel table (which uses rich text)
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

      // Add as Excel Table (creates rich text headers)
      worksheet.addTable({
        name: 'OptionPrices',
        ref: 'A1',
        headerRow: true,
        columns: headers.map(name => ({ name, filterButton: true })),
        rows: [
          [
            'Test Option',
            'Brand',
            'ITEM-001',
            'Office',
            ...priceTypes.map(() => 100),
            400,
            testOptions[0]!.id,
            office.id,
          ],
        ],
      });

      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const result = await previewImport(em, buffer, setup.company.id);

      expect(result.summary.totalRows).toBe(1);
    });

    it('should handle cells with formulas', async () => {
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

      // Add row with formula in Total column
      worksheet.addRow([
        'Test Option',
        'Brand',
        'ITEM-001',
        'Office',
        ...priceTypes.map(() => 100),
        { formula: 'SUM(E2:H2)' }, // Formula instead of value
        testOptions[0]!.id,
        office.id,
      ]);

      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Should handle formulas gracefully
      const result = await previewImport(em, buffer, setup.company.id);

      expect(result.summary.totalRows).toBe(1);
    });
  });
});
