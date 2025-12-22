/**
 * App switcher component for the unified shell.
 *
 * Displays a dropdown button (similar to Google's app grid) that allows
 * users to switch between available applications based on their permissions.
 */
import AppsIcon from '@mui/icons-material/Apps';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppContext } from '../context/AppContext';
import { useAppAccess } from '../hooks/useAppAccess';

import type { AppInfo } from '../context/AppContext';
import type React from 'react';

// ============================================================================
// Icon Mapping
// ============================================================================

/**
 * Maps app icon names to MUI icon components.
 */
const APP_ICONS: Record<string, React.ReactElement> = {
  Dashboard: <DashboardIcon sx={{ fontSize: 32 }} />,
  PhoneIphone: <PhoneIphoneIcon sx={{ fontSize: 32 }} />,
};

/**
 * Get the icon component for an app.
 */
function getAppIcon(iconName: string): React.ReactElement {
  return APP_ICONS[iconName] ?? <DashboardIcon sx={{ fontSize: 32 }} />;
}

// ============================================================================
// App Card Component
// ============================================================================

type AppCardProps = {
  app: AppInfo;
  isActive: boolean;
  onClick: () => void;
};

/**
 * Individual app card in the switcher grid.
 */
function AppCard({ app, isActive, onClick }: AppCardProps): React.ReactElement {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        p: 1.5,
        borderRadius: 2,
        cursor: 'pointer',
        position: 'relative',
        bgcolor: isActive ? 'action.selected' : 'transparent',
        '&:hover': {
          bgcolor: 'action.hover',
        },
        transition: 'background-color 0.2s ease',
        minWidth: 80,
      }}
      role="button"
      tabIndex={0}
      aria-label={`Switch to ${app.name}`}
      aria-current={isActive ? 'true' : undefined}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Active indicator */}
      {isActive && (
        <CheckCircleIcon
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            fontSize: 16,
            color: 'primary.main',
          }}
        />
      )}

      {/* App icon */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 2,
          bgcolor: isActive ? 'primary.main' : 'action.hover',
          color: isActive ? 'primary.contrastText' : 'text.primary',
        }}
      >
        {getAppIcon(app.icon)}
      </Box>

      {/* App name */}
      <Typography
        variant="caption"
        sx={{
          fontWeight: isActive ? 600 : 400,
          color: isActive ? 'primary.main' : 'text.secondary',
          textAlign: 'center',
        }}
      >
        {app.name}
      </Typography>
    </Box>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

/**
 * Loading skeleton for the app switcher content.
 */
function AppSwitcherSkeleton(): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', gap: 1, p: 1 }}>
      {[1, 2].map(i => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            p: 1.5,
          }}
        >
          <Skeleton variant="rounded" width={48} height={48} />
          <Skeleton variant="text" width={60} />
        </Box>
      ))}
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * App switcher dropdown component.
 *
 * Only renders if user has access to multiple apps.
 * Displays a grid of available apps with the current app highlighted.
 *
 * @example
 * <AppBar>
 *   <Toolbar>
 *     <Typography>My App</Typography>
 *     <Box sx={{ flexGrow: 1 }} />
 *     <AppSwitcher />
 *   </Toolbar>
 * </AppBar>
 */
export function AppSwitcher(): React.ReactElement | null {
  const navigate = useNavigate();
  const { activeApp, setActiveApp } = useAppContext();
  const { availableApps, hasMultipleApps, isLoading } = useAppAccess();

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>): void => {
      setAnchorEl(event.currentTarget);
    },
    [],
  );

  const handleClose = useCallback((): void => {
    setAnchorEl(null);
  }, []);

  const handleAppSelect = useCallback(
    (app: AppInfo): void => {
      setActiveApp(app.id);
      void navigate(app.rootPath);
      handleClose();
    },
    [setActiveApp, navigate, handleClose],
  );

  // Don't render if user only has access to one app (or none)
  if (!isLoading && !hasMultipleApps) {
    return null;
  }

  return (
    <>
      <Tooltip title="Switch app">
        <IconButton
          onClick={handleClick}
          color="inherit"
          aria-label="Switch application"
          aria-controls={open ? 'app-switcher-popover' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          data-testid="app-switcher-button"
        >
          <AppsIcon />
        </IconButton>
      </Tooltip>

      <Popover
        id="app-switcher-popover"
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              borderRadius: 2,
              minWidth: 200,
            },
          },
        }}
      >
        <Paper elevation={0}>
          {/* Header */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              Switch to
            </Typography>
          </Box>

          {/* App Grid */}
          {isLoading ? (
            <AppSwitcherSkeleton />
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                p: 1,
              }}
              role="menu"
              aria-label="Available applications"
            >
              {availableApps.map(app => (
                <AppCard
                  key={app.id}
                  app={app}
                  isActive={activeApp === app.id}
                  onClick={() => handleAppSelect(app)}
                />
              ))}
            </Box>
          )}
        </Paper>
      </Popover>
    </>
  );
}
