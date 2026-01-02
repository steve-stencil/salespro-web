# Price Guide Rebuild - Master Plan

**Last Updated**: December 26, 2025  
**Status**: Expert Review Complete - Ready for Implementation  
**Estimated Duration**: 12 weeks (3 phases)

---

## Executive Summary

This plan addresses the core problems with the legacy price guide system:

- **Pricing management is tedious**: Modals for every office/typeCode combination
- **Large catalogs don't scale**: No pagination, slow fetching, client-side filtering
- **Data entry is painful**: No guided workflows, lots of manual steps
- **Categories are error-prone**: String-based with typos and duplicates
- **Duplication pain**: Same options/upcharges recreated multiple times

### Solution Approach

1. Normalize the data model (PostgreSQL + MikroORM)
2. **Many-to-many shared libraries** for Options, UpCharges, AdditionalDetailFields
3. Build a dedicated pricing management page with audit trails
4. Add wizard-based item creation with linking to shared items
5. Implement cursor-based pagination with infinite scroll
6. Comprehensive testing strategy (unit, integration, E2E, migration)

---

## Phase Timeline

| Phase                    | Duration    | Focus                                                   |
| ------------------------ | ----------- | ------------------------------------------------------- |
| Phase 1: Foundation      | Weeks 1-5   | Entities, migrations, core APIs, testing infrastructure |
| Phase 2: Dashboard Core  | Weeks 6-10  | UI pages, wizards, pricing grid, library browser        |
| Phase 3: Bulk Operations | Weeks 11-12 | Mass tools, performance optimization, polish            |

---

## Documentation Structure

This plan is organized into focused documents for easier maintenance:

| Document                                                     | Purpose                                            |
| ------------------------------------------------------------ | -------------------------------------------------- |
| [01-data-model.md](./01-data-model.md)                       | Complete entity specifications, ERD, relationships |
| [02-migration-strategy.md](./02-migration-strategy.md)       | 7-step Parse to PostgreSQL migration               |
| [03-api-specifications.md](./03-api-specifications.md)       | REST routes, DTOs, validation rules                |
| [04-ui-specifications.md](./04-ui-specifications.md)         | Pages, components, user flows                      |
| [05-testing-strategy.md](./05-testing-strategy.md)           | Test layers, coverage requirements, CI/CD          |
| [06-implementation-phases.md](./06-implementation-phases.md) | Detailed phase breakdown with deliverables         |
| [07-design-decisions.md](./07-design-decisions.md)           | Architectural choices and rationale                |
| [08-out-of-scope.md](./08-out-of-scope.md)                   | Features explicitly excluded from this rebuild     |

---

## Problems Being Solved

### 1. Pricing Management Complexity

**Current state**: Admin opens modal for each option/upcharge, selects office, manually enters typeCode breakdowns, repeats for each office.

**New state**: Dedicated pricing page with:

- Bulk office selection
- Spreadsheet-style typeCode grid
- Copy-from-office presets
- Visual percentage pricing configuration
- Preview of calculated totals
- Support for default and option-specific override pricing

### 2. Large Catalog Scalability

**Current state**: Loading 500+ MSIs with all options/upcharges causes:

- 30+ second load times
- Browser memory issues
- Client-side filtering lag
- No pagination

**New state**: Hybrid-load architecture:

- Load MSI metadata only (category, name, office count)
- Lazy-fetch linked options/upcharges on expand
- Server-side filtering and cursor-based pagination
- Infinite scroll for large result sets

### 3. Duplication & Reusability

**Current state**: Same options/upcharges recreated across MSIs:

- "Low-E Glass" upcharge created 25 times (one per MSI)
- Price changes require updating all 25 copies
- Inconsistency and maintenance burden

**New state**: Shared library model:

- Create "Low-E Glass" once in shared library
- Link to multiple MSIs via junction tables
- Update pricing once, applies everywhere (or set overrides per option)
- Warning when editing affects multiple MSIs

### 4. Tedious Data Entry

**Current state**: Creating a new window product requires:

1. Create MSI
2. Add options one-by-one (even if they exist elsewhere)
3. Add upcharges one-by-one (even if they exist elsewhere)
4. Open pricing modal for each option
5. Repeat for each office

**New state**: Wizard workflow with linking:

