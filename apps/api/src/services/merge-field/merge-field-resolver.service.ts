import {
  MergeField,
  CustomMergeFieldDefinition,
} from '../../entities/merge-field';

import type { EntityManager } from '@mikro-orm/postgresql';

/**
 * Suggestion for an invalid merge field reference.
 */
export type FieldSuggestion = {
  /** The invalid field key that was found */
  invalid: string;
  /** A suggested valid key (if a similar one exists) */
  suggestion?: string;
};

/**
 * Result of template validation.
 */
export type TemplateValidationResult = {
  /** Whether all merge field references are valid */
  isValid: boolean;
  /** List of invalid field keys found in the template */
  invalidFields: string[];
  /** Suggestions for fixing invalid fields */
  suggestions: FieldSuggestion[];
};

/**
 * MergeFieldResolverService - handles merge field extraction and validation.
 *
 * This service provides utilities for:
 * - Extracting merge field references from template strings
 * - Validating templates against available system and custom fields
 * - Providing typo suggestions for invalid field references
 *
 * @example
 * ```typescript
 * const resolver = new MergeFieldResolverService(em);
 *
 * // Extract all field references from a template
 * const refs = resolver.extractReferences('Hello {{customer.name}}, your total is {{option.selected.totalPrice}}');
 * // Returns: ['customer.name', 'option.selected.totalPrice']
 *
 * // Validate a template
 * const result = await resolver.validateTemplate(companyId, template);
 * if (!result.isValid) {
 *   console.log('Invalid fields:', result.invalidFields);
 * }
 * ```
 */
export class MergeFieldResolverService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Extract all merge field references from a template string.
   * Returns array of keys like ["item.quantity", "custom.frameColor"]
   *
   * @param template - The template string containing {{field.key}} references
   * @returns Array of unique field keys found in the template
   */
  extractReferences(template: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = template.matchAll(regex);
    return [...new Set([...matches].map(m => m[1]!.trim()))];
  }

  /**
   * Validate a template for invalid merge field references.
   *
   * Checks all {{field.key}} references against:
   * - Global SYSTEM merge fields (MergeField table)
   * - Company-specific custom merge fields (CustomMergeFieldDefinition)
   *
   * @param companyId - The company ID to check custom fields against
   * @param templateContent - The template string to validate
   * @returns Validation result with invalid fields and suggestions
   */
  async validateTemplate(
    companyId: string,
    templateContent: string,
  ): Promise<TemplateValidationResult> {
    const referenced = this.extractReferences(templateContent);

    // Get all valid system fields
    const systemFields = await this.em.find(MergeField, { isActive: true });
    const systemKeys = new Set(systemFields.map(f => f.key));

    // Get all valid custom fields for this company
    const customFields = await this.em.find(CustomMergeFieldDefinition, {
      company: companyId,
      isActive: true,
    });
    const customKeys = new Set(customFields.map(f => `custom.${f.key}`));

    // Combine valid keys
    const validKeys = new Set([...systemKeys, ...customKeys]);

    // Find invalid references
    const invalidFields = referenced.filter(key => !validKeys.has(key));

    return {
      isValid: invalidFields.length === 0,
      invalidFields,
      suggestions: invalidFields.map(key => ({
        invalid: key,
        suggestion: this.findSimilar(key, validKeys),
      })),
    };
  }

  /**
   * Get all available merge fields for a company.
   *
   * @param companyId - The company ID to get fields for
   * @returns Object containing system and custom field arrays
   */
  async getAvailableFields(companyId: string): Promise<{
    systemFields: MergeField[];
    customFields: CustomMergeFieldDefinition[];
  }> {
    const [systemFields, customFields] = await Promise.all([
      this.em.find(MergeField, { isActive: true }),
      this.em.find(CustomMergeFieldDefinition, {
        company: companyId,
        isActive: true,
      }),
    ]);

    return { systemFields, customFields };
  }

  /**
   * Find similar key for typo suggestions using Levenshtein distance.
   *
   * @param key - The invalid key to find a match for
   * @param validKeys - Set of valid keys to search
   * @returns The closest matching key, or undefined if none found
   */
  private findSimilar(key: string, validKeys: Set<string>): string | undefined {
    let bestMatch: string | undefined;
    let bestDistance = Infinity;

    for (const valid of validKeys) {
      const distance = this.levenshteinDistance(key, valid);
      // Only suggest if the distance is small enough to be a likely typo
      if (distance < bestDistance && distance <= 3) {
        bestDistance = distance;
        bestMatch = valid;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate Levenshtein distance between two strings.
   *
   * @param a - First string
   * @param b - Second string
   * @returns The edit distance between the strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    // Initialize first column
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    // Initialize first row
    for (let j = 0; j <= a.length; j++) {
      matrix[0]![j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1, // insertion
            matrix[i - 1]![j]! + 1, // deletion
          );
        }
      }
    }

    return matrix[b.length]![a.length]!;
  }
}
