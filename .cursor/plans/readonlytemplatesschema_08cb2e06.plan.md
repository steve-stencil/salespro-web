# Read-Only Mobile Templates + iOS-Parity Runtime (Schema-Focused)

## Goal (as you clarified)

- **Templates are read-only in SalesPro**. You will ETL from the source system into the **best structure we define**, then push/ingest into `apps/api`.
- The plan focuses on **field-user workflows**: template selection, creating a draft (selected templates), and **form filling driven by `contractData`** (required fields, dynamic input, formulas, detail cells) — matching iOS behavior exactly. Rendering/preview/signing are out of scope unless explicitly expanded.
- **No template authoring/editor UI** in `apps/web` right now.

---

## Parity contract (what “full feature parity” means here)

This plan’s parity target is **the iOS “Select templates → Fill forms driven by `contractData` → Validate required fields” workflow**.

### In scope (must match iOS behavior)

- **Template selection** (including multi-add templates) and the “Next” flow decisioning.
- **Form UI driven strictly by `contract_data_json`**:
- sectioning (`ContractDataGroupBodySection`)
- dynamic visibility (`dynamicInputObject`)
- required validation (static required + dynamic required rules)
- formula cells (numeric/currency/whole)
- text-formula cells (string templates with `[...]` placeholders)
- detail cells (nested `detailItems` flow)
- “add multiple” within a body section (duplicate line items; reorder; delete; clear)
- photo selector cells (select/reorder/remove photos as values)
- drawing/sketch capture cells (store image as value) if present in templates
- **Cross-field updates** when a controlling field changes (dynamic recalculation / refresh).
- **Maintainable implementation**: replicate iOS behavior, but do *not* copy iOS structure; build clean, testable modules.

### Out of scope (explicitly not promised by this plan)

- Full PDF preview/sign/send flows (including DocuSign, email verification, brochure selection, payments, etc.).

> Note: Some `contractData` cell types launch complex sub-flows (e.g., payment capture). If these appear in templates and you want *true* parity, we must either implement them or explicitly block those templates/cells in web. This plan assumes **implement**, unless we later blacklist cell types at ingestion.---

## iOS source-of-truth map (where to copy behavior from)

Use these files as the authoritative reference for “what the app should do”:

- **Template selection + Next flow orchestration**:
- `leap-one/Estimate Pro/ContractObjectSelectionCollectionViewController.m`
- `-loadContracts` (query + gating)
- `-sortContracts` (category grouping + sort preference)
- `-collectionView:didSelectItemAtIndexPath:` (toggle select; multi-add; linking spinner)
- `-nextButtonTapped:` (0/1/many routing; processingCount gating)
- `-contractPagesSelectionTableViewCell:didChangeStepperValue:` (multi-add)
- **Selection state / contract “instance” behavior (values, formulas, dynamics, required validation)**:
- `leap-one/Estimate Pro/AddedContractObject.swift`
- `static createContract(for:completion:)` (async creation)
- `func containsUserInputRequiredSection()` (decides whether to show form)
- `func missingRequiredValues()` and helpers (required validation semantics)
- `func shouldDisplayCellItem(at:)` (dynamic show/hide rules)
- `func setValue(...)` / `updateIndexPaths(...)` / formula + text-formula update logic
- `copyItemValueForCellItem(...)`, `deleteCellItem(...)`, `moveCellItem(...)` (canAddMultiple UX)
- **Form UI behaviors (table sections, cell setup, cell interactions, dynamic reload)**:
- `leap-one/Estimate Pro/SinglePageContractFormTableViewController.m`
- `-setupCell:forCellItem:` (cell-type specific UI binding + required highlighting)
- `-tableView:didSelectRowAtIndexPath:` (detail cells/drawing/photos/etc routing)
- `-reloadTableViewIfNeeded:forCellItem:` (dynamic insert/delete/reload semantics)
- `leap-one/Estimate Pro/ContractFormBaseTableViewController.m`
- `-setupCell:forCellItem:` and input-type mapping (keyboard/pickers/date/etc)
- `-leapInputTableViewCell:didChangeText:didEnd:` (when values commit; required toggles)
- **Body-section and cell schema semantics**:
- `leap-one/Estimate Pro/ContractDataGroupBodySection.swift` (section flags: `userInputRequired`, `canAddMultiple`, etc.)
- `leap-one/Estimate Pro/ContractDataBodyCellItem.swift` (cell fields; parsing; `requiresUserInput`; text-formula placeholder parsing)
- **How templates are “linked” to estimate/customer and how placeholders are replaced**:
- `leap-one/Estimate Pro/ContractObjectManager.swift`
- `func addAddedContract(_:)` (placeholder replacement, body processing, dynamic/text-formula fixups)

