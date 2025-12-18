# Development Guide

This guide covers development practices, patterns, and conventions for working with SalesPro Web.

## Development Environment Setup

### Prerequisites

- **Node.js**: >= 20.11.0
- **pnpm**: >= 10.18.1
- **Git**: Latest version
- **PostgreSQL**: >= 16 (local installation or cloud)

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd salespro-web

# Install dependencies
pnpm install

# Set up environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Run database migrations
pnpm db:migrate

# Seed the database
pnpm db:seed

# Start development servers
pnpm dev
```

## Code Organization Patterns

### 1. File Naming Conventions

- **Components**: PascalCase (`UserProfile.tsx`)
- **Hooks**: camelCase with `use` prefix (`useUserData.ts`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Types**: PascalCase (`UserTypes.ts`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINTS.ts`)

### 2. Directory Structure

```
src/
├── components/       # Reusable UI components
│   ├── roles/       # Role management components
│   ├── users/       # User management components
│   └── offices/     # Office management components
├── pages/           # Page components
├── hooks/           # Custom React hooks
├── services/        # API client service modules
├── lib/             # Utility functions and API client
├── types/           # TypeScript type definitions
├── context/         # React context providers
├── theme/           # Theme configuration
└── layouts/         # Layout components
```

### 3. Import Organization

```typescript
// External libraries
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// Internal imports (absolute paths)
import { User } from '@shared/types';
import { validateUser } from '@shared/zod';

// Relative imports
import { UserCard } from './UserCard';
import { useUserData } from '../hooks/useUserData';
```

## API Development Patterns

### 1. Route Organization

```typescript
// apps/api/src/routes/users.ts
import { Router } from 'express';
import { z } from 'zod';
import { User } from '@shared/types';

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

router.post('/', async (req, res) => {
  try {
    const userData = createUserSchema.parse(req.body);
    // Implementation
  } catch (error) {
    // Error handling
  }
});
```

### 2. Error Handling Pattern

```typescript
// apps/api/src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true,
  ) {
    super(message);
  }
}

export const handleError = (error: unknown, res: Response) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      statusCode: error.statusCode,
    });
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);
  return res.status(500).json({
    error: 'Internal server error',
    statusCode: 500,
  });
};
```

### 3. Database Entity Pattern

```typescript
// apps/api/src/entities/User.entity.ts
import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';
import { Company } from './Company.entity';

@Entity()
export class User {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  @Property()
  email!: string;

  @Property()
  firstName!: string;

  @Property()
  lastName!: string;

  @ManyToOne(() => Company)
  company!: Company;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
```

## Frontend Development Patterns

### 1. Component Pattern

```typescript
// apps/web/src/components/UserCard.tsx
import React from 'react';
import { User } from '@shared/types';

interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onEdit }) => {
  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      {onEdit && (
        <button onClick={() => onEdit(user)}>
          Edit
        </button>
      )}
    </div>
  );
};
```

### 2. Custom Hook Pattern

```typescript
// apps/web/src/hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { User } from '../types/users';
import { usersService } from '../services/users';

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: usersService.getUsers,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
```

### 3. API Client Pattern

```typescript
// apps/web/src/lib/api-client.ts
import type { User } from '../types/users';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include', // Required for session cookies
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }
}

export const apiClient = new ApiClient();
```

## Shared Code Patterns

The `@shared/core` package provides types, utilities, and constants shared between the API and web applications.

### 1. Importing Shared Types

```typescript
// Option 1: Import from @shared/core directly
import type { CurrentUser, Role, LoginRequest } from '@shared/core';

// Option 2: Import from local types (re-exports from shared)
import type { User, Role } from '../types/users';
import type { LoginRequest } from '../types/auth';
```

### 2. Type Definitions

The shared package organizes types by domain:

