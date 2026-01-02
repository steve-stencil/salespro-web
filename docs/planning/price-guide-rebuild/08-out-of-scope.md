# Price Guide Rebuild - Out of Scope

[← Back to Index](./00-index.md)

---

## Overview

This document explicitly defines what is **NOT** included in the Price Guide Rebuild project. These exclusions are intentional and based on scope discussions during expert review.

---

## 1. Import/Export Operations

### What's Excluded

- CSV/Excel import of price guide data
- CSV/Excel export of price guide data
- Bulk data upload from spreadsheets
- Template download for data import

### Why Excluded

- Will be handled differently in the new system
- Requires separate design for data validation and error handling
- Import logic has edge cases that need dedicated planning
- Export formats may change with new data model

### Current State

The legacy system has import/export via:

- `SSPriceGuideItem` JSON export
- Excel template upload
- Mass copy operations

### Future Consideration

A separate planning effort will address:

- Modern import wizard with validation preview
- Progress tracking for large imports
- Error reporting and rollback
- Export with custom field selection

---

## 2. Placeholder System

### What's Excluded

- Placeholder creation and management
- Placeholder variables (e.g., `{{option.price}}`)
- Placeholder mapping to fields
- PDF contract generation with placeholders
- CRM export field configuration

### Why Excluded

- Complex subsystem requiring dedicated planning
- Interacts with contracts, proposals, CRM exports
- Identifier/namespace design needs careful thought
- Used primarily by PDF generation system

### Context from Legacy

The legacy system uses:

- `identifier` field on UpCharges for placeholder namespacing
- AdditionalDetailObjects with placeholder support
- Custom fields that map to PDF templates

### Future Consideration

Placeholder system will be planned separately with focus on:

- Template variable syntax
- Field mapping configuration
- PDF template integration
- CRM export field definitions

---

## 3. Mobile Sync Strategy

### What's Excluded

- iOS app data synchronization logic
- Offline-first sync mechanism
- Incremental sync for many-to-many relationships
- Conflict resolution for mobile edits
- Mobile-specific data schemas

### Why Excluded

- Separate project with different stakeholders
- Requires understanding of iOS app architecture
- Sync complexity with junction tables needs dedicated design
- Mobile team needs to be involved

### Context

The iOS app (`leap-one`) currently:

- Uses Parse SDK for sync
- Has offline-first architecture
- Caches price guide data locally
- Syncs estimates back to server

### Future Consideration

Mobile sync migration will address:

- Junction table sync strategy
- Incremental updates for shared items
- Offline conflict resolution
- Delta sync for large catalogs

---

## 4. Real-time Collaborative Editing

### What's Excluded

- WebSocket updates when others edit
- Live cursors showing who's editing
- Real-time conflict prevention
- Presence indicators

### Why Excluded

- Optimistic locking is sufficient for current use case
- Real-time requires WebSocket infrastructure
- Admin editing is not high-frequency collaborative
- Complexity not justified by use case

### Current Approach

**Optimistic locking** handles concurrent edits:

- Version numbers on entities
- Conflict detected on save attempt
- User can reload or force save
- Shows who modified and when

### Future Consideration

If needed, could add:

- WebSocket notifications for changes
- "Someone is editing" warnings
- Auto-refresh on external changes

---

## 5. Advanced Reporting/Analytics

### What's Excluded

- Price change trend charts
- Usage analytics dashboard
- Most-used options/upcharges reports
- Category utilization metrics
- Historical price comparison

### Why Excluded

- Basic audit trail provides raw data (PriceChangeLog)
- Analytics requires dedicated UI and query optimization
- Not core to price guide management
- Can be added incrementally

### What IS Included

- `PriceChangeLog` table capturing all price changes
- Basic "where used" counts on shared items
- Data validation reports

### Future Consideration

Analytics phase could add:

- Price trend visualization
- Popular items dashboard
- Category utilization charts
- Cost analysis reports

---

## 6. Legacy V1 Complete Feature Parity

### What's Excluded

Some legacy V1 features may not be migrated 1:1:

- Complex formula editor UI (basic support only)
- Legacy image upload workflow
- Custom sort algorithms
- Legacy report formats

### Why Excluded

- New system uses modern equivalents
- Some features were rarely used
- Cleaner implementation in new architecture

### Migration Approach

- Core data migrates fully
- UI may differ from legacy
- Functionality preserved, UX improved

---

## Scope Boundaries Summary

### In Scope ✅

| Feature                             | Status   |
| ----------------------------------- | -------- |
| 17 PostgreSQL entities              | Included |
| Many-to-many shared libraries       | Included |
| Pricing grid (bulk editing)         | Included |
| Create wizard (6 steps)             | Included |
| Migration wizard (7 steps)          | Included |
| Category management                 | Included |
| Full-text search                    | Included |
| Mass price change (background jobs) | Included |
| Custom price types                  | Included |
| Data validation                     | Included |
| Price change audit log              | Included |
| Optimistic locking                  | Included |
| Tag fields on MSI                   | Included |

### Out of Scope ❌

| Feature                 | Future Planning  |
| ----------------------- | ---------------- |
| Import/Export           | Separate project |
| Placeholder system      | Separate project |
| Mobile sync             | Separate project |
| Real-time collaboration | If needed        |
| Advanced analytics      | Future phase     |

---

## Questions for Future Planning

### Import/Export

1. What validation rules apply to imported data?
2. Should import create or update existing items?
3. What export formats are required?
4. How to handle errors in bulk imports?

### Placeholder System

1. What template variables are currently used?
2. How do placeholders map to new entities?
3. What PDF generation system will consume placeholders?
4. How to handle missing placeholder values?

### Mobile Sync

1. What is the current Parse sync mechanism?
2. How does the iOS app handle offline?
3. What conflicts can occur with mobile edits?
4. How much data is cached locally?

---

## Related Documentation

- [00-index.md](./00-index.md) - Main plan overview
- [07-design-decisions.md](./07-design-decisions.md) - Why these boundaries were set
- [02-migration-strategy.md](./02-migration-strategy.md) - What IS migrated