---

## Engineering quality requirement (do this better than iOS, without behavior drift)

The iOS code is the behavioral reference, not the architectural reference. For the web implementation:

- Keep **domain logic** (dynamic input, formulas, required validation, text-formula expansion) in **pure TypeScript modules** with unit tests.
- Keep UI components dumb: render view-models produced by the domain layer and dispatch “user changed value” events back in.
- Use **stable IDs** for values keyed by `objectId` / `cellId` consistently.
- Treat `contract_data_json` as untrusted input: validate schema, guard missing fields, and fail safely with actionable errors.
- Avoid hidden coupling and global mutable state. Prefer explicit dependencies and predictable data flow.
- Add test fixtures derived from real iOS payloads (sanitized) to prevent regression drift.

## What iOS actually stores (and why the schema matters)

From the iOS models:

- `ContractObject` (template catalog metadata + filters + asset refs):
- `type`, `pageId`, `pageSize`, `category`, `displayName`, `order`, `canAddMultiplePages`, `photosPerPage`, `wMargin`, `hMargin`
- state/office gating via Parse fields: `includedStates` (string or `ALL`), `excludedStates`, `includedOffices`
- asset fields: `pdf`, `iconImage`, `watermark` (PFFileObject)
- watermark config fields
- **payload fields**: `contractData` (nested array of groups/sections/cells), `images`
- `contractData` is a deeply nested structure:
- `ContractDataGroup` (`groupType` + `data[]`)
- Body: `ContractDataGroupBodySection` → `cellItems[]`
- Each `ContractDataBodyCellItem` can contain:
- nested `detailItems[]`
- dynamic input rules
- formulas referencing other cells via `cellId`
- signatures / initials flags

This payload is **not relational-friendly** (it’s a document tree). Trying to normalize it into many SQL tables makes:

- template ingestion harder
- runtime reconstruction slower
- version drift / partial updates risky

So the best DB approach is:

- **Store the big contract payload as a JSONB document**, and
- **Extract/index the small “catalog/filter” fields** needed for fast queries and UI.

---

## Recommended Database Schema (Postgres + MikroORM)

### 1) `ContractTemplate` (core catalog record)

This table exists to support *fast listing/filtering* (the iOS `loadContracts` equivalent) and stable identity.**Columns (normalized, indexed):**

- `id` (uuid, PK)
- `company_id` (uuid, required, indexed)
- `source_template_id` (text, optional, unique per company)
- Lets your ETL preserve the source system’s template ID.
- `type` (text, required, indexed)
- e.g. `contract` / `proposal` / future
- `page_id` (text, required, indexed)
- e.g. `singlePage` / `pdfPage`
- `category` (text, required, indexed)
- `display_name` (text, required)
- `sort_order` (int, required, indexed)
- `can_add_multiple_pages` (boolean, required)
- `is_template` (boolean, required)
- keep for parity; can default to false/true depending on your source semantics

**Filtering fields (match iOS query semantics):**

- `included_states` (text[], required, default `['ALL']`, GIN index)
- `excluded_states` (text[], required, default `[]`, GIN index)
- `included_office_ids` (uuid[], required, default `[]`, GIN index)

**iOS source of truth**

