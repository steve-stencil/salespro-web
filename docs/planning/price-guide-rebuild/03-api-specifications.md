# Price Guide Rebuild - API Specifications

[← Back to Index](./00-index.md) | [Data Model →](./01-data-model.md)

---

## Base URL

All routes are prefixed with `/api/price-guide/`.

---

## Route Organization

```
/api/price-guide/
├── /measure-sheet-items     # MSI CRUD + search
├── /categories              # Category tree management
├── /library/
│   ├── /options             # Shared options library
│   ├── /upcharges           # Shared upcharges library
│   └── /additional-details  # Shared fields library
├── /pricing/
│   ├── /options             # Option pricing grid
│   ├── /upcharges           # UpCharge pricing (default + override)
│   ├── /price-types         # Global + custom type management
│   └── /percentage-base     # Percentage base configuration
├── /tools/
│   ├── /mass-price          # Mass price change jobs
│   └── /validation          # Data validation queries
└── /migration/
    ├── /wizard              # 7-step migration orchestration
    └── /preview             # Preview data before migration
```

---

## Measure Sheet Items

### List MSIs (Paginated)

```http
GET /api/price-guide/measure-sheet-items
```

**Query Parameters**:

| Param      | Type   | Description                            |
| ---------- | ------ | -------------------------------------- |
| cursor     | string | Base64 encoded cursor for pagination   |
| limit      | number | Items per page (default: 50, max: 100) |
| search     | string | Full-text search query                 |
| categoryId | string | Filter by category                     |
| officeId   | string | Filter by office visibility            |

**Response**: `CatalogPageDTO`

```typescript
type CatalogPageDTO = {
  items: MeasureSheetItemSummaryDTO[];
  nextCursor?: string;
  hasMore: boolean;
  total: number;
};

type MeasureSheetItemSummaryDTO = {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
    fullPath: string; // "Windows > Double Hung"
  };
  measurementType: MeasurementType;
  officeCount: number;
  optionCount: number;
  upchargeCount: number;
  imageUrl?: string;
  sortOrder: number;
};
```

---

### Get MSI Detail

```http
GET /api/price-guide/measure-sheet-items/:id
```

**Response**: `MeasureSheetItemDetailDTO`

```typescript
type MeasureSheetItemDetailDTO = MeasureSheetItemSummaryDTO & {
  note?: string;
  defaultQty: number;
  showSwitch: boolean;
  formulaId?: string;
  qtyFormula?: string;
  tagTitle?: string;
  tagRequired: boolean;
  tagPickerOptions?: unknown[];
  tagParams?: Record<string, unknown>;
  offices: OfficeDTO[];
  options: LinkedOptionDTO[];
  upcharges: LinkedUpChargeDTO[];
  additionalDetailFields: AdditionalDetailFieldDTO[];
  version: number;
  updatedAt: string;
  lastModifiedBy?: UserDTO;
};

type LinkedOptionDTO = {
  junctionId: string;
  optionId: string;
  name: string;
  brand?: string;
  itemCode?: string;
  sortOrder: number;
  usageCount: number;
  pricing: OfficePricingDTO[];
};

type OfficePricingDTO = {
  officeId: string;
  officeName: string;
  breakdowns: {
    priceType: string;
    priceTypeCode: string;
    amount: number;
  }[];
  total: number;
};
```

---

### Create MSI

```http
POST /api/price-guide/measure-sheet-items
```

**Request Body**: `CreateMSIRequest`

```typescript
type CreateMSIRequest = {
  name: string;
  categoryId: string;
  measurementType: MeasurementType;
  note?: string;
  defaultQty?: number;
  showSwitch?: boolean;
  formulaId?: string;
  qtyFormula?: string;
  tagTitle?: string;
  tagRequired?: boolean;
  tagPickerOptions?: unknown[];
  tagParams?: Record<string, unknown>;
  officeIds: string[];
  optionIds?: string[];
  upchargeIds?: string[];
  additionalDetailFieldIds?: string[];
};
```

**Response**: `MeasureSheetItemDetailDTO`

