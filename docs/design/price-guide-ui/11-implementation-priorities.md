# Price Guide UI Design - Implementation Priorities

[← Back to Overview](./00-overview.md)

---

## Overview

This document provides a recommended implementation order based on:

- User value (what features matter most)
- Technical dependencies (what needs to be built first)
- Complexity (easier wins first for momentum)

---

## Phase 1: Foundation (Week 1-2)

### Priority 1.1: Core Components

Build the reusable components that everything else depends on.

| Component          | Complexity | Notes                      |
| ------------------ | ---------- | -------------------------- |
| EntityCard         | Medium     | Used everywhere            |
| PricingGrid        | High       | Core to pricing experience |
| RelationshipBadges | Low        | Simple but used everywhere |
| LinkPicker         | Medium     | Modal for linking items    |
| ImpactWarning      | Low        | Critical for shared items  |

### Priority 1.2: Catalog Page (Basic)

Get the main browsing experience working.

| Feature                  | Complexity | Notes                             |
| ------------------------ | ---------- | --------------------------------- |
| MSI list with pagination | Medium     | Cursor-based infinite scroll      |
| Search                   | Medium     | Requires full-text search backend |
| Category filter          | Low        | Dropdown with tree data           |
| Office filter            | Low        | Simple dropdown                   |
| MSI card (collapsed)     | Low        | Show summary info                 |
| MSI card (expanded)      | Medium     | Show linked items                 |

### Deliverable

Users can browse, search, and filter MSIs. They can see linked options/upcharges in expanded cards.

---

## Phase 2: CRUD Operations (Week 3-4)

### Priority 2.1: View/Edit MSI

| Feature                     | Complexity | Notes                                  |
| --------------------------- | ---------- | -------------------------------------- |
| MSI detail page (read-only) | Medium     | Tab structure, all relationships       |
| MSI edit mode               | Medium     | Form validation, save flow             |
| Link options to MSI         | Medium     | Uses LinkPicker component              |
| Link upcharges to MSI       | Medium     | Uses LinkPicker + compatibility config |
| Reorder linked items        | Medium     | Drag-drop within card                  |
| Unlink items                | Low        | With impact warning                    |

### Priority 2.2: Library Pages

| Feature                       | Complexity | Notes                         |
| ----------------------------- | ---------- | ----------------------------- |
| Options list                  | Low        | Table with pagination         |
| Create option                 | Low        | Simple form                   |
| Edit option                   | Low        | Simple form + impact warning  |
| UpCharges list                | Low        | Similar to options            |
| Create/edit upcharge          | Medium     | Includes compatibility config |
| Additional details list       | Low        | Similar pattern               |
| Create/edit additional detail | Medium     | Complex field type config     |

### Deliverable

Users can view, create, edit, and link all entity types. Basic CRUD is complete.

---

## Phase 3: Pricing (Week 5-6)

### Priority 3.1: Option Pricing

| Feature              | Complexity | Notes                             |
| -------------------- | ---------- | --------------------------------- |
| Pricing page layout  | Medium     | Tab structure, item selector      |
| Option pricing grid  | High       | Full spreadsheet functionality    |
| Cell editing         | High       | Keyboard nav, validation          |
| Copy from office     | Medium     | Convenience feature               |
| Save pricing changes | Medium     | Batch save with conflict handling |
| Pricing warnings     | Low        | Missing pricing indicators        |

### Priority 3.2: UpCharge Pricing

| Feature                  | Complexity | Notes                             |
| ------------------------ | ---------- | --------------------------------- |
| Default upcharge pricing | Medium     | Similar to options                |
| Percentage mode          | High       | Complex calculation logic         |
| Percentage base config   | Medium     | Multi-select price types          |
| Live preview             | Medium     | Real-time calculation display     |
| Option overrides         | High       | Second pricing grid for overrides |

### Deliverable

Users can configure all pricing scenarios including percentage-based upcharges with option overrides.

---

## Phase 4: Category Management (Week 7)

| Feature            | Complexity | Notes                         |
| ------------------ | ---------- | ----------------------------- |
| Category tree view | Medium     | Recursive rendering           |
| Expand/collapse    | Low        | State management              |
| Add category       | Low        | Inline form                   |
| Rename category    | Low        | Inline editing                |
| Delete category    | Medium     | Impact warning, reassign MSIs |
| Drag-drop reorder  | High       | Complex DnD within tree       |
| Drag-drop reparent | High       | Move between parents          |
| Depth warning      | Low        | Visual indicator at 5+        |

