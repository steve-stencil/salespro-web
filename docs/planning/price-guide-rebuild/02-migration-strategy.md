# Price Guide Rebuild - Migration Strategy

[← Back to Index](./00-index.md) | [Data Model →](./01-data-model.md)

---

## Overview

Migration from Parse/MongoDB to PostgreSQL is handled via an **in-app migration wizard** in the dashboard. Each company admin migrates their own data through a 7-step process.

**Key Principles**:

- Pointer-based migration (legacy uses Parse pointers, not embedded copies)
- Upsert pattern for idempotency (can re-run safely)
- V1 pricing migrates to "OTHER" type code
- Orphaned pointers are skipped gracefully
- Progress tracking and validation at each step

---

## Migration Wizard Flow

```
Dashboard → Data Migration → "Migrate Price Guide" button

Opens Migration Wizard:

Step 1: Initialize Price Types
  ↓
Step 2: Extract & Migrate Categories
  ↓
Step 3: Migrate Shared Libraries (Options, UpCharges, Fields)
  ↓
Step 4: Migrate Measure Sheet Items
  ↓
Step 5: Migrate Pricing
  ↓
Step 6: Build Relationships (Junction Tables)
  ↓
Step 7: Validate & Review

✅ Migration Complete!
```

---

## Step 1: Initialize Price Types

**Purpose**: Ensure global price types exist before migrating pricing data.

**Process**:

1. Check if global types exist (MATERIAL, LABOR, TAX, OTHER)
2. If not, seed them (one-time operation)

**Global Default Types**:

```typescript
const GLOBAL_PRICE_TYPES = [
  { code: 'MATERIAL', name: 'Materials', sortOrder: 1, company: null },
  { code: 'LABOR', name: 'Labor', sortOrder: 2, company: null },
  { code: 'TAX', name: 'Tax', sortOrder: 3, company: null },
  { code: 'OTHER', name: 'Other', sortOrder: 4, company: null },
];
```

**UI**: "4 global price types ready"

**Progress**: Instant (no company data to migrate)

---

## Step 2: Extract & Migrate Categories

**Purpose**: Build normalized category tree from legacy MSI string fields.

**Legacy Structure**:

```javascript
// SSMeasureSheetItem fields
{
  category: "Windows",
  subCategory: "Double Hung",
  subSubCategories: ["Standard", "Premium"]
}
```

**Migration Logic**:

```typescript
async function migrateCategories(company: Company) {
  const allMSIs = await parseQuery('SSMeasureSheetItem')
    .equalTo('company', company.sourceId)
    .find();

  const categoryTree = new Map<string, PriceGuideCategory>();

  for (const msi of allMSIs) {
    const cat = msi.get('category');
    const subCat = msi.get('subCategory');
    const drillDowns = msi.get('subSubCategories') || [];

    // Create root category if doesn't exist
    if (cat && !categoryTree.has(cat)) {
      const category = new PriceGuideCategory();
      category.company = company;
      category.name = cat;
      category.depth = 0;
      category.parent = null;
      await em.persist(category);
      categoryTree.set(cat, category);
    }

    // Create subcategory if doesn't exist
    const subKey = `${cat}|${subCat}`;
    if (subCat && !categoryTree.has(subKey)) {
      const subCategory = new PriceGuideCategory();
      subCategory.company = company;
      subCategory.name = subCat;
      subCategory.depth = 1;
      subCategory.parent = categoryTree.get(cat);
      await em.persist(subCategory);
      categoryTree.set(subKey, subCategory);
    }

    // Create drill-downs
    for (const dd of drillDowns) {
      const ddKey = `${cat}|${subCat}|${dd}`;
      if (!categoryTree.has(ddKey)) {
        const drillDown = new PriceGuideCategory();
        drillDown.company = company;
        drillDown.name = dd;
        drillDown.depth = 2;
        drillDown.parent = categoryTree.get(subKey);
        await em.persist(drillDown);
        categoryTree.set(ddKey, drillDown);
      }
    }
  }

  await em.flush();
}
```

