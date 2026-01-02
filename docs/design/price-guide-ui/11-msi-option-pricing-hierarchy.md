# MSI+Option Pricing Hierarchy Design

## Overview

This document describes the enhanced upcharge pricing hierarchy that allows pricing overrides at the MSI+Option level, providing granular control over upcharge pricing based on the context in which an option is used.

## Problem Statement

Currently, upcharge pricing overrides can only be set at the Option level. This means if an option (e.g., "Mezzo") is used in multiple MSIs (e.g., "0-100 UI" and "101-110 UI"), it must have the same override price across all MSIs.

**User Need**: Set different upcharge prices for the same option when used in different MSIs (e.g., different window size ranges).

## Solution: Three-Tier Pricing Hierarchy

### Pricing Resolution Order (Most Specific Wins)

```
1. MSI + Option Override (most specific)
   └─ Applies to one option in ONE specific MSI
   └─ Example: "Mezzo in 0-100 UI costs $40"

2. Global Option Override
   └─ Applies to one option across ALL MSIs
   └─ Example: "Mezzo always costs $50 more"

3. Default (least specific)
   └─ Base price for the upcharge
   └─ Applies when no overrides exist
```

### Office Dimension Simplification

Instead of requiring prices for every office, use a **default + override** pattern:

```
Before (must set every office):
├─ Main Office:    $50.00
├─ Marktsharp:     $50.00
├─ Odessa:         $50.00
└─ Pasadena:       $55.00  ← Only different one

After (default + overrides):
├─ Default:        $50.00
└─ Office Overrides:
   └─ Pasadena:    $55.00
```

**Benefits**:

- Less data to manage
- Clearer intent (which offices are different)
- New offices inherit the default automatically

## Data Model Changes

### UpChargePrice Entity

Add `measureSheetItem` as an optional foreign key:

```typescript
@Entity()
@Unique({
  properties: ['upCharge', 'option', 'measureSheetItem', 'office', 'priceType'],
})
export class UpChargePrice {
  // ... existing fields ...

  /** MSI for MSI-specific override (null = global) */
  @ManyToOne('MeasureSheetItem', { nullable: true })
  @Index()
  measureSheetItem?: MeasureSheetItem;
}
```

### Pricing Key Combinations

| upCharge | option | measureSheetItem | office | Type                                       |
| -------- | ------ | ---------------- | ------ | ------------------------------------------ |
| ✓        | null   | null             | ✓      | Default (per office)                       |
| ✓        | null   | null             | null   | Default (all offices) - NEW                |
| ✓        | ✓      | null             | ✓      | Global Option Override (per office)        |
| ✓        | ✓      | null             | null   | Global Option Override (all offices) - NEW |
| ✓        | ✓      | ✓                | ✓      | MSI+Option Override (per office)           |
| ✓        | ✓      | ✓                | null   | MSI+Option Override (all offices) - NEW    |

## API Changes

### Updated Pricing Response

```typescript
type UpChargePricingDetail = {
  upcharge: {
    id: string;
    name: string;
    version: number;
  };
  priceTypes: PriceType[];

  // Default pricing (when no overrides exist)
  defaultPricing: {
    default: PriceTypeConfig[]; // All offices
    officeOverrides: Record<string, PriceTypeConfig[]>; // Per-office overrides
  };

  // Global option overrides (apply across all MSIs)
  globalOptionOverrides: Array<{
    option: { id: string; name: string };
    default: PriceTypeConfig[];
    officeOverrides: Record<string, PriceTypeConfig[]>;
  }>;

  // MSI-specific overrides
  msiOptionOverrides: Array<{
    msi: { id: string; name: string };
    option: { id: string; name: string };
    default: PriceTypeConfig[];
    officeOverrides: Record<string, PriceTypeConfig[]>;
  }>;

  // Options available for overrides (from linked MSIs)
  linkedOptions: Array<{ id: string; name: string }>;

  // MSIs that have this upcharge linked
  linkedMsis: Array<{
    id: string;
    name: string;
    options: Array<{ id: string; name: string }>;
  }>;
};
```

### New Endpoints

```
# Get pricing for a specific MSI context
GET /api/price-guide/pricing/upcharges/:upchargeId/msi/:msiId

# Update MSI+Option override
PUT /api/price-guide/pricing/upcharges/:upchargeId/msi-overrides
Body: {
  msiId: string;
  optionId: string;
  default: PriceTypeConfig[];
  officeOverrides?: Record<string, PriceTypeConfig[]>;
  version: number;
}

# Delete MSI+Option override
DELETE /api/price-guide/pricing/upcharges/:upchargeId/msi-overrides
Body: {
  msiId: string;
  optionId: string;
}
```

