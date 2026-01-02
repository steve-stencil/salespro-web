# ADR-003: Require Minimum One Option Per Measure Sheet Item

## Status

**Accepted**

## Date

2024-12-29

## Context

The Price Guide system supports two pricing models for Measure Sheet Items (MSIs):

1. **Base Pricing**: Direct pricing on the MSI itself for simple items without variants
2. **Option Pricing**: Pricing through linked options (product variants like "Pella Premium", "Standard White")

This dual-model approach creates complexity:

- Two separate pricing entities (`MeasureSheetItemPrice` and `OptionPrice`)
- Conditional UI logic ("does this item have options?")
- Conversion flows when users add options to a base-priced item
- Multiple code paths for pricing calculations
- Confusion about when to use which model

The original rationale for base pricing was to support "simple items" like permit fees or flat-rate services that don't need variants. However, this can be achieved by creating a single option named after the item itself.

## Decision Drivers

- **Code simplicity**: Fewer entities, fewer code paths, easier maintenance
- **UI consistency**: Same workflow for all items
- **Mental model clarity**: "Items have options, options have prices" - full stop
- **Mobile app simplicity**: Single pricing lookup logic
- **Industry precedent**: Shopify, WooCommerce, and most e-commerce platforms require at least one variant per product

## Considered Options

1. **Keep dual model (Base + Option pricing)** - Support both pricing approaches
2. **Require minimum one option** - All MSIs must have at least one option
3. **Hybrid with auto-conversion** - Allow base pricing but auto-convert to option when user adds first option

## Decision

We will **require minimum one option per MSI** because it dramatically simplifies the codebase while providing equivalent functionality.

For "simple items" that don't have variants:

- The wizard auto-creates an option with the same name as the MSI
- Single-option items auto-select in the rep app (no extra user interaction)
- The UI can hide option selection when only one option exists

### Pros

- **Removes `MeasureSheetItemPrice` entity entirely** - One less table, migration, API, etc.
- **Single pricing path** - All pricing flows through `OptionPrice`
- **Simpler UI** - No conditional "base vs option" tab logic
- **No conversion dialogs** - No need to handle base→option transitions
- **Cleaner mental model** - Consistent pattern for all items
- **Less testing surface** - Fewer branches to cover

### Cons

- **Extra entity for simple items** - "Permit Fee" needs a "Permit Fee" option
- **Slight data overhead** - Each simple item has one more database record
- **Naming redundancy** - Single-option items may have option name = item name

## Consequences

### Positive

- Codebase is significantly simpler and more maintainable
- New developers understand the system faster (one pattern to learn)
- Mobile app pricing logic is uniform
- UI components are more straightforward

### Negative

- Existing items with base pricing need migration to create default options
- Users might find it odd that "Permit Fee" has an option called "Permit Fee"

### Risks

- **Migration complexity**: Existing base-priced items need default options created
  - _Mitigation_: Write migration script that creates option with item's name, copies base prices to option prices
- **User confusion**: "Why does my simple item have an option?"
  - _Mitigation_: Hide option picker in UI when only 1 option exists; document the pattern

## Implementation Notes

### Code Changes Required

**Remove:**

- `MeasureSheetItemPrice` entity
- `Migration20251229000000_msi-pricing.ts`
- MSI pricing API routes (`/api/price-guide/pricing/msi/*`)
- Base pricing tab in `PricingPage.tsx`
- `useMsiPricing` hook

**Add:**

- Validation in MSI create/update: "must have at least 1 option"
- Auto-create default option in wizard when user doesn't add any
- Auto-select logic for single-option items in rep app

**Update:**

- `PricingPage.tsx`: Single "Item Pricing" tab showing option pricing
- Wizard: Auto-create option step
- Shared types: Remove base pricing types

### Migration Strategy

For existing data:

```sql
-- For each MSI with base pricing but no options:
-- 1. Create PriceGuideOption with name = MSI.name
-- 2. Create MeasureSheetItemOption junction record
-- 3. Copy MeasureSheetItemPrice records to OptionPrice records
-- 4. Delete MeasureSheetItemPrice records
```

## Related ADRs

- None

## References

- [Shopify Product Variants](https://help.shopify.com/en/manual/products/variants) - Industry example of "minimum one variant" pattern
- Internal discussion: Price Guide simplification (2024-12-29)

