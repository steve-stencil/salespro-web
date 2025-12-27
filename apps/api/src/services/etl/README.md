# ETL Services

## Purpose

This folder contains services for ETL (Extract, Transform, Load) operations to migrate data from the legacy MongoDB database into the new SalesPro database schema.

## Structure

```
etl/
├── README.md                 # This file
├── index.ts                  # Public exports
├── types.ts                  # Shared TypeScript types
├── source-client.ts          # Generic utilities (re-exports from queries/)
├── office-etl.service.ts     # Office-specific ETL service
└── queries/
    ├── README.md             # Query module documentation
    ├── index.ts              # Query exports
    ├── base.ts               # Connection & shared utilities
    ├── user.queries.ts       # User lookups (for company scoping)
    └── office.queries.ts     # Office queries
```

## Patterns

### Adding a New Collection

To add ETL support for a new collection (e.g., Customer):

1. **Create query module** (`queries/customer.queries.ts`):

```typescript
import { createPointer, getCollection, parsePointer } from './base';
import { EtlErrorCode, EtlServiceError } from '../types';

type MongoCustomerDocument = Document & {
  _id: string;
  name?: string;
  _p_company?: string;
  // ... other fields
};

export async function queryCustomers(
  sourceCompanyId: string,
  skip = 0,
  limit = 100,
) {
  const collection = await getCollection<MongoCustomerDocument>('Customer');
  const companyPointer = createPointer('Company', sourceCompanyId);
  // ... query implementation
}
```

2. **Export from queries/index.ts**:

```typescript
export { queryCustomers, countCustomers } from './customer.queries';
```

3. **Create ETL service** (`customer-etl.service.ts`):

```typescript
import {
  queryCustomers,
  countCustomers,
  queryAllCustomers,
} from './queries/customer.queries';
import { getSourceCompanyIdByEmail, isSourceConfigured } from './source-client';

export class CustomerEtlService implements BaseEtlService {
  // Import query functions directly - no SourceClient needed
  // Similar structure to OfficeEtlService
}
```

4. **Update route factory** (`routes/migration/index.ts`):

```typescript
function getEtlService(collection: CollectionName, em: EntityManager) {
  switch (collection) {
    case 'offices':
      return new OfficeEtlService(em);
    case 'customers':
      return new CustomerEtlService(em);
  }
}
```

### Company Scoping

All ETL queries are scoped by the user's company in the source system:

1. User's email → Look up in `_User` collection
2. Extract company ID from `_p_company` pointer
3. Filter all queries by `_p_company: Company$<companyId>`

This ensures users can only migrate their own company's data.

### Pointer Format

The legacy MongoDB uses pointer strings for relationships:

```
_p_company: "Company$abc123"
_p_office: "Office$xyz789"
```

Use `parsePointer()` and `createPointer()` utilities:

```typescript
import { parsePointer, createPointer } from './queries';

// Parse: "Company$abc123" → "abc123"
const companyId = parsePointer(doc._p_company);

// Create: "Company" + "abc123" → "Company$abc123"
const pointer = createPointer('Company', companyId);
```

## Dependencies

- **mongodb** - Native MongoDB driver for direct database access
- **@mikro-orm/core** - For persisting migrated entities
- **entities/** - Target entity definitions (Office, MigrationSession, etc.)

## Related

- `routes/migration/` - API routes for migration operations
- `entities/MigrationSession.entity.ts` - Tracks migration progress
- `entities/Office.entity.ts` - Has `sourceId` field for deduplication
