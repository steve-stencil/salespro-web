# Price Guide Rebuild - UAT Test Plan

[← Back to Index](./00-index.md)

---

## Overview

This document provides step-by-step User Acceptance Testing (UAT) instructions for the Price Guide Rebuild feature set. Testers should have admin-level permissions with `price_guide:read`, `price_guide:create`, `price_guide:update`, and `price_guide:delete` access.

**Prerequisites:**

- Access to the web application with appropriate permissions
- At least one office configured in the system
- Test data or willingness to create test records

---

## 1. Navigation & Access

### 1.1 Sidebar Navigation

**Objective:** Verify Price Guide navigation menu displays correctly

| Step | Action                                               | Expected Result                                                          |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| 1    | Log in with admin credentials                        | Dashboard loads successfully                                             |
| 2    | Look for "Price Guide" in the sidebar                | Collapsible "Price Guide" menu item is visible                           |
| 3    | Click "Price Guide" to expand                        | Sub-menu expands showing: Catalog, Library, Categories, Tools, Migration |
| 4    | Click each sub-menu item                             | Each page loads without errors                                           |
| 5    | Navigate to a Price Guide page, then refresh browser | Page reloads correctly, Price Guide menu remains expanded                |

### 1.2 Permission-Based Access

**Objective:** Verify users only see pages they have permission for

| Step | Action                                      | Expected Result                                                      |
| ---- | ------------------------------------------- | -------------------------------------------------------------------- |
| 1    | Log in as user with `price_guide:read` only | Can view Catalog, Library, Categories; Tools/Migration may be hidden |
| 2    | Try to access `/price-guide/tools` directly | Access denied or redirected if no `price_guide:update` permission    |
| 3    | Log in as user with full permissions        | All Price Guide pages accessible                                     |

---

## 2. Catalog Page (`/price-guide`)

### 2.1 Page Load & Display

| Step | Action                          | Expected Result                                                                 |
| ---- | ------------------------------- | ------------------------------------------------------------------------------- |
| 1    | Navigate to `/price-guide`      | Catalog page loads with header "Price Guide Catalog"                            |
| 2    | Observe loading state           | Loading skeletons display while data loads                                      |
| 3    | Wait for data to load           | MSI cards display with name, category, measurement type, option/upcharge counts |
| 4    | Scroll down if many items exist | Infinite scroll loads more items automatically                                  |
| 5    | Scroll to bottom of list        | "End of list" message appears when all items loaded                             |

### 2.2 Search Functionality

| Step | Action                               | Expected Result                                                      |
| ---- | ------------------------------------ | -------------------------------------------------------------------- |
| 1    | Type a search term in the search box | Results filter after brief debounce delay (~300ms)                   |
| 2    | Clear the search box                 | All items display again                                              |
| 3    | Search for non-existent term         | Empty state shows "No items found" with suggestion to adjust filters |
| 4    | Click the X button in search field   | Search clears, all items return                                      |

### 2.3 Filtering

| Step | Action                                 | Expected Result                                       |
| ---- | -------------------------------------- | ----------------------------------------------------- |
| 1    | Click the Category dropdown            | List of categories appears with hierarchy indentation |
| 2    | Select a category                      | Only MSIs in that category display                    |
| 3    | Click the Office dropdown              | List of offices appears                               |
| 4    | Select an office                       | Only MSIs available in that office display            |
| 5    | Apply both category and office filters | Results filtered by both criteria                     |
| 6    | Click "Clear Filters" button           | All filters reset, full list returns                  |

### 2.4 MSI Card Interactions

| Step | Action                                | Expected Result                                          |
| ---- | ------------------------------------- | -------------------------------------------------------- |
| 1    | Click the expand arrow on an MSI card | Card expands showing View Details, Edit, Pricing buttons |
| 2    | Click the checkbox on an MSI card     | Card highlights, bulk actions toolbar appears at bottom  |
| 3    | Click the MSI name/category area      | Navigates to MSI Detail page                             |
| 4    | Click "View Details" in expanded card | Navigates to MSI Detail page                             |
| 5    | Click "Edit" in expanded card         | Navigates to Edit Wizard                                 |
| 6    | Click "Pricing" in expanded card      | Navigates to Pricing page                                |

### 2.5 Bulk Selection

