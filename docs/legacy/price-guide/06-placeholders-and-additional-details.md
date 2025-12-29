#### What they are used for

Placeholders are used primarily in:

- Contract/proposal generation (PDF templates)
- Showing computed totals in formatted strings
- Feeding CRM export fields in some contexts

#### AdditionalDetailObjects (per MSI and per UpCharge)

- MSI additional details:
  - Each additional detail may carry a `placeholder` token.
  - Replacement value comes from the user-entered “additionalValues” stored on the added estimate item.
- UpCharge additional details:
  - Namespaced via the upcharge `identifier`:
    - `%<identifier>.<placeholder>%` → user entered value for that accessory

Implementation reference:

- `/Users/stevestencil/Desktop/Coding/leap-one/Estimate Pro/PlaceHolderReplacement.swift`

#### UpCharge identifier namespace (critical)

When a rep adds an upcharge that has an `identifier`, the system generates many placeholders:

- `%<id>.name%`, `%<id>.note%`, `%<id>.measurementType%`, `%<id>.quantity%`, etc.
- plus placeholders defined on the upcharge itself
  This is why “Auto Generate UpCharge IDs” exists in the dashboard.

Dashboard-side helper:

- `/Users/stevestencil/Desktop/Coding/leap-360/src/services/parse/cloudFunctions/priceGuideTools.js` (`upChargeIds()`)
