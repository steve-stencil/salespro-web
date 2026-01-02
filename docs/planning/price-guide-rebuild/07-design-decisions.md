# Price Guide Rebuild - Design Decisions

[← Back to Index](./00-index.md)

---

## Overview

This document records all architectural decisions made during the expert review process. Each decision includes context, options considered, and rationale.

---

## Decision 1: Concurrency Control Strategy

### Context

With shared libraries, multiple admins could edit the same `PriceGuideOption` simultaneously. Without concurrency control, race conditions could corrupt data.

### Options Considered

1. **Pessimistic Locking**: Lock record while editing
2. **Last-Write-Wins**: Simpler but risky
3. **Optimistic Locking**: Version numbers with conflict detection

### Decision

**Optimistic Locking** with version numbers on all main entities.

### Implementation

```typescript
// All core entities include:
@Property({ version: true })
version: number = 1;

@Property({ onUpdate: () => new Date() })
updatedAt: Date = new Date();

@ManyToOne(() => User, { nullable: true })
lastModifiedBy?: User;
```

**Applied to**:

- PriceGuideCategory
- MeasureSheetItem
- PriceGuideOption
- UpCharge
- AdditionalDetailField
- OptionPrice
- UpChargePrice

**Not applied to** (low conflict risk):

- Junction tables

### Rationale

- MikroORM has built-in version support with automatic increment
- Conflicts show user who modified and when
- Works well with web UIs (no long locks)
- Version numbers are immune to clock skew issues

---

## Decision 2: "Where Used" Performance

### Context

The Library page will show usage counts ("Used in X MSIs"). With 200+ options, querying each count individually creates N+1 problems.

### Options Considered

1. **N queries per item**: Simple but slow (~2+ seconds)
2. **JOIN with GROUP BY**: Single query but still slow on large datasets
3. **Denormalized counters with triggers**: Fast, slightly more complex

### Decision

**Denormalized counters** updated via PostgreSQL triggers.

### Implementation

```typescript
// On shared entities
@Property({ default: 0 })
linkedMsiCount: number = 0;
```

```sql
CREATE FUNCTION update_option_linked_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE price_guide_options
    SET linked_msi_count = linked_msi_count - 1
    WHERE id = OLD.option_id;
  ELSIF (TG_OP = 'INSERT') THEN
    UPDATE price_guide_options
    SET linked_msi_count = linked_msi_count + 1
    WHERE id = NEW.option_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### Rationale

- Library page loads in <100ms instead of 2+ seconds
- Counters always accurate
- Standard practice for high-traffic systems (Reddit, Twitter, GitHub)
- PostgreSQL triggers are mature and well-tested

---

## Decision 3: Soft Delete Cascade Strategy

### Context

When an admin soft-deletes a shared item that's linked to multiple MSIs, what should happen to those links?

### Options Considered

1. **Block deletion if in use**: Safe but inflexible
2. **Cascade soft-delete to junction rows**: Could break restore
3. **Leave junction rows active**: Non-destructive, queries filter

### Decision

**Leave junction rows intact** with 90-day retention period.

### Implementation

- Admin soft-deletes shared item → `isActive=false`
- Junction rows remain active
- Queries filter: `WHERE entity.isActive = true`
- Item becomes "hidden" but relationships preserved
- Restore flips `isActive=true` → reappears everywhere
- Background job physically deletes after 90 days

### Rationale

- Non-destructive (no data loss)
- Easy rollback (flip one flag)
- Admin can "archive" items without breaking existing MSIs

---

## Decision 4: Price Change Audit Trail

### Context

The original plan deferred audit trail to "future phases." However, for pricing systems, this is critical for dispute resolution.

### Options Considered

1. **Defer to future phase**: Simpler initial release
2. **Full audit trail (all fields)**: Complex, more storage
3. **Price-only audit trail**: Minimal but useful

### Decision

**Price-only audit trail** in Phase 1.

### Implementation

```typescript
@Entity()
export class PriceChangeLog {
  @ManyToOne(() => OptionPrice, { nullable: true })
  optionPrice?: OptionPrice;

  @ManyToOne(() => UpChargePrice, { nullable: true })
  upChargePrice?: UpChargePrice;

  @Property({ type: 'decimal' })
  oldAmount!: Decimal;

  @Property({ type: 'decimal' })
  newAmount!: Decimal;

  @ManyToOne(() => User)
  changedBy!: User;