**Preview**: Show category tree that will be created

**Progress**: "X of Y categories migrated"

---

## Step 3: Migrate Shared Libraries

**Purpose**: Migrate SSPriceGuideItems to Options, UpCharges, and AdditionalDetailFields.

**Legacy Note**: The `items[]` and `accessories[]` arrays on SSMeasureSheetItem are **Parse pointers**, not embedded objects:

```javascript
{ __type: "Pointer", className: "SSPriceGuideItem", objectId: "<id>" }
```

This means the same SSPriceGuideItem can be referenced by multiple MSIs (already shared).

**Migration Logic**:

```typescript
async function migrateSharedItem(
  pointer: ParsePointer,
): Promise<PriceGuideOption | UpCharge | null> {
  const { objectId } = pointer;

  // Check if already migrated (upsert pattern)
  const existingOption = await em.findOne(PriceGuideOption, {
    sourceId: objectId,
  });
  if (existingOption) return existingOption;

  const existingUpCharge = await em.findOne(UpCharge, { sourceId: objectId });
  if (existingUpCharge) return existingUpCharge;

  // Try to fetch from legacy Parse
  try {
    const parseItem = await parseQuery('SSPriceGuideItem').get(objectId);

    if (!parseItem) {
      logger.warn(`Orphaned pointer: ${objectId} - skipping`);
      return null;
    }

    // Migrate based on isAccessory flag
    if (parseItem.get('isAccessory')) {
      const upCharge = new UpCharge();
      upCharge.company = company;
      upCharge.sourceId = objectId;
      upCharge.name = parseItem.get('name') || parseItem.get('displayTitle');
      upCharge.note = parseItem.get('info');
      upCharge.identifier = parseItem.get('identifier');
      upCharge.measurementType = parseItem.get('measurementType');
      upCharge.imageUrl = parseItem.get('imageURL');
      await em.persist(upCharge);
      return upCharge;
    } else {
      const option = new PriceGuideOption();
      option.company = company;
      option.sourceId = objectId;
      option.name = parseItem.get('displayTitle');
      option.brand = parseItem.get('subCategory2');
      option.itemCode = parseItem.get('customRefId');
      option.measurementType = parseItem.get('measurementType');
      await em.persist(option);
      return option;
    }
  } catch (error) {
    logger.error(`Failed to fetch ${objectId}:`, error);
    return null;
  }
}
```

**AdditionalDetailFields Migration**:

```typescript
async function migrateSharedField(
  pointer: ParsePointer,
): Promise<AdditionalDetailField | null> {
  const { objectId } = pointer;

  // Check if already migrated
  const existing = await em.findOne(AdditionalDetailField, {
    sourceId: objectId,
  });
  if (existing) return existing;

  try {
    const parseField = await parseQuery('AdditionalDetailObject').get(objectId);

    if (!parseField) {
      logger.warn(`Orphaned field pointer: ${objectId} - skipping`);
      return null;
    }

    const field = new AdditionalDetailField();
    field.company = company;
    field.sourceId = objectId;
    field.title = parseField.get('title');
    field.inputType = parseField.get('inputType');
    field.cellType = parseField.get('cellType');
    field.placeholder = parseField.get('placeholder');
    field.note = parseField.get('note');
    field.defaultValue = parseField.get('defaultValue');
    field.isRequired = parseField.get('isRequired') ?? false;
    field.shouldCopy = parseField.get('shouldCopy') ?? false;
    field.pickerValues = parseField.get('pickerValues');
    field.sizePickerConfig = parseField.get('sizePickerConfig');

    await em.persist(field);
    return field;
  } catch (error) {
    logger.error(`Failed to fetch field ${objectId}:`, error);
    return null;
  }
}
```

**Preview**: "X unique options, Y unique upcharges, Z fields"

**Progress**: "X of Y items migrated"

---

## Step 4: Migrate Measure Sheet Items