```typescript
// Authentication types (packages/shared/src/types/auth.ts)
import type {
  LoginRequest,
  LoginResponse,
  CurrentUser,
  MfaVerifyRequest,
  SessionSource,
  UserType,
} from '@shared/core';

// User/Role/Office types (packages/shared/src/types/users.ts)
import type {
  UserListItem,
  UserDetail,
  Role,
  RoleType,
  Office,
  CreateRoleRequest,
  UsersListResponse,
} from '@shared/core';

// Pagination types (packages/shared/src/types/api/pagination.ts)
import type { Pagination, PaginationParams } from '@shared/core';
```

### 3. Error Handling Utilities

```typescript
// packages/shared/src/types/errors.ts
import {
  ErrorCode,
  ERROR_MESSAGES,
  getErrorMessage,
  isClientError,
  isServerError,
  isRetryableError,
} from '@shared/core';

import type { ApiError, ErrorResponse } from '@shared/core';

// Usage example
function handleError(error: ApiError): string {
  if (isRetryableError(error)) {
    return 'Please try again in a moment.';
  }
  return getErrorMessage(error);
}
```

### 4. Adding New Shared Types

When adding types that need to be shared between API and web:

1. **Create/update the type file** in `packages/shared/src/types/`
2. **Export from the index** in `packages/shared/src/types/index.ts`
3. **Build the package**: `pnpm --filter @shared/core build`
4. **Re-export in app types** (optional) for backwards compatibility

```typescript
// packages/shared/src/types/products.ts
import type { Pagination } from './api/pagination';

export type Product = {
  id: string;
  name: string;
  price: number;
};

export type ProductsListResponse = {
  products: Product[];
  pagination: Pagination;
};

// packages/shared/src/types/index.ts
export * from './products';
```

### 5. Best Practices for Shared Types

**Do:**

- Define request/response types that are used by both API and web
- Keep types focused on data contracts (no UI or API implementation details)
- Use `type` over `interface` for consistency
- Add JSDoc comments for complex types

**Don't:**

- Put React-specific types in shared (keep those in `apps/web/src/types/`)
- Put Express-specific types in shared (keep those in `apps/api/src/`)
- Include runtime code unless absolutely necessary

## Testing Patterns

### 1. Vitest Configuration

The project uses Vitest as the primary testing framework with TypeScript support. Each package has its own Vitest configuration:

```typescript
// vitest.config.ts (example)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // or 'jsdom' for web
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['**/*.d.ts', '**/node_modules/**', '**/dist/**'],
    },
  },
});
```

### 2. API Testing

```typescript
// apps/api/src/__tests__/users.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server';

describe('Users API', () => {
  beforeEach(() => {
    // Setup test database
  });

  afterEach(() => {
    // Cleanup test data
  });

  it('should create a user', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
    };

    const response = await request(app)
      .post('/api/users')
      .send(userData)
      .expect(201);

    expect(response.body).toMatchObject(userData);
  });

  it('should handle validation errors', async () => {
    const invalidData = {
      name: '',
      email: 'invalid-email',
    };

    const response = await request(app)
      .post('/api/users')
      .send(invalidData)
      .expect(400);

    expect(response.body.error).toBeDefined();
  });
});
```

### 3. Component Testing

```typescript
// apps/web/src/components/__tests__/UserCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserCard } from '../UserCard';
import type { User } from '@shared/types';

const mockUser: User = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UserCard', () => {
  it('should render user information', () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<UserCard user={mockUser} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(mockUser);
  });
});
```

### 4. Unit Testing Utilities

```typescript
// apps/api/src/__tests__/lib/errors.test.ts
import { AppError, errorHandler, formatZod } from '../../lib/errors';
import { ZodError, z } from 'zod';

describe('AppError', () => {
  it('should create an AppError with correct properties', () => {
    const error = new AppError(400, 'BAD_REQUEST', 'Invalid input', {
      field: 'email',
    });

    expect(error.status).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'email' });
  });
});
```

### 5. Testing Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for specific package
pnpm --filter api test
pnpm --filter web test
pnpm --filter shared test
```

### 6. Test Coverage Requirements

- **Minimum Coverage**: 80% for branches, functions, lines, and statements
- **Coverage Reports**: Generated in HTML and LCOV formats
- **Coverage Directory**: `<rootDir>/coverage`
- **Excluded Files**: Type definitions, node_modules, dist, and coverage directories

### 7. Mock Patterns

```typescript
import { vi } from 'vitest';