  @Property()
  changedAt: Date = new Date();
}
```

Auto-captured via MikroORM `@AfterUpdate` hooks. No "reason" field to keep it simple.

### Rationale

- Critical for pricing disputes ("What was this price on quote date?")
- Simple append-only table
- Minimal overhead
- Compliance/audit requirements often require this

---

## Decision 5: Composite Indexes

### Context

High-frequency queries need optimized indexes for sub-100ms response times.

### Decision

Add composite indexes for common query patterns.

### Implementation

```typescript
// OptionPrice
@Index({ properties: ['option', 'office', 'priceType'] })
@Index({ properties: ['office', 'priceType'] })

// UpChargePrice
@Index({ properties: ['upCharge', 'option', 'office', 'priceType'] })
@Index({ properties: ['upCharge', 'office', 'priceType'] })

// Junction tables
@Index({ properties: ['measureSheetItem', 'sortOrder'] })
@Index({ properties: ['option'] }) // Reverse lookup
```

### Rationale

- Mobile app makes 60+ price lookups per estimate line
- Without composite index: ~500ms
- With composite index: ~50ms

---

## Decision 6: Percentage Pricing Structure

### Context

The original plan had percentage base as a JSON array field, which is not queryable.

### Options Considered

1. **JSON array with validation**: Simple but not queryable
2. **Normalized junction table**: Queryable, enforces referential integrity

### Decision

**Normalized junction table** (`UpChargePricePercentageBase`).

### Implementation

```typescript
@Entity()
export class UpChargePricePercentageBase {
  @ManyToOne(() => UpChargePrice)
  upChargePrice!: UpChargePrice;

  @ManyToOne(() => PriceObjectType)
  priceType!: PriceObjectType; // FK enforces valid type
}
```

### Rationale

- Can query: "Show all upcharges using Materials in percentage base"
- Database enforces valid priceType IDs
- Easier to extend (add multiplier per type later)
- Standard relational design

---

## Decision 7: Migration Strategy

### Context

Original plan assumed string matching for deduplication. Actually, legacy uses Parse pointers (already shared).

### Decision

**Pointer-based migration** with upsert pattern.

### Implementation

- `items[]` and `accessories[]` are Parse pointers
- Same SSPriceGuideItem can be referenced by multiple MSIs
- Migration uses `sourceId` for upsert pattern
- Skip orphaned pointers gracefully

### Rationale

- Much simpler than fuzzy string matching
- Idempotent (can re-run safely)
- Preserves existing sharing relationships

---

## Decision 8: Category Depth Limit

### Context

No validation on category depth could lead to deeply nested hierarchies that break UI.

### Options Considered

1. **Hard limit (3 levels)**: Matches examples, enforced in database
2. **No limit**: Trust admins
3. **No limit with UI warning**: Flexible with guidance

### Decision

**No hard limit** with UI warning at 5+ levels.

### Implementation

- No database constraint
- UI shows warning: "Categories deeper than 5 levels may be difficult to navigate"

### Rationale

- Flexibility over strictness
- Admin can still create deep hierarchies if needed
- Warning provides guidance without blocking

---

## Decision 9: Search Implementation

### Context

Need sub-500ms search across 500+ MSIs searching multiple fields.

### Options Considered

1. **LIKE queries**: Simple but slow
2. **PostgreSQL full-text search**: Fast, built-in, handles stemming
3. **Elasticsearch**: Powerful but additional infrastructure

### Decision

**PostgreSQL full-text search** with tsvector indexes.

### Implementation

```sql
ALTER TABLE measure_sheet_items
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('english', name || ' ' || COALESCE(note, ''))
) STORED;

CREATE INDEX idx_msi_search ON measure_sheet_items USING GIN(search_vector);
```

**Searchable fields**:

- MSI: name, note, category name
- Option: name, brand, itemCode

### Rationale

- Sub-100ms search on 1000+ records
- Handles stemming ("windows" matches "window")
- No additional infrastructure
- Relevance ranking built-in

---

## Decision 10: Office Assignment Validation

### Context

What if an option is linked to an MSI but doesn't have pricing for all MSI's offices?

### Options Considered

1. **Block linking**: Safe but inflexible
2. **Warn but allow**: Flexible, admin can fix later

### Decision

**Warn but allow** with $0 default for missing pricing.

### Implementation

- Admin links option to MSI that has offices A, B, C
- Option only has pricing for offices A, B
- Show warning: "⚠️ Pricing not set for Office C. Sales reps will see $0."
- Allow the link anyway
- Pricing calculation returns $0 for missing offices

### Rationale

- Flexibility over strictness
- Admin can set pricing later
- Sales reps see $0 (not broken)

---

## Decision 11: Background Jobs

### Context

Mass price changes can involve 3000+ database updates. Need background processing.

### Options Considered

1. **BullMQ + Redis**: Industry standard, powerful
2. **pg-boss**: PostgreSQL-based, no Redis needed
3. **Simple polling**: Basic but works

### Decision

**pg-boss** (PostgreSQL queue).

### Implementation

```typescript
import PgBoss from 'pg-boss';

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL,
  schema: 'pgboss',
});