| Step | Action                               | Expected Result                              |
| ---- | ------------------------------------ | -------------------------------------------- |
| 1    | Select 3 MSI cards using checkboxes  | Bulk actions toolbar shows "3 of X selected" |
| 2    | Click "Select All" toggle in toolbar | All visible MSIs selected                    |
| 3    | Click "Deselect All" or X button     | All selections cleared, toolbar disappears   |
| 4    | Press Escape key with items selected | Selection clears                             |

### 2.6 Import Button

| Step | Action                               | Expected Result                            |
| ---- | ------------------------------------ | ------------------------------------------ |
| 1    | Click "Import" button in header      | Import dialog opens                        |
| 2    | Drag a CSV/Excel file to upload area | File is accepted, shows filename and size  |
| 3    | Click "Change File"                  | Can select different file                  |
| 4    | Click "Start Import"                 | Progress indicator shows import running    |
| 5    | Wait for import to complete          | Results show imported/skipped/error counts |
| 6    | If errors, review error list         | Errors show row number, field, and message |
| 7    | Click "Done" or "Import Another"     | Dialog closes or resets for new import     |

### 2.7 Export Button

| Step | Action                                            | Expected Result                               |
| ---- | ------------------------------------------------- | --------------------------------------------- |
| 1    | Click "Export" button in header                   | Export dialog opens                           |
| 2    | Select format (CSV or Excel)                      | Radio button selects format                   |
| 3    | Choose scope (Selected/Filtered/All)              | Option selects, shows count for each          |
| 4    | Toggle include options (Options, UpCharges, etc.) | Checkboxes toggle on/off                      |
| 5    | Click "Export"                                    | Progress shows, then file downloads           |
| 6    | Open downloaded file                              | File contains expected data in correct format |

---

## 3. Bulk Operations

### 3.1 Bulk Delete

| Step | Action                             | Expected Result                         |
| ---- | ---------------------------------- | --------------------------------------- |
| 1    | Select 2+ MSIs in catalog          | Bulk toolbar appears                    |
| 2    | Click "Delete" in toolbar          | Bulk Delete confirmation dialog opens   |
| 3    | Review warning message             | Shows count of items to be deleted      |
| 4    | Click "Cancel"                     | Dialog closes, items remain selected    |
| 5    | Click "Delete" again, then confirm | Progress bar shows deletion in progress |
| 6    | Wait for completion                | Success message shows count deleted     |
| 7    | Verify items removed               | Deleted MSIs no longer appear in list   |

### 3.2 Bulk Edit

| Step | Action                                     | Expected Result                        |
| ---- | ------------------------------------------ | -------------------------------------- |
| 1    | Select 2+ MSIs in catalog                  | Bulk toolbar appears                   |
| 2    | Click "Edit" in toolbar                    | Bulk Edit dialog opens                 |
| 3    | Select "Move to different category"        | Category autocomplete appears          |
| 4    | Select a new category                      | Category selected                      |
| 5    | Click "Update X Items"                     | Progress bar shows update in progress  |
| 6    | Wait for completion                        | Success message shows count updated    |
| 7    | Select "Update office assignments"         | Office selection appears               |
| 8    | Choose "Add to offices" and select offices | Offices selected                       |
| 9    | Click "Update X Items"                     | MSIs now available in selected offices |

---

## 4. Library Page (`/price-guide/library`)

### 4.1 Tab Navigation

| Step | Action                             | Expected Result                            |
| ---- | ---------------------------------- | ------------------------------------------ |
| 1    | Navigate to `/price-guide/library` | Library page loads with Options tab active |
| 2    | Click "UpCharges" tab              | UpCharges list displays                    |
| 3    | Click "Additional Details" tab     | Additional Details list displays           |
| 4    | Click back to "Options" tab        | Options list displays again                |

### 4.2 Search Within Tabs

| Step | Action                            | Expected Result                             |
| ---- | --------------------------------- | ------------------------------------------- |
| 1    | Type in search box on Options tab | Options filter by search term               |
| 2    | Switch to UpCharges tab           | Search clears or persists (verify behavior) |
| 3    | Search on UpCharges tab           | UpCharges filter correctly                  |

### 4.3 Usage Counts

| Step | Action                          | Expected Result                                |
| ---- | ------------------------------- | ---------------------------------------------- |
| 1    | View library items              | Each item shows "Used in X MSIs" badge         |
| 2    | Click on an item with usage > 0 | "Where Used" modal or detail shows linked MSIs |