---

### Update MSI

```http
PUT /api/price-guide/measure-sheet-items/:id
```

**Request Body**: `UpdateMSIRequest`

```typescript
type UpdateMSIRequest = {
  name?: string;
  categoryId?: string;
  measurementType?: MeasurementType;
  note?: string;
  defaultQty?: number;
  showSwitch?: boolean;
  formulaId?: string;
  qtyFormula?: string;
  tagTitle?: string;
  tagRequired?: boolean;
  tagPickerOptions?: unknown[];
  tagParams?: Record<string, unknown>;
  version: number; // Required for optimistic locking
};
```

**Error Response** (version conflict):

```typescript
type ConflictError = {
  error: 'CONCURRENT_MODIFICATION';
  message: string;
  lastModifiedBy: UserDTO;
  lastModifiedAt: string;
  currentVersion: number;
};
```

---

### Delete MSI (Soft Delete)

```http
DELETE /api/price-guide/measure-sheet-items/:id
```

---

### Link/Unlink Options

```http
POST /api/price-guide/measure-sheet-items/:id/options
```

**Request Body**:

```typescript
type LinkOptionsRequest = {
  optionIds: string[];
};
```

**Response**: `LinkResultDTO`

```typescript
type LinkResultDTO = {
  success: boolean;
  linked: number;
  warnings: {
    type: 'missing_pricing';
    message: string;
    offices: string[];
  }[];
};
```

```http
DELETE /api/price-guide/measure-sheet-items/:id/options/:optionId
```

---

### Link/Unlink UpCharges

```http
POST /api/price-guide/measure-sheet-items/:id/upcharges
DELETE /api/price-guide/measure-sheet-items/:id/upcharges/:upchargeId
```

---

### Reorder Options/UpCharges

```http
PUT /api/price-guide/measure-sheet-items/:id/options/order
PUT /api/price-guide/measure-sheet-items/:id/upcharges/order
```

**Request Body**:

```typescript
type ReorderRequest = {
  orderedIds: string[]; // Junction IDs in new order
};
```

---

## Categories

### Get Category Tree

```http
GET /api/price-guide/categories
```

**Response**: `CategoryTreeDTO`

```typescript
type CategoryTreeDTO = {
  categories: CategoryNodeDTO[];
};

type CategoryNodeDTO = {
  id: string;
  name: string;
  depth: number;
  sortOrder: number;
  children: CategoryNodeDTO[];
  msiCount: number;
};
```

---

### Create Category

```http
POST /api/price-guide/categories
```

**Request Body**:

```typescript
type CreateCategoryRequest = {
  name: string;
  parentId?: string; // null = root
};
```

---

### Update Category

```http
PUT /api/price-guide/categories/:id
```

**Request Body**:

```typescript
type UpdateCategoryRequest = {
  name?: string;
  parentId?: string;
  sortOrder?: number;
  version: number;
};
```

---

### Delete Category

```http
DELETE /api/price-guide/categories/:id
```

**Error** if category has MSIs assigned.

---

### Move Category (Reorder)

```http
PUT /api/price-guide/categories/:id/move
```

**Request Body**:

```typescript
type MoveCategoryRequest = {
  newParentId?: string;
  sortOrder: number;
};
```

---

## Library - Options

### List Options

```http
GET /api/price-guide/library/options
```

**Query Parameters**:

| Param  | Type   | Description       |
| ------ | ------ | ----------------- |
| cursor | string | Pagination cursor |
| limit  | number | Items per page    |
| search | string | Full-text search  |

**Response**: `OptionListDTO`

```typescript
type OptionListDTO = {
  items: OptionSummaryDTO[];
  nextCursor?: string;
  hasMore: boolean;
};

type OptionSummaryDTO = {
  id: string;
  name: string;
  brand?: string;
  itemCode?: string;
  usageCount: number; // linkedMsiCount
  hasAllOfficePricing: boolean;
};
```

---

### Get Option Detail

```http
GET /api/price-guide/library/options/:id
```

**Response**: `OptionDetailDTO`

