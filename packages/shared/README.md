# @shared/core

## Purpose

This package contains shared TypeScript types, interfaces, and utilities used by both the API and web applications. It provides a single source of truth for common definitions to ensure consistency across the monorepo.

## Structure

```
packages/shared/
├── src/
│   ├── index.ts          # Main exports
│   ├── types/
│   │   └── errors.ts     # Error type definitions
│   └── __tests__/
│       └── index.test.ts # Package tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Installation

This package is available as `@shared/core` within the monorepo:

```json
{
  "dependencies": {
    "@shared/core": "workspace:*"
  }
}
```

## Usage

### Importing Types

```typescript
import type { ApiError, ValidationError } from '@shared/core';
```

### Error Types

The package exports standardized error types used across API and web:

```typescript
import type { ApiError, ErrorResponse, ValidationError } from '@shared/core';

// ApiError - Standard error response from the API
type ApiError = {
  message: string;
  statusCode: number;
  code?: string;
};

// ValidationError - Field-level validation errors
type ValidationError = {
  field: string;
  message: string;
};

// ErrorResponse - Complete error response shape
type ErrorResponse = {
  error: ApiError;
  errors?: ValidationError[];
};
```

## Adding New Shared Types

When adding new shared types:

1. Create the type definition in the appropriate file under `src/types/`
2. Export it from `src/index.ts`
3. Add tests if the type includes validation logic
4. Update this README with documentation

### Example: Adding a New Type

```typescript
// src/types/pagination.ts
export type PaginationParams = {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// src/index.ts
export type { PaginationParams, PaginatedResponse } from './types/pagination';
```

## Development

### Building

```bash
# From monorepo root
pnpm --filter @shared/core build

# Or from this directory
pnpm build
```

### Testing

```bash
# From monorepo root
pnpm --filter @shared/core test

# Or from this directory
pnpm test
```

### Type Checking

```bash
pnpm --filter @shared/core typecheck
```

## Best Practices

### Do

- Define types that are used by both API and web
- Keep types simple and focused
- Use `type` over `interface` for consistency
- Export types with the `type` keyword for type-only imports
- Add JSDoc comments for complex types

### Don't

- Put API-specific types here (put them in `apps/api`)
- Put UI-specific types here (put them in `apps/web`)
- Include runtime code unless absolutely necessary
- Import from other workspace packages (avoid circular dependencies)

## Dependencies

- **TypeScript** - Type definitions
- **Vitest** - Testing framework

## Related

- [API App](../../apps/api/README.md) - Consumes shared types
- [Web App](../../apps/web/README.md) - Consumes shared types
- [Config Package](../config/README.md) - Shared configuration