**Purpose**: Migrate SSMeasureSheetItem core data (not relationships yet).

**Migration Logic**:

```typescript
async function migrateMSI(
  parseMSI: Parse.Object,
): Promise<MeasureSheetItem | null> {
  const objectId = parseMSI.id;

  // Check if already migrated
  const existing = await em.findOne(MeasureSheetItem, { sourceId: objectId });
  if (existing) return existing;

  // Find the correct category
  const catPath = buildCategoryPath(
    parseMSI.get('category'),
    parseMSI.get('subCategory'),
    parseMSI.get('subSubCategories')?.[0], // Use first drill-down as leaf
  );
  const category = await findCategory(company, catPath);

  const msi = new MeasureSheetItem();
  msi.company = company;
  msi.sourceId = objectId;
  msi.name = parseMSI.get('itemName');
  msi.note = parseMSI.get('itemNote');
  msi.measurementType = parseMSI.get('measurementType');
  msi.imageUrl = parseMSI.get('imageURL');
  msi.formulaId = parseMSI.get('formulaID');
  msi.qtyFormula = parseMSI.get('qtyFormula');
  msi.defaultQty = parseMSI.get('defaultQty') ?? 1;
  msi.showSwitch = parseMSI.get('shouldShowSwitch') ?? false;
  msi.sortOrder = parseMSI.get('sortOrder') ?? 0;
  msi.category = category;

  // Migrate tag fields (custom field definitions)
  msi.tagTitle = parseMSI.get('tagTitle');
  msi.tagRequired = parseMSI.get('tagRequired') ?? false;
  msi.tagPickerOptions = parseMSI.get('tagPickerOptions');
  msi.tagParams = parseMSI.get('tagParams');

  await em.persist(msi);
  return msi;
}
```

**Preview**: "X items will be created"

**Progress**: "X of Y MSIs migrated"

---

## Step 5: Migrate Pricing

**Purpose**: Migrate PriceObjects to OptionPrice and UpChargePrice tables.

**V1 vs V2 Detection**:

- V2: Has `priceObjects` array with PriceObject pointers
- V1: Only has `itemPrices` with total amounts (no typeCode breakdown)

**V1 Pricing Migration** (all companies are V1):

```typescript
async function migratePricing(
  option: PriceGuideOption,
  parseItem: Parse.Object,
) {
  const itemPrices = parseItem.get('itemPrices') || [];
  const otherType = await em.findOne(PriceObjectType, {
    code: 'OTHER',
    company: null, // Global type
  });

  for (const ip of itemPrices) {
    // Check if already migrated
    const existing = await em.findOne(OptionPrice, {
      option: option,
      office: { sourceId: ip.officeId },
      priceType: otherType,
    });

    if (!existing) {
      const price = new OptionPrice();
      price.option = option;
      price.office = await getOffice(ip.officeId);
      price.priceType = otherType;
      price.amount = ip.total ?? 0;
      await em.persist(price);
    }
  }
}
```

**V2 Pricing Migration** (for future reference if V2 companies exist):

```typescript
async function migrateV2Pricing(
  option: PriceGuideOption,
  priceObjects: Parse.Object[],
) {
  for (const po of priceObjects) {
    const priceType = await getPriceType(po.get('typeCode'));
    const office = await getOffice(po.get('office')?.id);

    const price = new OptionPrice();
    price.option = option;
    price.office = office;
    price.priceType = priceType;
    price.amount = po.get('amount') ?? 0;
    await em.persist(price);
  }
}
```

**UpCharge Pricing Migration** (with override support):