### 4.4 Create New Library Item

| Step | Action                                 | Expected Result               |
| ---- | -------------------------------------- | ----------------------------- |
| 1    | Click "Add Option" (or similar) button | Create form/dialog opens      |
| 2    | Fill in required fields (name, etc.)   | Fields accept input           |
| 3    | Click Save/Create                      | New item appears in list      |
| 4    | Repeat for UpCharge                    | New upcharge created          |
| 5    | Repeat for Additional Detail           | New additional detail created |

### 4.5 Edit Library Item

| Step | Action                       | Expected Result                     |
| ---- | ---------------------------- | ----------------------------------- |
| 1    | Click Edit on a library item | Edit form opens with current values |
| 2    | Modify a field               | Field updates                       |
| 3    | Click Save                   | Changes saved, list updates         |

### 4.6 Delete Library Item

| Step | Action                            | Expected Result                                 |
| ---- | --------------------------------- | ----------------------------------------------- |
| 1    | Click Delete on item with 0 usage | Confirmation dialog appears                     |
| 2    | Confirm deletion                  | Item removed from list                          |
| 3    | Try to delete item with usage > 0 | Warning shows it's in use, may prevent deletion |

---

## 5. Category Management (`/price-guide/categories`)

### 5.1 View Category Tree

| Step | Action                                | Expected Result                       |
| ---- | ------------------------------------- | ------------------------------------- |
| 1    | Navigate to `/price-guide/categories` | Category tree displays hierarchically |
| 2    | Click expand arrow on parent category | Child categories reveal               |
| 3    | Collapse parent category              | Children hide                         |

### 5.2 Create Category

| Step | Action                                    | Expected Result                    |
| ---- | ----------------------------------------- | ---------------------------------- |
| 1    | Click "Add Category" button               | Create dialog/form opens           |
| 2    | Enter category name                       | Name field accepts input           |
| 3    | Select parent category (optional)         | Can choose parent for nesting      |
| 4    | Click Save                                | New category appears in tree       |
| 5    | Create deeply nested category (5+ levels) | Warning appears about deep nesting |

### 5.3 Rename Category

| Step | Action                                | Expected Result       |
| ---- | ------------------------------------- | --------------------- |
| 1    | Click on category name or Edit button | Name becomes editable |
| 2    | Change the name                       | Name updates          |
| 3    | Click away or press Enter             | New name saves        |

### 5.4 Move Category (Drag and Drop)

| Step | Action                     | Expected Result                       |
| ---- | -------------------------- | ------------------------------------- |
| 1    | Drag a category            | Visual indicator shows dragging       |
| 2    | Drop onto another category | Category moves as child of target     |
| 3    | Drop between categories    | Category reorders at that position    |
| 4    | Undo if available          | Category returns to original position |

### 5.5 Delete Category

| Step | Action                               | Expected Result                     |
| ---- | ------------------------------------ | ----------------------------------- |
| 1    | Click Delete on empty category       | Confirmation appears                |
| 2    | Confirm deletion                     | Category removed                    |
| 3    | Try to delete category with MSIs     | Warning shows MSIs will be affected |
| 4    | Try to delete category with children | Must delete or move children first  |

---

## 6. Create Wizard (`/price-guide/create`)

### 6.1 Step 1: Basic Info

| Step | Action                              | Expected Result                                   |
| ---- | ----------------------------------- | ------------------------------------------------- |
| 1    | Navigate to `/price-guide/create`   | Wizard opens on Step 1                            |
| 2    | Enter MSI name                      | Name field accepts input                          |
| 3    | Select a category from autocomplete | Category selected                                 |
| 4    | Select measurement type             | Dropdown shows options (SqFt, Linear, Unit, etc.) |
| 5    | Add tags (if available)             | Tags field accepts multiple values                |
| 6    | Click Next without required fields  | Validation errors display                         |
| 7    | Fill required fields, click Next    | Advances to Step 2                                |

### 6.2 Step 2: Link Options

| Step | Action                                 | Expected Result                       |
| ---- | -------------------------------------- | ------------------------------------- |
| 1    | View available options list            | Library options display with search   |
| 2    | Search for an option                   | Results filter                        |
| 3    | Click option to add it                 | Option moves to selected list         |
| 4    | Remove an option                       | Option returns to available list      |
| 5    | Click "Quick Add" to create new option | Inline form appears                   |
| 6    | Create new option                      | New option created and selected       |
| 7    | Click Next                             | Advances to Step 3                    |
| 8    | Click Previous                         | Returns to Step 1 with data preserved |

