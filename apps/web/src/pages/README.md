# Pages

## Purpose

This folder contains page-level React components that correspond to application routes. Pages are the top-level containers that compose layouts, components, and handle page-specific logic.

## Structure

| Page                      | Route               | Purpose                |
| ------------------------- | ------------------- | ---------------------- |
| `AcceptInvitePage.tsx`    | `/invites/:token`   | Accept user invitation |
| `CompanySettingsPage.tsx` | `/settings/company` | Company configuration  |
| `DashboardPage.tsx`       | `/dashboard`        | Main dashboard view    |
| `ForgotPasswordPage.tsx`  | `/forgot-password`  | Password reset request |
| `LoginPage.tsx`           | `/login`            | User authentication    |
| `MfaVerifyPage.tsx`       | `/mfa/verify`       | MFA code verification  |
| `OfficesPage.tsx`         | `/offices`          | Office management      |
| `ResetPasswordPage.tsx`   | `/reset-password`   | Password reset form    |
| `RolesPage.tsx`           | `/roles`            | Role management        |
| `UsersPage.tsx`           | `/users`            | User management        |

## Route Configuration

Routes are defined in `src/router.tsx`. See the router file for the complete route configuration.

### Public Routes (No Auth Required)

- `/login` - Login page
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset with token
- `/invites/:token` - Accept invitation

### Protected Routes (Auth Required)

- `/dashboard` - Main dashboard
- `/users` - User management
- `/roles` - Role management
- `/offices` - Office management
- `/settings/company` - Company settings

### MFA Routes

- `/mfa/verify` - MFA verification (pending MFA state)

## Patterns

### Page Component Structure

```tsx
import { Box, Container, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { usePermissions } from '../hooks/usePermissions';

import type { FC } from 'react';

/**
 * MyPage - Description of what this page does.
 */
export const MyPage: FC = () => {
  const { hasPermission } = usePermissions();
  const { data, isLoading, error } = useQuery({...});

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <Container maxWidth="lg">
      <PageHeader
        title="Page Title"
        action={
          hasPermission('resource:create') && (
            <Button onClick={handleCreate}>Create</Button>
          )
        }
      />
      <DataTable data={data} />
    </Container>
  );
};
```

### Authentication Flow Pages

Login and auth pages follow a specific pattern:

```tsx
export const LoginPage: FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();

  const handleSubmit = async (data: LoginFormData) => {
    const result = await login(data.email, data.password);

    if (result.requiresMfa) {
      navigate('/mfa/verify');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <AuthLayout>
      <LoginForm onSubmit={handleSubmit} isLoading={isLoading} error={error} />
    </AuthLayout>
  );
};
```

### CRUD Management Pages

Management pages (Users, Roles, Offices) follow a consistent pattern:

```tsx
export const ResourcePage: FC = () => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const { items, create, update, delete: remove } = useResource();
  const { hasPermission } = usePermissions();

  return (
    <Container>
      <PageHeader
        title="Resources"
        action={
          hasPermission('resource:create') && (
            <Button onClick={() => setEditDialogOpen(true)}>
              Create Resource
            </Button>
          )
        }
      />

      <ResourceTable items={items} onEdit={setSelectedItem} onDelete={remove} />

      <ResourceEditDialog
        open={editDialogOpen}
        item={selectedItem}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedItem(null);
        }}
        onSave={selectedItem ? update : create}
      />
    </Container>
  );
};
```

## Page Naming Conventions

- `[Feature]Page.tsx` - Main feature pages (UsersPage, RolesPage)
- `[Action][Feature]Page.tsx` - Action-specific pages (AcceptInvitePage)
- `[Auth]Page.tsx` - Authentication pages (LoginPage, MfaVerifyPage)

## Dependencies

- **React Router** - Navigation and routing
- **TanStack Query** - Data fetching
- **MUI** - UI components
- Custom hooks for data management

## Related

- [Components](../components/README.md) - Reusable UI components
- [Hooks](../hooks/README.md) - Data and state hooks
- [Layouts](../layouts/README.md) - Page layouts
- [Router](../router.tsx) - Route configuration
