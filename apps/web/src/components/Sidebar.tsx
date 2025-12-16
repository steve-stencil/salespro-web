/**
 * Sidebar navigation component.
 * Provides navigation links to main sections of the app.
 * Navigation items are filtered based on user permissions.
 */
import BusinessIcon from '@mui/icons-material/Business';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Toolbar from '@mui/material/Toolbar';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useUserPermissions, PERMISSIONS } from '../hooks/usePermissions';

import { LeapLogo } from './LeapLogo';

/** Width of the sidebar drawer */
const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  /** Permission required to see this nav item. If undefined, always shown. */
  permission?: string;
}

/** Navigation items for the sidebar with optional permission requirements */
const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <DashboardIcon />,
    // Dashboard is accessible to all authenticated users
  },
  {
    label: 'Users',
    path: '/users',
    icon: <PeopleIcon />,
    permission: PERMISSIONS.USER_READ,
  },
  {
    label: 'Roles',
    path: '/roles',
    icon: <SecurityIcon />,
    permission: PERMISSIONS.ROLE_READ,
  },
  {
    label: 'Offices',
    path: '/offices',
    icon: <BusinessIcon />,
    permission: PERMISSIONS.OFFICE_READ,
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/**
 * Loading skeleton for navigation items.
 */
function NavItemSkeleton(): React.ReactElement {
  return (
    <ListItem disablePadding sx={{ mb: 0.5 }}>
      <ListItemButton sx={{ borderRadius: 2 }}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Skeleton variant="circular" width={24} height={24} />
        </ListItemIcon>
        <ListItemText>
          <Skeleton variant="text" width={80} />
        </ListItemText>
      </ListItemButton>
    </ListItem>
  );
}

/**
 * Sidebar drawer content component.
 * Contains logo, navigation items, and bottom section.
 * Filters nav items based on user permissions.
 */
function DrawerContent(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();

  /**
   * Filter navigation items based on user permissions.
   */
  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      // If no permission required, show the item
      if (!item.permission) return true;
      // Check if user has the required permission
      return hasPermission(item.permission);
    });
  }, [hasPermission]);

  /**
   * Handle navigation item click.
   */
  function handleNavClick(path: string): void {
    void navigate(path);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo Section */}
      <Toolbar
        sx={{
          display: 'flex',
          justifyContent: 'center',
          py: 2,
        }}
      >
        <LeapLogo size="small" color="primary" />
      </Toolbar>

      <Divider />

      {/* Navigation Items */}
      <List sx={{ flex: 1, px: 1, py: 2 }} data-testid="nav-list">
        {isLoading ? (
          // Show loading skeletons while permissions are loading
          <>
            <NavItemSkeleton />
            <NavItemSkeleton />
            <NavItemSkeleton />
          </>
        ) : (
          visibleNavItems.map(item => {
            const isActive = location.pathname === item.path;

            return (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleNavClick(item.path)}
                  selected={isActive}
                  data-testid={`nav-item-${item.path.slice(1)}`}
                  sx={{
                    borderRadius: 2,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isActive ? 'inherit' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 600 : 400,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })
        )}
      </List>
    </Box>
  );
}

/**
 * Sidebar navigation component.
 * Renders as a persistent drawer on desktop and temporary drawer on mobile.
 */
export function Sidebar({
  mobileOpen,
  onMobileClose,
}: SidebarProps): React.ReactElement {
  return (
    <Box
      component="nav"
      sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      aria-label="main navigation"
    >
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
          },
        }}
      >
        <DrawerContent />
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
        <DrawerContent />
      </Drawer>
    </Box>
  );
}

/**
 * Mobile menu button for toggling the sidebar.
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