### 6.3 Step 3: Link UpCharges

| Step | Action                                        | Expected Result                                         |
| ---- | --------------------------------------------- | ------------------------------------------------------- |
| 1    | Search and select upcharges                   | UpCharges added to selection                            |
| 2    | For each upcharge, configure disabled options | Can select which options this upcharge doesn't apply to |
| 3    | Quick add new upcharge                        | New upcharge created inline                             |
| 4    | Click Next                                    | Advances to Step 4                                      |

### 6.4 Step 4: Additional Details

| Step | Action                                     | Expected Result     |
| ---- | ------------------------------------------ | ------------------- |
| 1    | Search and select additional detail fields | Fields added to MSI |
| 2    | Quick add new field                        | New field created   |
| 3    | Click Next                                 | Advances to Step 5  |

### 6.5 Step 5: Pricing

| Step | Action                                           | Expected Result                                       |
| ---- | ------------------------------------------------ | ----------------------------------------------------- |
| 1    | View pricing grid                                | Grid shows offices as rows, price types as columns    |
| 2    | Enter price for an option in an office/type cell | Price accepts decimal input                           |
| 3    | Tab through cells                                | Can navigate grid with keyboard                       |
| 4    | Leave some cells empty                           | Empty cells allowed (no pricing for that combination) |
| 5    | Click Next                                       | Advances to Step 6                                    |

### 6.6 Step 6: Review & Create

| Step | Action                         | Expected Result                                                   |
| ---- | ------------------------------ | ----------------------------------------------------------------- |
| 1    | View review summary            | Shows all selections: name, category, options, upcharges, pricing |
| 2    | Verify all information correct | Data matches what was entered                                     |
| 3    | Click "Create"                 | MSI creation begins                                               |
| 4    | Wait for completion            | Success message displays                                          |
| 5    | Navigate to Catalog            | New MSI appears in list                                           |

### 6.7 Wizard State Persistence

| Step | Action                          | Expected Result                      |
| ---- | ------------------------------- | ------------------------------------ |
| 1    | Fill out Steps 1-3              | Data entered                         |
| 2    | Click Previous multiple times   | Can go back through steps            |
| 3    | Data still present on each step | No data lost when navigating         |
| 4    | Click browser back button       | Warning may appear about losing data |

---

## 7. MSI Detail Page (`/price-guide/:msiId`)

### 7.1 View Details

| Step | Action                          | Expected Result                          |
| ---- | ------------------------------- | ---------------------------------------- |
| 1    | Click on an MSI in Catalog      | Detail page loads                        |
| 2    | Verify header shows MSI name    | Correct name displayed                   |
| 3    | View Basic Info section         | Category, measurement type, tags visible |
| 4    | View Options section            | Linked options listed with names         |
| 5    | View UpCharges section          | Linked upcharges listed                  |
| 6    | View Additional Details section | Additional detail fields shown           |
| 7    | View Offices section            | Shows which offices have this MSI        |

### 7.2 Action Buttons

| Step | Action                   | Expected Result                  |
| ---- | ------------------------ | -------------------------------- |
| 1    | Click "Edit" button      | Navigates to Edit Wizard         |
| 2    | Click "Pricing" button   | Navigates to Pricing page        |
| 3    | Click "Duplicate" button | Duplicate dialog opens           |
| 4    | Click "Delete" button    | Delete confirmation dialog opens |

### 7.3 Duplicate MSI

| Step | Action                     | Expected Result                |
| ---- | -------------------------- | ------------------------------ |
| 1    | Click "Duplicate"          | Dialog opens with copy options |
| 2    | Enter new name             | Name field accepts input       |
| 3    | Toggle "Include Options"   | Checkbox toggles               |
| 4    | Toggle "Include UpCharges" | Checkbox toggles               |
| 5    | Toggle "Include Pricing"   | Checkbox toggles               |
| 6    | Click "Duplicate"          | New MSI created                |
| 7    | Verify redirect to new MSI | New MSI detail page shows      |

### 7.4 Delete MSI

