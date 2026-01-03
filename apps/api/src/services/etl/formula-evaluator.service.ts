/**
 * Formula Evaluator Service
 *
 * Handles transformation and validation of quantity formulas during ETL.
 * Formulas reference other MSIs by their formulaId field.
 *
 * Example formula: "([abc123] * 2) + [def456]"
 * Where [abc123] and [def456] are formulaId references to other MSIs.
 */

/**
 * Result of formula transformation.
 */
export type FormulaTransformResult = {
  /** Transformed formula with new UUID references */
  formula: string;
  /** Legacy formulaIds that could not be resolved */
  unresolvedRefs: string[];
};

/**
 * Circular dependency detection result.
 */
export type CircularDependencyResult = {
  itemId: string;
  cycle: string[];
};

/**
 * Service for processing and validating quantity formulas during ETL.
 */
export class FormulaEvaluatorService {
  /**
   * Extract all bracket-enclosed references from a formula.
   *
   * Legacy formulas use [formulaId] syntax to reference other MSIs.
   *
   * @param formula - Formula string to parse
   * @returns Array of unique reference IDs found in brackets
   *
   * @example
   * ```typescript
   * extractReferences('[abc123] + [def456] * [abc123]')
   * // Returns: ['abc123', 'def456']
   * ```
   */
  extractReferences(formula: string): string[] {
    // Match anything inside brackets
    const bracketRegex = /\[([^\]]+)\]/g;
    const matches = formula.matchAll(bracketRegex);
    const refs = new Set<string>();

    for (const match of matches) {
      if (match[1]) {
        refs.add(match[1]);
      }
    }

