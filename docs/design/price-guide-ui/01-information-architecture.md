# Price Guide UI Design - Information Architecture

[← Back to Overview](./00-overview.md)

---

## Navigation Structure

### Primary Navigation

The Price Guide is a section within the dashboard. The primary navigation provides entry points to the main functional areas:

```
Dashboard
├── ...other sections...
└── Price Guide
    ├── Catalog        (MSI browsing and management)
    ├── Library        (Shared Options, UpCharges, Fields)
    ├── Pricing        (Dedicated bulk pricing interface)
    ├── Categories     (Hierarchy management)
    └── Tools          (Mass operations, validation, import/export)
```

### URL Structure

```
/dashboard/price-guide
├── /catalog                              # MSI list view
│   └── /:msiId                           # MSI detail view
│       ├── /edit                         # MSI edit mode
│       └── /pricing                      # MSI-specific pricing
│
├── /library
│   ├── /options                          # Options list
│   │   ├── /new                          # Create option
│   │   └── /:optionId                    # Option detail
│   │       ├── /edit                     # Edit option
│   │       └── /pricing                  # Option pricing
│   │
│   ├── /upcharges                        # UpCharges list
│   │   ├── /new                          # Create upcharge
│   │   └── /:upchargeId                  # UpCharge detail
│   │       ├── /edit                     # Edit upcharge
│   │       └── /pricing                  # UpCharge pricing
│   │
│   └── /additional-details               # Additional Detail Fields list
│       ├── /new                          # Create field
│       └── /:fieldId                     # Field detail
│           └── /edit                     # Edit field
│
├── /pricing                              # Bulk pricing interface
│   ├── ?type=options                     # Option pricing mode
│   └── ?type=upcharges                   # UpCharge pricing mode
│
├── /categories                           # Category tree view
│
├── /tools
│   ├── /mass-price-change                # Mass price change wizard
│   ├── /import                           # Import wizard
│   ├── /export                           # Export wizard
│   ├── /validate                         # Data validation
│   └── /price-types                      # Custom price types management
│
└── /create                               # MSI creation wizard
```

---

## Page Hierarchy and Relationships

### Mental Model: The Catalog View

Users think about their price guide as a **catalog of products they sell**. The MSI is the primary entity they work with. Options, UpCharges, and Additional Details are attributes/configurations of those products.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER'S MENTAL MODEL                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  "I sell windows. Each window type has color options and can have      │
│   upgrades like Low-E glass. Prices vary by my office locations."      │
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │  MY CATALOG     │                                                    │
│  │  (Organized by  │                                                    │
│  │   Categories)   │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ├── Windows                                                   │
│           │   ├── Double Hung Window                                    │
│           │   │   ├── Options: Pella, Andersen, Generic                │
│           │   │   ├── Upgrades: Low-E, Grilles, Argon                  │
│           │   │   └── Pricing: $200-$500 depending on office           │
│           │   │                                                         │
│           │   └── Bay Window                                            │
│           │       └── ...                                               │
│           │                                                             │
│           └── Doors                                                     │
│               └── ...                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### System Reality: Shared Libraries

The data model uses shared libraries to avoid duplication. This creates a conceptual gap:

**User thinks:** "The Pella option is part of my Double Hung Window"  
**System reality:** "The PriceGuideOption 'Pella' is a standalone entity linked to multiple MSIs"

### UI Strategy: Dual Entry Points

We provide two ways to access the same data:

1. **Context-First (via Catalog):** Browse MSIs, see linked options in context
2. **Library-First (via Library):** Browse all options, see which MSIs use them

Both views provide cross-references to the other.

---

## Navigation Patterns

### Breadcrumbs

All pages include contextual breadcrumbs:

```
Price Guide > Catalog > Double Hung Window > Edit

Price Guide > Library > Options > Pella Premium > Pricing

Price Guide > Tools > Mass Price Change > Step 2 of 4
```

### Cross-Links

The UI should provide contextual links between related entities:

**From MSI Detail:**

- "View in Library" links next to each option/upcharge
- "Edit Pricing" links to option-specific pricing

**From Option Detail:**

- "Used in X MSIs" badge that expands to show list
- Click to navigate to MSI

**From Pricing Page:**

- Item selector shows relationship breadcrumb
- Link back to item detail

---

## Tab Structure Within Pages

### MSI Detail Page Tabs

```
┌──────────────────────────────────────────────────────────────┐
│  Double Hung Window                                          │
├──────────────────────────────────────────────────────────────┤
│  [Overview] [Options] [UpCharges] [Details] [Pricing] [Log]  │
└──────────────────────────────────────────────────────────────┘
```

| Tab       | Content                                     |
| --------- | ------------------------------------------- |
| Overview  | Basic info, category, settings, thumbnail   |
| Options   | Linked options with reorder, quick-link new |
| UpCharges | Linked upcharges with compatibility matrix  |
| Details   | Linked additional detail fields             |
| Pricing   | Summary pricing grid for all linked options |
| Log       | Audit log of changes to this MSI            |

### Library Page Tabs

```
┌──────────────────────────────────────────────────────────────┐
│  Library                                                     │
├──────────────────────────────────────────────────────────────┤
│  [Options (127)] [UpCharges (45)] [Additional Details (23)]  │
└──────────────────────────────────────────────────────────────┘
```

Each tab shows the count of items for quick reference.

### Pricing Page Tabs

