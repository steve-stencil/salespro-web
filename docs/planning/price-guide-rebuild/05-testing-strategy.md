# Price Guide Rebuild - Testing Strategy

[← Back to Index](./00-index.md)

---

## Overview

**Comprehensive testing with strict quality gates:**

- 4 testing layers: Unit, Integration, E2E, Migration
- Factory functions for test data
- 80% code coverage requirement (blocks PRs if below)
- Playwright for E2E tests
- All tests must pass before merging

---

## Testing Layers

### 1. Unit Tests

**Purpose**: Test individual functions and utilities in isolation.

**Location**: `__tests__` folders next to source files

**Coverage**: 80%+ target

**Focus Areas**:

- Pricing calculation logic
- DTO mapping utilities
- Validation functions
- Search query builders
- Cursor encoding/decoding

**Examples**:

```typescript
// apps/api/src/utils/__tests__/pricing-calculator.test.ts
describe('calculateUpChargePrice', () => {
  it('should return default price when no override exists', () => {
    const price = calculateUpChargePrice({
      upCharge,
      option: null,
      office,
      priceType,
    });
    expect(price).toBe(defaultAmount);
  });

  it('should return override price when option-specific override exists', () => {
    const price = calculateUpChargePrice({
      upCharge,
      option: specificOption,
      office,
      priceType,
    });
    expect(price).toBe(overrideAmount);
  });

  it('should calculate percentage price correctly', () => {
    const price = calculatePercentageUpCharge({
      upCharge,
      option,
      percentageBase: [materialType, laborType],
      baseAmount: 1000,
    });
    expect(price).toBe(100); // 10% of 1000
  });
});

// apps/web/src/utils/__tests__/dto-mappers.test.ts
describe('toMeasureSheetItemSummaryDTO', () => {
  it('should map entity to DTO correctly', () => {
    const entity = createMockMSI();
    const dto = toMeasureSheetItemSummaryDTO(entity);

    expect(dto).toEqual({
      id: entity.id,
      name: entity.name,
      category: {
        id: entity.category.id,
        name: entity.category.name,
        fullPath: 'Windows > Double Hung',
      },
      optionCount: 5,
      upchargeCount: 3,
    });
  });
});
```

---

### 2. Integration Tests

**Purpose**: Test API routes + database interactions.

**Location**: `apps/api/src/routes/__tests__/`

**Database**: In-memory PostgreSQL (pg-mem) or test database

**Coverage**: All critical API endpoints

**Focus Areas**:

- CRUD operations on all entities
- Junction table operations (link/unlink)
- Pricing queries (default + override lookups)
- Optimistic locking conflicts
- Full-text search
- Data validation endpoints

**Examples**:

```typescript
// apps/api/src/routes/__tests__/options.routes.test.ts
describe('POST /api/price-guide/options', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    await seedCompany();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  it('should create option with pricing', async () => {
    const response = await request(app)
      .post('/api/price-guide/options')
      .send({
        name: 'Test Option',
        brand: 'TestBrand',
        pricing: [
          { officeId: 'office-1', priceTypeId: 'material', amount: 100 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();

    // Verify in database
    const option = await em.findOne(PriceGuideOption, response.body.id);
    expect(option).toBeDefined();
    expect(option.name).toBe('Test Option');
  });

  it('should link option to MSI and validate office coverage', async () => {
    const msi = await createMockMSI({ offices: ['office-1', 'office-2'] });
    const option = await createMockOption({
      pricing: [{ office: 'office-1' }],
    });

    const response = await request(app)
      .post(`/api/price-guide/measure-sheet-items/${msi.id}/options`)
      .send({ optionId: option.id });

    expect(response.status).toBe(200);
    expect(response.body.warnings).toHaveLength(1);
    expect(response.body.warnings[0].type).toBe('missing_pricing');
    expect(response.body.warnings[0].offices).toContain('office-2');
  });

  it('should increment linkedMsiCount when linking', async () => {
    const option = await createMockOption();
    expect(option.linkedMsiCount).toBe(0);

    const msi = await createMockMSI();
    await linkOptionToMSI(msi, option);

    await em.refresh(option);
    expect(option.linkedMsiCount).toBe(1);
  });
});

// apps/api/src/routes/__tests__/pricing.routes.test.ts
describe('PUT /api/price-guide/pricing/upcharges/:id/percentage-base', () => {
  it('should create percentage base junction rows', async () => {
    const upChargePrice = await createMockUpChargePrice({ isPercentage: true });

    const response = await request(app)
      .put(
        `/api/price-guide/pricing/upcharges/${upChargePrice.id}/percentage-base`,
      )
      .send({
        priceTypeIds: ['material-id', 'labor-id'],
      });

    expect(response.status).toBe(200);

    const bases = await em.find(UpChargePricePercentageBase, {
      upChargePrice: upChargePrice.id,
    });
    expect(bases).toHaveLength(2);
  });
});
```