```typescript
async function migrateUpChargePricing(
  upCharge: UpCharge,
  priceObjects: Parse.Object[],
) {
  for (const po of priceObjects) {
    const parentItem = po.get('parentItem'); // Option-specific override
    const option = parentItem
      ? await findMigratedOption(parentItem.objectId)
      : null;

    const price = new UpChargePrice();
    price.upCharge = upCharge;
    price.option = option; // null = default, set = override
    price.office = await getOffice(po.get('office')?.id);
    price.priceType = await getPriceType(po.get('typeCode'));
    price.amount = po.get('amount') ?? 0;
    price.isPercentage = po.get('isPercentage') ?? false;

    await em.persist(price);

    // Migrate percentage base if percentage pricing
    if (price.isPercentage) {
      const percentageTypeCodes = po.get('percentageTypeCodes') || [];
      for (const typeCode of percentageTypeCodes) {
        const base = new UpChargePricePercentageBase();
        base.upChargePrice = price;
        base.priceType = await getPriceType(typeCode);
        await em.persist(base);
      }
    }
  }
}
```

**Preview**: "X option prices, Y upcharge prices"

**Progress**: "X of Y prices migrated"

---

## Step 6: Build Relationships (Junction Tables)

**Purpose**: Create junction table rows from pointer arrays.

**MeasureSheetItemOffice** (from includedOffices):

```typescript
const includedOffices = parseMSI.get('includedOffices') || [];
for (const officePointer of includedOffices) {
  const office = await getOffice(officePointer.objectId);
  const junction = new MeasureSheetItemOffice();
  junction.measureSheetItem = msi;
  junction.office = office;
  await em.persist(junction);
}
```

**MeasureSheetItemOption** (from items[] array):

```typescript
const itemPointers = parseMSI.get('items') || [];
for (let i = 0; i < itemPointers.length; i++) {
  const option = await migrateSharedItem(itemPointers[i]);

  if (!option) {
    logger.warn(`Skipping orphaned option in MSI ${parseMSI.id}`);
    continue;
  }

  const junction = new MeasureSheetItemOption();
  junction.measureSheetItem = msi;
  junction.option = option as PriceGuideOption;
  junction.sortOrder = i; // Preserve order from array index
  await em.persist(junction);
}
```

**MeasureSheetItemUpCharge** (from accessories[] array):

```typescript
const accessoryPointers = parseMSI.get('accessories') || [];
for (let i = 0; i < accessoryPointers.length; i++) {
  const upCharge = await migrateSharedItem(accessoryPointers[i]);

  if (!upCharge) {
    logger.warn(`Skipping orphaned upcharge in MSI ${parseMSI.id}`);
    continue;
  }

  const junction = new MeasureSheetItemUpCharge();
  junction.measureSheetItem = msi;
  junction.upCharge = upCharge as UpCharge;
  junction.sortOrder = i;
  await em.persist(junction);
}
```

**UpChargeDisabledOption** (from disabledParents):

```typescript
const disabledParents = parseUpCharge.get('disabledParents') || [];
for (const pointer of disabledParents) {
  const option = await findMigratedOption(pointer.objectId);
  if (!option) continue;

  const junction = new UpChargeDisabledOption();
  junction.upCharge = upCharge;
  junction.option = option;
  await em.persist(junction);
}
```

**AdditionalDetailFields** (MSI-level and UpCharge-level):

```typescript
// MSI-level fields
const msiFieldPointers = parseMSI.get('additionalDetailObjects') || [];
for (let i = 0; i < msiFieldPointers.length; i++) {
  const field = await migrateSharedField(msiFieldPointers[i]);
  if (!field) continue;

  const junction = new MeasureSheetItemAdditionalDetailField();
  junction.measureSheetItem = msi;
  junction.additionalDetailField = field;
  junction.sortOrder = i;
  await em.persist(junction);
}

// UpCharge-level fields
const upchargeFieldPointers =
  parseUpCharge.get('additionalDetailObjects') || [];
for (let i = 0; i < upchargeFieldPointers.length; i++) {
  const field = await migrateSharedField(upchargeFieldPointers[i]);
  if (!field) continue;

  const junction = new UpChargeAdditionalDetailField();
  junction.upCharge = upCharge;
  junction.additionalDetailField = field;
  junction.sortOrder = i;
  await em.persist(junction);
}
```

