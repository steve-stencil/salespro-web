# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the SalesPro Dashboard project. ADRs document significant architectural decisions made during development, providing context and rationale for future reference.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision along with its context and consequences. ADRs help:

- **Document the "why"** behind technical decisions
- **Preserve institutional knowledge** when team members change
- **Enable informed decisions** about whether to change existing patterns
- **Reduce repeated discussions** about previously decided topics

## When to Create an ADR

Create an ADR when making decisions about:

- **Technology choices** - Selecting frameworks, libraries, or tools
- **Architectural patterns** - Choosing design patterns or architectural styles
- **Integration approaches** - How systems communicate with each other
- **Security decisions** - Authentication, authorization, encryption strategies
- **Performance strategies** - Caching, optimization, scaling approaches
- **Breaking changes** - Changes that affect existing patterns or APIs
- **Development practices** - Testing strategies, code organization, conventions

## ADR Format

Each ADR follows a standard format (see `ADR-000-template.md`):

1. **Title** - Short descriptive title with sequential number
2. **Status** - Current state (Proposed, Accepted, Deprecated, Superseded)
3. **Context** - The situation and factors driving the decision
4. **Decision** - What was decided and why
5. **Consequences** - The resulting effects (positive and negative)

## ADR Lifecycle

```
Proposed → Accepted → [Deprecated | Superseded]
```

- **Proposed**: Decision is being discussed
- **Accepted**: Decision has been approved and implemented
- **Deprecated**: Decision is no longer valid but kept for history
- **Superseded**: Replaced by a newer ADR (link to replacement)

## Naming Convention

ADRs are numbered sequentially:

```
ADR-001-short-title.md
ADR-002-another-decision.md
ADR-003-yet-another.md
```

Use lowercase with hyphens for the title portion.

## Index of ADRs

| ADR                                           | Title                                   | Status   | Date       |
| --------------------------------------------- | --------------------------------------- | -------- | ---------- |
| [ADR-000](ADR-000-template.md)                | ADR Template                            | Accepted | 2024-12-16 |
| [ADR-001](./ADR-001-credential-encryption.md) | Credential Encryption with Key Rotation | Accepted | 2024-12-16 |

<!-- Add new ADRs to this table as they are created -->

## Creating a New ADR

1. Copy `ADR-000-template.md` to a new file with the next sequential number
2. Fill in all sections with relevant details
3. Set status to "Proposed" for team discussion
4. Update status to "Accepted" once approved
5. Add entry to the index table above
6. Commit with message: `docs: add ADR-XXX for [topic]`

## Best Practices

### Do

- Keep ADRs concise but complete
- Focus on the "why" not just the "what"
- Include alternatives that were considered
- Document both positive and negative consequences
- Link to related ADRs when applicable
- Update status when decisions change

### Don't

- Don't delete ADRs - mark them as deprecated/superseded
- Don't modify accepted ADRs - create new ones instead
- Don't use ADRs for implementation details - focus on architecture
- Don't skip the consequences section - it's the most valuable part

## Related Documentation

- [Architecture Overview](../ARCHITECTURE.md)
- [Development Guide](../DEVELOPMENT.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)