```typescript
type OptionDetailDTO = OptionSummaryDTO & {
  measurementType?: MeasurementType;
  pricing: OfficePricingDTO[];
  usedByMSIs: {
    id: string;
    name: string;
    category: string;
  }[];
  version: number;
  updatedAt: string;
};
```

---

### Create Option

```http
POST /api/price-guide/library/options
```

**Request Body**:

```typescript
type CreateOptionRequest = {
  name: string;
  brand?: string;
  itemCode?: string;
  measurementType?: MeasurementType;
  pricing?: {
    officeId: string;
    priceTypeId: string;
    amount: number;
  }[];
};
```

---

### Update Option

```http
PUT /api/price-guide/library/options/:id
```

**Request Body**:

```typescript
type UpdateOptionRequest = {
  name?: string;
  brand?: string;
  itemCode?: string;
  measurementType?: MeasurementType;
  version: number;
};
```

---

### Delete Option

```http
DELETE /api/price-guide/library/options/:id
```

**Warning** if `usageCount > 0`.

---

## Library - UpCharges

Similar structure to Options with additional fields:

- `note`
- `identifier`
- `disabledOptionIds`

---

### Get UpCharge Disabled Options

```http
GET /api/price-guide/library/upcharges/:id/disabled-options
```

---

### Set UpCharge Disabled Options

```http
PUT /api/price-guide/library/upcharges/:id/disabled-options
```

**Request Body**:

```typescript
type SetDisabledOptionsRequest = {
  optionIds: string[]; // Options this upcharge does NOT apply to
};
```

---

## Library - Additional Detail Fields

```http
GET /api/price-guide/library/additional-details
GET /api/price-guide/library/additional-details/:id
POST /api/price-guide/library/additional-details
PUT /api/price-guide/library/additional-details/:id
DELETE /api/price-guide/library/additional-details/:id
```

---

## Pricing - Options

### Get Option Pricing Grid

```http
GET /api/price-guide/pricing/options/:optionId
```

**Response**: `OptionPricingGridDTO`

```typescript
type OptionPricingGridDTO = {
  optionId: string;
  optionName: string;
  offices: {
    id: string;
    name: string;
  }[];
  priceTypes: {
    id: string;
    code: string;
    name: string;
  }[];
  prices: {
    officeId: string;
    priceTypeId: string;
    amount: number;
  }[];
};
```

---

### Update Option Pricing (Bulk)

```http
PUT /api/price-guide/pricing/options/:optionId
```

**Request Body**:

```typescript
type UpdateOptionPricingRequest = {
  prices: {
    officeId: string;
    priceTypeId: string;
    amount: number;
  }[];
};
```

---

## Pricing - UpCharges

### Get UpCharge Pricing

```http
GET /api/price-guide/pricing/upcharges/:upchargeId
```

**Query Parameters**:

| Param    | Type   | Description                                         |
| -------- | ------ | --------------------------------------------------- |
| optionId | string | Get override for specific option (omit for default) |

**Response**: `UpChargePricingDTO`

```typescript
type UpChargePricingDTO = {
  upchargeId: string;
  upchargeName: string;
  isOverride: boolean;
  optionId?: string;
  optionName?: string;
  offices: OfficeDTO[];
  priceTypes: PriceTypeDTO[];
  prices: {
    officeId: string;
    priceTypeId: string;
    amount: number;
    isPercentage: boolean;
  }[];
  percentageBases: {
    officeId: string;
    priceTypeId: string;
    basePriceTypeIds: string[];
  }[];
};
```

---

### Update UpCharge Pricing (Bulk)

```http
PUT /api/price-guide/pricing/upcharges/:upchargeId
```

**Query Parameters**:

| Param    | Type   | Description                                         |
| -------- | ------ | --------------------------------------------------- |
| optionId | string | Set override for specific option (omit for default) |

**Request Body**:

```typescript
type UpdateUpChargePricingRequest = {
  prices: {
    officeId: string;
    priceTypeId: string;
    amount: number;
    isPercentage: boolean;
  }[];
  percentageBases?: {
    officeId: string;
    priceTypeId: string;
    basePriceTypeIds: string[];
  }[];
};
```

