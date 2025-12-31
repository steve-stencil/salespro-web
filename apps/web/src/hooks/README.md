# Hooks

## Purpose

This folder contains custom React hooks that encapsulate reusable stateful logic. Hooks provide a clean interface for components to interact with APIs, manage state, and handle side effects.

## Structure

| Hook                   | Purpose                                 |
| ---------------------- | --------------------------------------- |
| `useAuth.ts`           | Authentication context access           |
| `useApiError.ts`       | API error handling utilities            |
| `useCompanies.ts`      | Multi-company access and switching      |
| `useDebouncedValue.ts` | Debounce values for delayed updates     |
| `useOffices.ts`        | Office data fetching and mutations      |
| `useOfficeSettings.ts` | Office settings and logo management     |
| `usePermissions.ts`    | Permission checking utilities           |
| `usePlatform.ts`       | Platform/internal user data and actions |
| `useRoles.ts`          | Role data fetching and mutations        |
| `useTags.ts`           | Tag data fetching and mutations         |
| `useUsers.ts`          | User data fetching and mutations        |

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

### useOfficeSettings

Fetch and manage office settings including logo upload/removal.

```tsx
import {
  useOfficeSettings,
  useUploadLogo,
  useRemoveLogo,
} from '../hooks/useOfficeSettings';

function OfficeSettingsManager({ officeId }: { officeId: string }) {
  // Fetch settings
  const { data, isLoading } = useOfficeSettings(officeId);

  // Upload logo mutation
  const uploadLogo = useUploadLogo();

  // Remove logo mutation
  const removeLogo = useRemoveLogo();

  const handleUpload = async (file: File) => {
    await uploadLogo.mutateAsync({ officeId, file });
  };

  const handleRemove = async () => {
    await removeLogo.mutateAsync(officeId);
  };

  return (
    <div>
      {data?.settings.logo && (
        <img src={data.settings.logo.url} alt="Office logo" />
      )}
      <input type="file" onChange={e => handleUpload(e.target.files![0])} />
      <button onClick={handleRemove}>Remove Logo</button>
    </div>
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

### usePlatform

Manage platform-level data for internal users, including platform roles and internal user management.

```tsx
import {
  usePlatformRolesAdmin,
  useCreatePlatformRole,
  useUpdatePlatformRole,
  useDeletePlatformRole,
  useInternalUsers,
} from '../hooks/usePlatform';

function PlatformRoleManager() {
  // Fetch all platform roles with user counts
  const { data, isLoading } = usePlatformRolesAdmin();

  // Mutations for platform role CRUD
  const createRole = useCreatePlatformRole();
  const updateRole = useUpdatePlatformRole();
  const deleteRole = useDeletePlatformRole();

  const handleCreate = async () => {
    await createRole.mutateAsync({
      name: 'support-readonly',
      displayName: 'Support Read-Only',
      permissions: ['platform:view_companies'],
      companyPermissions: ['customer:read', 'user:read'],
    });
  };

  const handleUpdate = async (roleId: string) => {
    await updateRole.mutateAsync({
      roleId,
      data: { displayName: 'Updated Name' },
    });
  };

  return (
    <div>
      {data?.roles.map(role => (
        <RoleCard
          key={role.id}
          role={role}
          onEdit={() => handleUpdate(role.id)}
          onDelete={() => deleteRole.mutate(role.id)}
        />
      ))}
    </div>
  );
}
```

**Available hooks:**

| Hook                    | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `usePlatformCompanies`  | Fetch companies available to internal user |
| `useInternalUsers`      | List all internal platform users           |
| `useInternalUser`       | Get specific internal user details         |
| `usePlatformRoles`      | List platform roles (for dropdowns)        |
| `usePlatformRolesAdmin` | List platform roles with user counts       |
| `usePlatformRole`       | Get specific platform role details         |
| `useCreatePlatformRole` | Create a new platform role                 |
| `useUpdatePlatformRole` | Update an existing platform role           |
| `useDeletePlatformRole` | Delete a platform role                     |
| `useCreateInternalUser` | Create a new internal user                 |
| `useUpdateInternalUser` | Update an internal user                    |
| `useDeleteInternalUser` | Delete an internal user                    |

### useCompanies

Manage multi-company access, switching, and pinning.

```tsx
import {
  useUserCompanies,
  useSwitchCompany,
  usePinCompany,
} from '../hooks/useCompanies';

function CompanySelector() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  // Fetch companies with search
  const { data, isLoading, isFetching } = useUserCompanies(
    debouncedSearch || undefined,
    true, // enabled
  );

  // Switch active company
  const { switchCompany, isPending } = useSwitchCompany();

  // Pin/unpin companies
  const { pinCompany } = usePinCompany();

  const handleSelect = async (companyId: string) => {
    await switchCompany(companyId);
    // User context is automatically refreshed
  };

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      {data?.results.map(company => (
        <button key={company.id} onClick={() => handleSelect(company.id)}>
          {company.name}
        </button>
      ))}
    </div>
  );
}
```

**Key features:**

- Uses `keepPreviousData` to maintain UI stability during search
- Returns `isFetching` for subtle loading indicators during background updates
- Automatically invalidates queries after company switch

### useTags

Fetch and manage tags for the price guide library.

```tsx
import {
  useTagList,
  useTagDetail,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useAssignTag,
  useUnassignTag,
} from '../hooks/useTags';

function TagManager() {
  // List tags with search
  const { data, isLoading } = useTagList({ search: 'premium' });

  // Create new tag
  const createTag = useCreateTag();
  await createTag.mutateAsync({ name: 'Premium', color: '#4CAF50' });

  // Assign tag to an option
  const assignTag = useAssignTag();
  await assignTag.mutateAsync({
    tagId: 'tag-uuid',
    entityType: 'option',
    entityId: 'option-uuid',
  });

  return <div>{/* Tag list UI */}</div>;
}
```

**Available hooks:**

| Hook             | Purpose                             |
| ---------------- | ----------------------------------- |
| `useTagList`     | Fetch paginated list of tags        |
| `useTagDetail`   | Fetch single tag by ID              |
| `useCreateTag`   | Create a new tag                    |
| `useUpdateTag`   | Update tag name/color/active status |
| `useDeleteTag`   | Delete a tag                        |
| `useAssignTag`   | Assign tag to an entity             |
| `useUnassignTag` | Remove tag from an entity           |

### useDebouncedValue

Debounce a value to delay updates until user stops changing it. Useful for search inputs to reduce API calls.

```tsx
import { useDebouncedValue } from '../hooks/useDebouncedValue';

function SearchInput() {
  const [searchTerm, setSearchTerm] = useState('');
  // Only updates 300ms after user stops typing
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  // API call uses debounced value - fewer requests
  const { data } = useQuery({
    queryKey: ['search', debouncedSearch],
    queryFn: () => api.search(debouncedSearch),
  });

  return (
    <input
      value={searchTerm} // Immediate feedback
      onChange={e => setSearchTerm(e.target.value)}
    />
  );
}
```

**Parameters:**

| Parameter | Type     | Default | Description           |
| --------- | -------- | ------- | --------------------- |
| `value`   | `T`      | -       | The value to debounce |
| `delay`   | `number` | `300`   | Delay in milliseconds |

**Returns:** The debounced value of type `T`

**Use cases:**

- Search inputs (reduce API calls while typing)
- Form validation (validate after user stops typing)
- Window resize handlers (debounce expensive calculations)

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
