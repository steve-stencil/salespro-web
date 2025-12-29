#### Where reps see it

The iOS app exposes Price Guide in the main menu and flows into:

- Categories → Subcategories → DrillDowns → Item detail
- Key controllers include:
  - `PriceMeasureSheetItemTableViewController`
  - `DrillDownsTableViewController`
  - `PriceGuideItemTableViewController` (option selection + accessories)
    Entry points:
- `/Users/stevestencil/Desktop/Coding/leap-one/Estimate Pro/MainView/MenuViewController.m`
- `/Users/stevestencil/Desktop/Coding/leap-one/Estimate Pro/PriceMeasureSheetItemTableViewController.m`
- `/Users/stevestencil/Desktop/Coding/leap-one/Estimate Pro/DrillDownsTableViewController.m`

#### Offline-first sync requirement

The app maintains a local Core Data “pinned” copy of:

- MeasureSheetItem (MSI)
- PriceGuideOption (option records)
- UpCharge
- (V2) PriceObject + PriceObjectType

Sync behavior:

- On office change / periodic checks, it computes whether local and server are in sync by comparing `updatedAt` for MSIs + child PGIs (+ V2 PriceObjects).
- If out of sync, it downloads in batches (Parse query limit aware) and writes to Core Data.
  Core sync logic:
- `/Users/stevestencil/Desktop/Coding/leap-one/Estimate Pro/MeasureSheetItem.swift`
- orchestrated by `/Users/stevestencil/Desktop/Coding/leap-one/Estimate Pro/AppSync.swift`
