/**
 * Sidebar navigation component.
 * Provides navigation links to main sections of the app.
 * Navigation items are filtered based on user permissions.
 */
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BuildIcon from '@mui/icons-material/Build';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InventoryIcon from '@mui/icons-material/Inventory';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import SyncIcon from '@mui/icons-material/Sync';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
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
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useUserPermissions, PERMISSIONS } from '../hooks/usePermissions';

import { LeapLogo } from './LeapLogo';

/** Width of the sidebar drawer */
const DRAWER_WIDTH = 240;

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  /** Permission required to see this nav item. If undefined, always shown. */
  permission?: string;
};

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

/** Price Guide navigation items - shown in expandable section */
const PRICE_GUIDE_NAV_ITEMS: NavItem[] = [
  {
    label: 'Catalog',
    path: '/price-guide',
    icon: <InventoryIcon />,
    permission: PERMISSIONS.PRICE_GUIDE_READ,
  },
  {
    label: 'Library',
    path: '/price-guide/library',
    icon: <LibraryBooksIcon />,
    permission: PERMISSIONS.PRICE_GUIDE_READ,
  },
  {
    label: 'Categories',
    path: '/price-guide/categories',
    icon: <CategoryIcon />,
    permission: PERMISSIONS.PRICE_GUIDE_READ,
  },
  {
    label: 'Tools',
    path: '/price-guide/tools',
    icon: <BuildIcon />,
    permission: PERMISSIONS.PRICE_GUIDE_UPDATE,
  },
  {
    label: 'Migration',
    path: '/price-guide/migration',
    icon: <StorageIcon />,
    permission: PERMISSIONS.PRICE_GUIDE_CREATE,
  },
];

/** Admin navigation items - shown in a separate section */
const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Company Settings',
    path: '/admin/settings',
    icon: <SettingsIcon />,
    permission: PERMISSIONS.COMPANY_UPDATE,
  },
  {
    label: 'Data Migration',
    path: '/admin/data-migration',
    icon: <SyncIcon />,
    permission: PERMISSIONS.DATA_MIGRATION,
  },
];

/** Platform navigation items - for internal users only */
const PLATFORM_NAV_ITEMS: NavItem[] = [
  {
    label: 'Companies',
    path: '/platform/companies',
    icon: <BusinessIcon />,
    permission: PERMISSIONS.PLATFORM_VIEW_COMPANIES,
  },
  {
    label: 'Internal Users',
    path: '/platform/internal-users',
    icon: <PeopleIcon />,
    permission: PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS,
  },
  {
    label: 'Platform Roles',
    path: '/platform/roles',
    icon: <SecurityIcon />,
    permission: PERMISSIONS.PLATFORM_ADMIN,
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
 * Filters nav items based on user permissions.
 */
function DrawerContent(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();
  const [priceGuideOpen, setPriceGuideOpen] = useState(
    location.pathname.startsWith('/price-guide'),
  );

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
   * Filter price guide navigation items based on user permissions.
   */
  const visiblePriceGuideItems = useMemo(() => {
    return PRICE_GUIDE_NAV_ITEMS.filter(item => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    });
  }, [hasPermission]);

  /**
   * Filter admin navigation items based on user permissions.
   */
  const visibleAdminItems = useMemo(() => {
    return ADMIN_NAV_ITEMS.filter(item => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    });
  }, [hasPermission]);

  /**
   * Filter platform navigation items based on user permissions.
   */
  const visiblePlatformItems = useMemo(() => {
    return PLATFORM_NAV_ITEMS.filter(item => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    });
  }, [hasPermission]);

  /**
   * Handle navigation item click.
   */
  function handleNavClick(path: string): void {
    void navigate(path);
  }

  /**
   * Toggle price guide submenu.
   */
  function handlePriceGuideToggle(): void {
    setPriceGuideOpen(prev => !prev);
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

        {/* Price Guide Section */}
        {!isLoading && visiblePriceGuideItems.length > 0 && (
          <>
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={handlePriceGuideToggle}
                sx={{
                  borderRadius: 2,
                  bgcolor: location.pathname.startsWith('/price-guide')
                    ? 'action.selected'
                    : undefined,
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                  <InventoryIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Price Guide"
                  primaryTypographyProps={{
                    fontWeight: location.pathname.startsWith('/price-guide')
                      ? 600
                      : 400,
                  }}
                />
                {priceGuideOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </ListItemButton>
            </ListItem>
            <Collapse in={priceGuideOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding sx={{ pl: 2 }}>
                {visiblePriceGuideItems.map(item => {
                  const isActive = location.pathname === item.path;

                  return (
                    <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        onClick={() => handleNavClick(item.path)}
                        selected={isActive}
                        data-testid={`nav-item-${item.path.replace(/\//g, '-').slice(1)}`}
                        sx={{
                          borderRadius: 2,
                          py: 0.75,
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
                            minWidth: 32,
                            color: isActive ? 'inherit' : 'text.secondary',
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                            fontWeight: isActive ? 600 : 400,
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Collapse>
          </>
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
