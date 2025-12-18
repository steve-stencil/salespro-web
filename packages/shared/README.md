# @shared/core

## Purpose

This package contains shared TypeScript types, interfaces, and utilities used by the API, web, and any future applications. It provides a single source of truth for common definitions to ensure consistency across the monorepo.

## Structure

```
packages/shared/
├── src/
│   ├── index.ts              # Main exports
│   ├── types/
│   │   ├── api/              # API-specific types
│   │   │   ├── pagination.ts # Pagination types
│   │   │   ├── responses.ts  # Response wrappers
│   │   │   └── index.ts
│   │   ├── auth.ts           # Authentication types
│   │   ├── users.ts          # User, role, office types
│   │   ├── invites.ts        # User invitation types
│   │   ├── company.ts        # Company settings types
│   │   ├── errors.ts         # Error handling types
│   │   └── index.ts          # Re-exports all types
│   └── __tests__/
│       └── index.test.ts     # Package tests
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

Or use path aliases (configured in `tsconfig.base.json`):

```typescript
// These are equivalent:
import type { User } from '@shared/core';
import type { User } from '@shared/types/users';
```

## Usage

### Importing Types

```typescript
// Import from main entry point
import type { LoginRequest, LoginResponse, CurrentUser } from '@shared/core';

// Or import specific modules
import type { Pagination, PaginatedResponse } from '@shared/core';
import type { Role, RoleType, UserListItem } from '@shared/core';

// Error handling utilities (these have runtime code)
import { ErrorCode, getErrorMessage, isRetryableError } from '@shared/core';
```

### Type Categories

#### Authentication Types (`auth.ts`)

```typescript
import type {
  LoginRequest,
  LoginResponse,
  CurrentUser,
  MfaVerifyRequest,
  SessionSource,
  UserType,
} from '@shared/core';
```

#### User Management Types (`users.ts`)

```typescript
import type {
  // Entities
  User,
  UserListItem,
  UserDetail,
  Role,
  RoleBasic,
  RoleType,
  Office,
  UserOfficeAccess,
  PermissionMeta,
  PermissionsByCategory,

  // API Responses
  UsersListResponse,
  UserDetailResponse,
  RolesListResponse,
  PermissionsResponse,
  OfficesListResponse,
  OfficeMutationResponse,

  // API Requests
  CreateRoleRequest,
  UpdateRoleRequest,
  CreateOfficeRequest,
  UsersListParams,
} from '@shared/core';
```

#### Invitation Types (`invites.ts`)

```typescript
import type {
  InviteListItem,
  CreateInviteRequest,
  AcceptInviteRequest,
  ValidateInviteResponse,
} from '@shared/core';
```

#### Company Types (`company.ts`)

```typescript
import type {
  CompanySettings,
  CompanySettingsResponse,
  CompanySettingsUpdate,
} from '@shared/core';
```

#### Pagination Types (`api/pagination.ts`)

```typescript
import type {
  Pagination,
  PaginationParams,
  PaginatedResponse,
} from '@shared/core';
```

#### Error Types (`errors.ts`)

```typescript
import {
  ErrorCode,
  ERROR_MESSAGES,
  getErrorMessage,
  isClientError,
  isServerError,
  isRetryableError,
} from '@shared/core';

import type { ApiError, ErrorResponse } from '@shared/core';
```

## Adding New Shared Types

When adding new shared types:

1. **Identify the domain** - Does it belong to auth, users, invites, company, or a new domain?
2. **Create/update the type file** in `src/types/`
3. **Export from `src/types/index.ts`** if it's a new file
4. **Add JSDoc comments** for all exported types
5. **Update this README** with usage examples

### Guidelines

#### Do

- Define types that are used by both API and web (or multiple apps)
- Keep types simple and focused on data contracts
- Use `type` over `interface` for consistency
- Add JSDoc comments for complex types
- Group related types together in the same file
- Use descriptive names that indicate purpose (e.g., `CreateRoleRequest` vs `RoleInput`)

#### Don't

- Put API-only implementation types here (e.g., Express middleware types)
- Put UI-only types here (e.g., React component props)
- Include runtime code unless absolutely necessary (error helpers are an exception)
- Import from other workspace packages (avoid circular dependencies)
- Duplicate MikroORM entity definitions (those stay in the API)

### Example: Adding a New Domain

```typescript
// src/types/products.ts
import type { Pagination, PaginationParams } from './api/pagination';

/** Product entity */
export type Product = {
  id: string;
  name: string;
  price: number;
  createdAt: string;
};

/** Products list response */
export type ProductsListResponse = {
  products: Product[];
  pagination: Pagination;
};

/** Create product request */
export type CreateProductRequest = {
  name: string;
  price: number;
};

// src/types/index.ts - Add the export
export * from './products';
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

## Dependencies

- **TypeScript** - Type definitions
- **Zod** - Validation schemas (available for shared schemas)
- **Vitest** - Testing framework

## Related

- [API App](../../apps/api/README.md) - Consumes shared types
- [Web App](../../apps/web/README.md) - Consumes shared types
- [Config Package](../config/README.md) - Shared configuration
- [Architecture Docs](../../docs/ARCHITECTURE.md) - System architecture