- `ContractObjectSelectionCollectionViewController.m` → `-loadContracts`
- Parse keys: `includedStates`, `excludedStates`, `includedOffices`, plus `type`, `pageId`, `isTemplate`, `order`

> Why arrays instead of join tables?>> - Read-only ingestion, simple fetch filters, and fewer joins.> - Postgres GIN indexes make `ANY()`/`@>` queries fast.> - If you later need per-office overrides or huge cardinality, we can migrate to join tables.**Layout fields:**

- `page_size_str` (text, required; iOS format `"612,792"`)
- `page_width` (int, required)
- `page_height` (int, required)
- Store both to avoid parsing overhead and to help validate.
- `w_margin` (int, required)
- `h_margin` (int, required)
- `photos_per_page` (int, required)

**Watermark fields:**

- `use_watermark` (boolean, required)
- `watermark_width_percent` (numeric, required)
- `watermark_alpha` (numeric, required)

**Assets (use existing `File` table):**

- `pdf_file_id` (uuid FK → `File`, nullable)
- `icon_file_id` (uuid FK → `File`, nullable)
- `watermark_file_id` (uuid FK → `File`, nullable)

**The payload (JSONB, not relational):**

- `contract_data_json` (jsonb, required)
- `images_json` (jsonb, nullable)

**Derived columns (computed during ingest, speed up mobile UX):**

- `has_user_input` (boolean, required)
- derived similarly to iOS `containsUserInputRequiredSection` logic
- `signature_field_count` (int, required)
- `initials_field_count` (int, required)

**Operational:**

- `created_at`, `updated_at`
- `deleted_at` (optional soft-delete)

### 2) `ContractTemplateIngestRun` (optional but recommended)

This is not required for runtime, but it gives you visibility and safety.

- `id` uuid
- `company_id`
- `source` (text)
- `started_at`, `finished_at`
- `status` (success/failed)
- `summary` (jsonb) — counts, warnings (e.g., missing files)

This lets you answer: “Did the ETL push load correctly? Which templates changed?”

### 3) Drafts (for iOS parity while still read-only templates)

Even if templates are read-only, **users still need drafts**.

- `ContractDraft`
- references templates by `template_id[]` and stores user-entered values as JSONB
- does **not** mutate templates

---

## API Contract for Your ETL (push model)

You will write the ETL to map source → our canonical schema.

### A) Upsert templates (metadata + JSON payload)

- `POST /api/contract-templates/ingest/upsert`
- accepts an array of `ContractTemplateUpsert` objects
- upserts by `(company_id, source_template_id)`

`ContractTemplateUpsert` will include:

- all catalog/filter fields
- `contract_data_json` (already mapped to the engine-compatible schema)
- optional `images_json`
- asset references handled separately (see below)

### B) Upload assets (pdf/icon/watermark)

- `POST /api/contract-templates/ingest/:templateId/assets/:kind`
- `kind` in `pdf | icon | watermark`
- uses existing `File` storage adapter pattern

This avoids base64-in-JSON and keeps DB clean.---

## Mobile Runtime Endpoints (field app)

These match the iOS selection + rendering flows.

- `GET /api/mobile/templates?type=contract&state=OH&officeId=...`
- Filter semantics:
- included if `included_states` contains state OR contains `ALL`
- excluded if `excluded_states` contains state
- included if `included_office_ids` contains officeId
- Sorting:
- by `sort_order` default
- optional alphabetical sort (mobile preference) like iOS
- Response returns:
- minimal list fields for grid
- signed URLs for `icon/pdf/watermark` if present
- `GET /api/mobile/templates/:id`
- returns full `contract_data_json` (+ assets urls)
- `POST /api/mobile/contracts/render`
- calls the contract-engine with `AddedContractInput[]` built from:
- selected templates
- user-entered values (draft)
- uploaded photos/signatures

---

## iOS-parity runtime requirements (selection → form filling)

### 1) Template listing + grouping (selection screen)

**Behavior requirements**

