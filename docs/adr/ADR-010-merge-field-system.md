# ADR-010: Merge Field System Architecture

## Status

Accepted (Updated)

## Decisions Made

- **Syntax**: Handlebars-style `{{field.key}}`
- **System Fields**: Defined in code as a TypeScript constant (not database)
- **Custom Fields**: Stored per-company in database
- **Timeline**: Must be implemented BEFORE price guide import

## Context

The legacy system uses "placeholders" (e.g., `%quantity%`, `%totalPrice%`) for document generation. Problems with the current approach:

1. **No central registry** - Placeholders are scattered across MSIs, Options, UpCharges, and hardcoded in contract templates
2. **No usage tracking** - Can't see where a placeholder is used
3. **No discoverability** - Users must know placeholder syntax by heart
4. **No validation** - Typos in templates (`%quantty%`) fail silently
5. **Confusing terminology** - "Placeholder" is overloaded (also means UI hint text)

## Decision

Implement a centralized **Merge Field** system with:

1. **SYSTEM_MERGE_FIELDS constant** as code-based registry for global fields
2. **CustomMergeFieldDefinition entity** for per-company custom fields
3. **Admin UI** for merge field management
4. **Validation** on document save to catch invalid references

## Architecture

### Two Types of Merge Fields

| Type       | Where Defined                        | Storage                                        | Example                                               |
| ---------- | ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------- |
| **SYSTEM** | Global (shared across all companies) | **Code constant** (`system-merge-fields.ts`)   | `{{item.quantity}}`, `{{option.selected.totalPrice}}` |
| **CUSTOM** | Per-company library                  | `CustomMergeFieldDefinition` + junction tables | `{{custom.frameColor}}`, `{{custom.warrantyYears}}`   |

### Entity Design

#### SYSTEM Merge Fields (Code Constant)

```typescript
// apps/api/src/entities/merge-field/system-merge-fields.ts

export const SYSTEM_MERGE_FIELDS = {
  'item.quantity': {
    displayName: 'Quantity',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.NUMBER,
    description: 'The quantity/count of this line item',
  },
  'item.name': {
    displayName: 'Item Name',
    category: MergeFieldCategory.ITEM,
    dataType: MergeFieldDataType.TEXT,
    description: 'The name of the measure sheet item',
  },
  'option.selected.totalPrice': {
    displayName: 'Total Price',
    category: MergeFieldCategory.OPTION,
    dataType: MergeFieldDataType.CURRENCY,
    description: 'Total price (unit price × quantity)',
  },
  // ... more fields
} as const;

// Type-safe key validation
export type SystemMergeFieldKey = keyof typeof SYSTEM_MERGE_FIELDS;

export function isSystemMergeFieldKey(key: string): key is SystemMergeFieldKey {
  return key in SYSTEM_MERGE_FIELDS;
}
```

**Why code instead of database?**

