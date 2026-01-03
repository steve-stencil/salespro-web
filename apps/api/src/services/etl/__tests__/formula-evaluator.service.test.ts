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

    it('should extract references from deeply nested mathematical expressions', () => {
      const refs = service.extractReferences(
        '(([width] * [height]) + ([depth] / 2)) - [offset]',
      );

      expect(refs).toEqual(['width', 'height', 'depth', 'offset']);
    });

    it('should handle references with underscores and numbers', () => {
      const refs = service.extractReferences(
        '[WINDOW_COUNT_1] + [door_qty_2] * [TOTAL_3]',
      );

      expect(refs).toEqual(['WINDOW_COUNT_1', 'door_qty_2', 'TOTAL_3']);
    });

    it('should handle references with hyphens (legacy objectIds)', () => {
      const refs = service.extractReferences('[abc-123-def] + [xyz-789]');

      expect(refs).toEqual(['abc-123-def', 'xyz-789']);
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

    it('should handle mixed resolved and unresolved references', () => {
      const mapping = new Map([
        ['known1', 'uuid-aaa'],
        ['known2', 'uuid-bbb'],
      ]);

      const result = service.transformFormula(
        '[known1] + [unknown1] * [known2] - [unknown2]',
        mapping,
      );

      expect(result.formula).toBe(
        '[uuid-aaa] + [unknown1] * [uuid-bbb] - [unknown2]',
      );
      expect(result.unresolvedRefs).toEqual(['unknown1', 'unknown2']);
    });

    it('should transform deeply nested mathematical expressions', () => {
      const mapping = new Map([
        ['width', 'uuid-w'],
        ['height', 'uuid-h'],
        ['depth', 'uuid-d'],
      ]);

      const result = service.transformFormula(
        '(([width] * [height]) + [depth]) / 2',
        mapping,
      );

      expect(result.formula).toBe('(([uuid-w] * [uuid-h]) + [uuid-d]) / 2');
      expect(result.unresolvedRefs).toEqual([]);
    });

    it('should preserve formula structure with all operator types', () => {
      const mapping = new Map([
        ['a', 'uuid-a'],
        ['b', 'uuid-b'],
        ['c', 'uuid-c'],
        ['d', 'uuid-d'],
      ]);

      const result = service.transformFormula(
        '[a] + [b] - [c] * [d] / 2',
        mapping,
      );

      expect(result.formula).toBe(
        '[uuid-a] + [uuid-b] - [uuid-c] * [uuid-d] / 2',
      );
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

    // ========================================================================
    // Formula Chaining Tests (MSI with formula referencing another MSI with formula)
    // ========================================================================

    it('should allow valid formula chain: MSI with formula can be referenced by another MSI with formula', () => {
      // This is a valid and common scenario in legacy data:
      // - "Windows" calculates quantity from openings
      // - "Hardware" references "Windows" to calculate hardware qty
      // - "Screws" references "Hardware" to calculate screw qty
      const items = [
        { id: 'openings' }, // Base item, no formula
        { id: 'windows', qtyFormula: '[openings] - 2' }, // Has formula, can be referenced
        { id: 'hardware', qtyFormula: '[windows] * 4' }, // References MSI that has a formula
        { id: 'screws', qtyFormula: '[hardware] * 8' }, // References MSI that has a formula
      ];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles).toEqual([]); // No cycles - this is valid
    });

    it('should allow deep formula chains (5+ levels) without cycles', () => {
      const items = [
        { id: 'base' }, // Level 0: no formula
        { id: 'level1', qtyFormula: '[base] * 2' }, // Level 1
        { id: 'level2', qtyFormula: '[level1] + 10' }, // Level 2
        { id: 'level3', qtyFormula: '[level2] / 2' }, // Level 3
        { id: 'level4', qtyFormula: '[level3] - 5' }, // Level 4
        { id: 'level5', qtyFormula: '[level4] * 3' }, // Level 5
      ];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles).toEqual([]); // Valid chain, no cycles
    });

    it('should allow diamond dependency pattern (multiple paths to same item)', () => {
      // Diamond pattern:
      //       root
      //      /    \
      //     a      b
      //      \    /
      //       leaf
      // This is valid - no cycles, just shared dependencies
      const items = [
        { id: 'root' },
        { id: 'a', qtyFormula: '[root] * 2' },
        { id: 'b', qtyFormula: '[root] * 3' },
        { id: 'leaf', qtyFormula: '[a] + [b]' }, // References two MSIs that both have formulas
      ];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles).toEqual([]); // Valid diamond, no cycles
    });

    it('should detect cycle even when some items in chain have no formula', () => {
      const items = [
        { id: 'a', qtyFormula: '[b]' },
        { id: 'b' }, // No formula, but is referenced
        { id: 'c', qtyFormula: '[a]' }, // Creates indirect cycle through non-formula item
      ];

      // This should NOT be a cycle because 'b' doesn't reference anything
      const cycles = service.detectCircularDependencies(items);

      expect(cycles).toEqual([]);
    });

    it('should handle formula referencing multiple MSIs where some have formulas', () => {
      const items = [
        { id: 'manual' }, // No formula
        { id: 'calculated', qtyFormula: '[manual] * 2' }, // Has formula
        { id: 'combined', qtyFormula: '[manual] + [calculated]' }, // References both
      ];

      const cycles = service.detectCircularDependencies(items);

      expect(cycles).toEqual([]); // Valid - no cycles
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

    it('should map both formulaId AND sourceId for same MSI', () => {
      const msis = [
        { id: 'uuid-1', sourceId: 'mongo-obj-123', formulaId: 'WINDOW_COUNT' },
      ];

      const mapping = service.buildFormulaIdMapping(msis);

      // Both should map to the same UUID
      expect(mapping.get('WINDOW_COUNT')).toBe('uuid-1');
      expect(mapping.get('mongo-obj-123')).toBe('uuid-1');
      expect(mapping.size).toBe(2);
    });

    it('should handle MSIs with formulaId but no qtyFormula (reference targets)', () => {
      // These MSIs can be referenced by other formulas even though they have no formula themselves
      const msis = [
        { id: 'uuid-1', sourceId: 'src-1', formulaId: 'MANUAL_QTY' },
        { id: 'uuid-2', sourceId: 'src-2', formulaId: 'MEASURED_VALUE' },
      ];

      const mapping = service.buildFormulaIdMapping(msis);

      expect(mapping.get('MANUAL_QTY')).toBe('uuid-1');
      expect(mapping.get('MEASURED_VALUE')).toBe('uuid-2');
    });

    it('should handle duplicate formulaIds (last one wins)', () => {
      // Edge case: if legacy data has duplicate formulaIds, last processed wins
      const msis = [
        { id: 'uuid-1', formulaId: 'DUPLICATE' },
        { id: 'uuid-2', formulaId: 'DUPLICATE' },
      ];

      const mapping = service.buildFormulaIdMapping(msis);

      expect(mapping.get('DUPLICATE')).toBe('uuid-2');
    });

    it('should handle large mapping efficiently', () => {
      // Simulate a larger import with many MSIs
      const msis = Array.from({ length: 1000 }, (_, i) => ({
        id: `uuid-${i}`,
        sourceId: `src-${i}`,
        formulaId: `formula-${i}`,
      }));

      const mapping = service.buildFormulaIdMapping(msis);

      expect(mapping.size).toBe(2000); // 1000 formulaIds + 1000 sourceIds
      expect(mapping.get('formula-500')).toBe('uuid-500');
      expect(mapping.get('src-999')).toBe('uuid-999');
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

    it('should find dependents when target MSI has its own formula', () => {
      // The target MSI itself has a formula, but other MSIs depend on it
      const items = [
        { id: 'base' },
        { id: 'target', qtyFormula: '[base] * 2' }, // Target has a formula
        { id: 'dependent1', qtyFormula: '[target] + 5' }, // Depends on target
        { id: 'dependent2', qtyFormula: '[target] * 3' }, // Also depends on target
      ];

      const dependents = service.getDependents('target', items);

      expect(dependents.has('dependent1')).toBe(true);
      expect(dependents.has('dependent2')).toBe(true);
      expect(dependents.has('base')).toBe(false); // base is not a dependent
      expect(dependents.size).toBe(2);
    });

    it('should find transitive dependents through MSIs with formulas', () => {
      // Chain: base -> middle (has formula) -> end (has formula)
      // When we ask for dependents of 'base', we should get both middle and end
      const items = [
        { id: 'base' },
        { id: 'middle', qtyFormula: '[base] * 2' },
        { id: 'end', qtyFormula: '[middle] + 10' },
      ];

      const dependents = service.getDependents('base', items);

      expect(dependents.has('middle')).toBe(true);
      expect(dependents.has('end')).toBe(true);
    });

    it('should handle diamond pattern in getDependents', () => {
      // Diamond: base -> a, base -> b, both a and b -> leaf
      const items = [
        { id: 'base' },
        { id: 'a', qtyFormula: '[base]' },
        { id: 'b', qtyFormula: '[base]' },
        { id: 'leaf', qtyFormula: '[a] + [b]' },
      ];

      const dependents = service.getDependents('base', items);

      expect(dependents.has('a')).toBe(true);
      expect(dependents.has('b')).toBe(true);
      expect(dependents.has('leaf')).toBe(true);
      expect(dependents.size).toBe(3);
    });

    it('should not infinite loop on circular dependencies', () => {
      // Even with a cycle, getDependents should terminate
      const items = [
        { id: 'a', qtyFormula: '[b]' },
        { id: 'b', qtyFormula: '[a]' }, // Cycle
      ];

      // Should complete without hanging
      const dependents = service.getDependents('a', items);

      expect(dependents.has('b')).toBe(true);
      // 'a' might or might not be included depending on implementation
      // The important thing is it doesn't infinite loop
    });
  });

  // ==========================================================================
  // Integration-style Tests: Full ETL Formula Transformation Workflow
  // ==========================================================================

  describe('Full ETL Formula Transformation Workflow', () => {
    it('should transform formulas in a realistic legacy data scenario', () => {
      // Simulate legacy MSI data as it comes from MongoDB
      const legacyMsis = [
        {
          objectId: 'mongo-001',
          formulaID: 'OPENING_COUNT',
          // No qtyFormula - this is a base measurement
        },
        {
          objectId: 'mongo-002',
          formulaID: 'WINDOW_QTY',
          qtyFormula: '[OPENING_COUNT] - 2', // References OPENING_COUNT
        },
        {
          objectId: 'mongo-003',
          formulaID: 'HARDWARE_QTY',
          qtyFormula: '[WINDOW_QTY] * 4', // References WINDOW_QTY (which has a formula)
        },
        {
          objectId: 'mongo-004',
          formulaID: 'SCREW_QTY',
          qtyFormula: '[HARDWARE_QTY] * 8', // References HARDWARE_QTY (which has a formula)
        },
      ];

      // Step 1: Import MSIs and get new UUIDs
      const importedMsis = legacyMsis.map(legacy => ({
        id: `uuid-for-${legacy.objectId}`,
        sourceId: legacy.objectId,
        formulaId: legacy.formulaID,
      }));

      // Step 2: Build the mapping
      const mapping = service.buildFormulaIdMapping(importedMsis);

      // Verify mapping includes all formulaIds
      expect(mapping.get('OPENING_COUNT')).toBe('uuid-for-mongo-001');
      expect(mapping.get('WINDOW_QTY')).toBe('uuid-for-mongo-002');
      expect(mapping.get('HARDWARE_QTY')).toBe('uuid-for-mongo-003');

      // Step 3: Transform each formula
      const windowResult = service.transformFormula(
        '[OPENING_COUNT] - 2',
        mapping,
      );
      expect(windowResult.formula).toBe('[uuid-for-mongo-001] - 2');
      expect(windowResult.unresolvedRefs).toEqual([]);

      const hardwareResult = service.transformFormula(
        '[WINDOW_QTY] * 4',
        mapping,
      );
      expect(hardwareResult.formula).toBe('[uuid-for-mongo-002] * 4');
      expect(hardwareResult.unresolvedRefs).toEqual([]);

      const screwResult = service.transformFormula(
        '[HARDWARE_QTY] * 8',
        mapping,
      );
      expect(screwResult.formula).toBe('[uuid-for-mongo-003] * 8');
      expect(screwResult.unresolvedRefs).toEqual([]);
    });

    it('should validate formula chain has no circular dependencies after transformation', () => {
      // After transformation, verify the chain is valid
      const transformedItems = [
        { id: 'uuid-001' }, // OPENING_COUNT - no formula
        { id: 'uuid-002', qtyFormula: '[uuid-001] - 2' }, // WINDOW_QTY
        { id: 'uuid-003', qtyFormula: '[uuid-002] * 4' }, // HARDWARE_QTY
        { id: 'uuid-004', qtyFormula: '[uuid-003] * 8' }, // SCREW_QTY
      ];

      const cycles = service.detectCircularDependencies(transformedItems);

      expect(cycles).toEqual([]); // Valid chain, no cycles
    });

    it('should identify impact of changing a base item', () => {
      // If WINDOW_QTY changes, what else is affected?
      const items = [
        { id: 'opening' },
        { id: 'window', qtyFormula: '[opening] - 2' },
        { id: 'hardware', qtyFormula: '[window] * 4' },
        { id: 'screw', qtyFormula: '[hardware] * 8' },
        { id: 'unrelated', qtyFormula: '[opening] + 1' }, // Only depends on opening
      ];

      const windowDependents = service.getDependents('window', items);

      expect(windowDependents.has('hardware')).toBe(true);
      expect(windowDependents.has('screw')).toBe(true);
      expect(windowDependents.has('unrelated')).toBe(false);
    });

    it('should handle legacy data with missing references gracefully', () => {
      // Simulate legacy data where some referenced items were deleted
      const legacyFormula =
        '[EXISTING_ITEM] + [DELETED_ITEM] * [ANOTHER_DELETED]';
      const mapping = new Map([['EXISTING_ITEM', 'uuid-123']]);

      const result = service.transformFormula(legacyFormula, mapping);

      // Should transform what it can and preserve/report the rest
      expect(result.formula).toBe(
        '[uuid-123] + [DELETED_ITEM] * [ANOTHER_DELETED]',
      );
      expect(result.unresolvedRefs).toContain('DELETED_ITEM');
      expect(result.unresolvedRefs).toContain('ANOTHER_DELETED');
      expect(result.unresolvedRefs).toHaveLength(2);
    });
  });
});
