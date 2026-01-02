/**
 * Shared AppShell component used by all app layouts.
 *
 * Provides the consistent header with user info, company name, and app switcher.
 * Each app layout supplies its own sidebar content.
 */
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { AppSwitcher } from '../components/AppSwitcher';

import type { ReactNode } from 'react';

/** Width of the sidebar drawer */
export const DRAWER_WIDTH = 240;

type AppShellProps = {
  /** App-specific sidebar content */
  sidebar: ReactNode;
};

/**
 * Mobile menu button for toggling the sidebar drawer.
 */
export function MobileMenuButton({
  onClick,
}: {
  onClick: () => void;
}): React.ReactElement {
  return (
    <IconButton
      color="inherit"
      aria-label="open navigation menu"
      edge="start"
      onClick={onClick}
      sx={{ mr: 2, display: { md: 'none' } }}
    >
      <MenuIcon />
    </IconButton>
  );
}

/**
 * Shared AppShell component.
 *
 * Provides the layout structure with:
 * - Sidebar (content provided by each app)
 * - Header with app switcher, user info, and logout
 * - Main content area (renders Outlet)
 *
 * @example
 * function DashboardLayout() {
 *   return <AppShell sidebar={<DashboardSidebar />} />;
 * }
 */
export function AppShell({ sidebar }: AppShellProps): React.ReactElement {
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
      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
        aria-label="main navigation"
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
            },
          }}
        >
          {sidebar}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
          open
        >
          {sidebar}
        </Drawer>
      </Box>

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
        {/* Top App Bar - SHARED across all apps */}
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

            {/* App Switcher, User info, and Logout */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* App Switcher - only shows if user has multiple apps */}
              <AppSwitcher />

              {/* User info */}
              <Box
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                  ml: 1,
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
                sx={{ minWidth: 'auto', ml: 1 }}
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
