# Implementation Prompt: UpCharge Per-Price-Type Mixed Mode Pricing

## Context

The Price Guide system allows administrators to configure pricing for UpCharges (add-ons/accessories). The **data model already supports** per-price-type mixed mode pricing (where each price type like Materials, Labor, Tax, Other can independently be Fixed or Percentage), but the **UI currently doesn't expose this capability**.

## Objective

Update the UpCharge pricing UI to support **per-price-type mode selection**, allowing users to configure different pricing modes for each price type within a single upcharge.

## Business Requirements

### Use Case Example

A user wants to configure an "Installation Kit" upcharge where:

- **Materials**: 10% of the parent option's (Materials + Labor)
- **Labor**: Fixed $25 per office
- **Tax**: Fixed $0 (effectively not used)
- **Other**: Fixed $10 per office

## Technical Background

### Relevant Entities

**`UpChargePrice` entity** (`apps/api/src/entities/price-guide/UpChargePrice.entity.ts`):

- Each row represents pricing for a specific `(upCharge, option, measureSheetItem, office, priceType)` combination
- Has `isPercentage: boolean` - determines if this price type uses percentage or fixed
- Has `amount: number` - the dollar amount (if fixed) or percentage multiplier (if percentage)
- Has `percentageBase` relationship - which parent price types to sum for percentage calculation

**`UpChargePricePercentageBase` entity** (`apps/api/src/entities/price-guide/UpChargePricePercentageBase.entity.ts`):

- Junction table defining which price types to include in percentage base calculation
- Each row links an `UpChargePrice` to a `PriceObjectType` to include

### Pricing Hierarchy (Three Tiers)

1. **MSI+Option Override** (most specific): Pricing for a specific option within a specific MSI
2. **Global Option Override**: Pricing for an option across all MSIs
3. **Default Pricing** (least specific): Default pricing when no override exists

### Key Insight

Each `UpChargePrice` row can have its own `isPercentage` flag. The data model already supports:

- Row 1: `priceType=Materials, isPercentage=true, amount=0.10, percentageBase=[Materials, Labor]`
- Row 2: `priceType=Labor, isPercentage=false, amount=25.00`
- Row 3: `priceType=Other, isPercentage=false, amount=10.00`

## Design Documentation

Read the updated design specifications:

- `docs/design/price-guide-ui/06-pricing-experience.md` - Main pricing UI specification
- `docs/design/price-guide-ui/05-library-pages.md` - Library page updates
- `docs/design/price-guide-ui/10-edge-cases.md` - Edge cases for mixed mode
- `docs/design/price-guide-ui/11-msi-option-pricing-hierarchy.md` - MSI+Option pricing hierarchy

## Implementation Tasks

### 1. Update UpCharge Pricing Page Component

**Location**: `apps/web/src/pages/price-guide/PricingPage.tsx` (or create new component)

**Requirements**:

- Per-price-type configuration UI showing each price type (Materials, Labor, Tax, Other)
- Each price type can be independently configured as Fixed or Percentage

### 2. Create Per-Price-Type Configuration Component

**New Component**: `apps/web/src/components/price-guide/PriceTypeConfig.tsx`

**Requirements**:

- Mode dropdown: Fixed | Percentage
- If Fixed: show office grid for entering amounts
- If Percentage: show rate input + base type checkboxes
- Real-time preview calculations

### 3. Update Price Type Mode Selector

**Component**: `apps/web/src/components/price-guide/upcharge-pricing/PricingModeSelector.tsx`

```tsx
type PricingMode = 'fixed' | 'percentage';

type PriceTypeConfig = {
  priceTypeId: string;
  mode: PricingMode;
  // For fixed mode
  fixedAmounts?: Record<string, number>; // officeId -> amount
  // For percentage mode
  percentageRate?: number;
  percentageBaseTypes?: string[]; // priceTypeIds to include
};
```

### 4. Update API Integration

**Service**: `apps/web/src/services/price-guide.ts`