1. **Step 1**: Basic info (name, category, measurement type)
2. **Step 2**: Link existing options OR create new (quick-add table)
3. **Step 3**: Link existing upcharges OR create new (with disabled options config)
4. **Step 4**: Set pricing (bulk office + typeCode grid)
5. Preview and save

### 5. Category Management

**Current state**: Free-text category fields lead to:

- "Windows" vs "WINDOWS" vs "Window"
- "Doors" vs "Exterior Doors"
- No way to rename category globally
- No drag-and-drop ordering

**New state**: Normalized category hierarchy:

- Autocomplete from existing categories
- Tree-view management page
- Global rename
- Drag-and-drop reordering
- Bulk category moves

---

## Success Metrics

### Performance

- Catalog page loads in <2 seconds (vs 30+ seconds legacy)
- Pricing page supports 100 options × 10 offices × 5 typeCodes without lag
- Search returns results in <500ms
- Junction table queries optimized (no N+1)

### Usability

- Time to create new MSI with 5 linked options: <3 minutes (vs 15+ minutes)
- Time to update shared upcharge affecting 25 MSIs: <1 minute (vs 25+ minutes)
- Category typos reduced by 90% (autocomplete)
- Duplicate options reduced by 80% (shared library reuse)

### Data Quality

- Zero orphaned options/upcharges (referential integrity)
- Zero pricing calculation errors (maintain parity with legacy V2)
- 100% of shared items tracked for "where used"

---

## Key Technical Decisions

1. **Shared Libraries**: Options, UpCharges, and AdditionalDetailFields are always shareable
2. **Pricing Model**: OptionPrice is simple; UpChargePrice supports default + option-specific overrides
3. **Concurrency Control**: Optimistic locking with version numbers
4. **Performance**: Denormalized counters, composite indexes, PostgreSQL full-text search
5. **Background Jobs**: pg-boss (PostgreSQL-based, no Redis required)
6. **Pagination**: Cursor-based with infinite scroll (50 items/page)
7. **Testing**: 4 layers (unit, integration, E2E, migration) with 80% coverage requirement

See [07-design-decisions.md](./07-design-decisions.md) for detailed rationale.

---

## Data Model Overview

**17 Total Entities**:

- 8 core entities (categories, items, shared libraries, pricing)
- 6 junction tables (many-to-many relationships)
- 3 operational entities (audit log, background jobs, percentage base)

See [01-data-model.md](./01-data-model.md) for complete specifications.

---

## Migration Strategy Overview

**7-Step Migration Wizard** (in-app dashboard tool):

1. **Initialize Price Types**: Seed global types (Materials, Labor, Tax, Other)
2. **Extract Categories**: Build category tree from Parse MSI fields
3. **Migrate Shared Libraries**: Options, UpCharges, AdditionalDetailFields
4. **Migrate Measure Sheet Items**: Core MSI data with tag fields
5. **Migrate Pricing**: V1 → OTHER type, V2 → correct type codes
6. **Build Relationships**: Junction tables from pointer arrays
7. **Validate & Review**: Run data integrity checks, report issues

See [02-migration-strategy.md](./02-migration-strategy.md) for detailed implementation.

---

## Files to Create

### Backend (17 entities + routes + workers)

See [06-implementation-phases.md](./06-implementation-phases.md) for complete file listing.

### Frontend (6 pages + components)

- Catalog page with infinite scroll
- Library browser for shared items
- Pricing grid (spreadsheet-style)
- Category management tree
- Create wizard (6 steps)
- Migration wizard (7 steps)

### Shared Types

- DTOs for all entities
- Request/response types
- Enums and utilities

---

## Out of Scope

The following features are **explicitly excluded** from this rebuild:

1. **Import/Export Operations** - Will be handled differently in the new system
2. **Placeholder System** - Separate planning effort (PDF contract generation)
3. **Mobile Sync Strategy** - Separate project (iOS app migration)
4. **Real-time Collaborative Editing** - Not required; optimistic locking is sufficient
5. **Advanced Reporting/Analytics** - Basic audit trail only; analytics deferred

See [08-out-of-scope.md](./08-out-of-scope.md) for detailed rationale.

---

## Next Steps

1. Review all documentation for accuracy
2. Validate cross-references work correctly
3. Begin Phase 1 implementation (entities, migrations, core APIs)
4. Set up testing infrastructure with coverage enforcement
5. Create development seed data for testing

