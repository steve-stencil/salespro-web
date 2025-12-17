# Services

## Purpose

This folder contains API service modules that encapsulate HTTP requests to the backend. Services provide a typed interface for interacting with API endpoints and handle request/response formatting.

## Structure

| Service      | Purpose                                                 |
| ------------ | ------------------------------------------------------- |
| `auth.ts`    | Authentication API (login, logout, password reset, MFA) |
| `company.ts` | Company settings API                                    |
| `offices.ts` | Office management API                                   |
| `roles.ts`   | Role and permission API                                 |
| `users.ts`   | User management API                                     |

## Service Reference

### authApi

Authentication and session management.

```typescript
import { authApi } from '../services/auth';

// Login
const response = await authApi.login(email, password, rememberMe);

// Logout
await authApi.logout();

// Get current user
const user = await authApi.getCurrentUser();

// Password reset
await authApi.forgotPassword(email);
await authApi.resetPassword(token, newPassword);

// MFA
await authApi.verifyMfa(code, trustDevice);
```

### usersApi

User CRUD operations.

```typescript
import { usersApi } from '../services/users';

// List users with pagination
const { users, total } = await usersApi.list({ page: 1, limit: 20 });

// Get single user
const user = await usersApi.getById(userId);

// Update user
await usersApi.update(userId, { firstName: 'John' });

// Delete (deactivate) user
await usersApi.delete(userId);

// Invite user
await usersApi.invite({ email, roleId, officeIds });
```

### rolesApi

Role and permission management.

```typescript
import { rolesApi } from '../services/roles';

// List roles
const roles = await rolesApi.list();

// Get current user's permissions
const { permissions } = await rolesApi.getMyPermissions();

// Create role
await rolesApi.create({ name: 'Custom Role', permissions: ['user:read'] });

// Update role
await rolesApi.update(roleId, { permissions: ['user:read', 'user:create'] });

// Delete role
await rolesApi.delete(roleId);
```

### officesApi

Office management.

```typescript
import { officesApi } from '../services/offices';

// List offices
const offices = await officesApi.list();

// Create office
await officesApi.create({ name: 'Main Office', address: '123 Main St' });

// Update office
await officesApi.update(officeId, { name: 'HQ' });

// Delete office
await officesApi.delete(officeId);
```

### companyApi

Company settings.

```typescript
import { companyApi } from '../services/company';

// Get company settings
const company = await companyApi.getCurrent();

// Update company settings
await companyApi.update({ name: 'New Company Name' });
```

## Patterns

### Service Module Structure

```typescript
import { apiClient } from '../lib/api-client';

import type {
  Resource,
  CreateResourceRequest,
  UpdateResourceRequest,
} from '../types/resource';

/**
 * Resource API service.
 */
export const resourceApi = {
  /**
   * List resources with pagination.
   */
  list: async (params: ListParams): Promise<ListResponse<Resource>> => {
    return apiClient.get<ListResponse<Resource>>('/resources', { params });
  },

  /**
   * Get a single resource by ID.
   */
  getById: async (id: string): Promise<Resource> => {
    return apiClient.get<Resource>(`/resources/${id}`);
  },

  /**
   * Create a new resource.
   */
  create: async (data: CreateResourceRequest): Promise<Resource> => {
    return apiClient.post<Resource>('/resources', data);
  },

  /**
   * Update an existing resource.
   */
  update: async (
    id: string,
    data: UpdateResourceRequest,
  ): Promise<Resource> => {
    return apiClient.patch<Resource>(`/resources/${id}`, data);
  },

  /**
   * Delete a resource.
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/resources/${id}`);
  },
};
```

### Using with TanStack Query

Services are typically used through custom hooks with TanStack Query:

```typescript
// In hooks/useResources.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resourceApi } from '../services/resource';

export function useResources() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['resources'],
    queryFn: () => resourceApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: resourceApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });

  return {
    resources: listQuery.data,
    isLoading: listQuery.isLoading,
    create: createMutation,
  };
}
```

### Error Handling

Services throw errors that are handled by the API client interceptors:

```typescript
try {
  await authApi.login(email, password);
} catch (error) {
  // Error is already formatted by interceptor
  // Contains: { message: string, statusCode: number, errors?: ValidationError[] }
}
```

## API Client

All services use the centralized API client from `lib/api-client.ts`:

```typescript
import { apiClient } from '../lib/api-client';

// The client is pre-configured with:
// - Base URL from VITE_API_BASE
// - Credentials: 'include' for cookies
// - Response interceptors for error handling
// - Request interceptors for auth tokens
```

## Dependencies

- **axios** - HTTP client (via apiClient)
- **Types** - Request/response type definitions

## Related

- [API Client](../lib/api-client.ts) - HTTP client configuration
- [Hooks](../hooks/README.md) - Data fetching hooks
- [Types](../types/README.md) - TypeScript type definitions
