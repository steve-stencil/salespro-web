# Price Guide Pages

## Purpose

This folder contains page-level React components for the Price Guide feature. The Price Guide allows administrators to manage Measure Sheet Items (MSIs), their pricing, and related library entities (Options, UpCharges, Additional Details).

## Structure

### Main Pages

| File                         | Route                         | Description                                                |
| ---------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `CatalogPage.tsx`            | `/price-guide`                | MSI catalog with expandable cards, search, and filtering   |
| `MsiEditPage.tsx`            | `/price-guide/:msiId`         | Single-page MSI editing with accordion sections            |
| `PricingPage.tsx`            | `/price-guide/:msiId/pricing` | Option and upcharge pricing configuration                  |
| `CreateWizard.tsx`           | `/price-guide/new`            | Multi-step wizard for creating new MSIs                    |
| `LibraryPage.tsx`            | `/price-guide/library`        | Tabbed view for Options, UpCharges, and Additional Details |
| `CategoryManagementPage.tsx` | `/price-guide/categories`     | Category tree management                                   |
| `ToolsPage.tsx`              | `/price-guide/tools`          | Import/Export tools                                        |
| `MigrationWizardPage.tsx`    | `/price-guide/tools/migrate`  | Data migration wizard                                      |

### Section Components (`sections/`)

The `MsiEditPage` uses modular section components for each accordion panel:

| File                           | Purpose                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| `BasicInfoSection.tsx`         | Name, category, measurement type, note, quantity, tag settings       |
| `OfficesSection.tsx`           | Multi-select office visibility with select all/deselect all          |
| `OptionsSection.tsx`           | Search, link, and unlink options with quick-add functionality        |
| `UpchargesSection.tsx`         | Link upcharges and configure option compatibility (disabled options) |
| `AdditionalDetailsSection.tsx` | Link custom input fields for sales reps                              |

## Patterns

### MsiEditPage Architecture

The `MsiEditPage` uses a single-page editing approach with:

1. **State Management**: `useReducer` for local state, synchronized from API data
2. **Accordion Sections**: Each section is a collapsible `MuiAccordion`
3. **Manual Save**: Single "Save Changes" button that orchestrates multiple API calls
4. **Optimistic Locking**: Uses `version` field for conflict detection

```tsx
const handleSave = async () => {
  // 1. Update basic MSI info
  await updateMsiMutation.mutateAsync({ msiId, data: {...} });

  // 2. Sync offices
  await syncOfficesMutation.mutateAsync({ msiId, officeIds: [...] });

  // 3. Sync options (link new, unlink removed)
  // 4. Sync upcharges (link new, unlink removed, update disabled options)
  // 5. Sync additional details

  navigate('/price-guide');
};
```

### Section Component Pattern

Each section receives state and action creators from the parent:

```tsx
export type BasicInfoSectionProps = {
  state: WizardState;
  setBasicInfo: (info: Partial<WizardState>) => void;
  setCategory: (categoryId: string, categoryName: string) => void;
};

export function BasicInfoSection({
  state,
  setBasicInfo,
  setCategory,
}: BasicInfoSectionProps) {
  // Renders form fields that update state via setBasicInfo
}
```

### Catalog Page Expandable Cards

The `CatalogPage` uses `EntityCard` components with expandable content:

- **Row Click**: Expands/collapses the card to show linked items
- **Stoplight Menu**: Edit, Pricing, Delete actions
- **Count Badges**: Displayed in order: Offices → Options → UpCharges (with tooltip lists)
- **Expanded Content**: Three-column grid showing:
  - **Offices**: Link/unlink offices for MSI availability
  - **Options**: Link/unlink options with navigation to Library
  - **UpCharges**: Link/unlink upcharges with navigation to Library
- **Note**: Additional Details are managed only on the MSI Edit page, not in the catalog expanded view

## Dependencies

- **WizardContext**: Shared state management for create wizard and edit page
- **usePriceGuide hooks**: Data fetching and mutations
- **upcharge-pricing components**: UpCharge pricing configuration UI

## Related

- [Components - Price Guide](../../components/price-guide/README.md)
- [Design Docs](../../../../docs/design/price-guide-ui/00-overview.md)
- [WizardContext](../../components/price-guide/wizard/WizardContext.tsx)
