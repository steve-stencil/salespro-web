#### Legacy entities (names matter)

- **`SSMeasureSheetItem`**: the “line item” row reps add to estimates
  - Key fields: `category`, `subCategory`, `subSubCategories`, `itemName`, `itemNote`, `measurementType`, `defaultQty`, `formulaID`, `qtyFormula`, `shouldShowSwitch`, `includedOffices`, `additionalDetailObjects`, `placeholders`, tag fields (`tagTitle`, `tagRequired`, `tagPickerOptions`, `tagParams`, etc.)
  - Relationships: `items[]` (options), `accessories[]` (upcharges) both pointing to `SSPriceGuideItem`
- **`SSPriceGuideItem`**: used for BOTH options and upcharges (distinguished by `isAccessory`)
  - Options typically use: `displayTitle` (name), `subCategory2` (brand), `customRefId` (SKU)
  - Upcharges typically use: `name`, `info` (note), `identifier`, `disabledParents[]`, `percentagePrice`
- **V2 pricing data**: **`PriceObject`** (the pricing truth in V2)
  - Fields: `office` (Office ptr), `item` (SSPriceGuideItem ptr), optional `parentItem` (SSPriceGuideItem ptr), `typeCode`, `amount`, `isPercentage`, `percentageTypeCodes[]`
  - Interpretation:
    - For **options**: `PriceObject(item=Option, office=X, typeCode=..., amount=...)`
    - For **upcharges**: `PriceObject(item=UpCharge, parentItem=Option, office=X, typeCode=..., amount=..., isPercentage=bool, percentageTypeCodes=...)`
- **`PriceObjectType`**: defines selectable `typeCode`s (e.g. materials/labor/other). Default types exist globally; companies may have their own.

#### Critical invariants (must preserve when rebuilding)

- Upcharges can be excluded for an option via **`disabledParents`** on the upcharge object.
- V2 pricing is **office-scoped** and optionally filtered by **typeCodes** (used heavily in commissions + placeholders).
- Percent-based upcharges in V2 can be “% of” **specific base typeCodes** (not just total).

Code touchpoints:

- `PriceObject` schema: `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/PriceObject/Model.cjs`
- V1→V2 conversion job: `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/PriceObject/ConvertPriceGuideV1ToV2.cjs`
