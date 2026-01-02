#### Page + mental model

Dashboard’s Price Guide is an editable table of **Measure Sheet Items (MSIs)**. Each MSI expands to show:

- **Options** (SSPriceGuideItem isAccessory=false)
- **UpCharges** (SSPriceGuideItem isAccessory=true)

Key UI entry:

- `/Users/stevestencil/Desktop/Coding/leap-360/src/components/views/Pricing/PriceGuidePage/PriceGuidePage.tsx`

#### Fetching model

- MSIs are fetched via Parse query with filters:
  - categories/subCategories/subSubCategories, office filter (via `includedOffices`)
  - includes relations: `items`, `accessories`, `includedOffices`, etc.
  - `/Users/stevestencil/Desktop/Coding/leap-360/src/services/parse/priceGuide/fetchParseMeasureSheetItems.ts`
- Expanding rows triggers fetching full PG items into local RxDB:
  - `/Users/stevestencil/Desktop/Coding/leap-360/src/controllers/priceGuideItem/fetchPriceItems.ts`
  - cloud fn behind it fetches raw `SSPriceGuideItem` docs in bulk

#### Editing model

- MSI fields edit locally, then “Save All” persists MSI updates.
  - Save path: `/Users/stevestencil/Desktop/Coding/leap-360/src/controllers/measureSheetItem/saveMeasureSheetItems.ts` (and underlying parse save)
- Option/UpCharge record edits happen via controllers; some edits are direct on SSPriceGuideItem fields, but **V2 pricing edits** are done via **roll-up modals** that write PriceObjects.

#### V2 pricing editing (the key part)

- **Option pricing modal**: edits “breakdowns” = list of `{ typeCode, amount }` for a selected office, optionally applied to other offices.
  - `/Users/stevestencil/Desktop/Coding/leap-360/src/components/views/Pricing/PriceGuidePage/modals/OptionRollUpPriceModal/OptionRollUpPriceModal.tsx`
- Save behavior (important):
  - Before writing, dashboard **deletes existing PriceObject rows for (item, officesToApply + selectedOffice)** then recreates rows from breakdowns.
  - `/Users/stevestencil/Desktop/Coding/leap-360/src/services/parse/priceGuideItem/saveParsePriceGuideItem.ts`
- **UpCharge pricing modal(s)**: supports fixed $ or % pricing with a “percentage base” selection; this maps to `isPercentage` + `percentageTypeCodes`.
  - See UI pieces:
    - `/Users/stevestencil/Desktop/Coding/leap-360/src/components/views/Pricing/PriceGuidePage/modals/UpChargeRollUpPriceModal/*`
- Price type options (`typeCode`s) come from Parse `PriceObjectType`:
  - `/Users/stevestencil/Desktop/Coding/leap-360/src/services/parse/priceGuideItem/getPriceTypes.ts`

#### Admin tools in the page

- Export: triggers cloud function `exportPriceGuideToExcel`
- Import from file: triggers cloud function `importPriceGuideFromExcel` (overwrites)
- Mass Copy: triggers cloud function `copyValues` (legacy) and/or newer mass copy job
- Mass Price Change: triggers `increasePrices` (async job via lambda queue)
- Auto Generate UpCharge IDs: adds/forces a placeholder and assigns identifiers
  Entry points:
- `/Users/stevestencil/Desktop/Coding/leap-360/src/services/parse/cloudFunctions/priceGuideTools.js`
- `/Users/stevestencil/Desktop/Coding/leap-360/src/components/views/Pricing/PriceGuidePage/PriceGuideToolsDropdown/PriceGuideToolsDropdown.tsx`