---

## Pricing - Price Types

### List Price Types

```http
GET /api/price-guide/pricing/price-types
```

Returns global types + company-specific custom types.

---

### Create Custom Price Type

```http
POST /api/price-guide/pricing/price-types
```

**Request Body**:

```typescript
type CreatePriceTypeRequest = {
  code: string;
  name: string;
  description?: string;
};
```

---

### Update Price Type

```http
PUT /api/price-guide/pricing/price-types/:id
```

Only allowed for company-specific types (not global).

---

### Delete Price Type

```http
DELETE /api/price-guide/pricing/price-types/:id
```

Only allowed for company-specific types. Fails if in use.

---

## Tools - Mass Price Change

### Create Mass Price Change Job

```http
POST /api/price-guide/tools/mass-price
```

**Request Body**:

```typescript
type CreateMassPriceJobRequest = {
  targetType: 'options' | 'upcharges';
  targetIds: string[];
  operation: {
    type: 'increase' | 'decrease';
    valueType: 'percent' | 'fixed';
    value: number;
  };
  filters?: {
    officeIds?: string[];
    priceTypeIds?: string[];
  };
};
```

**Response**:

```typescript
type MassPriceJobDTO = {
  jobId: string;
  status: 'pending';
  totalRecords: number;
};
```

---

### Get Job Status

```http
GET /api/price-guide/tools/mass-price/:jobId
```

**Response**: `MassPriceJobStatusDTO`

```typescript
type MassPriceJobStatusDTO = {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  errors?: {
    itemId: string;
    message: string;
  }[];
  completedAt?: string;
};
```

---

### List Jobs

```http
GET /api/price-guide/tools/mass-price
```

**Query Parameters**:

| Param  | Type   | Description      |
| ------ | ------ | ---------------- |
| status | string | Filter by status |
| limit  | number | Items per page   |

---

## Tools - Data Validation

### Run Validation

```http
POST /api/price-guide/tools/validation/run
```

**Response**: `ValidationResultDTO`

```typescript
type ValidationResultDTO = {
  checks: {
    name: string;
    passed: boolean;
    count: number;
    items?: {
      id: string;
      name: string;
    }[];
  }[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
};
```

---

## Migration

### Start Migration Wizard

```http
POST /api/price-guide/migration/wizard/start
```

**Response**:

```typescript
type MigrationSessionDTO = {
  sessionId: string;
  currentStep: number;
  steps: MigrationStepDTO[];
};

type MigrationStepDTO = {
  step: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  preview?: {
    itemCount: number;
    description: string;
  };
  progress?: {
    current: number;
    total: number;
  };
  errors?: string[];
};
```

---

### Preview Step

```http
GET /api/price-guide/migration/wizard/:sessionId/preview/:step
```

---

### Execute Step

```http
POST /api/price-guide/migration/wizard/:sessionId/execute/:step
```

---

### Get Migration Status

```http
GET /api/price-guide/migration/wizard/:sessionId
```

---

## Error Handling

### Standard Error Response

```typescript
type ErrorResponse = {
  error: string;
  message: string;
  details?: Record<string, unknown>;
};
```

### Error Codes

| Code                    | HTTP Status | Description               |
| ----------------------- | ----------- | ------------------------- |
| NOT_FOUND               | 404         | Resource not found        |
| VALIDATION_ERROR        | 400         | Invalid request data      |
| CONCURRENT_MODIFICATION | 409         | Optimistic lock conflict  |
| UNAUTHORIZED            | 401         | Not authenticated         |
| FORBIDDEN               | 403         | Not authorized for action |
| INTERNAL_ERROR          | 500         | Unexpected server error   |

---

## Related Documentation

- [Data Model](./01-data-model.md) - Entity definitions
- [UI Specifications](./04-ui-specifications.md) - Frontend usage
- [Implementation Phases](./06-implementation-phases.md) - When routes are built