| Step | Action                             | Expected Result                  |
| ---- | ---------------------------------- | -------------------------------- |
| 1    | Click "Delete"                     | Confirmation dialog opens        |
| 2    | Type MSI name to confirm           | Must type exact name             |
| 3    | Click "Delete" with incorrect name | Button remains disabled          |
| 4    | Type correct name                  | Button enables                   |
| 5    | Click "Delete"                     | MSI deleted, redirect to Catalog |
| 6    | Verify MSI no longer in Catalog    | Deleted MSI not found            |

---

## 8. Edit Wizard (`/price-guide/:msiId/edit`)

### 8.1 Load Existing Data

| Step | Action                                   | Expected Result                    |
| ---- | ---------------------------------------- | ---------------------------------- |
| 1    | Navigate to Edit Wizard for existing MSI | Wizard loads with current data     |
| 2    | Verify Step 1 has current name/category  | Pre-populated correctly            |
| 3    | Navigate through all steps               | Each step shows current selections |

### 8.2 Make Changes

| Step | Action                  | Expected Result           |
| ---- | ----------------------- | ------------------------- |
| 1    | Change MSI name         | Name updates              |
| 2    | Add new option          | Option added to selection |
| 3    | Remove existing option  | Option removed            |
| 4    | Navigate to Review step | Shows all changes         |
| 5    | Click "Save Changes"    | Updates saved             |
| 6    | View MSI Detail page    | Changes reflected         |

### 8.3 Concurrent Edit Detection

| Step | Action                            | Expected Result                       |
| ---- | --------------------------------- | ------------------------------------- |
| 1    | Open same MSI in two browser tabs | Both load successfully                |
| 2    | Make change in Tab 1, save        | Save succeeds                         |
| 3    | Make change in Tab 2, save        | Conflict resolution dialog appears    |
| 4    | Choose "Reload" option            | Latest data loads                     |
| 5    | Choose "Discard" option           | Edits discarded, dialog closes        |
| 6    | Choose "Force Save" option        | Warning about overwriting, then saves |

---

## 9. Pricing Page (`/price-guide/:msiId/pricing`)

### 9.1 View Pricing Grid

| Step | Action                            | Expected Result                                          |
| ---- | --------------------------------- | -------------------------------------------------------- |
| 1    | Navigate to Pricing page for MSI  | Pricing grid displays                                    |
| 2    | View tabs for Options/UpCharges   | Tabs allow switching between option and upcharge pricing |
| 3    | Grid shows offices as rows        | Office names in first column                             |
| 4    | Grid shows price types as columns | Price type codes as headers                              |

### 9.2 Edit Prices

| Step | Action                        | Expected Result               |
| ---- | ----------------------------- | ----------------------------- |
| 1    | Click on a price cell         | Cell becomes editable         |
| 2    | Enter new price               | Price updates                 |
| 3    | Press Tab                     | Moves to next cell            |
| 4    | Press Enter                   | Saves current cell            |
| 5    | Enter invalid value (letters) | Validation error or rejection |
| 6    | Click "Save" button           | All changes saved             |

### 9.3 Bulk Price Operations

| Step | Action                      | Expected Result                             |
| ---- | --------------------------- | ------------------------------------------- |
| 1    | Select "Copy from Office"   | Source office dropdown appears              |
| 2    | Select source office        | Prices from source office copied to current |
| 3    | Apply percentage adjustment | All prices adjust by percentage             |

---

## 10. Tools Page (`/price-guide/tools`)

### 10.1 Mass Price Change Tab

| Step | Action                             | Expected Result                           |
| ---- | ---------------------------------- | ----------------------------------------- |
| 1    | Navigate to `/price-guide/tools`   | Tools page loads on Mass Price Change tab |
| 2    | Select "Percentage" change type    | Percentage option selected                |
| 3    | Select "Fixed Amount" change type  | Fixed amount option selected              |
| 4    | Select scope (All/Category/Office) | Scope options work correctly              |
| 5    | Enter change amount (e.g., 10%)    | Amount field accepts input                |
| 6    | Click "Apply Changes"              | Progress bar shows operation running      |
| 7    | Wait for completion                | Success message shows count updated       |

### 10.2 Price Types Tab

