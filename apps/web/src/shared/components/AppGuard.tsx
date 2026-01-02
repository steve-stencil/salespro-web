/**
 * AppGuard component for app-level permission checks.
 *
 * Protects app routes by checking if the user has permission to access
 * the specified app. Redirects to the first accessible app if denied.
 */
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useApps } from '../hooks/useApps';

import type { AppId } from '@shared/core';
import type { ReactNode } from 'react';

type AppGuardProps = {
  /** The app ID to check access for */
  app: AppId;
  /** Content to render if user has access */
  children: ReactNode;
};

/**
 * Guard component that checks app-level permissions.
 *
 * If the user doesn't have access to the specified app, they are
 * redirected to their first accessible app or shown an access denied message.
 *
 * @example
 * <AppGuard app="dashboard">
 *   <DashboardLayout />
 * </AppGuard>
 */
export function AppGuard({ app, children }: AppGuardProps): React.ReactElement {
  const navigate = useNavigate();
  const { apps, hasAppAccess, isLoading, firstAccessibleApp } = useApps();

  const hasAccess = hasAppAccess(app);

  // Redirect if user doesn't have access
  useEffect(() => {
    if (isLoading) return;

    if (!hasAccess && firstAccessibleApp) {
      // Redirect to first accessible app
      void navigate(firstAccessibleApp.basePath, { replace: true });
    }
  }, [isLoading, hasAccess, firstAccessibleApp, navigate]);

  // Show loading while permissions are being checked
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  // Show access denied if no access and no redirect available
  if (!hasAccess) {
    if (apps.length === 0) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 2,
            p: 4,
          }}
        >
          <Typography variant="h5" color="error">
            Access Denied
          </Typography>
          <Typography color="text.secondary" textAlign="center">
            You don&apos;t have permission to access any applications.
            <br />
            Please contact your administrator for access.
          </Typography>
        </Box>
      );
    }

    // If there's a redirect app but we haven't redirected yet, show loading
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography color="text.secondary">
          Redirecting to {firstAccessibleApp?.name ?? 'available app'}...
        </Typography>
      </Box>
    );
  }

  // User has access, render children
  return <>{children}</>;
}
