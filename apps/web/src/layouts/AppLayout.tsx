/**
 * Main application layout component.
 * Provides sidebar navigation and top app bar for authenticated pages.
 */
import LogoutIcon from '@mui/icons-material/Logout';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { MobileMenuButton, Sidebar } from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';

/** Width of the sidebar drawer */
const DRAWER_WIDTH = 240;

/**
 * Main layout wrapper for authenticated pages.
 * Includes sidebar navigation and top app bar with user info.
 */
export function AppLayout(): React.ReactElement {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * Toggle mobile sidebar drawer.
   */
  function handleDrawerToggle(): void {
    setMobileOpen(!mobileOpen);
  }

  /**
   * Handle logout action.
   */
  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await logout();
      void navigate('/login', { replace: true });
    } catch {
      // Error handled in context, still redirect
      void navigate('/login', { replace: true });
    }
  }

  /**
   * Logout button click handler wrapper for void return.
   */
  function onLogoutClick(): void {
    void handleLogout();
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} onMobileClose={handleDrawerToggle} />

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        {/* Top App Bar */}
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Toolbar>
            <MobileMenuButton onClick={handleDrawerToggle} />

            {/* Spacer */}
            <Box sx={{ flexGrow: 1 }} />

            {/* User info and logout */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    width: 32,
                    height: 32,
                    fontSize: '0.875rem',
                  }}
                >
                  {(user?.nameFirst ?? user?.email ?? 'U').charAt(0)}
                </Avatar>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 500, lineHeight: 1.2 }}
                  >
                    {user?.nameFirst} {user?.nameLast}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ lineHeight: 1.2 }}
                  >
                    {user?.company?.name}
                  </Typography>
                </Box>
              </Box>

              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={onLogoutClick}
                disabled={isLoggingOut}
                startIcon={
                  isLoggingOut ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <LogoutIcon />
                  )
                }
                sx={{ minWidth: 'auto' }}
              >
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {isLoggingOut ? 'Logging out...' : 'Log Out'}
                </Box>
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box sx={{ flex: 1, p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