Update the save logic to:

- Create/update `UpChargePrice` rows with correct `isPercentage` per price type
- Create/update `UpChargePricePercentageBase` rows for percentage types
- Handle $0 amounts for price types not being used

### 5. Update Library Page UpCharge Cards

**Location**: `apps/web/src/pages/price-guide/LibraryPage.tsx`

Update the mode badge to show:

- "All Fixed" when all price types use fixed
- "All X% of Y" when all price types use same percentage
- "Mixed" when different modes are used

### 6. Add Override Support

**Locations**: Two separate flows based on context

**From Library (UpCharge List)**:

- `UpChargePricingDialog` - Configure **default pricing only**
- Simple modal showing per-price-type configuration (Fixed or Percentage)

**From Pricing Page (Option Pricing Tab)**:

- `OptionUpchargeOverrides` - Configure **option-specific overrides**
- Appears within each option's pricing section
- Allows customizing upcharge pricing for that specific option
- Uses "Use Default" to inherit from the upcharge's default pricing

Override modes:

- Fixed: Set specific dollar amounts
- Percentage: Calculate as % of parent option
- Use Default: Inherit from the upcharge's default pricing

### 7. Validation

Implement validation rules:

- Percentage mode must have at least one base type selected
- Warning when all price types have $0 amounts

### 8. Preview Calculations

Show real-time preview of calculated totals:

- For percentage types: calculate based on sample parent option
- Show warnings for parent options with missing pricing
- Display total across all price types

## Component Structure

```
apps/web/src/components/price-guide/upcharge-pricing/
├── UpChargePricingDialog.tsx       # Dialog for default pricing (from Library)
├── UpChargePricingConfig.tsx       # Per-price-type configuration UI
├── OptionUpchargeOverrides.tsx     # Option-specific overrides (from Pricing Page)
├── OptionOverrideConfig.tsx        # Single override configuration
├── PriceTypeModeSelector.tsx       # Mode dropdown (Fixed/Percentage/Use Default)
├── FixedModeConfig.tsx             # Office amount grid
├── PercentageModeConfig.tsx        # Rate + base type selection
├── PricingPreview.tsx              # Calculated total preview
└── utils.ts                        # Validation and transform utilities
```

## Testing Checklist

- [ ] Can configure each price type independently (Fixed, Percentage)
- [ ] Percentage calculation correctly sums selected base types
- [ ] Preview shows accurate calculations with sample options
- [ ] Global option overrides work correctly
- [ ] MSI+Option overrides work correctly
- [ ] "Use Default" / "Use Inherited" modes inherit correctly
- [ ] Validation prevents invalid configurations
- [ ] Library page shows correct mode badge (All Fixed / All % / Mixed)
- [ ] Data saves correctly to `UpChargePrice` and `UpChargePricePercentageBase`
- [ ] Existing data loads correctly into new UI
- [ ] Dark mode styling works correctly

## API Endpoints

- `GET /api/price-guide/pricing/upcharges/:id` - Get upcharge pricing (includes `linkedOptions` and `linkedMsis`)
- `PUT /api/price-guide/pricing/upcharges/:id/default-prices` - Update default pricing
- `PUT /api/price-guide/pricing/upcharges/:id/override-prices` - Update global option overrides
- `DELETE /api/price-guide/pricing/upcharges/:id/override-prices` - Delete global option overrides
- `PUT /api/price-guide/pricing/upcharges/:id/msi-overrides` - Update MSI+Option overrides
- `DELETE /api/price-guide/pricing/upcharges/:id/msi-overrides` - Delete MSI+Option overrides
- `GET /api/price-guide/price-types` - Get available price types
- `GET /api/price-guide/offices` - Get offices for pricing grid

## Notes

- Follow existing patterns in the codebase for forms, validation, and state management
- Use MUI components for consistent styling
- Maintain accessibility (keyboard navigation, screen reader support)
- Dark mode support via MUI theme
