# Price Guide UI Design - Overview

> **Designed by:** Maya Chen (Senior UI/UX Engineer, Design Systems)  
> **Date:** December 2024  
> **Status:** Design Specification for Implementation

---

## Executive Summary

This document outlines a redesigned UI for the Price Guide management system. The goal is to create an interface that accurately represents the underlying data relationships while remaining accessible to home improvement industry professionals who may not have deep technical expertise.

### Design Philosophy

1. **Relationships First** - The data model is fundamentally relational. The UI should surface these relationships prominently, not hide them behind separate pages.

2. **Progressive Disclosure** - Complex configurations (percentage pricing, option overrides) should be revealed contextually, not presented upfront.

3. **Visual Mental Models** - Use spatial layouts that match how users think about their catalog: hierarchical categories, items with variants, add-ons with compatibility rules.

4. **Operational Efficiency** - Bulk operations, keyboard shortcuts, and smart defaults for repetitive tasks.

---

## Data Model Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PRICE GUIDE ECOSYSTEM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │   CATEGORIES     │  Self-referential hierarchy                       │
│  │   (Tree)         │  Windows > Double Hung > Premium                  │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           │ contains                                                    │
│           ▼                                                             │
│  ┌──────────────────┐       links to        ┌──────────────────┐       │
│  │ MEASURE SHEET    │◄─────────────────────►│     OPTIONS      │       │
│  │     ITEMS        │       (M:N)           │  (Shared Library)│       │
│  │  (Line Items)    │                       └──────────────────┘       │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           │ links to (M:N)                                              │
│           ├──────────────────────────────────────────┐                  │
│           │                                          ▼                  │
│           │                                 ┌──────────────────┐       │
│           │                                 │ ADDITIONAL DETAIL│       │
│           │                                 │     FIELDS       │       │
│           │                                 │  (Shared Library)│       │
│           │                                 └────────▲─────────┘       │
│           │                                          │                  │
│           │ links to                        links to │ (M:N)            │
│           ▼                                          │                  │
│  ┌──────────────────┐                                │                  │
│  │    UPCHARGES     │────────────────────────────────┘                  │
│  │ (Shared Library) │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           │ can disable                                                 │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │ OPTIONS          │  When UpCharge X is linked to MSI,               │
│  │ (Conditionally)  │  it may be disabled for Option Y                 │
│  └──────────────────┘                                                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                           PRICING LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  NOTE: All MSIs require at least one option. Pricing flows through     │
│        OptionPrice entities. See ADR-003 for rationale.                │
│                                                                         │
│  OPTION PRICES:  Option × Office × PriceType → Amount                  │
│                  (e.g., "Pella Premium" @ "Denver Office" @ "Labor")   │
│                                                                         │
│  UPCHARGE PRICES: UpCharge × Office × PriceType → Amount               │
│                   + Optional: × Option → Override Amount               │
│                   + Optional: isPercentage → % of selected PriceTypes  │
│                                                                         │
│  PRICE TYPES: Materials | Labor | Tax | Other | (Custom)               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Challenges

### 1. Multi-Dimensional Pricing

**Problem:** Prices exist at the intersection of Item × Office × PriceType. Users need to manage potentially thousands of price cells.

**Solution:** Spreadsheet-style grid with smart filters, copy-down operations, and visual indicators for missing/incomplete pricing.

### 2. Shared Library vs. Linked Items

**Problem:** Options exist independently but appear in context of MSIs. Users may not understand that editing an Option affects all MSIs that use it.

**Solution:**

- Clear visual distinction between "Library" (master) and "Linked" (reference)
- Impact warnings before edits ("This will affect 12 MSIs")
- Relationship visualization (where-used panels)

### 3. Conditional UpCharge Visibility

**Problem:** UpCharges can be disabled per-option. This creates a compatibility matrix that's hard to visualize.

**Solution:** Compatibility matrix UI when configuring UpCharge → Option relationships.