| Step | Action                            | Expected Result                            |
| ---- | --------------------------------- | ------------------------------------------ |
| 1    | Click "Price Types" tab           | Price types list displays                  |
| 2    | View existing price types         | Shows code, name, global flag, usage count |
| 3    | Enter new type code               | Code converts to uppercase                 |
| 4    | Enter display name                | Name accepts input                         |
| 5    | Click "Add Type"                  | New type appears in list                   |
| 6    | Try to delete type with usage > 0 | Warning or prevention                      |
| 7    | Delete type with 0 usage          | Type removed                               |

### 10.3 Validation Tab

| Step | Action                   | Expected Result                        |
| ---- | ------------------------ | -------------------------------------- |
| 1    | Click "Validation" tab   | Validation panel displays              |
| 2    | Click "Run Validation"   | Progress indicator shows               |
| 3    | Wait for completion      | Results display by category            |
| 4    | View errors              | Red error icons with descriptions      |
| 5    | View warnings            | Yellow warning icons with descriptions |
| 6    | Click "View" on an issue | Shows affected items                   |
| 7    | Click "Run Again"        | Re-runs validation                     |

---

## 11. Migration Wizard (`/price-guide/migration`)

### 11.1 Initial Load

| Step | Action                               | Expected Result               |
| ---- | ------------------------------------ | ----------------------------- |
| 1    | Navigate to `/price-guide/migration` | Migration wizard loads        |
| 2    | View stepper at top                  | Shows all 7 steps with labels |
| 3    | First step (Price Types) is active   | Step 1 content displays       |
| 4    | View progress indicator              | Shows "0 / 7 Complete"        |

### 11.2 Execute Each Step

| Step | Action                              | Expected Result                       |
| ---- | ----------------------------------- | ------------------------------------- |
| 1    | View Step 1: Price Types preview    | Shows items to migrate count          |
| 2    | Click "Migrate Price Types"         | Progress bar runs                     |
| 3    | Wait for completion                 | Success message, step marked complete |
| 4    | Click "Next Step"                   | Advances to Step 2: Categories        |
| 5    | Repeat for all 7 steps              | Each step runs and completes          |
| 6    | Final step shows validation results | Any warnings/errors from validation   |

### 11.3 Step Navigation

| Step | Action                               | Expected Result                      |
| ---- | ------------------------------------ | ------------------------------------ |
| 1    | Complete Steps 1-3                   | First 3 steps marked complete        |
| 2    | Click on Step 1 in stepper           | Can revisit completed step           |
| 3    | Click "Previous" button              | Goes back one step                   |
| 4    | Click "Next Step" on incomplete step | Button disabled until step completed |

### 11.4 Error Handling

| Step | Action                        | Expected Result                  |
| ---- | ----------------------------- | -------------------------------- |
| 1    | If a step has errors          | Errors display in red alert      |
| 2    | Error count shown             | "X errors" badge visible         |
| 3    | Can review error details      | Error messages are descriptive   |
| 4    | Can continue despite warnings | Next button enabled for warnings |

### 11.5 Completion

| Step | Action                     | Expected Result                     |
| ---- | -------------------------- | ----------------------------------- |
| 1    | Complete all 7 steps       | "Complete Migration" button enables |
| 2    | Click "Complete Migration" | Success banner displays             |
| 3    | Banner suggests next steps | Links to Catalog, Library, Tools    |

---

## 12. Error Handling & Edge Cases

### 12.1 Network Errors

| Step | Action                             | Expected Result           |
| ---- | ---------------------------------- | ------------------------- |
| 1    | Disable network, try to load page  | Error message displays    |
| 2    | Re-enable network, click retry     | Page loads correctly      |
| 3    | Lose network during save operation | Error toast/alert appears |

### 12.2 Session Timeout

| Step | Action             | Expected Result                      |
| ---- | ------------------ | ------------------------------------ |
| 1    | Let session expire | Redirect to login on next action     |
| 2    | Log back in        | Return to previous page or dashboard |

### 12.3 Invalid URLs

| Step | Action                                | Expected Result            |
| ---- | ------------------------------------- | -------------------------- |
| 1    | Navigate to `/price-guide/invalid-id` | 404 or "Not Found" message |
| 2    | Navigate to deleted MSI URL           | "Item not found" message   |

### 12.4 Empty States

| Step | Action                       | Expected Result                             |
| ---- | ---------------------------- | ------------------------------------------- |
| 1    | View Catalog with no MSIs    | Empty state with "Create First Item" button |
| 2    | View Library with no options | Empty state message                         |
| 3    | Search with no results       | "No items found" with suggestion            |

