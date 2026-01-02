import { v4 as uuid } from 'uuid';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  MergeFieldCategory,
  MergeFieldDataType,
} from '../../../entities/merge-field';
import { MergeFieldResolverService } from '../../../services/merge-field';

import type { Company } from '../../../entities';
import type {
  MergeField,
  CustomMergeFieldDefinition,
} from '../../../entities/merge-field';
import type { EntityManager } from '@mikro-orm/postgresql';

/**
 * Create a mock MergeField entity (SYSTEM field)
 */
function createMockMergeField(overrides: Partial<MergeField> = {}): MergeField {
  return {
    id: uuid(),
    key: 'item.quantity',
    displayName: 'Quantity',
    description: 'The quantity of the item',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.NUMBER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as MergeField;
}

/**
 * Create a mock CustomMergeFieldDefinition entity
 */
function createMockCustomField(
  overrides: Partial<CustomMergeFieldDefinition> = {},
): CustomMergeFieldDefinition {
  return {
    id: uuid(),
    company: { id: uuid() } as Company,
    key: 'frameColor',
    displayName: 'Frame Color',
    description: 'The color of the frame',
    dataType: MergeFieldDataType.TEXT,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    msiUsages: { loadItems: vi.fn() },
    optionUsages: { loadItems: vi.fn() },
    upChargeUsages: { loadItems: vi.fn() },
    ...overrides,
  } as unknown as CustomMergeFieldDefinition;
}

/**
 * Create a mock EntityManager
 */
function createMockEm() {
  const em = {
    fork: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    persist: vi.fn(),
    flush: vi.fn(),
  };
  em.fork.mockReturnValue(em);
  return em;
}

describe('MergeFieldResolverService', () => {
  let service: MergeFieldResolverService;
  let mockEm: ReturnType<typeof createMockEm>;
  const testCompanyId = uuid();

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm = createMockEm();
    service = new MergeFieldResolverService(mockEm as unknown as EntityManager);
  });

  describe('extractReferences', () => {
    it('should extract single merge field reference', () => {
      const template = 'Hello {{customer.name}}!';

      const result = service.extractReferences(template);

      expect(result).toEqual(['customer.name']);
    });

    it('should extract multiple merge field references', () => {
      const template =
        'Hello {{customer.name}}, your total is {{option.selected.totalPrice}}.';

      const result = service.extractReferences(template);

      expect(result).toContain('customer.name');
      expect(result).toContain('option.selected.totalPrice');
      expect(result).toHaveLength(2);
    });

    it('should deduplicate repeated references', () => {
      const template =
        '{{item.name}} costs {{option.selected.unitPrice}}. Buy {{item.name}} today!';

      const result = service.extractReferences(template);

      expect(result).toContain('item.name');
      expect(result).toContain('option.selected.unitPrice');
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no references found', () => {
      const template = 'Hello, this is plain text with no merge fields.';

      const result = service.extractReferences(template);

      expect(result).toEqual([]);
    });

    it('should handle empty string', () => {
      const template = '';

      const result = service.extractReferences(template);

      expect(result).toEqual([]);
    });

    it('should trim whitespace from field keys', () => {
      const template = 'Hello {{ customer.name }} and {{  item.quantity  }}!';

      const result = service.extractReferences(template);

      expect(result).toContain('customer.name');
      expect(result).toContain('item.quantity');
    });

    it('should handle nested braces correctly', () => {
      const template = 'Value: {{item.name}}';

      const result = service.extractReferences(template);

      expect(result).toEqual(['item.name']);
    });

    it('should extract custom field references', () => {
      const template =
        'Color: {{custom.frameColor}}, Size: {{custom.windowSize}}';

      const result = service.extractReferences(template);

      expect(result).toContain('custom.frameColor');
      expect(result).toContain('custom.windowSize');
      expect(result).toHaveLength(2);
    });

    it('should handle complex templates with mixed content', () => {
      const template = `
        Dear {{customer.name}},

        Thank you for your order of {{item.quantity}} x {{item.name}}.
        Total: {{option.selected.totalPrice}}

        Best regards,
        {{user.name}}
        {{company.name}}
      `;

      const result = service.extractReferences(template);

      expect(result).toContain('customer.name');
      expect(result).toContain('item.quantity');
      expect(result).toContain('item.name');
      expect(result).toContain('option.selected.totalPrice');
      expect(result).toContain('user.name');
      expect(result).toContain('company.name');
      expect(result).toHaveLength(6);
    });
  });

  describe('validateTemplate', () => {
    it('should return valid when all references exist', async () => {
      const template = 'Hello {{item.quantity}} {{custom.frameColor}}';
      const systemFields = [createMockMergeField({ key: 'item.quantity' })];
      const customFields = [createMockCustomField({ key: 'frameColor' })];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.isValid).toBe(true);
      expect(result.invalidFields).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    it('should return invalid fields when references do not exist', async () => {
      const template = 'Hello {{item.nonexistent}} {{custom.unknown}}';
      const systemFields = [createMockMergeField({ key: 'item.quantity' })];
      const customFields = [createMockCustomField({ key: 'frameColor' })];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.isValid).toBe(false);
      expect(result.invalidFields).toContain('item.nonexistent');
      expect(result.invalidFields).toContain('custom.unknown');
      expect(result.invalidFields).toHaveLength(2);
    });

    it('should provide suggestions for typos', async () => {
      const template = 'Hello {{item.quantiy}}'; // typo: "quantiy" instead of "quantity"
      const systemFields = [createMockMergeField({ key: 'item.quantity' })];
      const customFields: CustomMergeFieldDefinition[] = [];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.isValid).toBe(false);
      expect(result.invalidFields).toContain('item.quantiy');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]?.invalid).toBe('item.quantiy');
      expect(result.suggestions[0]?.suggestion).toBe('item.quantity');
    });

    it('should not provide suggestion when distance is too large', async () => {
      const template = 'Hello {{completely.different}}';
      const systemFields = [createMockMergeField({ key: 'item.quantity' })];
      const customFields: CustomMergeFieldDefinition[] = [];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.isValid).toBe(false);
      expect(result.suggestions[0]?.suggestion).toBeUndefined();
    });

    it('should handle template with no merge fields', async () => {
      const template = 'Plain text without any merge fields';
      const systemFields: MergeField[] = [];
      const customFields: CustomMergeFieldDefinition[] = [];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.isValid).toBe(true);
      expect(result.invalidFields).toEqual([]);
    });

    it('should only include active system fields', async () => {
      const template = '{{item.active}} {{item.inactive}}';
      const systemFields = [
        createMockMergeField({ key: 'item.active', isActive: true }),
        // inactive field is filtered by the query, so not returned
      ];
      const customFields: CustomMergeFieldDefinition[] = [];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.isValid).toBe(false);
      expect(result.invalidFields).toContain('item.inactive');
      expect(result.invalidFields).not.toContain('item.active');
    });

    it('should query for company-specific custom fields', async () => {
      const template = '{{custom.companyField}}';
      const systemFields: MergeField[] = [];
      const customFields = [createMockCustomField({ key: 'companyField' })];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      await service.validateTemplate(testCompanyId, template);

      // Verify the second find call was for custom fields with company filter
      expect(mockEm.find).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({
          company: testCompanyId,
          isActive: true,
        }),
      );
    });

    it('should handle mixed valid and invalid references', async () => {
      const template =
        '{{item.quantity}} {{invalid.field}} {{custom.frameColor}} {{another.bad}}';
      const systemFields = [createMockMergeField({ key: 'item.quantity' })];
      const customFields = [createMockCustomField({ key: 'frameColor' })];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.isValid).toBe(false);
      expect(result.invalidFields).toHaveLength(2);
      expect(result.invalidFields).toContain('invalid.field');
      expect(result.invalidFields).toContain('another.bad');
      expect(result.invalidFields).not.toContain('item.quantity');
      expect(result.invalidFields).not.toContain('custom.frameColor');
    });
  });

  describe('getAvailableFields', () => {
    it('should return both system and custom fields', async () => {
      const systemFields = [
        createMockMergeField({ key: 'item.quantity' }),
        createMockMergeField({ key: 'customer.name' }),
      ];
      const customFields = [
        createMockCustomField({ key: 'frameColor' }),
        createMockCustomField({ key: 'windowSize' }),
      ];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      const result = await service.getAvailableFields(testCompanyId);

      expect(result.systemFields).toHaveLength(2);
      expect(result.customFields).toHaveLength(2);
      expect(result.systemFields[0]?.key).toBe('item.quantity');
      expect(result.customFields[0]?.key).toBe('frameColor');
    });

    it('should return empty arrays when no fields exist', async () => {
      mockEm.find.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.getAvailableFields(testCompanyId);

      expect(result.systemFields).toEqual([]);
      expect(result.customFields).toEqual([]);
    });

    it('should query only active fields', async () => {
      mockEm.find.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.getAvailableFields(testCompanyId);

      // Verify system fields query
      expect(mockEm.find).toHaveBeenNthCalledWith(1, expect.anything(), {
        isActive: true,
      });

      // Verify custom fields query
      expect(mockEm.find).toHaveBeenNthCalledWith(2, expect.anything(), {
        company: testCompanyId,
        isActive: true,
      });
    });

    it('should handle company with no custom fields', async () => {
      const systemFields = [createMockMergeField({ key: 'item.quantity' })];

      mockEm.find.mockResolvedValueOnce(systemFields).mockResolvedValueOnce([]);

      const result = await service.getAvailableFields(testCompanyId);

      expect(result.systemFields).toHaveLength(1);
      expect(result.customFields).toEqual([]);
    });
  });

  describe('suggestion algorithm (Levenshtein distance)', () => {
    it('should suggest field for single character typo', async () => {
      const template = '{{customer.nam}}'; // missing 'e'
      const systemFields = [createMockMergeField({ key: 'customer.name' })];

      mockEm.find.mockResolvedValueOnce(systemFields).mockResolvedValueOnce([]);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.suggestions[0]?.suggestion).toBe('customer.name');
    });

    it('should suggest field for transposed characters', async () => {
      const template = '{{custoemr.name}}'; // transposed 'o' and 'm'
      const systemFields = [createMockMergeField({ key: 'customer.name' })];

      mockEm.find.mockResolvedValueOnce(systemFields).mockResolvedValueOnce([]);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.suggestions[0]?.suggestion).toBe('customer.name');
    });

    it('should suggest closest match when multiple similar fields exist', async () => {
      const template = '{{item.nam}}';
      const systemFields = [
        createMockMergeField({ key: 'item.name' }),
        createMockMergeField({ key: 'item.note' }),
        createMockMergeField({ key: 'customer.name' }),
      ];

      mockEm.find.mockResolvedValueOnce(systemFields).mockResolvedValueOnce([]);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.suggestions[0]?.suggestion).toBe('item.name');
    });

    it('should suggest custom fields when appropriate', async () => {
      const template = '{{custom.frameColr}}'; // typo in "Color"
      const systemFields: MergeField[] = [];
      const customFields = [createMockCustomField({ key: 'frameColor' })];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.suggestions[0]?.suggestion).toBe('custom.frameColor');
    });
  });

  describe('edge cases', () => {
    it('should handle template with only whitespace', async () => {
      const template = '   \n\t  ';
      const systemFields: MergeField[] = [];
      const customFields: CustomMergeFieldDefinition[] = [];

      mockEm.find
        .mockResolvedValueOnce(systemFields)
        .mockResolvedValueOnce(customFields);

      const result = await service.validateTemplate(testCompanyId, template);

      expect(result.isValid).toBe(true);
      expect(result.invalidFields).toEqual([]);
    });

    it('should handle malformed merge field syntax gracefully', () => {
      // Single braces should not match
      const template = 'Hello {customer.name} and {{item.quantity}}';

      const result = service.extractReferences(template);

      expect(result).toEqual(['item.quantity']);
      expect(result).not.toContain('customer.name');
    });

    it('should handle unclosed merge field syntax', () => {
      // The regex matches from {{ to the first }}, so unclosed braces
      // will capture everything until the next closing }}
      const template = 'Hello {{customer.name}} and {{item.quantity';

      const result = service.extractReferences(template);

      // Only properly closed reference should be extracted
      expect(result).toContain('customer.name');
      expect(result).toHaveLength(1);
    });

    it('should handle empty merge field reference', () => {
      // The regex [^}]+ requires at least one character, so {{}} won't match
      const template = 'Hello {{}} and {{item.name}}';

      const result = service.extractReferences(template);

      // Empty {{}} won't match because regex requires at least one character
      expect(result).not.toContain('');
      expect(result).toContain('item.name');
      expect(result).toHaveLength(1);
    });

    it('should handle very long field names', () => {
      const longKey = 'a'.repeat(100);
      const template = `Hello {{${longKey}}}`;

      const result = service.extractReferences(template);

      expect(result).toEqual([longKey]);
    });

    it('should handle special characters in surrounding text', () => {
      const template = '<html>{{customer.name}}</html> & "{{item.quantity}}"';

      const result = service.extractReferences(template);

      expect(result).toContain('customer.name');
      expect(result).toContain('item.quantity');
    });
  });
});
