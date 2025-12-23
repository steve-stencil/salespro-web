/**
 * Unit tests for ETL transform functions.
 *
 * Tests the parsing and transformation logic used during document template imports.
 */
import { describe, it, expect } from 'vitest';

import {
  parsePageSize,
  hasUserInputRequired,
  countSignatureFields,
  clampWatermarkAlpha,
  transformToTemplate,
} from '../../../services/etl/transform';
import { createRawParseDocumentData } from '../../factories';

import type { DocumentDataJson } from '../../../entities';

describe('ETL Transform Functions', () => {
  describe('parsePageSize', () => {
    it('should parse valid page size string "612,792"', () => {
      const result = parsePageSize('612,792');
      expect(result).toEqual({ width: 612, height: 792 });
    });

    it('should handle page size with spaces "612, 792"', () => {
      const result = parsePageSize('612, 792');
      expect(result).toEqual({ width: 612, height: 792 });
    });

    it('should handle page size with extra spaces " 612 , 792 "', () => {
      const result = parsePageSize(' 612 , 792 ');
      expect(result).toEqual({ width: 612, height: 792 });
    });

    it('should return defaults for invalid page size', () => {
      const result = parsePageSize('invalid');
      expect(result).toEqual({ width: 612, height: 792 });
    });

    it('should return defaults for empty string', () => {
      const result = parsePageSize('');
      expect(result).toEqual({ width: 612, height: 792 });
    });

    it('should return defaults for partial page size "612"', () => {
      const result = parsePageSize('612');
      expect(result).toEqual({ width: 612, height: 792 });
    });

    it('should handle large dimensions', () => {
      const result = parsePageSize('1200,1600');
      expect(result).toEqual({ width: 1200, height: 1600 });
    });

    it('should handle zero dimensions', () => {
      const result = parsePageSize('0,0');
      expect(result).toEqual({ width: 0, height: 0 });
    });
  });

  describe('hasUserInputRequired', () => {
    it('should return true when body has userInputRequired section', () => {
      const contractData: DocumentDataJson = [
        { groupType: 'header', data: [] },
        { groupType: 'body', data: [{ userInputRequired: true }] },
      ];
      expect(hasUserInputRequired(contractData)).toBe(true);
    });

    it('should return false when no userInputRequired sections', () => {
      const contractData: DocumentDataJson = [
        { groupType: 'header', data: [] },
        { groupType: 'body', data: [{ userInputRequired: false }] },
      ];
      expect(hasUserInputRequired(contractData)).toBe(false);
    });

    it('should ignore header groups (only check body)', () => {
      const contractData: DocumentDataJson = [
        { groupType: 'header', data: [{ userInputRequired: true }] },
        { groupType: 'body', data: [{ userInputRequired: false }] },
      ];
      expect(hasUserInputRequired(contractData)).toBe(false);
    });

    it('should ignore signature groups (only check body)', () => {
      const contractData: DocumentDataJson = [
        { groupType: 'signature', data: [{ userInputRequired: true }] },
        { groupType: 'body', data: [{ userInputRequired: false }] },
      ];
      expect(hasUserInputRequired(contractData)).toBe(false);
    });

    it('should return true if any body section has userInputRequired', () => {
      const contractData: DocumentDataJson = [
        {
          groupType: 'body',
          data: [
            { userInputRequired: false },
            { userInputRequired: true },
            { userInputRequired: false },
          ],
        },
      ];
      expect(hasUserInputRequired(contractData)).toBe(true);
    });

    it('should handle empty contractData', () => {
      const contractData: DocumentDataJson = [];
      expect(hasUserInputRequired(contractData)).toBe(false);
    });

    it('should handle body group with no data', () => {
      const contractData: DocumentDataJson = [{ groupType: 'body', data: [] }];
      expect(hasUserInputRequired(contractData)).toBe(false);
    });
  });

  describe('countSignatureFields', () => {
    it('should count signature cellTypes in body', () => {
      const contractData: DocumentDataJson = [
        {
          groupType: 'body',
          data: [
            { cellItems: [{ cellType: 'signature' }, { cellType: 'text' }] },
          ],
        },
      ];
      const result = countSignatureFields(contractData);
      expect(result.signatures).toBe(1);
      expect(result.initials).toBe(0);
    });

    it('should count initialsRequired fields', () => {
      const contractData: DocumentDataJson = [
        {
          groupType: 'body',
          data: [
            {
              cellItems: [
                { initialsRequired: true },
                { initialsRequired: false },
              ],
            },
          ],
        },
      ];
      const result = countSignatureFields(contractData);
      expect(result.initials).toBe(1);
      expect(result.signatures).toBe(0);
    });

    it('should count both signatures and initials', () => {
      const contractData: DocumentDataJson = [
        {
          groupType: 'body',
          data: [
            {
              cellItems: [
                { cellType: 'signature' },
                { initialsRequired: true },
                { cellType: 'signature', initialsRequired: true },
              ],
            },
          ],
        },
      ];
      const result = countSignatureFields(contractData);
      expect(result.signatures).toBe(2);
      expect(result.initials).toBe(2);
    });

    it('should recursively check detailItems', () => {
      const contractData: DocumentDataJson = [
        {
          groupType: 'body',
          data: [
            {
              cellItems: [{ detailItems: [{ cellType: 'signature' }] }],
            },
          ],
        },
      ];
      const result = countSignatureFields(contractData);
      expect(result.signatures).toBe(1);
    });

    it('should handle nested detailItems', () => {
      const contractData: DocumentDataJson = [
        {
          groupType: 'body',
          data: [
            {
              cellItems: [
                {
                  detailItems: [
                    {
                      cellType: 'signature',
                      detailItems: [{ initialsRequired: true }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const result = countSignatureFields(contractData);
      expect(result.signatures).toBe(1);
      expect(result.initials).toBe(1);
    });

    it('should handle row arrays in cellItems', () => {
      const contractData: DocumentDataJson = [
        {
          groupType: 'body',
          data: [
            {
              cellItems: [
                [{ cellType: 'signature' }, { cellType: 'signature' }],
                [{ initialsRequired: true }],
              ],
            },
          ],
        },
      ];
      const result = countSignatureFields(contractData);
      expect(result.signatures).toBe(2);
      expect(result.initials).toBe(1);
    });

    it('should return zero counts for empty contractData', () => {
      const contractData: DocumentDataJson = [];
      const result = countSignatureFields(contractData);
      expect(result.signatures).toBe(0);
      expect(result.initials).toBe(0);
    });

    it('should count across multiple groups', () => {
      const contractData: DocumentDataJson = [
        {
          groupType: 'header',
          data: [{ cellItems: [{ cellType: 'signature' }] }],
        },
        {
          groupType: 'body',
          data: [{ cellItems: [{ cellType: 'signature' }] }],
        },
        {
          groupType: 'signature',
          data: [{ cellItems: [{ cellType: 'signature' }] }],
        },
      ];
      const result = countSignatureFields(contractData);
      // Should count from all groups
      expect(result.signatures).toBe(3);
    });
  });

  describe('clampWatermarkAlpha', () => {
    it('should return 0.05 for undefined', () => {
      expect(clampWatermarkAlpha(undefined)).toBe(0.05);
    });

    it('should return value if in valid range', () => {
      expect(clampWatermarkAlpha(0.5)).toBe(0.5);
      expect(clampWatermarkAlpha(0)).toBe(0);
      expect(clampWatermarkAlpha(1)).toBe(1);
    });

    it('should clamp values above 1 to 1', () => {
      expect(clampWatermarkAlpha(1.5)).toBe(1);
      expect(clampWatermarkAlpha(100)).toBe(1);
    });

    it('should clamp negative values to 0', () => {
      expect(clampWatermarkAlpha(-0.5)).toBe(0);
      expect(clampWatermarkAlpha(-100)).toBe(0);
    });

    it('should return default for NaN', () => {
      expect(clampWatermarkAlpha(Number.NaN)).toBe(0.05);
    });
  });

  describe('transformToTemplate', () => {
    it('should map all fields correctly from raw Parse object', () => {
      const raw = createRawParseDocumentData({
        objectId: 'abc123',
        type: 'contract',
        pageId: 'singlePage',
        category: 'Test Category',
        displayName: 'Test Template',
        order: 10,
        pageSize: '612,792',
        hMargin: 35,
        wMargin: 20,
        canAddMultiplePages: false,
        isTemplate: true,
        includedStates: ['CA', 'TX'],
        includedOffices: [{ objectId: 'office1' }],
        contractData: [{ groupType: 'body', data: [] }],
        images: [{ url: 'test.png' }],
      });

      const result = transformToTemplate(raw);

      expect(result.sourceTemplateId).toBe('abc123');
      expect(result.sourceType).toBe('contract');
      expect(result.categoryName).toBe('Test Category');
      expect(result.displayName).toBe('Test Template');
      expect(result.sortOrder).toBe(10);
      expect(result.pageWidth).toBe(612);
      expect(result.pageHeight).toBe(792);
      expect(result.hMargin).toBe(35);
      expect(result.wMargin).toBe(20);
      expect(result.canAddMultiplePages).toBe(false);
      expect(result.isTemplate).toBe(true);
      expect(result.includedStates).toEqual(['CA', 'TX']);
      expect(result.sourceOfficeIds).toEqual(['office1']);
      expect(result.imageUrls).toEqual(['test.png']);
    });

    it('should provide default values for missing optional fields', () => {
      const raw = createRawParseDocumentData({
        objectId: 'min123',
        // All other fields omitted
      });
      // Clear optional fields to test defaults
      raw.type = undefined;
      raw.pageId = undefined;
      raw.category = undefined;
      raw.displayName = undefined;
      raw.order = undefined;
      raw.pageSize = undefined;
      raw.hMargin = undefined;
      raw.wMargin = undefined;
      raw.canAddMultiplePages = undefined;
      raw.isTemplate = undefined;
      raw.includedStates = undefined;
      raw.includedOffices = undefined;
      raw.photosPerPage = undefined;
      raw.useWatermark = undefined;
      raw.watermarkWidthPercent = undefined;
      raw.watermarkAlpha = undefined;

      const result = transformToTemplate(raw);

      expect(result.sourceTemplateId).toBe('min123');
      expect(result.sourceType).toBe('contract');
      expect(result.pageId).toBe('singlePage');
      expect(result.categoryName).toBe('');
      expect(result.displayName).toBe('Untitled');
      expect(result.sortOrder).toBe(0);
      expect(result.pageWidth).toBe(612);
      expect(result.pageHeight).toBe(792);
      expect(result.hMargin).toBe(35);
      expect(result.wMargin).toBe(20);
      expect(result.canAddMultiplePages).toBe(false);
      expect(result.isTemplate).toBe(false);
      expect(result.includedStates).toEqual([]);
      expect(result.sourceOfficeIds).toEqual([]);
      expect(result.photosPerPage).toBe(1);
      expect(result.useWatermark).toBe(false);
      expect(result.watermarkWidthPercent).toBe(100);
      expect(result.watermarkAlpha).toBe(0.05);
    });

    it('should extract file URLs from Parse file objects', () => {
      const raw = createRawParseDocumentData({
        objectId: 'files123',
        pdf: { url: 'https://example.com/file.pdf', name: 'file.pdf' },
        iconImage: { url: 'https://example.com/icon.png', name: 'icon.png' },
        watermark: {
          url: 'https://example.com/watermark.png',
          name: 'watermark.png',
        },
      });

      const result = transformToTemplate(raw);

      expect(result.pdfUrl).toBe('https://example.com/file.pdf');
      expect(result.iconUrl).toBe('https://example.com/icon.png');
      expect(result.watermarkUrl).toBe('https://example.com/watermark.png');
    });

    it('should handle missing file objects', () => {
      const raw = createRawParseDocumentData({
        objectId: 'nofiles123',
        pdf: undefined,
        iconImage: undefined,
        watermark: undefined,
      });

      const result = transformToTemplate(raw);

      expect(result.pdfUrl).toBeUndefined();
      expect(result.iconUrl).toBeUndefined();
      expect(result.watermarkUrl).toBeUndefined();
    });

    it('should calculate hasUserInput from contractData', () => {
      const raw = createRawParseDocumentData({
        objectId: 'userinput123',
        contractData: [
          { groupType: 'body', data: [{ userInputRequired: true }] },
        ],
      });

      const result = transformToTemplate(raw);

      expect(result.hasUserInput).toBe(true);
    });

    it('should calculate signature and initials counts', () => {
      const raw = createRawParseDocumentData({
        objectId: 'sigs123',
        contractData: [
          {
            groupType: 'body',
            data: [
              {
                cellItems: [
                  { cellType: 'signature' },
                  { cellType: 'signature' },
                  { initialsRequired: true },
                ],
              },
            ],
          },
        ],
      });

      const result = transformToTemplate(raw);

      expect(result.signatureFieldCount).toBe(2);
      expect(result.initialsFieldCount).toBe(1);
    });

    it('should clamp invalid watermark alpha values', () => {
      const raw = createRawParseDocumentData({
        objectId: 'alpha123',
        watermarkAlpha: 1.5,
      });

      const result = transformToTemplate(raw);

      expect(result.watermarkAlpha).toBe(1);
    });

    it('should extract multiple office IDs from Parse pointers', () => {
      const raw = createRawParseDocumentData({
        objectId: 'offices123',
        includedOffices: [
          { objectId: 'office1', className: 'Office', __type: 'Pointer' },
          { objectId: 'office2', className: 'Office', __type: 'Pointer' },
          { objectId: 'office3', className: 'Office', __type: 'Pointer' },
        ],
      });

      const result = transformToTemplate(raw);

      expect(result.sourceOfficeIds).toEqual(['office1', 'office2', 'office3']);
    });

    it('should handle empty category (for Uncategorized)', () => {
      const raw = createRawParseDocumentData({
        objectId: 'nocat123',
        category: '',
      });

      const result = transformToTemplate(raw);

      expect(result.categoryName).toBe('');
    });
  });
});