- **Gating**:
- Do not show templates unless the user has a selected office and there is an active customer.
- Customer state must be a valid 2-letter code; otherwise block and show an error.
- **Filter semantics**:
- Include when template is allowed for the customer state (state-specific or “ALL”).
- Exclude when template is excluded for that state.
- Include only when template is included for the selected office.
- Exclude templates that are “verification” pages.
- Exclude templates marked as templates (not selectable pages).
- **Sorting and grouping**:
- Group by `category`
- Sort categories alphabetically, but force `"Imported"` to the first position if present
- Within a category, sort by `order` by default, and allow a persisted toggle to sort alphabetically

**iOS source of truth**

- `ContractObjectSelectionCollectionViewController.m`
- `-loadContracts` (gating + filter semantics)
- `-sortContracts` (grouping, category order, inserted report object behavior)
- `-categories` getter and `-insureFirstCategoryIsImportedCategoryName` (Imported-first behavior)
- `-sortButtonTapped:` (persisted sort preference)

### 2) Selecting templates creates “instances” (linking step)

**Behavior requirements**

- Selecting a template is not just “toggle a checkbox”; it creates an instance with values, formulas, and derived state.
- Selection is asynchronous; while “Linking Estimate…” is happening, Next must not proceed.
- Multi-add templates must support multiple instances for a single template (iOS uses a stepper when `canAddMultiplePages == YES`).

**iOS source of truth**

- `ContractObjectSelectionCollectionViewController.m`
- `-collectionView:didSelectItemAtIndexPath:` (toggle behavior + async create + processingCount)
- `-contractPagesSelectionTableViewCell:didChangeStepperValue:` (multi-add behavior)
- `AddedContractObject.swift`
- `static createContract(for:completion:)` (async creation entry point)

### 3) Decide whether the form UI appears (1 selected vs many selected)

**Behavior requirements**

- If exactly one document selected:
- if it has at least one user-input-required section and at least one visible user-input cell ⇒ show the form UI
- otherwise ⇒ go straight to render (out of scope for this plan)
- If multiple documents selected:
- show an arrange/reorder UI before proceeding (web UI can differ from iOS modal, but ordering semantics must match)
- after ordering, if any selected document requires user input ⇒ show form UI(s); else render

**iOS source of truth**

- `ContractObjectSelectionCollectionViewController.m`
- `-nextButtonTapped:` (routing logic)
- `-arrangeDocumentViewControllerDidTapSave` (after reorder, decide form vs render)
- `AddedContractObject.swift`
- `func containsUserInputRequiredSection()` (definition of “requires form”)

### 4) Form screen: sectioning and which cells exist

**Behavior requirements**

- The form UI is built from `contractData` → body groups → body sections.
- Only sections where `userInputRequired == true` appear in the form screen.
- Only cells that “require user input” appear (hidden/non-user-input cells are excluded).

**iOS source of truth**

- `AddedContractObject.swift`
- `filteredBodySections` (how iOS builds the form-only view of the payload)
- `ContractDataGroupBodySection.swift`
- `userInputRequired`, `canAddMultiple`
- `ContractDataBodyCellItem.swift`
- `requiresUserInput()` and `shouldDisplayCell()`

### 5) Form screen: dynamic visibility rules

**Behavior requirements**

- For cells with `inputType == dynamic`:
- determine the “active dynamic rule” using the parent cell’s value
- if active rule is not enabled ⇒ the cell is hidden
- if parent changes, dependent cells must show/hide and reset their values to defaults as iOS does
- Dynamic rules must support both:
- exact match (`valuesContains`)
- comparator patterns (`"==>>"`, `"==<<"`, `"==>="`, `"==<="`, `"===="`) over numeric parent values

**iOS source of truth**

- `AddedContractObject.swift`
- `activeDynamicInputObject(for:)`, `setDynamicInputFieldDefaultValues()`, `dynamicValue(forComparator:parentValue:)`
- `shouldDisplayCellItem(at:)`
- `ContractDataBodyCellItem.swift`
- parsing + storage of `dynamicInputObject`

