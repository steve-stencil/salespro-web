/**
 * Smart redirect component that routes users to the appropriate app
 * based on their permissions.
 *
 * - Users with app:web permission go to /dashboard
 * - Users with only app:mobile permission go to /mobile/contracts
 * - Users with no app permissions see a "No Access" page
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAppAccess } from '../hooks/useAppAccess';
import { useAuth } from '../hooks/useAuth';

import type React from 'react';

/**
 * Storage key for tracking last used app.
 */
const LAST_APP_KEY = 'salespro:lastActiveApp';

/**
 * Page displayed when user has no app access permissions.
 */
function NoAccessPage(): React.ReactElement {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await logout();
      void navigate('/login', { replace: true });
    } catch {
      void navigate('/login', { replace: true });
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        px: 3,
        bgcolor: 'background.default',
      }}
    >
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '4rem', md: '6rem' },
          fontWeight: 700,
          color: 'warning.main',
          mb: 2,
        }}
      >
        No Access
      </Typography>
      <Typography variant="h4" gutterBottom>
        Application Access Required
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 4, maxWidth: 500 }}
      >
        Your account does not have access to any applications. Please contact
        your administrator to request access to the Web Dashboard or Mobile
        Contracts application.
      </Typography>
      <Button
        variant="contained"
        onClick={() => void handleLogout()}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? 'Signing out...' : 'Sign Out'}
      </Button>
    </Box>
  );
}

/**
 * Smart redirect component that determines the best landing page
 * based on user's app permissions and last used app.
 *
 * @example
 * // In router
 * {
 *   path: '/',
 *   element: <SmartRedirect />
 * }
 */
export function SmartRedirect(): React.ReactElement {
  const { hasWebAccess, hasMobileAccess, isLoading, defaultApp } =
    useAppAccess();

  // While loading permissions, show a loading spinner
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress size={48} aria-label="Loading" />
      </Box>
    );
  }

  // No app access at all
  if (!hasWebAccess && !hasMobileAccess) {
    return <NoAccessPage />;
  }

  // Check last used app from localStorage
  const lastApp = localStorage.getItem(LAST_APP_KEY);

  // If user has access to their last used app, go there
  if (lastApp === 'mobile' && hasMobileAccess) {
    return <Navigate to="/mobile/contracts" replace />;
  }

  if (lastApp === 'web' && hasWebAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  // Default to web if available, otherwise mobile
  if (hasWebAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  if (hasMobileAccess) {
    return <Navigate to="/mobile/contracts" replace />;
  }

  // Fallback (should not reach here given the checks above)
  if (defaultApp === 'mobile') {
    return <Navigate to="/mobile/contracts" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
