# Price Guide Components

## Purpose

This folder contains reusable React components for the Price Guide feature. These components handle the UI for managing Measure Sheet Items (MSIs), Options, UpCharges, Additional Details, and their relationships.

## Structure

### Core Display Components

| Component             | Description                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `EntityCard/`         | Expandable card for displaying MSIs, Options, and UpCharges in list views                        |
| `LinkedItemsList/`    | Displays linked items (Offices, Options, UpCharges, Additional Details) with link/unlink actions |
| `RelationshipBadges/` | Count badges and status indicators for entity relationships                                      |
| `LoadingStates.tsx`   | Skeleton loaders and empty states for consistent loading UX                                      |

### Linking & Selection

| Component        | Description                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `LinkPicker/`    | Modal for selecting items to link (supports Offices, Options, UpCharges, Additional Details) |
| `ImpactWarning/` | Confirmation dialogs for edit, delete, and unlink operations                                 |

### Bulk Operations

| Component                | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `BulkActionsToolbar.tsx` | Floating toolbar for bulk selection actions    |
| `BulkDeleteDialog.tsx`   | Confirmation dialog for bulk delete operations |
| `BulkEditDialog.tsx`     | Dialog for bulk editing MSI properties         |
| `ExportDialog.tsx`       | Export configuration dialog                    |
| `ImportDialog.tsx`       | Import file upload and preview dialog          |

### Dialogs & Modals

| Component                     | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `DeleteMsiDialog.tsx`         | Single MSI delete confirmation                  |
| `DuplicateMsiDialog.tsx`      | MSI duplication with name input                 |
| `ConflictResolutionModal.tsx` | Handles optimistic locking conflicts            |
| `JobProgressModal.tsx`        | Progress indicator for long-running operations  |
| `WhereUsedModal.tsx`          | Shows where an entity is used across the system |

### Pricing Components

| Component           | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `PricingGrid.tsx`   | Grid for editing option prices across offices and price types   |
| `upcharge-pricing/` | Complex upcharge pricing configuration (fixed/percentage modes) |

### Wizard Components (`wizard/`)

Step components for the MSI creation wizard:

| Component                   | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `WizardContext.tsx`         | Shared state management for wizard and edit page   |
| `BasicInfoStep.tsx`         | Name, category, measurement type configuration     |
| `LinkOptionsStep.tsx`       | Option selection step                              |
| `LinkUpChargesStep.tsx`     | UpCharge selection and compatibility configuration |
| `AdditionalDetailsStep.tsx` | Additional detail field selection                  |
| `PricingStep.tsx`           | Initial pricing configuration                      |
| `ReviewStep.tsx`            | Final review before creation                       |

### Utilities

| Component                     | Description                          |
| ----------------------------- | ------------------------------------ |
| `MsiThumbnailUpload.tsx`      | Thumbnail image upload with preview  |
| `PriceGuideErrorBoundary.tsx` | Error boundary with recovery options |
| `PriceGuideToast.tsx`         | Toast notification provider and hook |

## Patterns

### EntityCard with Expandable Content

The `EntityCard` component displays entities in a consistent format with optional expandable content:

```tsx
import {
  EntityCard,
  CountBadge,
  LinkedItemsList,
} from '../components/price-guide';

<EntityCard
  entityType="msi"
  name={msi.name}
  subtitle={msi.category.fullPath}
  thumbnailUrl={msi.thumbnailUrl}
  isExpanded={isExpanded}
  onToggleExpand={handleToggle}
  badges={
    <>
      <CountBadge
        count={msi.officeCount}
        variant="office"
        items={msi.officeNames}
      />
      <CountBadge
        count={msi.optionCount}
        variant="option"
        items={msi.optionNames}
      />
      <CountBadge
        count={msi.upchargeCount}
        variant="upcharge"
        items={msi.upchargeNames}
      />
    </>
  }
  expandedContent={<MsiExpandedContent msiId={msi.id} />}
  menuActions={[
    { label: 'Edit', onClick: handleEdit, icon: <EditIcon /> },
    {
      label: 'Delete',
      onClick: handleDelete,
      icon: <DeleteIcon />,
      color: 'error',
    },
  ]}
/>;
```

### LinkedItemsList for Relationship Display

Displays linked items with link/unlink capabilities:

```tsx
import { LinkedItemsList } from '../components/price-guide';

// Offices, Options, and UpCharges in expanded content
<LinkedItemsList
  title="Offices"
  itemType="office"
  items={offices}
  isLoading={isLoading}
  onLinkClick={() => openLinkPicker('office')}
  onUnlinkItem={officeId => handleUnlinkOffice(officeId)}
/>;
```

**Supported item types:**

- `'office'` - Office availability
- `'option'` - Linked options
- `'upcharge'` - Linked upcharges
- `'additionalDetail'` - Linked custom fields

### LinkPicker for Item Selection

Modal dialog for selecting items to link:

```tsx
import { LinkPicker } from '../components/price-guide';

<LinkPicker
  open={isOpen}
  itemType="office" // 'office' | 'option' | 'upcharge' | 'additionalDetail'
  items={availableItems}
  alreadyLinkedIds={linkedIds}
  isLoading={isLoading}
  hasMore={hasNextPage}
  onLoadMore={fetchNextPage}
  onSearch={setSearchQuery}
  onClose={handleClose}
  onLink={handleLink}
  isLinking={isPending}
/>;
```

### Confirmation Dialogs

Use `UnlinkConfirmation` for unlink operations:

```tsx
import { UnlinkConfirmation } from '../components/price-guide';

<UnlinkConfirmation
  open={isOpen}
  itemName="Office A"
  itemType="office" // 'office' | 'option' | 'upcharge' | 'additionalDetail'
  msiName="Window Installation"
  onCancel={handleCancel}
  onConfirm={handleConfirm}
  isLoading={isPending}
/>;
```

### RelationshipBadges

Display counts and status with tooltips:

```tsx
import { CountBadge, UsageCountBadge, PricingStatusBadge } from '../components/price-guide';

// Count badge with tooltip showing item names
<CountBadge count={5} variant="office" items={['Office A', 'Office B', ...]} />

// Usage count showing how many MSIs use this item
<UsageCountBadge count={12} />

// Pricing status indicator
<PricingStatusBadge status="complete" />
```

**CountBadge variants:** `'office'` | `'option'` | `'upcharge'` | `'detail'`

## Dependencies

- **MUI Components**: Material UI for all UI elements
- **@tanstack/react-query**: Data fetching integration via parent components
- **@shared/types**: Shared type definitions for entities
- **react-router-dom**: Navigation from cards to detail pages

## Related

- [Pages - Price Guide](../../pages/price-guide/README.md)
- [Hooks - usePriceGuide](../../hooks/usePriceGuide.ts)
- [Services - price-guide](../../services/price-guide.ts)
- [Shared Types](../../../../../packages/shared/src/types/price-guide.ts)
- [Design Docs](../../../../../docs/design/price-guide-ui/00-overview.md)