---

## 13. Keyboard Navigation

### 13.1 Catalog Page Shortcuts

| Shortcut        | Action          | Expected Result                         |
| --------------- | --------------- | --------------------------------------- |
| `/` or `Ctrl+K` | Focus search    | Search input focused                    |
| `n`             | New item        | Navigates to create wizard              |
| `Ctrl+A`        | Select all      | All visible items selected              |
| `Escape`        | Clear selection | Selections cleared                      |
| `Delete`        | Delete selected | Delete dialog opens (if items selected) |

### 13.2 Form Navigation

| Shortcut    | Action         | Expected Result                |
| ----------- | -------------- | ------------------------------ |
| `Tab`       | Next field     | Focus moves to next input      |
| `Shift+Tab` | Previous field | Focus moves to previous input  |
| `Enter`     | Submit/Next    | Form submits or advances       |
| `Escape`    | Cancel         | Dialog closes or cancel action |

### 13.3 Wizard Navigation

| Shortcut     | Action        | Expected Result            |
| ------------ | ------------- | -------------------------- |
| `Ctrl+Enter` | Next step     | Advances to next step      |
| `Alt+Left`   | Previous step | Goes to previous step      |
| `Ctrl+S`     | Save          | Saves and completes wizard |

---

## 14. Responsive Design

### 14.1 Mobile View (< 768px)

| Step | Action                 | Expected Result                |
| ---- | ---------------------- | ------------------------------ |
| 1    | View Catalog on mobile | Cards stack vertically         |
| 2    | Open sidebar           | Drawer overlays content        |
| 3    | Use filters            | Filters stack or use accordion |
| 4    | Bulk toolbar           | Toolbar fits on small screen   |

### 14.2 Tablet View (768px - 1024px)

| Step | Action                 | Expected Result                     |
| ---- | ---------------------- | ----------------------------------- |
| 1    | View Catalog on tablet | Layout adapts appropriately         |
| 2    | Use pricing grid       | Grid scrolls horizontally if needed |

---

## 15. Performance

### 15.1 Large Data Sets

| Step | Action                              | Expected Result               |
| ---- | ----------------------------------- | ----------------------------- |
| 1    | Load Catalog with 500+ MSIs         | Page loads within 3 seconds   |
| 2    | Scroll through list                 | Smooth scrolling, no lag      |
| 3    | Search in large catalog             | Results return within 500ms   |
| 4    | Open pricing grid with many offices | Grid renders without freezing |

### 15.2 Bulk Operations

| Step | Action                           | Expected Result                             |
| ---- | -------------------------------- | ------------------------------------------- |
| 1    | Select 100 items for bulk delete | Operation completes within 30 seconds       |
| 2    | Mass price change on 1000 items  | Progress shows, completes within 60 seconds |

---

## Sign-Off Checklist

Before signing off on UAT, verify:

- [ ] All navigation items accessible and functional
- [ ] Catalog page loads, searches, and filters correctly
- [ ] Bulk operations (select, delete, edit, export) work
- [ ] Import accepts files and processes correctly
- [ ] Library page shows all tabs with CRUD operations
- [ ] Category management with drag-and-drop works
- [ ] Create Wizard completes all 6 steps successfully
- [ ] Edit Wizard loads existing data and saves changes
- [ ] MSI Detail page shows all information
- [ ] Duplicate and Delete MSI work correctly
- [ ] Pricing page allows editing prices
- [ ] Tools page: Mass Price Change executes
- [ ] Tools page: Price Types can be added/removed
- [ ] Tools page: Validation runs and shows results
- [ ] Migration Wizard completes all 7 steps
- [ ] Error messages are user-friendly
- [ ] Keyboard shortcuts function
- [ ] Mobile/responsive layouts work

---

## Issue Reporting

When reporting issues, include:

1. **Browser and version** (e.g., Chrome 120)
2. **Steps to reproduce**
3. **Expected result**
4. **Actual result**
5. **Screenshots or video if applicable**
6. **Console errors** (if any)
7. **User role/permissions**

---

## Related Documentation

- [00-index.md](./00-index.md) - Main plan overview
- [04-ui-specifications.md](./04-ui-specifications.md) - UI design specs
- [06-implementation-phases.md](./06-implementation-phases.md) - Feature timeline
