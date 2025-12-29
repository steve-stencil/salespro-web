# Price Guide Rebuild - Implementation Phases

[← Back to Index](./00-index.md)

---

## Overview

**Total Duration**: 12 weeks (3 phases)

| Phase                    | Duration    | Focus                                                   |
| ------------------------ | ----------- | ------------------------------------------------------- |
| Phase 1: Foundation      | Weeks 1-5   | Entities, migrations, core APIs, testing infrastructure |
| Phase 2: Dashboard Core  | Weeks 6-10  | UI pages, wizards, pricing grid, library browser        |
| Phase 3: Bulk Operations | Weeks 11-12 | Mass tools, performance optimization, polish            |

---

## Phase 1: Foundation (Weeks 1-5)

### Week 1: Core Entities

**Backend Entities** (`apps/api/src/entities/price-guide/`):

1. `PriceGuideCategory.entity.ts`
2. `MeasureSheetItem.entity.ts` (with tag fields)
3. `PriceGuideOption.entity.ts`
4. `UpCharge.entity.ts`
5. `AdditionalDetailField.entity.ts`
6. `PriceObjectType.entity.ts`

**Deliverables**:

- [ ] All 6 core entities with MikroORM decorators
- [ ] Validation decorators (class-validator)
- [ ] Relationships properly defined
- [ ] Version field for optimistic locking
- [ ] Tag fields on MeasureSheetItem

### Week 2: Junction Tables & Pricing

**Junction Tables** (`apps/api/src/entities/price-guide/`):

7. `MeasureSheetItemOffice.entity.ts`
8. `MeasureSheetItemOption.entity.ts`
9. `MeasureSheetItemUpCharge.entity.ts`
10. `MeasureSheetItemAdditionalDetailField.entity.ts`
11. `UpChargeAdditionalDetailField.entity.ts`
12. `UpChargeDisabledOption.entity.ts`

**Pricing Entities**:

13. `OptionPrice.entity.ts`
14. `UpChargePrice.entity.ts`

**Deliverables**:

- [ ] All junction tables with unique constraints
- [ ] Pricing entities with composite indexes
- [ ] Soft delete support (isActive flag)

### Week 3: Operational Entities & Database Setup

**Operational Entities**:

15. `UpChargePricePercentageBase.entity.ts`
16. `PriceChangeLog.entity.ts`
17. `PriceChangeJob.entity.ts`

**Database**:

- [ ] MikroORM migrations generated
- [ ] Database triggers for denormalized counters
- [ ] Full-text search indexes
- [ ] Composite indexes for pricing queries
- [ ] Global price types seeding

**Deliverables**:

- [ ] All 17 entities complete
- [ ] Database migrations tested
- [ ] Triggers for linkedMsiCount updates
- [ ] PostgreSQL full-text search configured

### Week 4: Core API Routes

**Measure Sheet Items**:

- `apps/api/src/routes/price-guide/measure-sheet-items.routes.ts`
  - [ ] GET / (paginated, cursor-based)
  - [ ] GET /:id
  - [ ] POST /
  - [ ] PUT /:id
  - [ ] DELETE /:id
  - [ ] POST /:id/options
  - [ ] DELETE /:id/options/:optionId
  - [ ] POST /:id/upcharges
  - [ ] DELETE /:id/upcharges/:upchargeId

**Categories**:

- `apps/api/src/routes/price-guide/categories.routes.ts`
  - [ ] GET / (tree structure)
  - [ ] POST /
  - [ ] PUT /:id
  - [ ] DELETE /:id
  - [ ] PUT /:id/move

**Library Routes**:

- `apps/api/src/routes/price-guide/library/options.routes.ts`
- `apps/api/src/routes/price-guide/library/upcharges.routes.ts`
- `apps/api/src/routes/price-guide/library/additional-details.routes.ts`

**Deliverables**:

- [ ] All CRUD operations working
- [ ] Pagination with cursor support
- [ ] Full-text search working
- [ ] Optimistic locking on updates

