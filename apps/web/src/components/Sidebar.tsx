/**
 * Sidebar navigation component.
 * Provides navigation links to main sections of the app.
 * Navigation items are filtered based on user permissions and active app.
 */
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BusinessIcon from '@mui/icons-material/Business';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import DraftsIcon from '@mui/icons-material/Drafts';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
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
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAppContext } from '../context/AppContext';
import { useAppAccess } from '../hooks/useAppAccess';
import { useUserPermissions, PERMISSIONS } from '../hooks/usePermissions';

import { LeapLogo } from './LeapLogo';

import type { AppId } from '../context/AppContext';

/** Width of the sidebar drawer */
const DRAWER_WIDTH = 240;

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  /** Permission required to see this nav item. If undefined, always shown. */
  permission?: string;
  /** Which app this nav item belongs to. If undefined, shown for all apps. */
  app?: AppId;
};

/** Navigation items for the WEB app */
const WEB_NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <DashboardIcon />,
    app: 'web',
  },
  {
    label: 'Users',
    path: '/users',
    icon: <PeopleIcon />,
    permission: PERMISSIONS.USER_READ,
    app: 'web',
  },
  {
    label: 'Roles',
    path: '/roles',
    icon: <SecurityIcon />,
    permission: PERMISSIONS.ROLE_READ,
    app: 'web',
  },
  {
    label: 'Offices',
    path: '/offices',
    icon: <BusinessIcon />,
    permission: PERMISSIONS.OFFICE_READ,
    app: 'web',
  },
];

/** Navigation items for the MOBILE app */
const MOBILE_NAV_ITEMS: NavItem[] = [
  {
    label: 'Contracts',
    path: '/mobile/contracts',
    icon: <DescriptionIcon />,
    app: 'mobile',
  },
  {
    label: 'Drafts',
    path: '/mobile/drafts',
    icon: <DraftsIcon />,
    app: 'mobile',
  },
];

/** Admin navigation items - shown in a separate section (web app only) */
const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Company Settings',
    path: '/admin/settings',
    icon: <SettingsIcon />,
    permission: PERMISSIONS.COMPANY_UPDATE,
    app: 'web',
  },
];

/** Platform navigation items - for internal users only (web app only) */
const PLATFORM_NAV_ITEMS: NavItem[] = [
  {
    label: 'Companies',
    path: '/platform/companies',
    icon: <BusinessIcon />,
    permission: PERMISSIONS.PLATFORM_VIEW_COMPANIES,
    app: 'web',
  },
  {
    label: 'Internal Users',
    path: '/platform/internal-users',
    icon: <PeopleIcon />,
    permission: PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS,
    app: 'web',
  },
  {
    label: 'Platform Roles',
    path: '/platform/roles',
    icon: <SecurityIcon />,
    permission: PERMISSIONS.PLATFORM_ADMIN,
    app: 'web',
  },
];

type SidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

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
 * Filters nav items based on user permissions and active app.
 */
function DrawerContent(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();
  const { activeApp } = useAppContext();
  const { hasWebAccess, hasMobileAccess } = useAppAccess();

  /**
   * Get navigation items for the active app.
   */
  const activeNavItems = useMemo(() => {
    if (activeApp === 'mobile' && hasMobileAccess) {
      return MOBILE_NAV_ITEMS;
    }
    if (activeApp === 'web' && hasWebAccess) {
      return WEB_NAV_ITEMS;
    }
    // Default to web items if user has web access
    if (hasWebAccess) {
      return WEB_NAV_ITEMS;
    }
    // Fall back to mobile if that's all they have
    if (hasMobileAccess) {
      return MOBILE_NAV_ITEMS;
    }
    return [];
  }, [activeApp, hasWebAccess, hasMobileAccess]);

  /**
   * Filter navigation items based on user permissions.
   */
  const visibleNavItems = useMemo(() => {
    return activeNavItems.filter(item => {
      // If no permission required, show the item
      if (!item.permission) return true;
      // Check if user has the required permission
      return hasPermission(item.permission);
    });
  }, [activeNavItems, hasPermission]);

  /**
   * Filter admin navigation items based on user permissions and active app.
   * Admin items are only shown in the web app context.
   */
  const visibleAdminItems = useMemo(() => {
    // Only show admin items in web app context
    if (activeApp !== 'web') return [];
    return ADMIN_NAV_ITEMS.filter(item => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    });
  }, [activeApp, hasPermission]);

  /**
   * Filter platform navigation items based on user permissions and active app.
   * Platform items are only shown in the web app context.
   */
  const visiblePlatformItems = useMemo(() => {
    // Only show platform items in web app context
    if (activeApp !== 'web') return [];
    return PLATFORM_NAV_ITEMS.filter(item => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    });
  }, [activeApp, hasPermission]);

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

      {/* Admin Section - Only shown if user has admin permissions */}
      {!isLoading && visibleAdminItems.length > 0 && (
        <>
          <Divider />
          <Box sx={{ px: 1, py: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                mb: 1,
              }}
            >
              <AdminPanelSettingsIcon
                sx={{ fontSize: 18, color: 'text.secondary' }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={600}
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
              >
                Admin
              </Typography>
            </Box>
            <List disablePadding data-testid="admin-nav-list">
              {visibleAdminItems.map(item => {
                const isActive = location.pathname === item.path;

                return (
                  <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      onClick={() => handleNavClick(item.path)}
                      selected={isActive}
                      data-testid={`nav-item-${item.path.replace(/\//g, '-').slice(1)}`}
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
              })}
            </List>
          </Box>
        </>
      )}

      {/* Platform Section - Only shown if user has platform permissions */}
      {!isLoading && visiblePlatformItems.length > 0 && (
        <>
          <Divider />
          <Box sx={{ px: 1, py: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                mb: 1,
              }}
            >
              <AdminPanelSettingsIcon
                sx={{ fontSize: 18, color: 'warning.main' }}
              />
              <Typography
                variant="caption"
                color="warning.main"
                fontWeight={600}
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
              >
                Platform
              </Typography>
            </Box>
            <List disablePadding data-testid="platform-nav-list">
              {visiblePlatformItems.map(item => {
                const isActive = location.pathname === item.path;

                return (
                  <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      onClick={() => handleNavClick(item.path)}
                      selected={isActive}
                      data-testid={`nav-item-${item.path.replace(/\//g, '-').slice(1)}`}
                      sx={{
                        borderRadius: 2,
                        '&.Mui-selected': {
                          bgcolor: 'warning.main',
                          color: 'warning.contrastText',
                          '&:hover': {
                            bgcolor: 'warning.dark',
                          },
                          '& .MuiListItemIcon-root': {
                            color: 'warning.contrastText',
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
              })}
            </List>
          </Box>
        </>
      )}
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
