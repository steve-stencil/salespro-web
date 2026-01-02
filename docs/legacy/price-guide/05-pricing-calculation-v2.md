#### Option price in V2

Conceptually: **Option total** = sum of PriceObject amounts for:

- `office = selectedOffice`
- `item = selected option`
- optionally filtered by a list of `typeCodes` (used for commission math and placeholders)

In code:

- Options compute prices via `PriceGuideOption.totalPrice(with typeCodes)`
- Total estimate price loops through active option + upcharges.
  See:
- `/Users/stevestencil/Desktop/Coding/leap-one/Estimate Pro/SSEstimatePricing.swift`

#### UpCharge price in V2

UpCharge total for an item depends on:

- the selected option (parent)
- the upcharge’s `disabledParents` list (skip if parent option is disabled)
- PriceObjects with:
  - `item = upCharge`
  - `parentItem = selected option`
  - `office = selectedOffice`
  - optionally filtered typeCodes
- If a PriceObject row has `isPercentage=true`, then `amount` is treated as a multiplier and applied to the parent’s total for `percentageTypeCodes`.

In code:

- `/Users/stevestencil/Desktop/Coding/leap-one/Estimate Pro/UpCharge.swift` (V2 path)
- totalization: `/Users/stevestencil/Desktop/Coding/leap-one/Estimate Pro/SSEstimatePricing.swift`

#### Quantity interaction

Line total typically scales as:

- optionTotal \* itemQuantity
- plus each upchargeTotal _ upchargeQuantity _ itemQuantity
