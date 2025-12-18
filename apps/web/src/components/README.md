# Components

## Purpose

This folder contains reusable React components for the SalesPro Dashboard. Components are organized by feature domain and shared utilities.

## Structure

### Root Components

| Component             | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `ErrorBoundary.tsx`   | Error boundary for graceful error handling |
| `FrogIcon.tsx`        | Custom frog icon component                 |
| `LeapLogo.tsx`        | Leap brand logo component                  |
| `PermissionGuard.tsx` | Conditional rendering based on permissions |
| `ProtectedRoute.tsx`  | Route wrapper requiring authentication     |
| `Sidebar.tsx`         | Main navigation sidebar                    |

### Feature Folders

#### `offices/`

Office management components:

| Component                  | Purpose                           |
| -------------------------- | --------------------------------- |
| `index.ts`                 | Component exports                 |
| `OfficeCard.tsx`           | Office display card with logo     |
| `OfficeDeleteDialog.tsx`   | Office deletion confirmation      |
| `OfficeEditDialog.tsx`     | Office create/edit form           |
| `OfficeFilters.tsx`        | Office list filtering             |
| `OfficeLogo.tsx`           | Office logo display with fallback |
| `OfficeLogoUpload.tsx`     | Logo upload with drag & drop      |
| `OfficeSettingsDialog.tsx` | Office settings management dialog |

#### `roles/`

Role management components:

| Component              | Purpose                 |
| ---------------------- | ----------------------- |
| `PermissionPicker.tsx` | Permission selection UI |
| `RoleCard.tsx`         | Role display card       |
| `RoleDetailDialog.tsx` | Role details view       |
| `RoleEditDialog.tsx`   | Role create/edit form   |

#### `users/`

User management components:

| Component                 | Purpose                     |
| ------------------------- | --------------------------- |
| `InviteUserModal.tsx`     | User invitation form        |
| `OfficeAccessManager.tsx` | User office assignments     |
| `PendingInvitesList.tsx`  | List of pending invitations |
| `UserEditDialog.tsx`      | User edit form              |
| `UserFilters.tsx`         | User list filtering         |
| `UserTable.tsx`           | User data table             |

## Patterns

### Component Structure

```tsx
import { memo } from 'react';
import { Box, Typography } from '@mui/material';

import type { FC } from 'react';

type MyComponentProps = {
  title: string;
  onAction: () => void;
};

/**
 * MyComponent description.
 */
export const MyComponent: FC<MyComponentProps> = memo(({ title, onAction }) => {
  return (
    <Box>
      <Typography variant="h6">{title}</Typography>
    </Box>
  );
});

MyComponent.displayName = 'MyComponent';
```

### Using PermissionGuard

```tsx
import { PermissionGuard } from '../components/PermissionGuard';

// Show content only if user has permission
<PermissionGuard permission="user:create">
  <Button onClick={handleCreate}>Create User</Button>
</PermissionGuard>

// With fallback content
<PermissionGuard
  permission="admin:access"
  fallback={<Typography>Access denied</Typography>}
>
  <AdminPanel />
</PermissionGuard>

// Multiple permissions (any)
<PermissionGuard anyOf={['user:update', 'admin:access']}>
  <EditButton />
</PermissionGuard>
```

### Using ProtectedRoute

```tsx
import { ProtectedRoute } from '../components/ProtectedRoute';

// In router configuration
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  }
/>

// With permission requirement
<Route
  path="/admin"
  element={
    <ProtectedRoute requiredPermission="admin:access">
      <AdminPage />
    </ProtectedRoute>
  }
/>
```

### Dialog Components

Dialog components follow a consistent pattern:

```tsx
type EditDialogProps = {
  open: boolean;
  onClose: () => void;
  item?: Item; // undefined for create mode
  onSave: (data: ItemData) => Promise<void>;
};

export const ItemEditDialog: FC<EditDialogProps> = ({
  open,
  onClose,
  item,
  onSave,
}) => {
  const isEditMode = !!item;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{isEditMode ? 'Edit Item' : 'Create Item'}</DialogTitle>
      {/* ... */}
    </Dialog>
  );
};
```

## Styling Guidelines

- **Use MUI components** - Never create custom CSS files
- **Use `sx` prop** - For component-specific styling
- **Use theme values** - Never hardcode colors
- **Use MUI icons** - From `@mui/icons-material`

```tsx
// Good
<Box sx={{ p: 2, bgcolor: 'background.paper' }}>
  <Typography color="primary.main">Hello</Typography>
</Box>

// Bad - hardcoded colors
<Box sx={{ padding: '16px', backgroundColor: '#fff' }}>
  <Typography style={{ color: '#26D07C' }}>Hello</Typography>
</Box>
```

## Dependencies

- **MUI** - Component library
- **React Hook Form** - Form management
- **TanStack Query** - Data fetching hooks

## Related

- [Hooks](../hooks/README.md) - Custom hooks used by components
- [Pages](../pages/README.md) - Page-level components
- [Theme](../theme/README.md) - Styling configuration
- [Services](../services/README.md) - API calls