---

### 3. E2E Tests (End-to-End)

**Purpose**: Test full user workflows via browser.

**Tool**: Playwright

**Location**: `apps/web/e2e/`

**Coverage**: Critical happy paths + error scenarios

**Focus Areas**:

- Create MSI wizard (happy path)
- Library browsing and editing
- Mass price change workflow
- Migration wizard (all 7 steps)
- Concurrent edit conflict resolution
- Search functionality
- Pagination/infinite scroll

**Examples**:

```typescript
// apps/web/e2e/create-msi-wizard.spec.ts
import { test, expect } from '@playwright/test';

test('Admin can create MSI with linked options', async ({ page }) => {
  await page.goto('/price-guide/catalog');
  await page.click('text=Create Item');

  // Step 1: Basic info
  await page.fill('[name=name]', 'Test Window');
  await page.selectOption('[name=category]', 'windows-double-hung');
  await page.selectOption('[name=measurementType]', 'sqft');
  await page.click('text=Next');

  // Step 2: Link options
  await page.click('text=Link Existing');
  await page.fill('[placeholder="Search options"]', 'Pella');
  await page.check('[data-option-id="option-123"]');
  await page.check('[data-option-id="option-456"]');
  await page.click('text=Next');

  // Step 3: Link upcharges
  await page.click('text=Link Existing');
  await page.check('[data-upcharge-id="upcharge-789"]');
  await page.click('text=Next');

  // Step 4: Skip additional details
  await page.click('text=Next');

  // Step 5: Set pricing
  await page.fill(
    '[data-option="option-123"][data-office="office-1"][data-type="material"]',
    '200',
  );
  await page.fill(
    '[data-option="option-123"][data-office="office-1"][data-type="labor"]',
    '150',
  );
  await page.click('text=Next');

  // Step 6: Review and create
  await expect(page.locator('text=2 options linked')).toBeVisible();
  await expect(page.locator('text=1 upcharge linked')).toBeVisible();
  await page.click('text=Create');

  await expect(page.locator('text=Successfully created')).toBeVisible();
});

// apps/web/e2e/mass-price-change.spec.ts
test('Admin can apply mass price increase', async ({ page }) => {
  await page.goto('/price-guide/tools');
  await page.click('text=Mass Price Change');

  // Select target items
  await page.selectOption('[name=targetType]', 'upcharges');
  await page.fill('[placeholder="Search items"]', 'grilles');
  await page.check('[data-item="upcharge-grilles"]');

  // Configure operation
  await page.selectOption('[name=operation]', 'increase');
  await page.selectOption('[name=valueType]', 'percent');
  await page.fill('[name=value]', '10');

  // Preview
  await page.click('text=Preview Changes');
  await expect(page.locator('text=Will affect 25 MSIs')).toBeVisible();

  // Execute
  await page.click('text=Apply Changes');

  // Wait for job completion
  await expect(page.locator('text=Processing')).toBeVisible();
  await expect(page.locator('text=Completed')).toBeVisible({ timeout: 30000 });
});

// apps/web/e2e/migration-wizard.spec.ts
test('Admin can complete price guide migration', async ({ page }) => {
  await page.goto('/dashboard/data-migration');
  await page.click('text=Migrate Price Guide');

  // Step 1: Price Types
  await expect(page.locator('text=4 global price types ready')).toBeVisible();
  await page.click('text=Next');

  // Step 2: Categories
  await expect(page.locator('text=Found 12 unique categories')).toBeVisible();
  await page.click('text=Migrate');
  await expect(page.locator('text=12 of 12 categories migrated')).toBeVisible();
  await page.click('text=Next');

  // ... continue through all 7 steps

  // Step 7: Validation
  await expect(page.locator('text=No orphaned links found')).toBeVisible();
  await expect(page.locator('text=5 options missing pricing')).toBeVisible();
  await page.click('text=Complete Migration');

  await expect(
    page.locator('text=Migration completed successfully'),
  ).toBeVisible();
});
```