### 6) Required validation (static + dynamic required)

**Behavior requirements**

- “Next” on the form must:
- compute missing required values
- show a single alert listing all missing fields
- prevent advancing until resolved
- Required checks include:
- `isRequired == true`
- “dynamic required” when dynamic rule marks the cell required
- photo selector required: must have at least one photo selected
- detail cells: required values are only checked if the detail cell has been “added” (`hasBeenAdded`)

**iOS source of truth**

- `ContractObjectSelectionCollectionViewController.m`
- `-contractTabBarController:didTapNextButton:` (missing values alert format)
- `AddedContractObject.swift`
- `missingRequiredValues()` and helpers:
- `missingRequiredValues(fromCellItems:sectionName:)`
- `missingRequiredValues(fromDetailCellItems:)`

### 7) Formulas (numeric/currency/whole)

**Behavior requirements**

- Formula cells are **computed**, not user-editable.
- Any time a referenced cell changes, recompute and refresh dependents.
- Formatting must match iOS for each formula input type:
- currency with/without decimals
- whole number rounding
- default decimal places (note: iOS has flags affecting precision)

**iOS source of truth**

- `AddedContractObject.swift`
- `value(forFormulaString:)`, `formulaValue(for:)`, `updateFormula(for:changedCellId:...)`

### 8) Text-formulas (string templates with `[...]` placeholders)

**Behavior requirements**

- Text-formula cells are **computed strings** based on other cell values referenced by `[...]`.
- When referenced cells change, recompute and refresh text-formula cells.
- During template “linking” for multi-added items, cellIds may be rewritten; text-formula placeholders must be rewritten consistently.

**iOS source of truth**

- `ContractDataBodyCellItem.swift`
- parsing `textFormulaPlaceHolders` and `textFormulaWithPlaceHolders`
- `updateCellIds(with:)` (placeholder rewrite for duplicated rows)
- `AddedContractObject.swift`
- `createNewReturnValue(forTextFormulaCellItem:)`, `updateCellItemValue(usingTextFormula:...)`
- `refreshTextFormulaValues(...)`
- `ContractObjectManager.swift`
- `updateTextFormulaValue(for:cellIds:)` and `updateCellIdsInTextFormula(...)` (linking-time rewrite)

### 9) Body sections that can “add multiple” (duplicate / reorder / delete)

**Behavior requirements**

- If a section has `canAddMultiple == true`, user can:
- add a new row (copy template row but not necessarily its entered values)
- reorder rows within the section
- delete rows (with constraints matching iOS)
- copy a row including entered values (swipe action)
- clear a detail-cell row (swipe action) which clears nested values and resets `hasBeenAdded`

**iOS source of truth**

- `ContractDataGroupBodySection.swift` (`canAddMultiple`)
- `SinglePageContractFormTableViewController.m`
- `-headerView:didSelectButton:` (add row behavior)
- swipe actions: `tappedCopyForIndexPath`, `tappedClearForIndexPath`, `tappedDeleteForIndexPath`
- row movement: `-tableView:moveRowAtIndexPath:toIndexPath:`
- `AddedContractObject.swift`
- `copyItemValueForCellItem(...)`, `deleteCellItem(...)`, `moveCellItem(...)`

### 10) Photo selector cells (values are a photo array)

**Behavior requirements**

- Users can add/remove/reorder photos attached to a cell.
- Required semantics: required photo selector must have at least one photo.
- Persist ordering (web UI can differ, but ordering must be stable and render-order preserved).

**iOS source of truth**

- `SinglePageContractFormTableViewController.m`
- `PhotoPickerTableViewCell` delegate methods (add, remove, reorder, picker)
- `AddedContractObject.swift`
- `contractPhotoObjects(for:)` and required validation handling for photo selector

### 11) Drawing/sketch cells (value is an image)

**Behavior requirements**

- If a cell is a drawing/sketch type, user can capture an image and store it as the cell’s value.
- Required semantics: required drawing cell must have an image.

