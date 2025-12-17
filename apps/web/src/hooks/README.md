# Hooks

## Purpose

This folder contains custom React hooks that encapsulate reusable stateful logic. Hooks provide a clean interface for components to interact with APIs, manage state, and handle side effects.

## Structure

| Hook                | Purpose                            |
| ------------------- | ---------------------------------- |
| `useAuth.ts`        | Authentication context access      |
| `useApiError.ts`    | API error handling utilities       |
| `useOffices.ts`     | Office data fetching and mutations |
| `usePermissions.ts` | Permission checking utilities      |
| `useRoles.ts`       | Role data fetching and mutations   |
| `useUsers.ts`       | User data fetching and mutations   |

## Hook Reference

### useAuth

Access authentication state and methods.

```tsx
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <LoginPrompt />;

  return (
    <div>
      <p>Welcome, {user.firstName}!</p>
      <Button onClick={logout}>Logout</Button>
    </div>
  );
}
```

### usePermissions

Check user permissions in components.

```tsx
import { usePermissions } from '../hooks/usePermissions';

function AdminPanel() {
  const { hasPermission, hasAnyPermission, permissions } = usePermissions();

  // Check single permission
  const canCreateUser = hasPermission('user:create');

  // Check any of multiple permissions
  const canManageUsers = hasAnyPermission(['user:update', 'user:delete']);

  // Check wildcard permissions
  const isAdmin = hasPermission('*');

  return (
    <div>
      {canCreateUser && <CreateUserButton />}
      {canManageUsers && <UserManagement />}
    </div>
  );
}
```

### useUsers

Fetch and manage user data with TanStack Query.

```tsx
import { useUsers } from '../hooks/useUsers';

function UserList() {
  const {
    users,
    isLoading,
    error,
    pagination,
    setPage,
    updateUser,
    deleteUser,
  } = useUsers({
    page: 1,
    limit: 20,
    search: '',
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <>
      <UserTable users={users} onUpdate={updateUser} onDelete={deleteUser} />
      <Pagination {...pagination} onChange={setPage} />
    </>
  );
}
```

### useRoles

Fetch and manage role data.

```tsx
import { useRoles } from '../hooks/useRoles';

function RoleManager() {
  const { roles, isLoading, createRole, updateRole, deleteRole } = useRoles();

  const handleCreate = async (data: CreateRoleData) => {
    await createRole.mutateAsync(data);
  };

  return (
    <RoleList
      roles={roles}
      onEdit={updateRole.mutate}
      onDelete={deleteRole.mutate}
    />
  );
}
```

### useOffices

Fetch and manage office data.

```tsx
import { useOffices } from '../hooks/useOffices';

function OfficeManager() {
  const { offices, isLoading, createOffice, updateOffice, deleteOffice } =
    useOffices();

  return (
    <OfficeGrid
      offices={offices}
      onCreate={createOffice.mutate}
      onUpdate={updateOffice.mutate}
      onDelete={deleteOffice.mutate}
    />
  );
}
```

### useApiError

Handle API errors consistently.

```tsx
import { useApiError } from '../hooks/useApiError';

function MyComponent() {
  const { handleError, clearError, error } = useApiError();

  const handleSubmit = async (data: FormData) => {
    try {
      await apiClient.post('/endpoint', data);
    } catch (err) {
      handleError(err); // Extracts error message, shows toast
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert severity="error">{error}</Alert>}
      {/* form fields */}
    </form>
  );
}
```

## Patterns

### Creating a Data Hook with TanStack Query

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resourceApi } from '../services/resource';

export function useResource(id: string) {
  const queryClient = useQueryClient();

  // Fetch query
  const { data, isLoading, error } = useQuery({
    queryKey: ['resource', id],
    queryFn: () => resourceApi.getById(id),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: resourceApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource', id] });
    },
  });

  return {
    resource: data,
    isLoading,
    error,
    update: updateMutation,
  };
}
```

### Hook Naming Conventions

- `use[Resource]` - Data fetching hooks (useUsers, useRoles)
- `use[Feature]` - Feature-specific logic (useAuth, usePermissions)
- `use[Utility]` - Utility hooks (useApiError, useDebounce)

## Dependencies

- **TanStack Query** - Data fetching and caching
- **React Context** - State sharing (AuthContext)

## Related

- [Services](../services/README.md) - API client methods
- [Context](../context/README.md) - React contexts
- [Components](../components/README.md) - UI components using hooks
