# ETL Query Modules

## Purpose

This folder contains MongoDB query functions for fetching data from the legacy database during ETL operations. Each collection has its own query module for clean separation and maintainability.

## Structure

```
queries/
├── README.md              # This file
├── index.ts               # Re-exports all query modules
├── base.ts                # Connection management & shared utilities
├── user.queries.ts        # User lookups (for company scoping)
└── office.queries.ts      # Office-specific queries
```

## Patterns

### Query Module Template

Each collection query module follows this pattern:

```typescript
/**
 * [Collection] Queries for ETL Operations
 */

import { createPointer, getCollection, parsePointer } from './base';
import { EtlErrorCode, EtlServiceError } from '../types';
import type { Document } from 'mongodb';

// Document type
type Mongo[Collection]Document = Document & {
  _id: string;
  name?: string;
  _p_company?: string;
  _created_at?: Date;
  _updated_at?: Date;
};

// Query for preview (minimal fields)
export async function query[Collection]s(
  sourceCompanyId: string,
  skip = 0,
  limit = 100,
): Promise<PaginatedResult<LegacySource[Collection]>> {
  // Implementation
}

// Count total
export async function count[Collection]s(
  sourceCompanyId: string,
): Promise<number> {
  // Implementation
}

// Query all fields for import
export async function queryAll[Collection]s(
  sourceCompanyId: string,
  skip: number,
  limit: number,
): Promise<RawSource[Collection][]> {
  // Implementation
}

// Query single by ID
export async function query[Collection]ById(
  objectId: string,
): Promise<RawSource[Collection] | null> {
  // Implementation
}
```

### Accessing Document Properties

Due to TypeScript's index signature rules, use bracket notation:

```typescript
// Good
doc['_id'];
doc['name'];
doc['_p_company'];

// Bad (TypeScript error)
doc._id;
doc.name;
```

### Error Handling

Wrap all queries in try-catch and throw `EtlServiceError`:

```typescript
try {
  const collection = await getCollection<MyDoc>('MyCollection');
  // ... query
} catch (error) {
  throw new EtlServiceError(
    `Failed to fetch items: ${error instanceof Error ? error.message : String(error)}`,
    EtlErrorCode.SOURCE_QUERY_FAILED,
  );
}
```

## Shared Utilities (base.ts)

### Connection Management

```typescript
import {
  getCollection,
  closeSourceConnection,
  isSourceConfigured,
} from './base';

// Get typed collection
const collection = await getCollection<MyDocument>('MyCollection');

// Check if configured
if (!isSourceConfigured()) {
  throw new Error('LEGACY_MONGODB_URI not set');
}

// Close on shutdown
await closeSourceConnection();
```

### Pointer Utilities

```typescript
import { parsePointer, createPointer } from './base';

// Parse pointer string to objectId
const companyId = parsePointer('Company$abc123'); // => 'abc123'

// Create pointer string from parts
const pointer = createPointer('Company', 'abc123'); // => 'Company$abc123'
```

### Pagination Helper

```typescript
import { queryWithPagination } from './base';

const result = await queryWithPagination(
  collection,
  { _p_company: companyPointer },
  { skip: 0, limit: 100, sort: { name: 1 } },
  doc => ({ id: doc._id, name: doc.name }),
);
// => { items: [...], total: 123 }
```

## Adding a New Collection

1. Create `[collection].queries.ts` following the template above
2. Define the Mongo document type with all needed fields
3. Implement the four standard query functions
4. Export from `index.ts`
5. Add methods to `SourceClient` in `source-client.ts`

## Dependencies

- **mongodb** - Native MongoDB driver
- **../types** - Shared type definitions and error classes
- **../../../config/env** - Environment configuration

## Related

- `../README.md` - Main ETL documentation
- `../source-client.ts` - Facade that uses these queries
- `../types.ts` - Type definitions for query results