**iOS source of truth**

- `SinglePageContractFormTableViewController.m`
- `-showDrawingCaptureView:title:` and `SketchPadViewControllerDelegate`
- `AddedContractObject.swift`
- `imageValue(for:)` and required validation logic

### 12) Linked values (cross-document propagation)

**Behavior requirements**

- Cells can participate in “linked values” (a shared logical field across multiple documents/cells).
- When a linked value changes in one cell, other linked cells must update automatically (without requiring manual refresh).
- Linked values respect overwrite priority (iOS uses overwrite-priority semantics to avoid clobbering user-entered data).

**iOS source of truth**

- `ContractDataBodyCellItem.swift`
- `linkedValueSettings` parsing (only on cell types that store string user input)
- `AddedContractObject.swift`
- `updateValue(_:for:overwritePriority:)` (writes through linked value settings)
- `linkedValueChanged(_:)` (notification-driven propagation to other linked cells)
- `ContractObjectManager.swift`
- `updateLinkedValues(withPriority:)` (bulk update before send/render flows; useful parity reference)
- `ContractFormBaseTableViewController.m`
- `-leapInputTableViewCellTextForPopover:` (user messaging about linked fields)

### 13) Input types and editors (how each cell is edited)

**Behavior requirements**

- Each user-input cell must select the correct editor and formatting behavior based on `inputType`, including:
- email, phone, numeric, numeric-decimal
- currency whole / currency decimal
- date / time / date+time pickers
- picker / multi-select picker (with separator)
- size pickers (2D/3D) and “united inch” picker
- Formula and text-formula cells are non-editable labels.
- Dynamic cells select editor based on the active dynamic rule (input type/picker values can change).

**iOS source of truth**

- `ContractFormBaseTableViewController.m`
- `-setupCell:forInputType:...` and `-setupTextField:forInputType:...` (input-type → editor mapping)
- `-setupCell:forCellItem:` (dynamic input resolution for inputType/pickerValues)
- `SinglePageContractFormTableViewController.m`
- `-setupCell:forCellItem:` (special cell types: detail cell, sketch, photo selector, provia)

### 14) Detail cells (nested “detailItems” flow)

**Behavior requirements**

- A “detail cell” opens a dedicated detail editor surface for its nested `detailItems`.
- On “Done”, it validates required fields inside the detail editor, then:
- marks the parent detail cell as `hasBeenAdded = true`
- persists the parent value as the `detailLineItems` array

**iOS source of truth**

- `SinglePageContractFormTableViewController.m`
- `-tableView:didSelectRowAtIndexPath:` (routes into detail editor)
- `-detailSinglePageContractFormTableViewController:didTapDoneButton:` (validation + persist + hasBeenAdded)
- `-detailSinglePageContractFormTableViewController:didChangeValue:forCellItem:` (write-through on edits)
- `AddedContractObject.swift`
- `missingRequiredValues(fromCellItems:fromDetailCellItem:)` (detail required semantics)

## How we keep iOS parity in form filling (even with our schema)

The important point: **parity depends on runtime logic**, not on how templates are stored.We will replicate the iOS semantics using the same conceptual inputs:

- `contract_data_json` → drives sections/cells
- values keyed by stable ids (`objectId` / `cellId`) → drives formulas/dynamic rules

Key iOS behaviors to reproduce in web:

- **Required fields** (`isRequired` + dynamic required)
- **Dynamic fields** (`dynamicInputObject` with parent cellId + comparator rules)
- **Formulas** (cellId references in `formula`)
- **Detail cells** (nested `detailItems` and conditional display)
- **Text formulas** (`inputType=textFormula` with `[...]` placeholders)
- **Linked values** (cross-document propagation via `linkedValueSettings`)
- **Add-multiple sections** (`canAddMultiple` behavior: duplicate/reorder/delete rows)

We keep these in JSONB exactly as the engine expects.---

## Implementation Todos (updated to your read-only constraint)