- System fields are fixed by developers (users can't add/edit them)
- Values are computed at runtime (not stored)
- No need for seeding, migrations, or DB queries
- Type-safe: TypeScript enforces valid keys at compile time
- Single source of truth (no drift between code and DB)

#### CUSTOM Merge Fields (Per-Company Library)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CustomMergeFieldDefinition (Company Library)              │
├─────────────────────────────────────────────────────────────────────────────┤
│ id: UUID                                                                     │
│ company: Company                        // Per-company                      │
│ key: string (unique per company)        // e.g., "frameColor"               │
│ displayName: string                     // e.g., "Frame Color"              │
│ description?: string                    // Help text for users              │
│ dataType: enum                          // TEXT, NUMBER, CURRENCY, DATE     │
│ isActive: boolean                       // Soft delete / deprecate          │
│ sourceId?: string                       // Legacy placeholder for migration │
│ createdAt, updatedAt                                                        │
│                                                                              │
│ TAGGING: Uses existing polymorphic ItemTag system                           │
│ → Add CUSTOM_MERGE_FIELD to TaggableEntityType enum                         │
│ → Tags linked via ItemTag(tag, entityType=CUSTOM_MERGE_FIELD, entityId)     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 1:N (which MSIs use this field)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MsiCustomMergeField (Junction Table)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ id: UUID                                                                     │
│ msi: MeasureSheetItem                   // The MSI using this field         │
│ fieldDefinition: CustomMergeFieldDef    // FK to the library definition     │
│ defaultValue?: string                   // MSI-specific default value       │
│ createdAt                                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Similar junction tables for Options and UpCharges:
- OptionCustomMergeField (option, fieldDefinition, defaultValue)
- UpChargeCustomMergeField (upCharge, fieldDefinition, defaultValue)
```

### Visual Example: Custom Field Library

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Company: ABC Windows                                                       │
│  Custom Merge Field Library                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CustomMergeFieldDefinition                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ id: "field-001"                                                      │   │
│  │ key: "frameColor"                                                    │   │
│  │ displayName: "Frame Color"                                           │   │
│  │ dataType: TEXT                                                       │   │
│  │ Used by: 12 MSIs                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ id: "field-002"                                                      │   │
│  │ key: "glassType"                                                     │   │
│  │ displayName: "Glass Type"                                            │   │
│  │ dataType: TEXT                                                       │   │
│  │ Used by: 12 MSIs                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Double Hung   │     │ Casement      │     │ Picture       │
│ Window (MSI)  │     │ Window (MSI)  │     │ Window (MSI)  │
├───────────────┤     ├───────────────┤     ├───────────────┤
│ MsiCustom-    │     │ MsiCustom-    │     │ MsiCustom-    │
│ MergeField:   │     │ MergeField:   │     │ MergeField:   │
│               │     │               │     │               │
│ frameColor    │     │ frameColor    │     │ frameColor    │
│ = "White"     │     │ = "Almond"    │     │ = "Black"     │
│               │     │               │     │               │
│ glassType     │     │ glassType     │     │ glassType     │
│ = "Low-E"     │     │ = "Tempered"  │     │ = "Low-E"     │
└───────────────┘     └───────────────┘     └───────────────┘

All 3 MSIs use the SAME field definitions from the library,
but each has its own default value.
```

### Benefits of This Architecture

1. **Consistency for Repeating Sections**: Document templates can reference `{{custom.frameColor}}` knowing all MSIs in a category will have it
2. **Central Management**: Admins see all custom fields in one place
3. **Usage Tracking**: "Where is frameColor used?" → Shows all 12 MSIs
4. **Validation**: Template editor can warn if an MSI is missing a required field
5. **Bulk Operations**: "Add frameColor to all Window MSIs" becomes possible
6. **No Duplicates**: Prevents "frameColor" vs "frame_color" vs "FrameColor"

### Merge Field Categories

| Category     | Examples                                                     | Computed? |
| ------------ | ------------------------------------------------------------ | --------- |
| **ITEM**     | `quantity`, `name`, `category`, `tag`, `note`                | Mixed     |
| **OPTION**   | `selectionName`, `selectionBrand`, `unitPrice`, `totalPrice` | Yes       |
| **UPCHARGE** | `{identifier}.name`, `{identifier}.totalPrice`               | Yes       |
| **CUSTOMER** | `customerName`, `customerEmail`, `jobAddress`                | Yes       |
| **USER**     | `salesRepName`, `salesRepEmail`, `salesRepPhone`             | Yes       |
| **COMPANY**  | `companyName`, `companyPhone`, `companyLogo`                 | Yes       |
| **CUSTOM**   | Any user-defined field                                       | No        |

### Scope Types

| Scope      | Description                                   | Storage                | Can Delete? | Can Edit Key? |
| ---------- | --------------------------------------------- | ---------------------- | ----------- | ------------- |
| **SYSTEM** | Built-in fields like `quantity`, `totalPrice` | **Code constant**      | No          | No            |
| **CUSTOM** | User-created fields                           | Per-company (database) | Yes         | Yes           |

**System Fields are Code Constants:**

- SYSTEM merge fields are defined in `system-merge-fields.ts`
- They are computed at runtime from entity data
- No database storage, no seeding required
- Examples: `{{item.quantity}}`, `{{option.selected.totalPrice}}`, `{{customer.name}}`

**Custom Fields are Per-Company:**

- CUSTOM merge fields are created by users for their specific needs
- They have `company: <company_id>` in the database
- Examples: `{{custom.colorCode}}`, `{{custom.warrantyYears}}`

### Data Types

```typescript
enum MergeFieldDataType {
  TEXT = 'TEXT', // String value
  NUMBER = 'NUMBER', // Numeric, no currency formatting
  CURRENCY = 'CURRENCY', // Formatted as $1,234.56
  DATE = 'DATE', // Formatted date
  BOOLEAN = 'BOOLEAN', // Yes/No
  IMAGE = 'IMAGE', // URL to image
}
```

### Syntax: Handlebars Style ✅

| Legacy                       | New                                     | Example Value            |
| ---------------------------- | --------------------------------------- | ------------------------ |
| `%quantity%`                 | `{{item.quantity}}`                     | "12"                     |
| `%name%`                     | `{{item.name}}`                         | "Architectural Shingles" |
| `%totalPrice%`               | `{{option.selected.totalPrice}}`        | "$1,234.56"              |
| `%option1.name%`             | `{{option.1.name}}`                     | "GAF Timberline"         |
| `%colorUpcharge.totalPrice%` | `{{upcharge.colorUpcharge.totalPrice}}` | "$150.00"                |
| `%customField%`              | `{{custom.colorCode}}`                  | "BL-001"                 |

**Benefits of Handlebars:**

- Industry standard (used by Handlebars.js, Mustache, many email platforms)
- Double-brace is unambiguous (percent signs appear in normal text)
- Familiar to developers
- Can leverage existing Handlebars libraries for rendering

## Merge Field Management UI

### List View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Merge Fields                                      [+ Create Custom Field]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔍 Search...          Category: [All ▼]   Scope: [All ▼]   Tags: [All ▼]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {{item.quantity}}                                    📋 Copy         │   │
│  │ Item Quantity                                        SYSTEM · ITEM   │   │
│  │ The quantity/count of this line item                                 │   │
│  │ Used in: 12 templates, 45 MSIs                       Type: NUMBER   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {{option.selected.totalPrice}}                       📋 Copy         │   │
│  │ Selected Option Total Price                          SYSTEM · OPTION │   │
│  │ Total price (unit × quantity) for the selected option               │   │
│  │ Used in: 8 templates, 0 MSIs                         Type: CURRENCY │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {{custom.frameColor}}                         [Edit] [Delete] 📋    │   │
│  │ Frame Color                                          CUSTOM · TEXT   │   │
│  │ Window frame color selection                                         │   │
│  │ 🏷️ [Windows] [Colors]                    ← Tags for organization    │   │
│  │ Used in: 12 MSIs                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {{custom.warrantyYears}}                      [Edit] [Delete] 📋    │   │
│  │ Warranty Years                                       CUSTOM · NUMBER │   │
│  │ Product warranty duration                                            │   │
│  │ 🏷️ [Warranty] [All Products]                                        │   │
│  │ Used in: 45 MSIs, 12 Options                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tagging Support

Custom merge fields use the existing polymorphic `ItemTag` system:

```typescript
// TaggableEntityType enum (add new value):
export enum TaggableEntityType {
  OPTION = 'OPTION',
  UPCHARGE = 'UPCHARGE',
  ADDITIONAL_DETAIL = 'ADDITIONAL_DETAIL',
  CUSTOM_MERGE_FIELD = 'CUSTOM_MERGE_FIELD', // ← NEW
}

// Tags linked via ItemTag junction:
// ItemTag { tag: "Windows", entityType: CUSTOM_MERGE_FIELD, entityId: <field-def-id> }
```

Benefits of tagging merge fields:

- **Organization**: Group related fields (e.g., "Window Fields", "Roofing Fields")
- **Filtering**: Filter merge field list by tag in management UI
- **Bulk Operations**: "Add all fields tagged 'Windows' to this MSI"

### Usage Detail Modal

Clicking "Used in: 12 templates, 45 MSIs" shows:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  {{item.quantity}} Usage                                            [X]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📄 Contract Templates (12)                                                 │
│  ├── Standard Proposal Template                                             │
│  ├── Roofing Contract                                                       │
│  ├── Windows Agreement                                                      │
│  └── ... 9 more                                                            │
│                                                                             │
│  📦 Measure Sheet Items (45)                                                │
│  ├── Architectural Shingles - used in note field                           │
│  ├── Double Hung Window - used in note field                               │
│  ├── Vinyl Siding - used in note field                                     │
│  └── ... 42 more                                                           │
│                                                                             │
│  ⚠️  Cannot delete - remove from all usages first                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Validation (Future)

Template validation can be implemented as a service that:

1. Extracts all `{{field.key}}` references from a template
2. Checks against `SYSTEM_MERGE_FIELDS` constant + company's custom fields
3. Returns invalid fields with typo suggestions (Levenshtein distance)

```typescript
// Example validation flow
function validateTemplate(companyId: string, template: string) {
  const referenced = extractReferences(template); // ['item.quantity', 'custom.frameColor']

  // Check system fields (from code constant)
  const systemKeys = new Set(Object.keys(SYSTEM_MERGE_FIELDS));

  // Check custom fields (from database)
  const customFields = await getCustomFields(companyId);
  const customKeys = new Set(customFields.map(f => `custom.${f.key}`));

  const validKeys = new Set([...systemKeys, ...customKeys]);
  const invalidFields = referenced.filter(key => !validKeys.has(key));

  return { isValid: invalidFields.length === 0, invalidFields };
}
```

## Migration Strategy

### Phase 1: Schema + System Fields ✅

1. ~~Create `MergeField` entity~~ → Define `SYSTEM_MERGE_FIELDS` constant
2. Create `CustomMergeFieldDefinition` entity and junction tables
3. Add `CUSTOM_MERGE_FIELD` to `TaggableEntityType` enum

### Phase 2: Legacy Import

1. Parse legacy `placeholders` arrays
2. Create CUSTOM merge fields for each unique placeholder
3. Create junction records linking to MSIs/Options/UpCharges

### Phase 3: Template Migration

1. Scan existing contract templates for `%placeholder%` syntax
2. Convert to new syntax `{{category.key}}`

### Phase 4: UI + Validation

1. Build merge field management page
2. Add validation on template save
3. Add merge field picker to template editor

## Alternatives Considered

### 1. Keep Legacy Design (Rejected)

- Pro: Less work
- Con: All the problems listed in Context

### 2. Placeholders as JSON on Entities (Rejected)

- Pro: Simpler schema
- Con: Can't track usage, no central management

### 3. System Fields in Database (Rejected)

- Pro: Consistent storage for all field types
- Con: Unnecessary complexity - system fields are fixed, computed at runtime, and don't need DB storage. Code constant is simpler and type-safe.

### 4. Dynamic Merge Fields Only (Rejected)

- Pro: No database needed
- Con: Can't have custom fields with stored values

## Consequences

### Positive

- Central registry for all merge fields (code + DB)
- Type-safe system field keys (TypeScript enforcement)
- No seeding/migration needed for system fields
- Usage tracking enables "where used" queries (custom fields)
- Validation prevents typos in templates
- Better UX with autocomplete/picker
- Can deprecate fields without breaking things
- Clear separation of SYSTEM vs CUSTOM fields

### Negative

- Custom fields still require database schema
- Migration effort required for legacy placeholders
- Need to maintain `SYSTEM_MERGE_FIELDS` constant in code

### Neutral

- Syntax change may require user retraining
- Need to document all SYSTEM fields

## References

- Salesforce Merge Fields: https://help.salesforce.com/s/articleView?id=sf.merge_fields.htm
- HubSpot Personalization Tokens: https://knowledge.hubspot.com/contacts/how-do-i-use-personalization-tokens
- Handlebars: https://handlebarsjs.com/