```
┌──────────────────────────────────────────────────────────────┐
│  Pricing                                                     │
├──────────────────────────────────────────────────────────────┤
│  [Option Pricing] [UpCharge Pricing]                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Contextual Sidebars

### When Viewing an MSI

Show a contextual sidebar with quick stats:

```
┌────────────────────┐
│ Quick Stats        │
├────────────────────┤
│ 5 Options linked   │
│ 3 UpCharges linked │
│ 4 Offices enabled  │
│ ──────────────────│
│ Pricing Status     │
│ ✓ Complete         │
│ ──────────────────│
│ Last Modified      │
│ John Smith         │
│ Dec 15, 2024       │
└────────────────────┘
```

### When Viewing an Option

Show where this option is used:

```
┌────────────────────┐
│ Used In            │
├────────────────────┤
│ 12 MSIs            │
│ ──────────────────│
│ • Double Hung      │
│ • Casement         │
│ • Picture Window   │
│ • ...8 more        │
│ ──────────────────│
│ [View All →]       │
└────────────────────┘
```

---

## Modal vs. Page Navigation

### Use Modals For:

- Quick-add operations (new option while editing MSI)
- Confirmation dialogs (delete, bulk operations)
- Simple edit operations (rename, single field change)
- Conflict resolution (optimistic locking)
- Selection pickers (choose option to link)

### Use New Pages For:

- Full entity creation (Create MSI wizard)
- Complex editing (MSI with all relationships)
- Bulk pricing management
- Import/export wizards
- Detailed views that need URL sharing

### Inline Editing For:

- Category names in tree
- Sort order (drag-drop)
- Simple toggles (active/inactive)
- Single field updates in tables

---

## Search and Filter Architecture

### Global Search

Available in header, searches across all entity types:

```
┌────────────────────────────────────────────────────┐
│ 🔍 Search price guide...                      ⌘K  │
└────────────────────────────────────────────────────┘
```

Results grouped by type:

```
┌────────────────────────────────────────────────────┐
│ Results for "pella"                                │
├────────────────────────────────────────────────────┤
│ MEASURE SHEET ITEMS                                │
│   Double Hung Window (contains Pella option)       │
│   Casement Window (contains Pella option)          │
│                                                    │
│ OPTIONS                                            │
│   Pella Premium                                    │
│   Pella Standard                                   │
│                                                    │
│ CATEGORIES                                         │
│   (no results)                                     │
└────────────────────────────────────────────────────┘
```

### Page-Level Filters

Each list page has contextual filters:

**Catalog Page:**

- Search (name, note, category)
- Category filter (hierarchical dropdown)
- Office filter
- Status filter (active, inactive, missing pricing)

**Library Options Page:**

- Search (name, brand, item code)
- Has pricing filter (complete, incomplete, none)
- Usage filter (used, unused)

**Pricing Page:**

- Item selector
- Office filter
- Price type filter

---

## Responsive Considerations

### Desktop (1440px+)

- Full sidebar navigation
- Two-column layouts for detail pages
- Full pricing grids

### Tablet (768px - 1439px)

- Collapsible sidebar
- Single-column with expandable sections
- Horizontal scroll for pricing grids

### Mobile (< 768px)

- Bottom navigation
- Card-based list views
- Vertical pricing entry (one office at a time)

**Note:** Primary target is desktop. Mobile should be functional but not optimized for complex operations.

---

## Keyboard Navigation

### Global Shortcuts

| Shortcut | Action                     |
| -------- | -------------------------- |
| `⌘K`     | Open global search         |
| `⌘N`     | Create new (context-aware) |
| `⌘S`     | Save current form          |
| `Esc`    | Close modal / Cancel       |

### List Navigation

| Shortcut | Action                              |
| -------- | ----------------------------------- |
| `↑/↓`    | Move selection                      |
| `Enter`  | Open selected item                  |
| `Space`  | Toggle checkbox                     |
| `⌘A`     | Select all visible                  |
| `Delete` | Delete selected (with confirmation) |

### Pricing Grid Navigation

| Shortcut | Action                |
| -------- | --------------------- |
| `Tab`    | Move to next cell     |
| `Enter`  | Confirm and move down |
| `⌘C/⌘V`  | Copy/paste cells      |
| `⌘D`     | Fill down             |
| `⌘R`     | Fill right            |

---

## State Persistence

### URL State (Shareable)

- Current page/tab
- Selected item ID
- Search query
- Active filters

### Session State (Tab-specific)

- Expanded/collapsed sections
- Selected items in multi-select
- Unsaved form data (with warning on navigate)

### User Preferences (Persistent)

- Default filters
- Column widths in tables
- Sidebar collapsed state

---

## Error States and Empty States

### Empty States

| Context           | Message                                                            | Action                      |
| ----------------- | ------------------------------------------------------------------ | --------------------------- |
| No MSIs           | "Your price guide is empty. Start by creating your first item."    | [Create Item]               |
| No search results | "No items match 'xyz'. Try adjusting your search."                 | [Clear Search]              |
| No options on MSI | "No options linked yet. Link existing options or create new ones." | [Link Options] [Create New] |
| No pricing        | "Pricing not configured. Set up pricing for your offices."         | [Set Up Pricing]            |

### Error States

| Context                | Message                                                               | Action                       |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------- |
| Load failure           | "Failed to load items. Please try again."                             | [Retry]                      |
| Save conflict          | "This item was modified by John Smith. Review changes before saving." | [Review] [Discard]           |
| Validation error       | Inline field errors with summary at top                               | Fix and retry                |
| Bulk operation failure | "3 of 10 items failed. [View Errors]"                                 | [View Errors] [Retry Failed] |

---

## Next Steps

Continue to [Core Patterns](./02-core-patterns.md) for reusable UI components.

