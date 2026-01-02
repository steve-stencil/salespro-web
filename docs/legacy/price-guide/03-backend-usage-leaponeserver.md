#### What backend is responsible for (legacy)

- Define Parse schemas, validation, hooks, and cloud functions for:
  - MSI CRUD lifecycle
  - Bulk operations (mass copy, mass price change)
  - Import/export pipelines
  - Sync helpers used by clients

#### Key lifecycle hooks (SSMeasureSheetItem)

- BeforeSave:
  - Maintains `itemsRelation` and `accessoriesRelation` to mirror the array fields.
  - Sets `orderNumber_` for sorting if missing (new items appear first).
  - `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/MeasureSheetItem/BeforeSave.cjs`
- AfterSave:
  - Updates “Packages” and “Custom Configs” to keep active option selection valid.
  - Can delete unused price guide items when items/accessories arrays change.
  - `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/MeasureSheetItem/afterSave/afterSave.cjs`
  - Package update logic: `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/MeasureSheetItem/afterSave/updatePackages.cjs`

#### V2: PriceObjects read paths

- Fetch grouped PriceObjects (for dashboard / syncing):
  - `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/PriceObject/fetchPriceObjects.cjs`
  - Returns grouped structure by itemId, with officePrices[], each office contains breakdowns[].

#### “Is my price guide in sync?” (server-side helper)

- Builds a “fingerprint” for:
  - MSIs included in a user’s selected office
  - referenced options/upcharges updatedAt
  - PriceObjects updatedAt for that office
- `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/MeasureSheetItem/PriceGuideDownload.cjs`

#### Mass operations

- Mass Copy (new job):
  - Copies selected MSI keys and can clone/link relational arrays (items/accessories) and embedded arrays (additionalDetailObjects/placeholders).
  - Locks with `company.operationStatus.massCopyInProgress`.
  - `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/functions/PriceGuide/MassCopy/massCopy.mjs`
- Mass Price Change:
  - Triggered by `increasePrices`, builds optionIds and optionally upChargeIds from MSIs, then calls a lambda queue.
  - `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/MeasureSheetItem/Tools.cjs`
  - Job trigger wrapper: `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/MeasureSheetItem/MassPriceIncrease.cjs`

#### Import/Export (Excel)

- Export:
  - Queries `SSMeasureSheetItem` + `items`, creates workbook, emails attachment to user.
  - `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/functions/Exporting.cjs` (`exportPriceGuideToExcel`)
- Import:
  - Uploads base64 xlsx, validates, imports rows into `SSMeasureSheetItem` + `SSPriceGuideItem`.
  - Overwrites; deletes “del” rows (`m-del`, `p-del`) too.
  - Calls `measureSheetItemsSaved` after save.
  - `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/functions/Excel.cjs`
  - Job wrapper: `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/functions/Exporting.cjs` (`importPriceGuideFromExcel`)
