#### Export

- Admin triggers export; backend emails an xlsx file (“SalesPro Price Guide Export.xlsx”).
- Export is async; UI shows “check your email”.
  Key code:
- Dashboard trigger: `startExportPriceGuide()` → `Parse.Cloud.run('exportPriceGuideToExcel')`
- Backend: `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/functions/Exporting.cjs`

#### Import

- Admin uploads xlsx (base64); backend validates, overwrites, emails success/failure.
- Import format uses row markers:
  - `m` (measure sheet item), `p` (price item), `m-del`, `p-del`
    Key code:
- Dashboard trigger: `startImportPriceGuide()` → `Parse.Cloud.run('importPriceGuideFromExcel')`
- Backend parsing: `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/functions/Excel.cjs`

#### Mass Copy

- Copies selected MSI fields to other MSIs; can also clone/link items/accessories and copy embedded arrays.
- Newer job has locking + email notification:
  - `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/functions/PriceGuide/MassCopy/massCopy.mjs`

#### Mass Price Change (V2-aware by implication)

- Triggered from dashboard; server enqueues a lambda job with:
  - optionIds, upChargeIds, officeIds, mathSymbol, amount
- `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/MeasureSheetItem/Tools.cjs`
- `/Users/stevestencil/Desktop/Coding/leaponeserver/cloud/classes/MeasureSheetItem/MassPriceIncrease.cjs`