### Deliverable

Users can fully manage their category hierarchy with drag-drop support.

---

## Phase 5: Bulk Operations (Week 8-9)

### Priority 5.1: Selection & Basic Bulk

| Feature                 | Complexity | Notes                        |
| ----------------------- | ---------- | ---------------------------- |
| Multi-select in catalog | Low        | Checkbox column              |
| Bulk actions toolbar    | Low        | Sticky bottom bar            |
| Select all              | Low        | With pagination awareness    |
| Bulk delete             | Medium     | Confirmation with impact     |
| Bulk edit (category)    | Medium     | Change category for selected |
| Bulk edit (offices)     | Medium     | Add/remove office visibility |

### Priority 5.2: Mass Price Change

| Feature               | Complexity | Notes                    |
| --------------------- | ---------- | ------------------------ |
| Wizard flow (5 steps) | Medium     | Multi-step form          |
| Item selection        | Medium     | Search + checkbox list   |
| Change configuration  | Low        | Form for operation type  |
| Preview generation    | Medium     | Calculate sample changes |
| Background job        | High       | pg-boss integration      |
| Progress tracking     | Medium     | Real-time updates        |
| Completion report     | Low        | Summary of changes       |

### Priority 5.3: Import/Export

| Feature            | Complexity | Notes                        |
| ------------------ | ---------- | ---------------------------- |
| Export dialog      | Low        | Format selection             |
| Generate CSV/XLSX  | Medium     | Server-side generation       |
| Import wizard      | High       | File upload, column mapping  |
| Validation preview | High       | Show errors before import    |
| Import execution   | High       | Background job with progress |

### Deliverable

Users can perform all bulk operations efficiently.

---

## Phase 6: Polish & Advanced Features (Week 10+)

### Priority 6.1: Relationship Visualization

| Feature                    | Complexity | Notes                   |
| -------------------------- | ---------- | ----------------------- |
| Where-used panel           | Medium     | List of linked MSIs     |
| Impact warnings (enhanced) | Medium     | Detailed change preview |
| Relationship diagram       | High       | Visual graph view       |

### Priority 6.2: Data Quality

| Feature              | Complexity | Notes                      |
| -------------------- | ---------- | -------------------------- |
| Validation tool      | Medium     | Check data integrity       |
| Issue detail views   | Medium     | Drill into specific issues |
| Auto-fix suggestions | High       | Safe automatic repairs     |

### Priority 6.3: History & Audit

| Feature               | Complexity | Notes                   |
| --------------------- | ---------- | ----------------------- |
| Price change log      | Medium     | View historical changes |
| Entity change history | High       | Full audit trail        |
| Restore from history  | High       | Undo changes            |

### Priority 6.4: Performance Optimization

| Feature            | Complexity | Notes                        |
| ------------------ | ---------- | ---------------------------- |
| Virtual scrolling  | Medium     | For large lists              |
| Optimistic updates | Medium     | Faster perceived performance |
| Prefetching        | Medium     | Load data before needed      |
| Caching strategy   | Medium     | TanStack Query optimization  |

---

## Component Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEPENDENCY GRAPH                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: Foundation                                                        │
│  ┌─────────────────┐                                                        │
│  │ EntityCard      │──┐                                                     │
│  └─────────────────┘  │                                                     │
│  ┌─────────────────┐  │     Phase 2: CRUD                                   │
│  │ PricingGrid     │──┼────►┌─────────────────┐                             │
│  └─────────────────┘  │     │ Catalog Page    │                             │
│  ┌─────────────────┐  │     └────────┬────────┘                             │
│  │ LinkPicker      │──┤              │                                      │
│  └─────────────────┘  │              ▼                                      │
│  ┌─────────────────┐  │     ┌─────────────────┐                             │
│  │ ImpactWarning   │──┤     │ MSI Detail      │                             │
│  └─────────────────┘  │     └────────┬────────┘                             │
│  ┌─────────────────┐  │              │                                      │
│  │ Badges          │──┘              ▼         Phase 3: Pricing             │
│  └─────────────────┘        ┌─────────────────┐                             │
│                             │ Library Pages   │────►┌─────────────────┐     │
│                             └────────┬────────┘     │ Pricing Page    │     │
│                                      │              └────────┬────────┘     │
│                                      ▼                       │              │
│  Phase 4: Categories        ┌─────────────────┐              │              │
│  ┌─────────────────┐        │ CRUD Complete   │              │              │
│  │ CategoryTree    │        └────────┬────────┘              │              │
│  └────────┬────────┘                 │                       │              │
│           │                          ▼                       ▼              │
│           │                 ┌─────────────────────────────────────┐         │
│           └────────────────►│       Phase 5: Bulk Operations      │         │
│                             └─────────────────────────────────────┘         │
│                                              │                              │
│                                              ▼                              │
│                             ┌─────────────────────────────────────┐         │
│                             │       Phase 6: Polish & Advanced     │         │
│                             └─────────────────────────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Effort Estimates