## UI Design

### Entry Points

1. **Library Page → Upcharge → Pricing Button**
   - Configure default pricing
   - Configure global option overrides
   - Search and configure MSI-specific overrides

2. **MSI Detail Page → Upcharges Section → Pricing Button** (NEW)
   - Configure pricing for options in this specific MSI
   - Shows inherited values from global/default

### Library Page Dialog Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Configure Pricing: [Upcharge Name]                          X │
├─────────────────────────────────────────────────────────────────┤
│ [Default] [Global Option Overrides] [MSI Overrides]             │
├─────────────────────────────────────────────────────────────────┤

Default Tab:
│ Default pricing for all options in all MSIs                     │
│                                                                 │
│ Default (all offices):                                          │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Materials: [Fixed ▼] $[50.00]                               ││
│ │ Labor:     [Percentage ▼] [10]% of [☑M ☑L ☐T ☐O]           ││
│ │ Tax:       [Not Used ▼]                                     ││
│ │ Other:     [Not Used ▼]                                     ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Office Overrides: [+ Add Office Override]                       │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Pasadena: Materials $55.00  [Edit] [Remove]                 ││
│ └─────────────────────────────────────────────────────────────┘│

Global Option Overrides Tab:
│ Applies to specific options across ALL MSIs                     │
│ [+ Add Global Override]                                         │
│                                                                 │
│ ▼ Mezzo                                                         │
│   Default: Fixed $60 (all price types)                          │
│   Office Overrides: Pasadena $65                                │
│                                                                 │
│ ▼ Ultramaxx                                                     │
│   Default: 15% of M+L                                           │

MSI Overrides Tab:
│ Override pricing for specific MSI + Option combinations         │
│                                                                 │
│ Search MSI: [________________] 🔍                               │
│                                                                 │
│ Existing Overrides (3):                                         │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 0-100 UI → Mezzo: Fixed $40         [Edit] [Delete]         ││
│ │ 101-110 UI → Mezzo: Fixed $60       [Edit] [Delete]         ││
│ │ 101-110 UI → Ultramaxx: 15% M+L     [Edit] [Delete]         ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ [+ Add MSI Override]                                            │
└─────────────────────────────────────────────────────────────────┘
```

### MSI Detail Page Dialog (Context-Aware)

```
┌─────────────────────────────────────────────────────────────────┐
│ Pricing: [Upcharge] in [MSI Name]                           X │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Configure pricing for options in this MSI.                      │
│ "Use Inherited" uses global option override or default.         │
│                                                                 │
│ ▼ Mezzo                                                         │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ [○ Use Inherited] Currently: $50 (global option)        │  │
│   │ [● Override for this MSI]                               │  │
│   │                                                         │  │
│   │ Materials: [Fixed ▼] $[40.00]                          │  │
│   │ Labor:     [Use Inherited ▼]                           │  │
│   │ Tax:       [Use Inherited ▼]                           │  │
│   │ Other:     [Not Used ▼]                                │  │
│   │                                                         │  │
│   │ Office Overrides: [+ Add]                              │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ▼ Ultramaxx                                                     │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ [● Use Inherited] Currently: 10% M+L (default)         │  │
│   │ [○ Override for this MSI]                               │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Migration Strategy

1. **Database Migration**: Add `measure_sheet_item_id` column (nullable) to `up_charge_price` table
2. **No data migration needed**: Existing rows have `null` for MSI, which means "global"
3. **API backward compatible**: Existing endpoints continue to work, new functionality is additive

## Implementation Phases

### Phase 1: Data Model & API

- Add `measureSheetItem` to `UpChargePrice` entity
- Create database migration
- Update API endpoints to support MSI overrides
- Update shared types

### Phase 2: Library Page UI

- Add "MSI Overrides" tab to pricing dialog
- Implement search/filter for MSIs
- Add create/edit/delete for MSI overrides

### Phase 3: MSI Detail Page Integration

- Add "Pricing" action to upcharges in MSI detail
- Create context-aware pricing dialog
- Show inherited values and allow MSI-specific overrides

### Phase 4: Office Simplification (Optional)

- Add "default for all offices" concept
- Migrate UI to use default + office overrides pattern
- This can be done incrementally alongside the MSI work
