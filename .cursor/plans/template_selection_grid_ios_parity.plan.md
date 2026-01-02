# Document Template Selection Grid - iOS Parity Plan

**Objective**: Implement the document template selection grid UI that matches iOS behavior.**Parity principle**: Match iOS behavior exactly, but implement with maintainable, testable web architecture.---

## Overview

When users navigate to the Documents section (`/mobile/documents/:estimateId`), they should see a grid of selectable template tiles organized by category. This is the **entry point** for the entire document workflow.---

## iOS Source Files Reference

The following iOS files contain the source of truth for this feature:| File | Purpose ||------|---------|| `leap-one/Estimate Pro/ContractObjectSelectionCollectionViewController.m` | Main view controller - grid display, selection, actions || `leap-one/Estimate Pro/ContractObjectSelectionCollectionViewController.h` | Header with property definitions || `leap-one/Estimate Pro/ContractPagesSelectionTableViewCell.m` | Individual tile cell - thumbnail, label, stepper || `leap-one/Estimate Pro/ContractPagesSelectionTableViewCell.h` | Cell header with IBOutlets || `leap-one/Estimate Pro/ContractObject.swift` | Document template model || `leap-one/Estimate Pro/ContractObjectManager.swift` | Document management and state || `leap-one/Estimate Pro/CollectionHeaderView.swift` | Category section header || `leap-one/Estimate Pro/PDFThumbnailUtility.m` | PDF thumbnail generation |---

## Phase 1: Template Grid Layout & Display

### 1.1 Grid Container Component

- [ ] **Create `DocumentTemplateGrid` component**
- Responsive grid layout (CSS Grid or MUI Grid)
- Sections for each category with collapsible headers
- Instruction text: "Tap the templates you want to include in your document"

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-viewDidLoad` (lines ~106-131)
- Look for: `heading.text = @"Tap the templates you want to include in your document"`
- Look for: `collectionView.contentInset`, collection view setup

### 1.2 Category Sections

- [ ] **Create `DocumentCategorySection` component**
- Category header with name and collapse toggle
- Grid of template tiles within the category
- Support for "Imported" category for user-uploaded PDFs

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-numberOfSectionsInCollectionView:` (line ~1016)
- Method: `-collectionView:viewForSupplementaryElementOfKind:atIndexPath:` (lines ~1029-1060)
- File: `CollectionHeaderView.swift` - header view implementation
- Look for: `self.categories` array, `CollectionHeaderView` class

### 1.3 Template Tile Component

- [ ] **Create `DocumentTemplateTile` component**
- Thumbnail image display (PDF preview or icon)
- Template name label
- Selection state indicator (checkmark overlay when selected)
- Page count badge (for multi-page templates: "2 Added")
- Loading state for thumbnail fetch

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-collectionView:cellForItemAtIndexPath:` (lines ~1066-1122)
- File: `ContractPagesSelectionTableViewCell.m` - full cell implementation
- Look for: `cell.imageView.image`, `cell.lblName.text`, `cell.lblTemplateCount`
- Look for: `object.thumbnailImage`, `object.iconImage`, `cell.stepper`

---

## Phase 2: Template Data & State Management

### 2.1 Template Types

- [ ] **Define TypeScript types** in `types/document.ts`

```typescript
type DocumentTemplate = {
  id: string;
  objectId: string;
  displayName: string;
  category: string;
  categoryId: string;
  thumbnailUrl?: string;
  iconUrl?: string;
  canAddMultiplePages: boolean;
  pageCount: number;
  isRequired: boolean;
  sortOrder: number;
  pageId: string;
  photosPerPage: number;
};

type DocumentCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isCollapsed: boolean;
};
```

**iOS reference**:

- File: `ContractObject.swift`
- Look for: `class ContractObject` properties
- Properties: `objectId`, `displayName`, `category`, `canAddMultiplePages`, `thumbnailImage`, `iconImage`, `pageId`, `photosPerPage`

### 2.2 API Integration

- [ ] **Implement template loading API**
- Endpoint: `GET /documents/:estimateId/templates`
- Returns: categories, templates, config

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-loadContracts` (lines ~251-330) - fetches templates from Parse
- Method: `-sortContracts` (lines ~331-400) - organizes by category
- Look for: `PFQuery`, `fromPin`, `pinName`, category sorting logic

### 2.3 Selection State

- [ ] **Enhance `useDocumentTemplates` hook**
- Track selected template IDs (Set)
- Track page counts for multi-page templates (Map)
- `toggleTemplate(id)` - single page templates
- `setTemplatePageCount(id, count)` - multi-page templates
- `selectCategory(categoryId)` / `deselectCategory(categoryId)`
- `clearSelection()`

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-collectionView:didSelectItemAtIndexPath:` (lines ~1127-1200)
- File: `ContractObjectManager.swift`
- Look for: `addContractObject:`, `removeContractObject:`, selection tracking

---

## Phase 3: Selection Interactions

### 3.1 Single-Page Template Selection

- [ ] **Tap to toggle selection**
- Visual feedback on tap (ripple/highlight)
- Checkmark overlay appears when selected
- Update selection count in header

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-collectionView:didSelectItemAtIndexPath:` (lines ~1127-1200)
- Look for: cell selection logic, `isSelected` state
- Look for: `LogObject addLogWithNote:` for analytics

### 3.2 Multi-Page Template Selection

- [ ] **Stepper control for page count**
- Show stepper when `canAddMultiplePages: true`
- Increment/decrement page count
- Badge shows count: "2 Added"
- Remove from selection when count reaches 0

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-contractPagesSelectionTableViewCell:didChangeStepperValue:` (lines ~1200-1280)
- File: `ContractPagesSelectionTableViewCell.m`
- Look for: `cell.stepper`, `UIStepper`, `lblTemplateCount.text`
- Look for: `@"%li %@",(long)count, @"Added"` format string

### 3.3 Selection Summary

- [ ] **Update header/toolbar with selection status**
- "{X} of {Y} templates selected"
- Enable/disable NEXT button based on selection

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Look for: `nextButton.enabled` assignments
- Look for: `saveButton.enabled` assignments
- Method: `-updateButtonStates` or similar

---

## Phase 4: Action Bar

### 4.1 Top Action Buttons

- [ ] **NEXT button**
- Enabled when at least one template selected
- Navigates to form/preview step

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-nextButtonTapped:` (search for this selector)
- Method: `-addBarButtonItems` (lines ~133-171) - button setup
- Look for: `LeapBarButtonItem barButtonItemWithTitle:@"NEXT"`
- [ ] **ADD FROM DEVICE button** (out of scope - see checklist)

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-addDocumentTapped:` (lines ~920-960)
- Method: `-documentPicker:didPickDocumentsAtURLs:` (lines ~961-1010)
- Look for: `UIDocumentPickerViewController`, `UTType`
- [ ] **SAVE button** (out of scope - see checklist)

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-saveButtonTapped:` (search for selector)
- Method: `-showSaveDraftAlertOn:sender:` (search for method)
- [ ] **OPEN button** (out of scope - see checklist)

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-openButtonTapped:` (search for selector)
- Look for: `SavedTemplatesTableViewController`, segue handling
- [ ] **SORT button** (iPad only)
- Toggle alphabetic vs custom sort

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-sortButtonTapped:` (search for selector)
- Property: `sortAlphabetic` (line ~77)
- Look for: `SortContractsAlphabetic` user defaults key

---

## Phase 5: Loading & Empty States

### 5.1 Loading State

- [ ] **Skeleton loading for grid**
- Show placeholder tiles while loading
- Loading indicator in header

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Property: `isLoading` (line ~68)
- Look for: `MBProgressHUD` usage

### 5.2 Empty State

