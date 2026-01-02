/**
 * Google-style app switcher component.
 *
 * Displays a grid of available apps in a popover menu, allowing users
 * to switch between applications they have access to.
 */
import AppsIcon from '@mui/icons-material/Apps';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorefrontIcon from '@mui/icons-material/Storefront';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCurrentAppId } from '../context/AppContext';
import { useApps } from '../hooks/useApps';

import type { AppDefinition } from '@shared/core';

/**
 * Get the icon component for an app based on its icon name.
 */
function getAppIcon(iconName: string): React.ReactElement {
  switch (iconName) {
    case 'dashboard':
      return <DashboardIcon sx={{ fontSize: 32 }} />;
    case 'storefront':
      return <StorefrontIcon sx={{ fontSize: 32 }} />;
    default:
      return <AppsIcon sx={{ fontSize: 32 }} />;
  }
}

type AppTileProps = {
  app: AppDefinition;
  isActive: boolean;
  onClick: () => void;
};

/**
 * Individual app tile in the switcher grid.
 */
function AppTile({ app, isActive, onClick }: AppTileProps): React.ReactElement {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        p: 2,
        minWidth: 80,
        borderRadius: 2,
        border: 'none',
        bgcolor: isActive ? 'action.selected' : 'transparent',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        '&:hover': {
          bgcolor: isActive ? 'action.selected' : 'action.hover',
        },
        '&:focus': {
          outline: 'none',
          bgcolor: 'action.focus',
        },
      }}
    >
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
      <Typography
        variant="caption"
        sx={{
          fontWeight: isActive ? 600 : 400,
          textAlign: 'center',
          color: 'text.primary',
        }}
      >
        {app.name}
      </Typography>
    </Box>
  );
}

/**
 * Loading skeleton for the app switcher.
 */
function AppSwitcherSkeleton(): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 1,
        p: 2,
      }}
    >
      {[1, 2].map(i => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            p: 2,
          }}
        >
          <Skeleton variant="rounded" width={48} height={48} />
          <Skeleton variant="text" width={60} />
        </Box>
      ))}
    </Box>
  );
}

type AppSwitcherProps = {
  /** Size of the trigger button */
  size?: 'small' | 'medium' | 'large';
};

/**
 * App switcher component with popover menu.
 *
 * Displays a grid button that opens a popover showing all apps
 * the user has access to. Clicking an app navigates to it.
 *
 * Only renders if the user has access to multiple apps.
 *
 * @example
 * <AppSwitcher />
 */
export function AppSwitcher({
  size = 'medium',
}: AppSwitcherProps): React.ReactElement | null {
  const navigate = useNavigate();
  const { apps, hasMultipleApps, isLoading } = useApps();
  const currentAppId = useCurrentAppId();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const isOpen = Boolean(anchorEl);

  /**
   * Open the popover.
   */
  function handleOpen(event: React.MouseEvent<HTMLButtonElement>): void {
    setAnchorEl(event.currentTarget);
  }

  /**
   * Close the popover.
   */
  function handleClose(): void {
    setAnchorEl(null);
  }

  /**
   * Navigate to the selected app and close the popover.
   */
  function handleAppClick(app: AppDefinition): void {
    handleClose();
    void navigate(app.basePath);
  }

  // Don't render if user only has access to one app (or none)
  if (!isLoading && !hasMultipleApps) {
    return null;
  }

  return (
    <>
      <Tooltip title="Switch apps">
        <IconButton
          onClick={handleOpen}
          size={size}
          aria-label="Switch applications"
          aria-haspopup="true"
          aria-expanded={isOpen}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <AppsIcon />
        </IconButton>
      </Tooltip>

      <Popover
        open={isOpen}
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
              minWidth: 200,
            },
          },
        }}
      >
        <Paper elevation={0}>
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Apps
            </Typography>
          </Box>

          {isLoading ? (
            <AppSwitcherSkeleton />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns:
                  apps.length > 2 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                gap: 0.5,
                p: 1,
              }}
            >
              {apps.map(app => (
                <AppTile
                  key={app.id}
                  app={app}
                  isActive={currentAppId === app.id}
                  onClick={() => handleAppClick(app)}
                />
              ))}
            </Box>
          )}
        </Paper>
      </Popover>
    </>
  );
}
