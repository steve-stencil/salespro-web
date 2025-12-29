#### What “Price Guide” is (in this ecosystem)

The “Price Guide” is the **company-owned catalog** of sellable line items (Measure Sheet Items) that sales reps add to estimates, with:

- **Per-office availability** (a line item can be visible in multiple offices).
- **Options** (product variants) per line item.
- **UpCharges** (add-ons) per line item, that can be disabled for certain options.
- **Pricing** per office, and in V2, **broken down into typed components** (materials/labor/other, etc.), including **percentage-based** prices that roll up off selected base components.

#### Primary users

- **Pricing Admin / Operations Manager (Dashboard user)**: maintains items/options/upcharges, pricing breakdowns, mass operations, import/export.
- **Sales Rep (Field user; iOS app today)**: selects items and options, sets quantities, adds upcharges, generates contract/proposal PDFs; pricing must be fast/offline-capable.
- **Support / Implementations**: uses import/export and bulk tools for migrations, vendor catalog downloads, office cloning.

#### Where the feature “lives”

- **Dashboard**: `/Users/stevestencil/Desktop/Coding/leap-360/` (UI + Parse cloud function calls)
- **Backend (legacy)**: `/Users/stevestencil/Desktop/Coding/leaponeserver/` (Parse classes + cloud functions + Mongo aggregation helpers)
- **Rep app**: `/Users/stevestencil/Desktop/Coding/leap-one/` (sync to Core Data + estimate pricing + placeholder substitution)