    return Array.from(refs);
  }

  /**
   * Transform legacy formula references to new UUIDs.
   *
   * Replaces [legacyFormulaId] with [newUuid] based on the provided mapping.
   * Unresolved references are preserved as-is and returned in unresolvedRefs.
   *
   * @param legacyFormula - Original formula with legacy formulaId references
   * @param formulaIdToUuid - Map of legacyFormulaId -> newUuid
   * @returns Transformed formula and list of unresolved references
   *
   * @example
   * ```typescript
   * const mapping = new Map([['abc', 'uuid-1'], ['def', 'uuid-2']]);
   * transformFormula('[abc] + [def] + [xyz]', mapping);
   * // Returns: { formula: '[uuid-1] + [uuid-2] + [xyz]', unresolvedRefs: ['xyz'] }
   * ```
   */
  transformFormula(
    legacyFormula: string,
    formulaIdToUuid: Map<string, string>,
  ): FormulaTransformResult {
    const unresolvedRefs: string[] = [];

    const transformed = legacyFormula.replace(
      /\[([^\]]+)\]/g,
      (match, legacyId: string) => {
        const uuid = formulaIdToUuid.get(legacyId);
        if (uuid) {
          return `[${uuid}]`;
        } else {
          unresolvedRefs.push(legacyId);
          return match; // Keep original if not found
        }
      },
    );

    return { formula: transformed, unresolvedRefs };
  }

  /**
   * Detect circular dependencies in formula references.
   *
   * Uses DFS to find cycles in the dependency graph.
   * Circular dependencies would cause infinite loops during quantity calculation.
   *
   * @param items - Array of items with id and optional qtyFormula
   * @returns Array of items with circular dependencies and their cycles
   *
   * @example
   * ```typescript
   * const items = [
   *   { id: 'a', qtyFormula: '[b] * 2' },
   *   { id: 'b', qtyFormula: '[c] + 1' },
   *   { id: 'c', qtyFormula: '[a]' },  // Cycle: a -> b -> c -> a
   * ];
   * detectCircularDependencies(items);
   * // Returns: [{ itemId: 'a', cycle: ['a', 'b', 'c', 'a'] }]
   * ```
   */
  detectCircularDependencies(
    items: Array<{ id: string; qtyFormula?: string }>,
  ): CircularDependencyResult[] {
    // Build dependency graph: nodeId -> [ids that depend on this node]
    const dependsOn = new Map<string, string[]>();

    for (const item of items) {
      if (item.qtyFormula) {
        const refs = this.extractReferences(item.qtyFormula);
        dependsOn.set(item.id, refs);
      }
    }

    const cycles: CircularDependencyResult[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): boolean => {
      if (inStack.has(nodeId)) {
        // Found a cycle - extract the cycle portion of the path
        const cycleStart = path.indexOf(nodeId);
        const cycle = [...path.slice(cycleStart), nodeId];
        cycles.push({ itemId: path[0] ?? nodeId, cycle });
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      inStack.add(nodeId);
      path.push(nodeId);

      const dependencies = dependsOn.get(nodeId) ?? [];
      for (const dep of dependencies) {
        // Only follow edges that exist in our items
        if (dependsOn.has(dep) || items.some(i => i.id === dep)) {
          dfs(dep, path);
        }
      }

      inStack.delete(nodeId);
      path.pop();
      return false;
    };

    // Check each node that has dependencies
    for (const item of items) {
      if (item.qtyFormula && !visited.has(item.id)) {
        dfs(item.id, []);
      }
    }

    return cycles;
  }

  /**
   * Validate a formula for syntax errors.
   *
   * Checks for:
   * - Balanced brackets
   * - Valid operators
   * - Non-empty references
   *
   * @param formula - Formula string to validate
   * @returns Object with isValid flag and optional error message
   */
  validateFormulaSyntax(formula: string): { isValid: boolean; error?: string } {
    if (!formula || formula.trim() === '') {
      return { isValid: false, error: 'Formula cannot be empty' };
    }

    // Check for balanced brackets
    let bracketCount = 0;
    for (const char of formula) {
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
      if (bracketCount < 0) {
        return { isValid: false, error: 'Unmatched closing bracket' };
      }
    }
    if (bracketCount !== 0) {
      return { isValid: false, error: 'Unmatched opening bracket' };
    }

    // Check for empty brackets
    if (formula.includes('[]')) {
      return { isValid: false, error: 'Empty bracket reference' };
    }

    // Check for consecutive operators (basic check)
    if (/[+\-*/]{2,}/.test(formula.replace(/\s/g, ''))) {
      return { isValid: false, error: 'Consecutive operators' };
    }

    return { isValid: true };
  }

  /**
   * Build a mapping of formulaId -> uuid from imported MSIs.
   *
   * Used to transform formulas after MSIs have been imported.
   *
   * @param importedMsis - Array of imported MSIs with id, sourceId, and formulaId
   * @returns Map of formulaId -> uuid
   */
  buildFormulaIdMapping(
    importedMsis: Array<{ id: string; sourceId?: string; formulaId?: string }>,
  ): Map<string, string> {
    const mapping = new Map<string, string>();

    for (const msi of importedMsis) {
      // Map by formulaId if present
      if (msi.formulaId) {
        mapping.set(msi.formulaId, msi.id);
      }
      // Also map by sourceId as fallback
      if (msi.sourceId) {
        mapping.set(msi.sourceId, msi.id);
      }
    }

    return mapping;
  }

  /**
   * Get all items that depend on a given item (directly or indirectly).
   *
   * Useful for determining impact of changes.
   *
   * @param targetId - The item ID to find dependents for
   * @param items - All items with formulas
   * @returns Set of item IDs that depend on the target
   */
  getDependents(
    targetId: string,
    items: Array<{ id: string; qtyFormula?: string }>,
  ): Set<string> {
    // Build reverse dependency graph: nodeId -> [ids that reference this node]
    const dependedOnBy = new Map<string, Set<string>>();

    for (const item of items) {
      if (item.qtyFormula) {
        const refs = this.extractReferences(item.qtyFormula);
        for (const ref of refs) {
          if (!dependedOnBy.has(ref)) {
            dependedOnBy.set(ref, new Set());
          }
          dependedOnBy.get(ref)!.add(item.id);
        }
      }
    }

    const dependents = new Set<string>();
    const queue = [targetId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const directDependents = dependedOnBy.get(current);

      if (directDependents) {
        for (const dep of directDependents) {
          if (!dependents.has(dep)) {
            dependents.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    return dependents;
  }
}