### 4. Percentage-Based Pricing

**Problem:** Some UpCharges are calculated as percentages of other price components. This creates dependencies that users need to understand.

**Solution:** Visual formula builder for percentage pricing with live preview calculations.

### 5. Scale (500+ MSIs, 200+ Options)

**Problem:** Lists become unwieldy at scale.

**Solution:**

- Virtual scrolling for all lists
- Powerful search and filtering
- Bulk selection and operations
- Keyboard navigation

---

## Document Structure

| Document                                                               | Description                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------ |
| [01-information-architecture.md](./01-information-architecture.md)     | Page structure, navigation, URL design           |
| [02-core-patterns.md](./02-core-patterns.md)                           | Reusable UI patterns and components              |
| [03-catalog-page.md](./03-catalog-page.md)                             | MSI browsing and management                      |
| [04-item-detail-page.md](./04-item-detail-page.md)                     | Single MSI view with relationships               |
| [05-library-pages.md](./05-library-pages.md)                           | Options, UpCharges, Additional Details libraries |
| [06-pricing-experience.md](./06-pricing-experience.md)                 | Spreadsheet pricing, bulk operations             |
| [07-category-management.md](./07-category-management.md)               | Tree management, drag-drop                       |
| [08-relationship-visualization.md](./08-relationship-visualization.md) | Where-used, impact analysis                      |
| [09-bulk-operations.md](./09-bulk-operations.md)                       | Mass edit, mass price change                     |
| [10-edge-cases.md](./10-edge-cases.md)                                 | Error states, conflicts, scale                   |

---

## Target Users

### Primary: Pricing Admin / Operations Manager

- **Technical comfort:** Moderate (can use Excel, basic web apps)
- **Domain expertise:** High (knows products, pricing, industry)
- **Tasks:** Configure price guide, update pricing, import vendor catalogs
- **Pain points:** Tedious data entry, unclear what affects what, fear of breaking things

### Secondary: Company Owner / Decision Maker

- **Technical comfort:** Low to moderate
- **Domain expertise:** High
- **Tasks:** Review pricing, approve changes, understand structure
- **Pain points:** Wants overview without getting into details

### Tertiary: Support / Implementations

- **Technical comfort:** High
- **Domain expertise:** Moderate
- **Tasks:** Bulk migrations, troubleshooting, office cloning
- **Pain points:** Needs power-user tools, import/export, validation

---

## Design Principles

1. **Show the Shape of the Data**  
   Use visual hierarchy and grouping to communicate entity relationships without requiring users to understand the database schema.

2. **Warn Before You Burn**  
   Any action that affects shared data should clearly communicate scope of impact. "Delete" should describe what will happen.

3. **Inline > Modal > New Page**  
   Prefer inline editing for simple changes. Use modals for focused tasks. Only navigate to new pages for complex workflows.

4. **Smart Defaults, Not Blank Forms**  
   Pre-populate based on context. Copy pricing from similar items. Suggest options based on category.

5. **Recoverable Actions**  
   Soft delete with undo. Version tracking. Clear audit trail for pricing changes.

6. **Keyboard-First for Power Users**  
   Tab navigation, slash commands, bulk selection, copy-paste for pricing grids.

---

## Success Metrics

| Metric                                  | Target        | Rationale                       |
| --------------------------------------- | ------------- | ------------------------------- |
| Time to create MSI with 3 options       | < 3 minutes   | Current workflow is ~10 minutes |
| Time to update pricing across 10 items  | < 2 minutes   | Bulk operations should be fast  |
| Error rate (incomplete pricing)         | < 5%          | Clear warnings prevent gaps     |
| Support tickets for "I broke something" | 50% reduction | Better confirmation dialogs     |

---

## Next Steps

1. Review [Information Architecture](./01-information-architecture.md) for navigation structure
2. Review [Core Patterns](./02-core-patterns.md) for reusable components
3. Proceed to individual page specifications