// Mock external dependencies
vi.mock('@mikro-orm/core', () => ({
  connect: vi.fn(),
  connection: {
    readyState: 0,
  },
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5433/salespro_test';

// Mock API responses
vi.mock('../services', () => ({
  getUsers: vi.fn().mockResolvedValue([]),
  createUser: vi.fn().mockResolvedValue({ id: '1', name: 'Test User' }),
}));
```

### 8. Testing File Upload System

```typescript
// Mock storage adapter for file upload tests
vi.mock('../../lib/storage', () => ({
  getStorageAdapter: vi.fn(() => ({
    upload: vi.fn().mockResolvedValue({
      key: 'test-key',
      size: 1000,
      etag: '"abc123"',
    }),
    download: vi.fn().mockResolvedValue(mockStream),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    getSignedDownloadUrl: vi.fn().mockResolvedValue('https://signed-url'),
    generatePresignedUpload: vi.fn().mockResolvedValue({
      url: 'https://upload-url',
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      expiresAt: new Date(Date.now() + 900000),
    }),
  })),
  isS3Configured: vi.fn().mockReturnValue(true),
  generateStorageKey: vi.fn(
    (companyId, fileId, ext) => `${companyId}/files/${fileId}.${ext}`,
  ),
}));

// Mock thumbnail generation
vi.mock('../../services/file/thumbnail', () => ({
  generateAndUploadThumbnail: vi.fn().mockResolvedValue('thumbnail-key'),
  generateThumbnailAsync: vi.fn().mockResolvedValue(undefined),
}));

// Integration test with file upload
it('should upload a file', async () => {
  const response = await makeRequest()
    .post('/api/files/upload')
    .set('Cookie', authCookie)
    .attach('file', Buffer.from('test'), 'test.pdf');

  expect(response.status).toBe(201);
  expect(response.body.file).toHaveProperty('id');
});
```

## Environment Configuration

### 1. API Environment

```typescript
// apps/api/src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number).default('4000'),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
});

export const env = envSchema.parse(process.env);
```

### 2. Web Environment

```typescript
// apps/web/src/config/env.ts
const env = {
  VITE_API_BASE: import.meta.env.VITE_API_BASE || 'http://localhost:4000/api',
  VITE_NODE_ENV: import.meta.env.VITE_NODE_ENV || 'development',
} as const;

export { env };
```

## Performance Optimization

### 1. API Performance

- **Database indexing** for frequently queried fields
- **Connection pooling** for PostgreSQL
- **Response compression** with Express
- **Caching** for expensive operations

### 2. Frontend Performance

- **Code splitting** with dynamic imports
- **Lazy loading** for routes and components
- **Memoization** with React.memo and useMemo
- **Bundle optimization** with Vite

## Security Best Practices

### 1. API Security

- **Input validation** with Zod schemas
- **CORS configuration** for cross-origin requests
- **Helmet middleware** for security headers
- **Environment variable** validation

### 2. Frontend Security

- **Content Security Policy** headers
- **XSS prevention** through React's built-in protection
- **Environment variable** security
- **HTTPS enforcement** in production

## Debugging and Development Tools

### 1. API Debugging

- **Structured logging** with Pino
- **Request/response** logging middleware
- **Error tracking** and reporting
- **Database query** logging

### 2. Frontend Debugging

- **React DevTools** for component inspection
- **TanStack Query DevTools** for data fetching
- **Vite DevTools** for build optimization
- **Browser DevTools** for performance profiling

## Deployment Considerations

### 1. Environment Variables

- **Development**: Local environment with hot reloading
- **Staging**: Production-like environment for testing
- **Production**: Optimized build with security hardening

### 2. Build Optimization

- **Tree shaking** for unused code elimination
- **Code splitting** for smaller bundle sizes
- **Asset optimization** for images and fonts
- **Caching strategies** for static assets

This development guide provides comprehensive patterns and practices for building robust applications with SalesPro Web.