### Week 5: Pricing Routes & Testing Infrastructure

**Pricing Routes**:

- `apps/api/src/routes/price-guide/pricing/options.routes.ts`
- `apps/api/src/routes/price-guide/pricing/upcharges.routes.ts`
- `apps/api/src/routes/price-guide/pricing/price-types.routes.ts`
- `apps/api/src/routes/price-guide/pricing/percentage-base.routes.ts`

**Testing Infrastructure**:

- [ ] Test database setup (pg-mem or test instance)
- [ ] Factory functions for all entities
- [ ] Integration test harness
- [ ] CI/CD pipeline configuration

**Deliverables**:

- [ ] Pricing bulk update working
- [ ] Default + override pricing for upcharges
- [ ] Percentage pricing with base configuration
- [ ] 80% test coverage on core functionality

### Phase 1 Acceptance Criteria

- [ ] All 17 entities defined and migrated
- [ ] Database triggers for denormalized counters working
- [ ] Full-text search returning results in <200ms
- [ ] All CRUD operations tested
- [ ] Optimistic locking prevents concurrent edit conflicts
- [ ] Price change audit log capturing all modifications
- [ ] CI pipeline running all tests

---

## Phase 2: Dashboard Core (Weeks 6-10)

### Week 6: Shared Types & Catalog Page

**Shared Package** (`packages/shared/src/`):

- `dtos/price-guide.dto.ts`
  - [ ] MeasureSheetItemSummaryDTO
  - [ ] MeasureSheetItemDetailDTO
  - [ ] PriceGuideOptionSummaryDTO
  - [ ] PriceGuideOptionDetailDTO
  - [ ] UpChargeSummaryDTO
  - [ ] UpChargeDetailDTO
  - [ ] PriceGuideCategoryDTO
  - [ ] LinkedOptionDTO
  - [ ] LinkedUpChargeDTO
  - [ ] PricingGridDTO
  - [ ] LinkResultDTO

- `types/price-guide.types.ts`
- `types/enums.ts`
- `utils/price-guide.utils.ts`

**Catalog Page**:

- `apps/web/src/pages/price-guide/CatalogPage.tsx`
  - [ ] Infinite scroll with React Query
  - [ ] Search bar with debounce
  - [ ] Category filter
  - [ ] Office filter
  - [ ] MSI summary cards
  - [ ] Row expansion for options/upcharges

**Deliverables**:

- [ ] All DTOs typed and exported
- [ ] Catalog page rendering 500+ items smoothly
- [ ] Search returning results in <500ms

### Week 7: Library Browser & Category Management

**Library Browser**:

- `apps/web/src/pages/price-guide/LibraryPage.tsx`
  - [ ] Tab navigation (Options, UpCharges, Additional Details)
  - [ ] Search within each tab
  - [ ] Usage count badges
  - [ ] Pricing status indicators
  - [ ] Edit/delete actions

**Category Management**:

- `apps/web/src/pages/price-guide/CategoryManagementPage.tsx`
  - [ ] Tree view component
  - [ ] Drag-and-drop reordering
  - [ ] Inline rename
  - [ ] Add child category
  - [ ] Move category
  - [ ] Depth warning (>5 levels)

**Deliverables**:

- [ ] Library browser with all three tabs
- [ ] Category tree with drag-and-drop
- [ ] "Where used" modal for shared items

### Week 8: Create Wizard (Steps 1-4)

**Create Wizard**:

- `apps/web/src/pages/price-guide/CreateWizard.tsx`
- `apps/web/src/components/price-guide/wizard/`

**Steps Implemented**:

- [ ] Step 1: Basic Info (name, category, measurement type, tags)
- [ ] Step 2: Link Options (search, select, quick-add)
- [ ] Step 3: Link UpCharges (search, select, disabled options config)
- [ ] Step 4: Additional Details (search, select, quick-add)

**Deliverables**:

- [ ] Wizard navigation working
- [ ] State persistence between steps
- [ ] Quick-add inline forms
- [ ] Autocomplete for category selection

### Week 9: Create Wizard (Steps 5-6) & Pricing Page

**Wizard Steps**:

- [ ] Step 5: Pricing Grid (office × typeCode)
- [ ] Step 6: Review & Create

**Pricing Page**:

- `apps/web/src/pages/price-guide/PricingPage.tsx`
  - [ ] Option pricing grid
  - [ ] UpCharge default pricing grid
  - [ ] UpCharge override mode
  - [ ] Percentage pricing configuration
  - [ ] Copy-from-office functionality

**Components**:

- `apps/web/src/components/price-guide/PricingGrid.tsx`
- `apps/web/src/components/price-guide/PercentageBaseSelector.tsx`

**Deliverables**:

- [ ] Complete MSI creation through wizard
- [ ] Pricing grid with bulk editing
- [ ] Percentage pricing UI working

### Week 10: Migration Wizard

**Migration Routes**:

- `apps/api/src/routes/price-guide/migration/wizard.routes.ts`
- `apps/api/src/routes/price-guide/migration/preview.routes.ts`

**Migration Pages**:

- `apps/web/src/pages/price-guide/MigrationWizardPage.tsx`
  - [ ] Step 1: Initialize Price Types
  - [ ] Step 2: Categories
  - [ ] Step 3: Shared Libraries
  - [ ] Step 4: Measure Sheet Items
  - [ ] Step 5: Pricing
  - [ ] Step 6: Relationships
  - [ ] Step 7: Validation

**Deliverables**:

- [ ] Full migration wizard working
- [ ] Progress tracking per step
- [ ] Preview before each step
- [ ] Validation report with issue details
- [ ] Idempotent migration (can re-run)

### Phase 2 Acceptance Criteria

- [ ] Catalog loads in <2 seconds with 500+ items
- [ ] Full MSI creation via wizard
- [ ] Library browser with usage counts
- [ ] Category management with drag-and-drop
- [ ] Pricing grid with bulk editing
- [ ] Migration wizard completing all 7 steps
- [ ] E2E tests for critical paths

---

## Phase 3: Bulk Operations & Polish (Weeks 11-12)

### Week 11: Mass Tools & Background Jobs

**Background Worker**:

- `apps/api/src/workers/price-change.worker.ts`
  - [ ] pg-boss worker setup
  - [ ] Mass price change processing
  - [ ] Progress tracking
  - [ ] Error handling and retry

**Tools Routes**:

- `apps/api/src/routes/price-guide/tools/mass-price.routes.ts`
  - [ ] POST / (create job)
  - [ ] GET /:jobId (status)
  - [ ] GET / (list jobs)

- `apps/api/src/routes/price-guide/tools/validation.routes.ts`
  - [ ] POST /run

**Tools Page**:

- `apps/web/src/pages/price-guide/ToolsPage.tsx`
  - [ ] Mass Price Change wizard
  - [ ] Custom Price Types management
  - [ ] Data Validation runner

**Components**:

- `apps/web/src/components/price-guide/JobProgressModal.tsx`

**Deliverables**:

- [ ] Mass price change working with progress
- [ ] Background job with retry on failure
- [ ] Data validation on-demand
- [ ] Custom price type CRUD

### Week 12: Polish & Performance

**Performance Optimization**:

- [ ] Query optimization for large catalogs
- [ ] Index tuning based on query analysis
- [ ] Response time monitoring
- [ ] Memory usage optimization

**Conflict Resolution**:

- `apps/web/src/components/price-guide/ConflictResolutionModal.tsx`
  - [ ] Show who modified
  - [ ] Show what changed
  - [ ] Options: discard, reload, force save

**Polish**:

- [ ] Loading states throughout
- [ ] Error boundary handling
- [ ] Empty states
- [ ] Success/error toasts
- [ ] Keyboard navigation