**Note**: Junction row creation triggers update `linkedMsiCount` fields via database triggers.

**Preview**: "X option links, Y upcharge links, Z field links"

**Progress**: "X of Y links created"

---

## Step 7: Validate & Review

**Purpose**: Run data validation queries and report issues (no auto-fix).

**Validation Checks**:

### 1. Orphaned Junction Rows

```sql
SELECT COUNT(*) FROM measure_sheet_item_options mso
LEFT JOIN price_guide_options o ON mso.option_id = o.id
WHERE o.id IS NULL;
```

### 2. Options Without Any Pricing

```sql
SELECT o.* FROM price_guide_options o
LEFT JOIN option_prices op ON op.option_id = o.id
WHERE o.is_active = true
GROUP BY o.id
HAVING COUNT(op.id) = 0;
```

### 3. MSIs Without Any Offices

```sql
SELECT m.* FROM measure_sheet_items m
LEFT JOIN measure_sheet_item_offices mo ON mo.measure_sheet_item_id = m.id
WHERE m.is_active = true
GROUP BY m.id
HAVING COUNT(mo.id) = 0;
```

### 4. MSIs Without Any Options

```sql
SELECT m.* FROM measure_sheet_items m
LEFT JOIN measure_sheet_item_options mo ON mo.measure_sheet_item_id = m.id
WHERE m.is_active = true
GROUP BY m.id
HAVING COUNT(mo.id) = 0;
```

### 5. Circular Category References

```sql
WITH RECURSIVE category_path AS (
  SELECT id, parent_id, ARRAY[id] as path, 0 as depth
  FROM price_guide_categories
  WHERE parent_id IS NULL

  UNION ALL

  SELECT c.id, c.parent_id, path || c.id, depth + 1
  FROM price_guide_categories c
  JOIN category_path cp ON c.parent_id = cp.id
  WHERE NOT c.id = ANY(path) AND depth < 10
)
SELECT * FROM category_path WHERE depth >= 10;
```

### 6. Percentage Pricing Without Percentage Base

```sql
SELECT up.* FROM upcharge_prices up
LEFT JOIN upcharge_price_percentage_bases pb ON pb.upcharge_price_id = up.id
WHERE up.is_percentage = true
GROUP BY up.id
HAVING COUNT(pb.id) = 0;
```

**Validation Report UI**:

```
✅ No orphaned links found
⚠️  5 options missing pricing
    - "Pella Premium" (ID: abc123) [View]
    - "Low-E Glass" (ID: def456) [View]
✅ All MSIs have offices assigned
⚠️  2 MSIs have no options
    - "Empty Window Item" (ID: xyz789) [Fix]
✅ No circular category references
✅ All percentage pricing configured correctly
```

**Admin Actions**: View issues, manually fix, or proceed if acceptable.

---

## Migration Wizard Features

### Progress Tracking

- Real-time progress bar per step
- "X of Y items migrated"
- Estimated time remaining

### Idempotency

- Can re-run any step safely
- Upsert pattern via `sourceId` checks
- Skips already-migrated items

### Error Handling

- Logs orphaned pointers (continues processing)
- Logs failed fetches (continues processing)
- Shows error summary at end
- Can retry failed items

### Preview Before Execute

- Shows counts before each step
- "X items will be created"
- No destructive actions until confirmed

### Validation

- Step 7 validates all data
- Reports issues (doesn't auto-fix)
- Admin can review and fix manually

---

## Post-Migration

### Background Job (90 days after migration)

- Physically delete soft-deleted items (`isActive=false` for 90+ days)
- Clean up orphaned junction rows
- Vacuum database

### On-Demand Validation

- Admin dashboard has "Run Data Validation" button
- Runs same checks as Step 7
- Available anytime after migration

---

## Related Documentation

- [Data Model](./01-data-model.md) - Entity specifications
- [API Specifications](./03-api-specifications.md) - Migration wizard routes
- [Testing Strategy](./05-testing-strategy.md) - Migration test coverage