| Phase     | Duration      | Developers | Notes                      |
| --------- | ------------- | ---------- | -------------------------- |
| Phase 1   | 2 weeks       | 2          | Foundation + basic catalog |
| Phase 2   | 2 weeks       | 2          | Full CRUD operations       |
| Phase 3   | 2 weeks       | 2          | Complex pricing logic      |
| Phase 4   | 1 week        | 1          | Category tree              |
| Phase 5   | 2 weeks       | 2          | Bulk operations            |
| Phase 6   | 2+ weeks      | 1-2        | Polish, can be ongoing     |
| **Total** | **~11 weeks** |            |                            |

---

## Risk Mitigation

### High-Risk Items

| Risk                   | Mitigation                                                            |
| ---------------------- | --------------------------------------------------------------------- |
| PricingGrid complexity | Build with well-tested library (e.g., AG Grid) or build incrementally |
| Drag-drop in tree      | Use mature DnD library (dnd-kit)                                      |
| Background jobs        | Test pg-boss integration early                                        |
| Import validation      | Plan complex logic early, mock first                                  |

### Testing Strategy

| Phase   | Test Focus                              |
| ------- | --------------------------------------- |
| Phase 1 | Unit tests for components               |
| Phase 2 | Integration tests for CRUD flows        |
| Phase 3 | E2E tests for pricing calculations      |
| Phase 4 | Visual regression for tree interactions |
| Phase 5 | Load testing for bulk operations        |

---

## MVP Definition

**Minimum Viable Product includes:**

- ✅ Phase 1: Catalog browsing
- ✅ Phase 2: Basic CRUD for all entities
- ✅ Phase 3: Option pricing (not upcharge percentage mode)
- ⏳ Phase 4: Basic category management (no drag-drop)
- ⏳ Phase 5: Basic export only

**Estimated MVP timeline: 6 weeks**

---

## Success Criteria

| Metric             | Target  | Validation             |
| ------------------ | ------- | ---------------------- |
| Page load time     | < 2s    | Lighthouse             |
| Search results     | < 500ms | Performance monitoring |
| Create MSI flow    | < 3 min | User testing           |
| Bulk price change  | < 2 min | User testing           |
| Zero-error deploys | 95%     | CI/CD metrics          |
| Test coverage      | > 80%   | Jest/Vitest            |

---

## Next Steps for Developers

1. **Read these documents in order:**
   - [Overview](./00-overview.md) - Understand the big picture
   - [Information Architecture](./01-information-architecture.md) - Learn navigation
   - [Core Patterns](./02-core-patterns.md) - Study component designs

2. **Set up development environment:**
   - Review existing code in `/apps/web/src/pages/price-guide/`
   - Understand current patterns in use
   - Set up Storybook for component development

3. **Start with Phase 1:**
   - Create component stubs
   - Build EntityCard first (used everywhere)
   - Implement PricingGrid with basic features
   - Iterate on LinkPicker

4. **Weekly reviews:**
   - Demo progress to stakeholders
   - Gather feedback early
   - Adjust priorities as needed

---

## Questions?

Design decisions are documented in:

- [Design Decisions](../planning/price-guide-rebuild/07-design-decisions.md) - Technical rationale
- [API Specifications](../planning/price-guide-rebuild/03-api-specifications.md) - Backend contracts

For UI/UX questions, refer back to the persona (Maya Chen) mindset:

- Does this show the relationships clearly?
- Are we warning users about impact?
- Is this pattern consistent with similar features?
- Will this scale to 500+ items?
