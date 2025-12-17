# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for significant technical decisions made in this project.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences. They help:

- **Document** the reasoning behind decisions
- **Communicate** decisions to the team
- **Maintain** institutional knowledge as team members change
- **Review** past decisions when circumstances change

## When to Create an ADR

Create an ADR when:

- Choosing between competing technologies or patterns
- Making significant refactoring decisions
- Establishing new integration patterns
- Making security-related architectural choices
- Implementing performance optimization strategies
- Introducing breaking changes to existing patterns

## ADR Template

Use the template at [ADR-000-template.md](./ADR-000-template.md) when creating new ADRs.

## ADR Statuses

- **Proposed** - Under discussion, not yet accepted
- **Accepted** - Decision has been made and implemented
- **Deprecated** - Decision has been superseded by another ADR
- **Superseded** - Replaced by a newer ADR (link to replacement)

## Index

| ADR                                           | Title                                   | Status   | Date       |
| --------------------------------------------- | --------------------------------------- | -------- | ---------- |
| [ADR-001](./ADR-001-credential-encryption.md) | Credential Encryption with Key Rotation | Accepted | 2024-12-16 |

## Creating a New ADR

1. Copy `ADR-000-template.md` to `ADR-XXX-title.md` (use next sequential number)
2. Fill in all sections
3. Submit for review via PR
4. Update this index when merged