---

### 4. Migration Tests

**Purpose**: Validate data migration from Parse to PostgreSQL.

**Location**: `apps/api/src/migration/__tests__/`

**Critical**: 100% coverage of migration logic

**Focus Areas**:

- V1 → V2 pricing conversion
- Pointer-based deduplication
- Category tree building
- Junction table creation
- Orphaned pointer handling
- Data integrity validation
- Tag field migration

**Examples**:

```typescript
// apps/api/src/migration/__tests__/price-migration.test.ts
describe('Price Guide Migration', () => {
  it('should migrate V1 pricing to OTHER type', async () => {
    // Setup Parse mock data (V1 - no PriceObjects)
    const parseMSI = createMockParseMSI({
      itemPrices: [{ officeId: 'office-1', total: 500 }],
    });

    await migratePriceGuide(company);

    const option = await em.findOne(PriceGuideOption, {
      sourceId: parseMSI.id,
    });
    const prices = await em.find(OptionPrice, { option });

    expect(prices).toHaveLength(1);
    expect(prices[0].priceType.code).toBe('OTHER');
    expect(prices[0].amount).toBe(500);
  });

  it('should migrate tag fields correctly', async () => {
    const parseMSI = createMockParseMSI({
      tagTitle: 'Size',
      tagRequired: true,
      tagPickerOptions: ['Small', 'Medium', 'Large'],
      tagParams: { unit: 'inches' },
    });

    await migratePriceGuide(company);

    const msi = await em.findOne(MeasureSheetItem, { sourceId: parseMSI.id });
    expect(msi.tagTitle).toBe('Size');
    expect(msi.tagRequired).toBe(true);
    expect(msi.tagPickerOptions).toEqual(['Small', 'Medium', 'Large']);
    expect(msi.tagParams).toEqual({ unit: 'inches' });
  });

  it('should deduplicate shared options correctly', async () => {
    // Two MSIs point to same option via pointer
    const sharedOptionPointer = { objectId: 'shared-123', __type: 'Pointer' };

    const parseMSI1 = createMockParseMSI({
      items: [sharedOptionPointer],
    });

    const parseMSI2 = createMockParseMSI({
      items: [sharedOptionPointer],
    });

    await migratePriceGuide(company);

    const options = await em.find(PriceGuideOption, { sourceId: 'shared-123' });
    expect(options).toHaveLength(1); // Only one option created

    const option = options[0];
    expect(option.linkedMsiCount).toBe(2); // Linked to 2 MSIs
  });

  it('should preserve pointer relationships in junction tables', async () => {
    const optionPointer = { objectId: 'option-123', __type: 'Pointer' };
    const parseMSI = createMockParseMSI({
      items: [optionPointer],
    });

    await migratePriceGuide(company);

    const msi = await em.findOne(MeasureSheetItem, { sourceId: parseMSI.id });
    const junctions = await em.find(
      MeasureSheetItemOption,
      {
        measureSheetItem: msi,
      },
      { populate: ['option'] },
    );

    expect(junctions).toHaveLength(1);
    expect(junctions[0].option.sourceId).toBe('option-123');
  });

  it('should skip orphaned pointers gracefully', async () => {
    const orphanedPointer = { objectId: 'missing-123', __type: 'Pointer' };
    const validPointer = { objectId: 'valid-456', __type: 'Pointer' };
    const parseMSI = createMockParseMSI({
      items: [orphanedPointer, validPointer],
    });

    // Mock Parse query to return null for orphaned pointer
    mockParseQuery.mockReturnValueOnce(null);

    await migratePriceGuide(company);

    const msi = await em.findOne(MeasureSheetItem, { sourceId: parseMSI.id });
    const junctions = await em.find(MeasureSheetItemOption, {
      measureSheetItem: msi,
    });

    expect(junctions).toHaveLength(1); // Only valid pointer linked
  });
});
```

