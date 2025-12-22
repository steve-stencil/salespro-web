/**
 * Permission guard components for protecting routes and UI elements.
 *
 * These components conditionally render children based on user permissions.
 * Note: These are for UX only - backend ALWAYS enforces permissions.
 */
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { Navigate, useNavigate } from 'react-router-dom';

import {
  useUserPermissions,
  useHasPermission,
  useHasAllPermissions,
  useHasAnyPermission,
} from '../hooks/usePermissions';

import type { ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

type PermissionGuardProps = {
  /** Required permission to access the content */
  permission: string;
  /** Content to render if user has permission */
  children: ReactNode;
  /** Optional fallback when permission denied (defaults to redirect or null) */
  fallback?: ReactNode;
  /** Show loading spinner while checking permissions (default: true for routes) */
  showLoading?: boolean;
  /** Redirect to this path if permission denied (for route guards) */
  redirectTo?: string;
};

type MultiPermissionGuardProps = {
  /** Required permissions to access the content */
  permissions: string[];
  /** Content to render if user has permission(s) */
  children: ReactNode;
  /** Optional fallback when permission denied */
  fallback?: ReactNode;
  /** Show loading spinner while checking permissions */
  showLoading?: boolean;
  /** Redirect to this path if permission denied */
  redirectTo?: string;
};

type RequirePermissionProps = {
  /** Permission string required */
  permission: string;
  /** Content to render if authorized */
  children: ReactNode;
};

// ============================================================================
// Loading Component
// ============================================================================

/**
 * Loading spinner for permission checks.
 */
function PermissionLoading(): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
        py: 4,
      }}
      data-testid="permission-loading"
    >
      <CircularProgress />
    </Box>
  );
}

// ============================================================================
// Forbidden Page Component
// ============================================================================

/**
 * Forbidden page displayed when user lacks required permission.
 */
export function ForbiddenPage(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        px: 3,
      }}
      data-testid="forbidden-page"
    >
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '4rem', md: '6rem' },
          fontWeight: 700,
          color: 'error.main',
          mb: 2,
        }}
      >
        403
      </Typography>
      <Typography variant="h4" gutterBottom>
        Access Denied
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 4, maxWidth: 500 }}
      >
        You don&apos;t have permission to access this page. Please contact your
        administrator if you believe this is a mistake.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="contained" onClick={() => void navigate('/')}>
          Go to Home
        </Button>
        <Button variant="outlined" onClick={() => void navigate(-1)}>
          Go Back
        </Button>
      </Box>
    </Box>
  );
}

// ============================================================================
// Permission Guard Components
// ============================================================================

/**
 * Route-level permission guard.
 * Shows loading state, then redirects or shows forbidden page if unauthorized.
 *
 * @example
 * <PermissionGuard permission="role:read" redirectTo="/dashboard">
 *   <RolesPage />
 * </PermissionGuard>
 */
export function PermissionGuard({
  permission,
  children,
  fallback,
  showLoading = true,
  redirectTo,
}: PermissionGuardProps): React.ReactElement | null {
  const { hasPermission, isLoading } = useHasPermission(permission);

  if (isLoading && showLoading) {
    return <PermissionLoading />;
  }

  if (!hasPermission) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}

/**
 * Guard that requires ALL specified permissions.
 *
 * @example
 * <RequireAllPermissions permissions={['role:read', 'role:update']}>
 *   <EditRoleButton />
 * </RequireAllPermissions>
 */
export function RequireAllPermissions({
  permissions,
  children,
  fallback = null,
  showLoading = false,
  redirectTo,
}: MultiPermissionGuardProps): React.ReactElement | null {
  const { hasPermission, isLoading } = useHasAllPermissions(permissions);

  if (isLoading && showLoading) {
    return <PermissionLoading />;
  }

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return null;
  }

  return <>{children}</>;
}

/**
 * Guard that requires ANY of the specified permissions.
 *
 * @example
 * <RequireAnyPermission permissions={['role:create', 'role:update']}>
 *   <ManageRoleButtons />
 * </RequireAnyPermission>
 */
export function RequireAnyPermission({
  permissions,
  children,
  fallback = null,
  showLoading = false,
  redirectTo,
}: MultiPermissionGuardProps): React.ReactElement | null {
  const { hasPermission, isLoading } = useHasAnyPermission(permissions);

  if (isLoading && showLoading) {
    return <PermissionLoading />;
  }

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return null;
  }

  return <>{children}</>;
}

/**
 * Simple permission wrapper that hides content if user lacks permission.
 * Does not show loading state - ideal for UI elements that should appear/disappear.
 *
 * @example
 * <RequirePermission permission="role:create">
 *   <Button>Create Role</Button>
 * </RequirePermission>
 */
export function RequirePermission({
  permission,
  children,
}: RequirePermissionProps): React.ReactElement | null {
  const { hasPermission } = useUserPermissions();

  if (!hasPermission(permission)) {
    return null;
  }

  return <>{children}</>;
}

// ============================================================================
// Alert Components for Inline Permission Errors
// ============================================================================

type PermissionAlertProps = {
  /** Permission that is missing */
  permission: string;
  /** Action that was attempted */
  action?: string;
};

/**
 * Alert component to display when user lacks a specific permission.
 * Useful for inline error messages.
 */
export function PermissionDeniedAlert({
  permission,
  action = 'perform this action',
}: PermissionAlertProps): React.ReactElement {
  return (
    <Alert
      severity="error"
      sx={{ mb: 2 }}
      data-testid="permission-denied-alert"
    >
      You don&apos;t have the required permission ({permission}) to {action}.
      Contact your administrator for access.
    </Alert>
  );
}