await boss.start();
await boss.send('price-change', { jobId: job.id });
```

### Rationale

- No new infrastructure (uses existing PostgreSQL)
- Good enough for mass price change operations
- Can upgrade to Redis later if real-time features added
- Zero additional AWS costs

---

## Decision 12: Frontend Pagination

### Context

Loading 500+ MSIs at once is slow. Need efficient data fetching.

### Options Considered

1. **Offset-based pagination**: Simple but slow for large offsets
2. **Cursor-based + infinite scroll**: Fast, good UX

### Decision

**Cursor-based pagination** with infinite scroll, 50 items per page.

### Implementation

```typescript
interface CatalogPage {
  items: MeasureSheetItemSummaryDTO[];
  nextCursor?: string;
  hasMore: boolean;
}

// Cursor: Base64({ id, sortOrder })
```

### Rationale

- Initial load: 50 items (~100KB) instead of 500 items (~2MB)
- Smooth infinite scroll
- Cached pages (scroll back = instant)
- No page drift issues

---

## Decision 13: TypeScript DTOs

### Context

Backend entities should not be directly exposed to frontend.

### Decision

**Explicit DTOs** in shared package.

### Implementation

```typescript
// Backend decides what to expose
export type MeasureSheetItemSummaryDTO = {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
    fullPath: string;
  };
  optionCount: number;
  upchargeCount: number;
};
```

### Rationale

- Frontend-backend contract is explicit
- Can evolve independently (versioning)
- Type-safe across full stack
- No circular reference issues
- Optimized payloads

---

## Decision 14: Feature Flags

### Context

Originally considered for gradual rollout.

### Decision

**Not needed** (greenfield app, not deployed yet).

### Rationale

- App is in development, not production
- Proper testing is sufficient
- Feature flags would add unnecessary complexity

---

## Decision 15: Data Validation

### Context

Need to verify data integrity after migration and during operations.

### Decision

**Validation in migration Step 7** with on-demand access.

### Implementation

- Run after migration completion
- Available on-demand from admin dashboard
- Reports issues (doesn't auto-fix)
- Admin reviews and fixes manually

**Validation checks**:

- Orphaned junction rows
- Options without pricing
- MSIs without offices
- MSIs without options
- Circular category references
- Percentage pricing without base

### Rationale

- Catches data issues early
- Admin has visibility into data quality
- No auto-fix prevents unintended changes

---

## Decision 16: Testing Strategy

### Context

Need comprehensive testing for a complex system.

### Decision

**All 4 testing layers** with strict quality gates.

### Implementation

- Unit tests: 80%+ coverage
- Integration tests: All critical API endpoints
- E2E tests: Playwright for user flows
- Migration tests: 100% of migration logic

**Factory functions** for test data.

**80% coverage requirement** blocks PRs if below.

### Rationale

- Complex system requires comprehensive testing
- Factory functions are more flexible than fixtures
- Coverage enforcement prevents regressions
- Playwright is modern and reliable

---

## Summary Table

| #   | Decision               | Choice                                |
| --- | ---------------------- | ------------------------------------- |
| 1   | Concurrency Control    | Optimistic locking (version numbers)  |
| 2   | Where Used Performance | Denormalized counters + triggers      |
| 3   | Soft Delete Cascade    | Leave junction rows, 90-day retention |
| 4   | Audit Trail            | Price-only, auto-logged, Phase 1      |
| 5   | Indexes                | Composite indexes for common queries  |
| 6   | Percentage Pricing     | Normalized junction table             |
| 7   | Migration Strategy     | Pointer-based, upsert pattern         |
| 8   | Category Depth         | No limit, UI warning at 5+            |
| 9   | Search                 | PostgreSQL full-text search           |
| 10  | Office Validation      | Warn but allow, $0 default            |
| 11  | Background Jobs        | pg-boss (PostgreSQL queue)            |
| 12  | Pagination             | Cursor-based, 50 items/page           |
| 13  | DTOs                   | Explicit in shared package            |
| 14  | Feature Flags          | Not needed (greenfield)               |
| 15  | Data Validation        | Migration Step 7 + on-demand          |
| 16  | Testing                | 4 layers, 80% coverage, Playwright    |

---

## Related Documentation

- [Data Model](./01-data-model.md) - Entity specifications reflecting these decisions
- [Migration Strategy](./02-migration-strategy.md) - Migration implementation
- [Testing Strategy](./05-testing-strategy.md) - Testing implementation