---

## Test Data Strategy

### Factory Functions

**Location**: `apps/api/src/__tests__/factories/`

**Benefits**:

- Type-safe
- Flexible overrides
- Reusable across tests
- Clear test intent

**Examples**:

```typescript
// apps/api/src/__tests__/factories/option.factory.ts
import { faker } from '@faker-js/faker';

export function createOption(overrides?: Partial<PriceGuideOption>) {
  return {
    id: faker.string.uuid(),
    company: testCompany,
    name: faker.commerce.productName(),
    brand: faker.company.name(),
    itemCode: faker.string.alphanumeric(6).toUpperCase(),
    linkedMsiCount: 0,
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createOptionPrice(overrides?: Partial<OptionPrice>) {
  return {
    id: faker.string.uuid(),
    option: createOption(),
    office: createOffice(),
    priceType: createPriceType({ code: 'MATERIAL' }),
    amount: faker.number.int({ min: 50, max: 1000 }),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Usage in tests
const option = createOption({ name: 'Custom Name', linkedMsiCount: 5 });
const price = createOptionPrice({ option, amount: 250 });
```

### Seed Scripts

**Location**: `apps/api/src/seeds/`

**Purpose**: Create realistic data for manual testing and demos.

```typescript
// apps/api/src/seeds/dev-price-guide.seed.ts
export async function seedDevPriceGuide() {
  // Create 10 categories
  const categories = await createCategoryTree();

  // Create 100 shared options
  const options = await Promise.all(
    Array.from({ length: 100 }, () => createAndPersistOption()),
  );

  // Create 50 shared upcharges
  const upcharges = await Promise.all(
    Array.from({ length: 50 }, () => createAndPersistUpCharge()),
  );

  // Create 50 MSIs with realistic links
  for (let i = 0; i < 50; i++) {
    const msi = await createAndPersistMSI({
      category: faker.helpers.arrayElement(categories),
      options: faker.helpers.arrayElements(options, { min: 3, max: 10 }),
      upcharges: faker.helpers.arrayElements(upcharges, { min: 1, max: 5 }),
    });
  }

  console.log('Seeded dev price guide data');
}

// Run with: pnpm seed:dev
```

---

## Coverage Requirements

### Strict Enforcement

- PR checks fail if coverage drops below 80%
- Coverage measured per-package (api, web, shared)
- All new code must include tests

### Coverage Reports

```bash
pnpm test:coverage
# Generates HTML report in coverage/index.html
```

### Excluded from Coverage

- Entity definition files (boilerplate)
- Migration seed scripts
- Development utilities

---

## Continuous Integration

### GitHub Actions Configuration

```yaml
name: Tests

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: pnpm install

      - name: Run linting
        run: pnpm lint

      - name: Run unit tests
        run: pnpm test:unit

      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Check coverage
        run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Test Commands

```bash
# Run all tests
pnpm test

# Run specific layer
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:migration

# Run with coverage
pnpm test:coverage

# Run in watch mode (development)
pnpm test:watch

# Run E2E with UI (debugging)
pnpm test:e2e --ui
```

---

## Related Documentation

- [Implementation Phases](./06-implementation-phases.md) - When testing is set up
- [API Specifications](./03-api-specifications.md) - What to test
- [Migration Strategy](./02-migration-strategy.md) - Migration test focus
