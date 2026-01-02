/**
 * Formula Evaluator Service Tests
 *
 * Unit tests for the FormulaEvaluatorService.
 * Tests formula parsing, reference extraction, transformation, and circular dependency detection.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { FormulaEvaluatorService } from '../formula-evaluator.service';

describe('FormulaEvaluatorService', () => {
  let service: FormulaEvaluatorService;

  beforeEach(() => {
    service = new FormulaEvaluatorService();
  });

  // ==========================================================================
  // extractReferences Tests
  // ==========================================================================

  describe('extractReferences', () => {
    it('should extract single reference from formula', () => {
      const refs = service.extractReferences('[abc123]');

      expect(refs).toEqual(['abc123']);
    });

    it('should extract multiple unique references', () => {
      const refs = service.extractReferences('[abc123] + [def456] * 2');

      expect(refs).toEqual(['abc123', 'def456']);
    });

    it('should deduplicate repeated references', () => {
      const refs = service.extractReferences('[abc] + [def] + [abc] * [abc]');

      expect(refs).toEqual(['abc', 'def']);
    });

    it('should return empty array for formula without references', () => {
      const refs = service.extractReferences('100 * 2 + 50');

      expect(refs).toEqual([]);
    });

    it('should handle empty formula', () => {
      const refs = service.extractReferences('');

      expect(refs).toEqual([]);
    });

    it('should extract UUID-style references', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const refs = service.extractReferences(`[${uuid}] * 2`);

      expect(refs).toEqual([uuid]);
    });

    it('should handle complex formulas with nested brackets in math', () => {
      const refs = service.extractReferences('([ref1] + [ref2]) / [ref3]');

      expect(refs).toEqual(['ref1', 'ref2', 'ref3']);
    });
  });

  // ==========================================================================
  // transformFormula Tests
  // ==========================================================================

  describe('transformFormula', () => {
    it('should transform all legacy references to UUIDs', () => {
      const mapping = new Map([
        ['legacyA', 'uuid-aaa'],
        ['legacyB', 'uuid-bbb'],
      ]);

      const result = service.transformFormula('[legacyA] + [legacyB]', mapping);

      expect(result.formula).toBe('[uuid-aaa] + [uuid-bbb]');
      expect(result.unresolvedRefs).toEqual([]);
    });

    it('should preserve unresolved references and report them', () => {
      const mapping = new Map([['legacyA', 'uuid-aaa']]);

      const result = service.transformFormula(
        '[legacyA] + [unknownRef]',
        mapping,
      );

      expect(result.formula).toBe('[uuid-aaa] + [unknownRef]');
      expect(result.unresolvedRefs).toEqual(['unknownRef']);
    });

    it('should handle formula with no references', () => {
      const mapping = new Map([['legacyA', 'uuid-aaa']]);

      const result = service.transformFormula('100 * 2', mapping);

      expect(result.formula).toBe('100 * 2');
      expect(result.unresolvedRefs).toEqual([]);
    });

    it('should handle empty mapping gracefully', () => {
      const result = service.transformFormula('[ref1] + [ref2]', new Map());

      expect(result.formula).toBe('[ref1] + [ref2]');
      expect(result.unresolvedRefs).toEqual(['ref1', 'ref2']);
    });

    it('should handle empty formula', () => {
      const result = service.transformFormula('', new Map());

      expect(result.formula).toBe('');
      expect(result.unresolvedRefs).toEqual([]);
    });

    it('should transform duplicate references correctly', () => {
      const mapping = new Map([['ref', 'uuid-123']]);

      const result = service.transformFormula('[ref] * [ref] + [ref]', mapping);

      expect(result.formula).toBe('[uuid-123] * [uuid-123] + [uuid-123]');
      expect(result.unresolvedRefs).toEqual([]);
    });
  });

  // ==========================================================================
  // detectCircularDependencies Tests
  // ==========================================================================

  describe('detectCircularDependencies', () => {
    it('should detect simple circular dependency (A -> B -> A)', () => {
      const items = [
        { id: 'a', qtyFormula: '[b] * 2' },
        { id: 'b', qtyFormula: '[a] + 1' },
      ];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect longer circular dependency chain (A -> B -> C -> A)', () => {
      const items = [
        { id: 'a', qtyFormula: '[b] * 2' },
        { id: 'b', qtyFormula: '[c] + 1' },
        { id: 'c', qtyFormula: '[a]' },
      ];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should return empty array when no cycles exist', () => {
      const items = [
        { id: 'a', qtyFormula: '[b] * 2' },
        { id: 'b', qtyFormula: '[c] + 1' },
        { id: 'c' }, // No formula, terminates the chain
      ];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles).toEqual([]);
    });

    it('should handle items without formulas', () => {
      const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles).toEqual([]);
    });

    it('should handle self-referencing formula', () => {
      const items = [{ id: 'a', qtyFormula: '[a] * 2' }];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect multiple independent cycles', () => {
      const items = [
        { id: 'a', qtyFormula: '[b]' },
        { id: 'b', qtyFormula: '[a]' }, // Cycle 1: a <-> b
        { id: 'c', qtyFormula: '[d]' },
        { id: 'd', qtyFormula: '[c]' }, // Cycle 2: c <-> d
      ];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should handle references to non-existent items', () => {
      const items = [
        { id: 'a', qtyFormula: '[nonexistent] * 2' },
        { id: 'b', qtyFormula: '[a] + 1' },
      ];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles).toEqual([]);
    });
  });

  // ==========================================================================
  // validateFormulaSyntax Tests
  // ==========================================================================

  describe('validateFormulaSyntax', () => {
    it('should return valid for well-formed formula', () => {
      const result = service.validateFormulaSyntax('[ref1] + [ref2] * 2');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect empty formula', () => {
      const result = service.validateFormulaSyntax('');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Formula cannot be empty');
    });

    it('should detect whitespace-only formula', () => {
      const result = service.validateFormulaSyntax('   ');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Formula cannot be empty');
    });

    it('should detect unmatched opening bracket', () => {
      const result = service.validateFormulaSyntax('[ref1 + ref2]');

      expect(result.isValid).toBe(true); // Brackets are balanced
    });

    it('should detect unmatched closing bracket', () => {
      const result = service.validateFormulaSyntax('ref1] + [ref2');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unmatched closing bracket');
    });

    it('should detect unclosed bracket', () => {
      const result = service.validateFormulaSyntax('[ref1 + [ref2]');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unmatched opening bracket');
    });

    it('should detect empty brackets', () => {
      const result = service.validateFormulaSyntax('[] + [ref1]');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Empty bracket reference');
    });

    it('should detect consecutive operators', () => {
      const result = service.validateFormulaSyntax('[ref1] ++ [ref2]');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Consecutive operators');
    });

    it('should allow simple numeric formulas', () => {
      const result = service.validateFormulaSyntax('100 * 2 + 50');

      expect(result.isValid).toBe(true);
    });
  });

  // ==========================================================================
  // buildFormulaIdMapping Tests
  // ==========================================================================

  describe('buildFormulaIdMapping', () => {
    it('should build mapping from formulaId to uuid', () => {
      const msis = [
        { id: 'uuid-1', sourceId: 'src-1', formulaId: 'formula-a' },
        { id: 'uuid-2', sourceId: 'src-2', formulaId: 'formula-b' },
      ];

      const mapping = service.buildFormulaIdMapping(msis);

      expect(mapping.get('formula-a')).toBe('uuid-1');
      expect(mapping.get('formula-b')).toBe('uuid-2');
    });

    it('should also map by sourceId as fallback', () => {
      const msis = [
        { id: 'uuid-1', sourceId: 'src-1', formulaId: 'formula-a' },
        { id: 'uuid-2', sourceId: 'src-2' }, // No formulaId
      ];

      const mapping = service.buildFormulaIdMapping(msis);

      expect(mapping.get('src-1')).toBe('uuid-1');
      expect(mapping.get('src-2')).toBe('uuid-2');
    });

    it('should handle empty array', () => {
      const mapping = service.buildFormulaIdMapping([]);

      expect(mapping.size).toBe(0);
    });

    it('should handle items without formulaId or sourceId', () => {
      const msis = [{ id: 'uuid-1' }, { id: 'uuid-2' }];

      const mapping = service.buildFormulaIdMapping(msis);

      expect(mapping.size).toBe(0);
    });
  });

  // ==========================================================================
  // getDependents Tests
  // ==========================================================================

  describe('getDependents', () => {
    it('should find direct dependents', () => {
      const items = [
        { id: 'a' },
        { id: 'b', qtyFormula: '[a] * 2' },
        { id: 'c', qtyFormula: '[a] + 1' },
      ];

      const dependents = service.getDependents('a', items);

      expect(dependents.has('b')).toBe(true);
      expect(dependents.has('c')).toBe(true);
      expect(dependents.size).toBe(2);
    });

    it('should find transitive dependents', () => {
      const items = [
        { id: 'a' },
        { id: 'b', qtyFormula: '[a] * 2' },
        { id: 'c', qtyFormula: '[b] + 1' }, // Depends on b which depends on a
      ];

      const dependents = service.getDependents('a', items);

      expect(dependents.has('b')).toBe(true);
      expect(dependents.has('c')).toBe(true);
    });

    it('should return empty set when no dependents', () => {
      const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

      const dependents = service.getDependents('a', items);

      expect(dependents.size).toBe(0);
    });

    it('should handle complex dependency graphs', () => {
      const items = [
        { id: 'root' },
        { id: 'a', qtyFormula: '[root]' },
        { id: 'b', qtyFormula: '[root]' },
        { id: 'c', qtyFormula: '[a] + [b]' },
        { id: 'd', qtyFormula: '[c]' },
      ];

      const dependents = service.getDependents('root', items);

      expect(dependents.has('a')).toBe(true);
      expect(dependents.has('b')).toBe(true);
      expect(dependents.has('c')).toBe(true);
      expect(dependents.has('d')).toBe(true);
    });

    it('should not include the target itself', () => {
      const items = [{ id: 'a' }, { id: 'b', qtyFormula: '[a]' }];

      const dependents = service.getDependents('a', items);

      expect(dependents.has('a')).toBe(false);
    });
  });
});