**Documentation**:

- [ ] API documentation (OpenAPI)
- [ ] Admin user guide
- [ ] Developer onboarding guide

**Deliverables**:

- [ ] Performance targets met
- [ ] Concurrent edit handling smooth
- [ ] Comprehensive error handling
- [ ] Documentation complete

### Phase 3 Acceptance Criteria

- [ ] Mass price change processes 1000 items in <60 seconds
- [ ] Conflict resolution UI working
- [ ] All performance targets met
- [ ] 80% test coverage maintained
- [ ] No critical bugs

---

## Files to Create

### Backend Entities (`apps/api/src/entities/price-guide/`)

**Core Entities**:

1. `PriceGuideCategory.entity.ts`
2. `MeasureSheetItem.entity.ts`
3. `PriceGuideOption.entity.ts`
4. `UpCharge.entity.ts`
5. `AdditionalDetailField.entity.ts`
6. `PriceObjectType.entity.ts`
7. `OptionPrice.entity.ts`
8. `UpChargePrice.entity.ts`

**Junction Tables**: 9. `MeasureSheetItemOffice.entity.ts` 10. `MeasureSheetItemOption.entity.ts` 11. `MeasureSheetItemUpCharge.entity.ts` 12. `MeasureSheetItemAdditionalDetailField.entity.ts` 13. `UpChargeAdditionalDetailField.entity.ts` 14. `UpChargeDisabledOption.entity.ts`

**Operational**: 15. `UpChargePricePercentageBase.entity.ts` 16. `PriceChangeLog.entity.ts` 17. `PriceChangeJob.entity.ts`

### Backend Routes (`apps/api/src/routes/price-guide/`)

- `measure-sheet-items.routes.ts`
- `categories.routes.ts`
- `library/options.routes.ts`
- `library/upcharges.routes.ts`
- `library/additional-details.routes.ts`
- `pricing/options.routes.ts`
- `pricing/upcharges.routes.ts`
- `pricing/price-types.routes.ts`
- `pricing/percentage-base.routes.ts`
- `tools/mass-price.routes.ts`
- `tools/validation.routes.ts`
- `migration/wizard.routes.ts`
- `migration/preview.routes.ts`

### Backend Workers (`apps/api/src/workers/`)

- `price-change.worker.ts`

### Frontend Pages (`apps/web/src/pages/price-guide/`)

- `CatalogPage.tsx`
- `LibraryPage.tsx`
- `PricingPage.tsx`
- `CategoryManagementPage.tsx`
- `ToolsPage.tsx`
- `CreateWizard.tsx`
- `MigrationWizardPage.tsx`

### Frontend Components (`apps/web/src/components/price-guide/`)

- `ConflictResolutionModal.tsx`
- `OfficeWarningBanner.tsx`
- `UsageCountBadge.tsx`
- `PricingGrid.tsx`
- `PercentageBaseSelector.tsx`
- `JobProgressModal.tsx`
- `wizard/BasicInfoStep.tsx`
- `wizard/LinkOptionsStep.tsx`
- `wizard/LinkUpChargesStep.tsx`
- `wizard/AdditionalDetailsStep.tsx`
- `wizard/PricingStep.tsx`
- `wizard/ReviewStep.tsx`

### Shared Package (`packages/shared/src/`)

- `dtos/price-guide.dto.ts`
- `types/price-guide.types.ts`
- `types/enums.ts`
- `utils/price-guide.utils.ts`

### Test Factories (`apps/api/src/__tests__/factories/`)

- `option.factory.ts`
- `upcharge.factory.ts`
- `msi.factory.ts`
- `category.factory.ts`
- `pricing.factory.ts`

---

## Related Documentation

- [Data Model](./01-data-model.md) - Entity specifications
- [API Specifications](./03-api-specifications.md) - Route details
- [UI Specifications](./04-ui-specifications.md) - Page designs
- [Testing Strategy](./05-testing-strategy.md) - Test coverage requirements
