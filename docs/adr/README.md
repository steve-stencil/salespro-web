# Architecture Decision Records (ADRs)

This folder contains Architecture Decision Records for significant technical decisions made in this project.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences. ADRs help future developers understand:

- **Why** a decision was made
- **What** alternatives were considered
- **What** trade-offs were accepted

## Index

| ADR                                         | Title               | Status   | Date    |
| ------------------------------------------- | ------------------- | -------- | ------- |
| [ADR-001](./ADR-001-mfa-trusted-devices.md) | MFA Trusted Devices | Accepted | 2024-12 |

## Creating a New ADR

1. Copy `ADR-000-template.md` to `ADR-XXX-title.md`
2. Fill in all sections
3. Add an entry to the index above
4. Submit for review

## ADR Statuses

- **Proposed**: Under discussion, not yet accepted
- **Accepted**: Decision has been made and implemented
- **Deprecated**: No longer relevant or applicable
- **Superseded**: Replaced by a newer ADR (link to the replacement)

## When to Write an ADR

Write an ADR when making decisions about:

- Choosing between competing technologies or patterns
- Significant refactoring or architectural changes
- New integration patterns with external systems
- Security-related architectural choices
- Performance optimization strategies
- Breaking changes to existing patterns

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Michael Nygard's Original Article](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
