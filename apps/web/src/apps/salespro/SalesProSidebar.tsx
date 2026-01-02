/**
 * SalesPro-specific sidebar navigation.
 *
 * Contains navigation links for the SalesPro field sales app.
 * This is the sidebar content used by SalesProLayout.
 */
import AssignmentIcon from '@mui/icons-material/Assignment';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import ReceiptIcon from '@mui/icons-material/Receipt';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { LeapLogo } from '../../components/LeapLogo';
import { useUserPermissions, PERMISSIONS } from '../../hooks/usePermissions';

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  /** Permission required to see this nav item. If undefined, always shown. */
  permission?: string;
};

/** Main navigation items for SalesPro */
const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    path: '/sales',
    icon: <HomeIcon />,
    // Home is accessible to all authenticated users with app:salespro
  },
  {
    label: 'Customers',
    path: '/sales/customers',
    icon: <PersonIcon />,
    permission: PERMISSIONS.CUSTOMER_READ,
  },
  {
    label: 'Quotes',
    path: '/sales/quotes',
    icon: <ReceiptIcon />,
    // Permission to be added later
  },
  {
    label: 'Measure Sheets',
    path: '/sales/measure-sheets',
    icon: <AssignmentIcon />,
    // Permission to be added later
  },
];

/**
 * SalesPro sidebar navigation content.
 *
 * Contains navigation links for the SalesPro field sales app,
 * filtered by user permissions.
 */
export function SalesProSidebar(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();

  /**
   * Filter navigation items based on user permissions.
   */
  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo Section with SalesPro branding */}
      <Toolbar
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 2,
          gap: 0.5,
        }}
      >
        <LeapLogo size="small" color="primary" />
        <Typography
          variant="caption"
          sx={{
            color: 'primary.main',
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          SalesPro
        </Typography>
      </Toolbar>

      <Divider />

      {/* Navigation Items */}
      <List sx={{ flex: 1, px: 1, py: 2 }} data-testid="nav-list">
        {!isLoading &&
          visibleNavItems.map(item => {
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

      {/* Bottom section - placeholder for future quick actions */}
      <Divider />
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Field Sales Application
        </Typography>
      </Box>
    </Box>
  );
}
