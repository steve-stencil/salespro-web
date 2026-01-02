/**
 * Smart redirect component for app-aware routing.
 *
 * Redirects users to the appropriate app based on:
 * 1. Last used app (from localStorage)
 * 2. First accessible app (if last used is not accessible)
 * 3. Falls back to /dashboard if nothing else works
 */
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useApps, getLastUsedApp } from '../shared/hooks/useApps';

/**
 * Smart redirect component that routes users to their preferred or first accessible app.
 */
export function SmartRedirect(): React.ReactElement {
  const navigate = useNavigate();
  const { apps, hasAppAccess, isLoading, firstAccessibleApp } = useApps();

  useEffect(() => {
    if (isLoading) return;

    // Check if user had a previously used app
    const lastUsedApp = getLastUsedApp();
    if (lastUsedApp && hasAppAccess(lastUsedApp)) {
      // Navigate to last used app
      const appPath = lastUsedApp === 'dashboard' ? '/dashboard' : '/sales';
      void navigate(appPath, { replace: true });
      return;
    }

    // Navigate to first accessible app
    if (firstAccessibleApp) {
      void navigate(firstAccessibleApp.basePath, { replace: true });
      return;
    }

    // Fallback to dashboard (will show access denied if no permission)
    void navigate('/dashboard', { replace: true });
  }, [isLoading, hasAppAccess, firstAccessibleApp, navigate, apps]);

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