- [ ] **No templates available**
- Friendly message if no templates configured
- Refresh button to retry

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Look for: empty state handling in `-loadContracts`
- Look for: `refreshButton` IBOutlet

### 5.3 Error State

- [ ] **API error handling**
- Error message with retry option
- Offline indicator if applicable

---

## Phase 6: Offline Support (Future)

- [ ] **Cache templates for offline use**
- Store template metadata in IndexedDB
- Cache thumbnail images

**iOS reference**:

- File: `ContractObjectSelectionCollectionViewController.m`
- Method: `-loadContracts`
- Look for: `fromPin`, `pinName`, `kPinContracts` constant
- Look for: Parse local datastore pinning

---

## Implementation Checklist

### Components to Create

- [ ] `src/features/mobile/components/DocumentTemplateGrid.tsx`
- [ ] `src/features/mobile/components/DocumentCategorySection.tsx`
- [ ] `src/features/mobile/components/DocumentTemplateTile.tsx`
- [ ] `src/features/mobile/components/DocumentActionBar.tsx`
- [ ] `src/features/mobile/components/DocumentTemplateStepper.tsx`

### Types to Update/Create

- [ ] `src/features/mobile/types/document.ts` - template and category types

### Hooks to Update

- [ ] `src/features/mobile/hooks/useDocumentTemplates.ts` - selection logic

### Services to Update

- [ ] `src/features/mobile/services/document.ts` - template API calls

### Pages to Update

- [ ] `src/features/mobile/pages/DocumentSelectionPage.tsx` - integrate grid

---

## iOS Method to Web Equivalent Mapping

| iOS Method/Property | Location | Web Equivalent ||---------------------|----------|----------------|| `-viewDidLoad` | `ContractObjectSelectionCollectionViewController.m:106` | Component mount || `-loadContracts` | `ContractObjectSelectionCollectionViewController.m:251` | `useDocumentTemplates` query || `-sortContracts` | `ContractObjectSelectionCollectionViewController.m:331` | Category sorting logic || `-numberOfSectionsInCollectionView:` | `ContractObjectSelectionCollectionViewController.m:1016` | Categories array length || `-numberOfItemsInSection:` | `ContractObjectSelectionCollectionViewController.m:1022` | Templates per category || `-cellForItemAtIndexPath:` | `ContractObjectSelectionCollectionViewController.m:1066` | `DocumentTemplateTile` render || `-didSelectItemAtIndexPath:` | `ContractObjectSelectionCollectionViewController.m:1127` | `toggleTemplate` handler || `-didChangeStepperValue:` | `ContractObjectSelectionCollectionViewController.m:1200` | Stepper onChange || `ContractPagesSelectionTableViewCell` | `ContractPagesSelectionTableViewCell.m` | `DocumentTemplateTile` || `CollectionHeaderView` | `CollectionHeaderView.swift` | `DocumentCategorySection` header || `ContractObject` | `ContractObject.swift` | `DocumentTemplate` type || `ContractObjectManager` | `ContractObjectManager.swift` | Selection state hook |---

## Acceptance Criteria

1. **Grid displays** - Templates shown as tiles in a responsive grid
2. **Categories work** - Templates grouped by category with headers
3. **Selection works** - Tapping tiles toggles selection with visual feedback
4. **Multi-page works** - Stepper increments/decrements page count
5. **Count updates** - Header shows "X of Y templates selected"
6. **NEXT enabled** - Button enabled only when templates selected
7. **Loading state** - Skeleton shown while fetching templates
8. **Error handling** - Graceful error display with retry

---

## Related Files

- **Out of scope items**: See `readonlytemplates_out_of_scope_parity_checklist.plan.md`
- **iOS main controller**: `leap-one/Estimate Pro/ContractObjectSelectionCollectionViewController.m`
- **iOS cell view**: `leap-one/Estimate Pro/ContractPagesSelectionTableViewCell.m`
- **iOS model**: `leap-one/Estimate Pro/ContractObject.swift`
